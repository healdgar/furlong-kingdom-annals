import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// The commodity ledger's selection, quantity and balance-write paths were made allocation-free. A randomized
// differential against the ledger frozen at 0f60c68 proves they return the same rows in the same order, the same
// totals, the same errors and the same daily settlement events for arbitrary operation sequences.
const source=readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */'),end=source.indexOf('/* Runtime adapters for numeric commodity custody. */',start);
assert.ok(start>=0&&end>start);
const load=text=>{const c=vm.createContext({});vm.runInContext(text,c);return c.CommodityBalanceLedger;};
const Candidate=load(source.slice(start,end)),Frozen=load(readFileSync(new URL('./frozen/commodity-balance-core-0f60c68.js',import.meta.url),'utf8'));
const GOODS=['grain','fish','timber','char','tools'],AVAIL=['held','sale','unassigned','transit','market-cleared'],LOCS=['yard','barn','hall','cart','exposed:1'];
const OWNER_IDS=['h1','h2','h3','h4',null,'crown'];
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
function make(Ledger){const owners=new Map(OWNER_IDS.map(id=>[id,id===null||id==='crown'?id:{id}]));
  const K=new Ledger({realmId:1,day:0,ownerId:o=>o==null?'unassigned':typeof o==='string'?o:o.id});
  return {K,owner:id=>owners.get(id)};}
const canon=(v,pair)=>JSON.stringify(v,(k,x)=>typeof x==='number'&&!Number.isFinite(x)?String(x):x instanceof Set?[...x]:x instanceof Map?[...x]:x);
const rowShape=(r,pair)=>({location:r.location,good:r.good,owner:r.owner&&typeof r.owner==='object'?r.owner.id:r.owner,availability:r.availability,qty:r.qty});
function snapshot({K}){return canon({
  facilities:[...K.facilities].map(([id,f])=>[id,f.active,f.capacity,f.transit,[...f.balances].map(([g,os])=>[g,[...os].map(([o,av])=>[o&&typeof o==='object'?o.id:o,[...av]])])]),
  rows:[...K.entries({includeTransit:true})].map(rowShape),
  plain:[...K.entries()].map(rowShape)});}
function run(seed,steps){
  const r=rng(seed),A=make(Frozen),B=make(Candidate),pick=a=>a[Math.floor(r()*a.length)];
  for(const P of [A,B]){P.K.location('yard',{capacity:Infinity,exposed:true});P.K.location('barn',{capacity:60});P.K.location('hall',{capacity:30,goods:['grain','fish','tools']});P.K.location('cart',{capacity:Infinity,transit:true});P.K.location('exposed:1',{capacity:Infinity,exposed:true});}
  const both=fn=>{const out=[];for(const P of [A,B]){try{out.push(canon(fn(P)));}catch(e){out.push('throw:'+e.message);}}assert.equal(out[1],out[0]);return out[0];};
  const selector=()=>{const f={};if(r()<.6)f.owner=pick(OWNER_IDS);if(r()<.6)f.good=pick(GOODS);if(r()<.5)f.availability=pick(AVAIL);if(r()<.25)f.location=pick(LOCS);if(r()<.1)f.includeTransit=true;return f;};
  const withOwners=(P,f)=>{const g={...f};if('owner' in g)g.owner=P.owner(g.owner);return g;};
  for(let i=0;i<steps;i++){
    const op=Math.floor(r()*12),good=pick(GOODS),own=pick(OWNER_IDS),ava=pick(AVAIL),loc=pick(LOCS),q=Math.floor(r()*9)*0.37+(r()<.2?0:0.01);
    if(op<4){const d=r()<.15?-q:q,cause=pick(['seed','production','x']);both(P=>P.K.adjust(loc,good,P.owner(own),ava,d,cause));}
    else if(op===4){const f=selector();both(P=>P.K.consume(withOwners(P,f),q*1.7,'bite'));}
    else if(op===5){const f=selector(),to=pick(OWNER_IDS),opts=r()<.5?{location:pick(LOCS),availability:pick(AVAIL)}:{};both(P=>P.K.transfer(withOwners(P,f),q*2,P.owner(to),opts));}
    else if(op===6){const f=selector();both(P=>[...P.K.entries(withOwners(P,f))].map(rowShape));}
    else if(op===11&&r()<.5)both(P=>(P.K===B.K?[...P.K.entries({exposedOnly:true})]:[...P.K.entries()].filter(x=>P.K.locations.get(x.location)?.exposed)).map(rowShape));
    else if(op===7){const av=r()<.3?undefined:ava,tr=r()<.4;both(P=>[P.K.quantity(P.owner(own),good,av,tr),P.K.quantity(P.owner(own),good,av),P.K.total(good,tr),[...P.K.owners(good,av,tr)].map(o=>o&&typeof o==='object'?o.id:o)]);}
    else if(op===8)both(P=>[P.K.used(loc),P.K.free(loc,good)]);
    else if(op===9){const id=pick(['barn','hall']),cap=20+Math.floor(r()*80);both(P=>P.K.location(id,{capacity:cap}));}
    else if(op===10&&r()<.35)both(P=>P.K.settle(i+1));
    else both(P=>P.K.event('note',null,q,{good}));
    assert.equal(snapshot(B),snapshot(A),`state diverged at step ${i}, seed ${seed}`);
  }
  both(P=>P.K.settle(steps+2));
}
test('optimized ledger matches the frozen 0f60c68 ledger over randomized operation sequences',()=>{for(let seed=1;seed<=20;seed++)run(seed,140);});
test('ranked selection order survives owner churn, reinsertion and mixed availabilities',()=>{
  for(const Ledger of [Frozen,Candidate]){const K=new Ledger({ownerId:o=>String(o)});K.location('a',{capacity:Infinity});K.location('b',{capacity:Infinity});
    K.adjust('b','grain','x','held',1);K.adjust('a','grain','x','sale',2);K.adjust('a','grain','x','held',3);K.adjust('b','grain','x','held',-1);K.adjust('b','grain','x','held',4);
    assert.deepEqual([...K.entries({owner:'x',good:'grain'})].map(r=>r.location+'/'+r.availability+'='+r.qty),['a/sale=2','a/held=3','b/held=4']);
    assert.equal(K.quantity('x','grain'),9);assert.equal(K.quantity('x','grain','held'),7);assert.equal(K.quantity('x','grain','sale'),2);}
});
