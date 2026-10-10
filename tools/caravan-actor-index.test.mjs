import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(begin,end)=>{const i=source.indexOf(begin),j=source.indexOf(end,i+begin.length);assert.ok(i>=0&&j>i,begin);return source.slice(i+begin.length,j);};
const rename=(text,from,to)=>text.replace('function '+from+'(','function '+to+'(');

// Frozen from 8980908 before copying the candidate HTML into this private clone.
// These are the exact selectors whose ordering and live checks the index must retain.
const oldDriver=`function driverFor(o,mode,m,d){const tr=mode==='cart'?'carter':'boatman';if(m&&m!=='out'&&m.tr===tr&&!awayNow(m))return m; // a carter who trades on his own account drives his own load
  const ok=h=>h.tr===tr&&!awayNow(h)&&ageYrs(h)<62;let L=heads_(o,ok);if(!L.length&&d)L=heads_(d,ok);return L.length?L[Math.floor(frand()*L.length)]:null;} // a carter of the place; or one from the market the load is going to, come out for it`;
const oldMerchant=`function merchantFor(o,cost,d,unit){let best=null;const half=unit>0?unit:cost*0.5,scan=t=>{if(!t.folk)return;for(const h of householdsOf(t)){const p=h.head;if(!p||p.dead||p.role)continue;const tr=p.tr,w=p.w||0;if((tr==='merchant'||tr==='carter'||tr==='boatman')&&w>half&&(!best||(tr==='merchant'?best.tr!=='merchant'||w>(best.w||0):best.tr!=='merchant'&&w>(best.w||0))))best=p;}};scan(o);if(d&&d!==o)scan(d);return best;} // a merchant of the place, or a dealer of the market the goods will go to, riding out to buy (strangers come only by sea), with the means to buy the load`;

const helper=block('/* CARAVAN_ACTOR_INDEX_BEGIN */','/* CARAVAN_ACTOR_INDEX_END */');
const newDriver=(()=>{const i=source.indexOf('function driverFor(o,mode,m,d,actors){'),j=source.indexOf('\nconst DEALERS=',i);assert.ok(i>=0&&j>i);return source.slice(i,j);})();
const newMerchant=line('function merchantFor(o,cost,d,unit,actors){');
const newLade=(()=>{const i=source.indexOf('function ladeOut(c,o,quiet,actors){'),j=source.indexOf('\nfunction ladeIn(',i);assert.ok(i>=0&&j>i);return source.slice(i,j);})();

function realm(){
  const ctx=vm.createContext({console,Math,Map,Set,Number,Array,Object,Infinity});
  const code=`
    let NOW=0, draws=0, drawsQ=[];
    const STORAGE_TITLE_OUTCOME=null;
    const W={settlements:[]};
    const BEASTS=['horses','cattle','sheep','swine'];
    function day(){return NOW;}
    function ageYrs(p){return p.age;}
    function awayNow(p){return p.away&&day()<p.away.until?p.away:null;}
    function frand(){draws++;return drawsQ.length?drawsQ.shift():0.5;}
    function householdCalls(s){s.householdCalls=(s.householdCalls||0)+1;return s.households||[];}
    const householdsOf=householdCalls;
    function heads_(s,pred){if(!s.folk)return [];const out=[];for(const h of householdsOf(s)){const p=h.head;if(p&&!p.dead&&!p.role&&pred(p))out.push(p);}return out;}
    function purchase(){return 0;}
    function ladeOut(){return null;}
    function driverFor(){return null;}
    function merchantFor(){return null;}
    function price(){return 2;}
    function freight(){return 1;}
    function PL(){return 1;}
    function offer(){}
    function storageCargoOut(){}
    function commodityCreditPurchase(){}
    function life(){}
    function folkName(p){return p.id;}
    ${helper}
    ${newDriver}
    ${newMerchant}
    ${newLade}
    ${rename(oldDriver,'driverFor','driverForOld')}
    ${rename(oldMerchant,'merchantFor','merchantForOld')}
    function actorContext(){return caravanActorIndex();}
    function makePerson(id,tr,w,opts={}){return {id,tr,w,age:opts.age??30,dead:!!opts.dead,role:opts.role||null,away:opts.away||null};}
    function place(id,people,opts={}){return {id,folk:opts.folk===false?undefined:[{}],households:people.map(head=>({head})),stores:{grain:0},_unmet:{},_missQ:{},pos:{x:id,z:0}};}
    function resetDraws(...q){draws=0;drawsQ=q;}
    function resetNow(n){NOW=n;}
    function state(){return {draws,NOW};}
  `;
  vm.runInContext(code,ctx);
  return ctx;
}
const evalIn=(r,src)=>vm.runInContext(src,r);
const ids=(r,expr)=>evalIn(r,expr);

test('actor helper is tick local and lazily keeps household visit order',()=>{
  const r=realm();
  evalIn(r,`const a=place(0,[makePerson('one','merchant',40),makePerson('two','carter',50)]),b=place(1,[makePerson('three','boatman',60)]);W.settlements=[a,b];globalThis.a=a;globalThis.b=b;globalThis.C=actorContext();`);
  assert.equal(ids(r,'a.householdCalls||0'),0,'index creation does not visit a town');
  assert.deepEqual(Array.from(ids(r,'caravanActorHeads(C,a).dealer.map(p=>p.id)')),['one','two']);
  assert.deepEqual(Array.from(ids(r,'caravanActorHeads(C,b).dealer.map(p=>p.id)')),['three']);
  assert.equal(ids(r,'a.householdCalls'),1);assert.equal(ids(r,'b.householdCalls'),1);
  evalIn(r,'caravanActorHeads(C,a)');assert.equal(ids(r,'a.householdCalls'),1,'repeat lookup reuses ordered candidates');
  evalIn(r,'resetNow(1);globalThis.C2=actorContext();caravanActorHeads(C2,a)');
  assert.equal(ids(r,'a.householdCalls'),2,'a new trade pass gets a fresh lazy view');
});

test('indexed dealer selection matches the frozen ranking, threshold and scan order',()=>{
  const cases=[
    // Higher purse among merchants wins; a still richer carter cannot displace one.
    [[['c','carter',500],['m1','merchant',80],['m2','merchant',120]],[],100,100,'m2'],
    // Equal purses retain the first household encountered.
    [[['first','merchant',100],['second','merchant',100]],[],100,50,'first'],
    // The richest eligible merchant may be at the destination.
    [[['origin','merchant',100]],[['dest','merchant',900]],100,50,'dest'],
    // If no origin dealer clears the unit threshold, scan the destination next.
    [[['poor','merchant',9]],[['dest','carter',30]],20,20,'dest'],
    // Equal origin and destination purses keep the origin-first tie.
    [[['origin','merchant',25]],[['dest','merchant',25]],20,20,'origin'],
    // Unit takes precedence over half the full load cost; zero unit falls back to half cost.
    [[['unit-only','merchant',12]],[],100,11,'unit-only'],
    [[['cost-only','merchant',51]],[],100,0,'cost-only'],
  ];
  for(const [op,dp,cost,unit,want] of cases){
    const r=realm();
    evalIn(r,`const o=place(0,${JSON.stringify(op)}.map(x=>makePerson(...x))),d=place(1,${JSON.stringify(dp)}.map(x=>makePerson(...x)));W.settlements=[o,d];globalThis.o=o;globalThis.d=d;globalThis.C=actorContext();`);
    const args=`${cost},d,${unit}`;
    const old=ids(r,`merchantForOld(o,${args})?.id??null`),fresh=ids(r,`merchantFor(o,${args},C)?.id??null`);
    assert.equal(old,want);assert.equal(fresh,old,`${op.map(x=>x[0]).join(',')} -> ${dp.map(x=>x[0]).join(',')}`);
  }
});

test('dealer selection preserves dead and role exclusions but does not reject an away merchant',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[makePerson('dead','merchant',900,{dead:true}),makePerson('role','merchant',800,{role:'justice'}),makePerson('away','merchant',30,{away:{until:50}})]);W.settlements=[o];globalThis.o=o;globalThis.C=actorContext();`);
  assert.equal(ids(r,'merchantFor(o,20,null,20,C)?.id??null'),'away');
  assert.deepEqual(Array.from(ids(r,'caravanActorHeads(C,o).dealer.map(p=>p.id)')),['away']);
});

test('each merchant lookup rereads purses after a prior load changes them',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[makePerson('a','merchant',100),makePerson('b','merchant',90)]);W.settlements=[o];globalThis.o=o;globalThis.C=actorContext();`);
  assert.equal(ids(r,'merchantFor(o,10,null,10,C).id'),'a');
  evalIn(r,'o.households[0].head.w=20');
  assert.equal(ids(r,'merchantFor(o,10,null,10,C).id'),'b');
});

test('indexed selectors match repeated live loads across varied household rolls',()=>{
  let seed=0x91e10da5;const rnd=()=>((seed=Math.imul(seed^seed>>>15,0x2c1b3c6d)+0x297a2d39|0,seed^=seed>>>12,seed=Math.imul(seed,0x297a2d39),(seed^seed>>>15)>>>0)/4294967296);
  const trades=['merchant','carter','boatman','smith',null];
  for(let round=0;round<18;round++){
    const makeRoll=base=>Array.from({length:12},(_,i)=>[`${base}-${i}`,trades[Math.floor(rnd()*trades.length)],Math.floor(rnd()*180),{
      age:[25,61.99,62,75][Math.floor(rnd()*4)],dead:rnd()<0.12,role:rnd()<0.1?'justice':null,
      away:rnd()<0.25?{until:round*20+Math.floor(rnd()*8)}:null,
    }]);
    const origin=makeRoll('o'+round),destination=makeRoll('d'+round),r=realm();
    evalIn(r,`const o=place(0,${JSON.stringify(origin)}.map(x=>makePerson(...x))),d=place(1,${JSON.stringify(destination)}.map(x=>makePerson(...x)));W.settlements=[o,d];globalThis.o=o;globalThis.d=d;NOW=${round*20};globalThis.C=actorContext();`);
    for(let load=0;load<12;load++){
      r.liveChanges=[...origin,...destination].map(()=>({w:Math.floor(rnd()*180),away:rnd()<0.2?{until:round*20+Math.floor(rnd()*9)}:null}));
      evalIn(r,'{let at=0;for(const t of [o,d])for(const h of t.households){const q=liveChanges[at++];if(h.head.tr===\'merchant\'||h.head.tr===\'carter\'||h.head.tr===\'boatman\')h.head.w=q.w;h.head.away=q.away;}}');
      const cost=1+Math.floor(rnd()*220),unit=rnd()<0.2?0:1+Math.floor(rnd()*90);
      assert.equal(ids(r,`merchantFor(o,${cost},d,${unit},C)?.id??null`),ids(r,`merchantForOld(o,${cost},d,${unit})?.id??null`),`merchant round ${round} load ${load}`);
      const draw=rnd();evalIn(r,`resetDraws(${draw})`);const old=ids(r,'driverForOld(o,"cart","out",d)?.id??null'),oldDraws=ids(r,'state().draws');
      evalIn(r,`resetDraws(${draw})`);const fresh=ids(r,'driverFor(o,"cart","out",d,C)?.id??null'),newDraws=ids(r,'state().draws');
      assert.equal(fresh,old,`driver round ${round} load ${load}`);assert.equal(newDraws,oldDraws,`draws round ${round} load ${load}`);
    }
  }
});

test('indexed driver selection matches direct driving, age, absence, fallback and RNG order',()=>{
  const scenarios=[
    {origin:[['own','carter',0,{age:70}],['other','carter',0]],dest:[['dest','carter',0]],m:'own',want:'own',draws:0},
    {origin:[['local','carter',0,{away:{until:20}}]],dest:[['d1','carter',0],['d2','carter',0]],want:'d2',draws:1,q:[0.75]},
    {origin:[['local1','carter',0],['local2','carter',0]],dest:[['dest','carter',0]],want:'local2',draws:1,q:[0.75]},
    {origin:[['old','carter',0,{age:62}]],dest:[['young','carter',0,{age:61.99}]],want:'young',draws:1,q:[0]},
    {origin:[['away','carter',0,{away:{until:20}}]],dest:[],want:null,draws:0},
    {origin:[['cart','carter',0]],dest:[['boat','boatman',0]],mode:'boat',want:'boat',draws:1,q:[0]},
  ];
  for(const s of scenarios){
    const r=realm();
    evalIn(r,`const o=place(0,${JSON.stringify(s.origin)}.map(x=>makePerson(...x))),d=place(1,${JSON.stringify(s.dest)}.map(x=>makePerson(...x)));W.settlements=[o,d];globalThis.o=o;globalThis.d=d;globalThis.C=actorContext();`);
    const mode=s.mode||'cart',m=s.m||'out';evalIn(r,`resetDraws(${(s.q||[]).join(',')})`);
    const expected=ids(r,`driverForOld(o,'${mode}',${m==='out'?'"out"':`o.households.find(h=>h.head.id==='${m}').head`},d)?.id??null`);
    const oldDraws=ids(r,'state().draws');evalIn(r,`resetDraws(${(s.q||[]).join(',')})`);
    const fresh=ids(r,`driverFor(o,'${mode}',${m==='out'?'"out"':`o.households.find(h=>h.head.id==='${m}').head`},d,C)?.id??null`),freshDraws=ids(r,'state().draws');
    assert.equal(expected,s.want);assert.equal(fresh,expected);assert.equal(oldDraws,s.draws);assert.equal(freshDraws,s.draws);
  }
});

test('driver lists are live: departures affect the next draw, and the next tick rebuild sees new households',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[makePerson('first','carter',0),makePerson('second','carter',0)]);W.settlements=[o];globalThis.o=o;globalThis.C=actorContext();`);
  evalIn(r,'resetDraws(0)');assert.equal(ids(r,'driverFor(o,"cart","out",null,C).id'),'first');
  evalIn(r,'o.households[0].head.away={until:10};resetDraws(0)');assert.equal(ids(r,'driverFor(o,"cart","out",null,C).id'),'second');
  evalIn(r,'resetNow(11);o.households.push({head:makePerson("third","carter",0)});C=actorContext();resetDraws(0)');
  assert.equal(ids(r,'driverFor(o,"cart","out",null,C).id'),'first','the returned driver is again available at the new day');
  assert.deepEqual(Array.from(ids(r,'caravanActorHeads(C,o).cart.map(p=>p.id)')),['first','second','third']);
});

test('the optional index falls back when a guarded selector changes',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[makePerson('merchant','merchant',100)]);W.settlements=[o];globalThis.o=o;globalThis.C=actorContext();`);
  assert.equal(ids(r,'C instanceof Map'),true);
  evalIn(r,'heads_=function(s,p){return [];};globalThis.BAD=actorContext()');
  assert.equal(ids(r,'BAD'),null);
  assert.equal(ids(r,'merchantFor(o,10,null,10,BAD)?.id??null'),'merchant');
  evalIn(r,'globalThis.FURLONG_STORAGE_AUDIT_OBSERVER=function(){};globalThis.OBSERVED=actorContext()');
  assert.equal(ids(r,'OBSERVED'),null,'the storage observer keeps the exact live-query path');
});

test('trade pass creates one actor context and threads it to every departure attempt',()=>{
  const i=source.indexOf('function tickTrade(){'),j=source.indexOf('\nfunction tickEconomy(){',i),trade=source.slice(i,j);
  assert.match(trade,/actors=caravanActorIndex\(\)/);
  assert.match(trade,/ladeOut\(c,o,told\.has\(tk\),actors\)/);
});

test('merchant miss still restores stock and records unmet want through ladeOut',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[]),d=place(1,[]);o.stores.grain=4;W.settlements=[o,d];globalThis.o=o;globalThis.c={good:'grain',qty:7,len:10,dest:1,value:14,unit:0.5};globalThis.C=actorContext();`);
  assert.equal(ids(r,'ladeOut(c,o,false,C)'),null);
  assert.equal(ids(r,'o.stores.grain'),11);
  assert.equal(ids(r,'ladeOut.why'),'merchant');
  assert.equal(ids(r,'o._missQ.grain'),7);
  assert.equal(ids(r,'o._unmet.merchant'),3.5);
});

test('driver miss still restores stock, records freight want and increments wait count',()=>{
  const r=realm();
  evalIn(r,`const o=place(0,[makePerson('buyer','merchant',100)]),d=place(1,[]);o.stores.grain=4;W.settlements=[o,d];globalThis.o=o;globalThis.c={good:'grain',qty:7,len:10,dest:1,value:14,unit:0.5};globalThis.C=actorContext();`);
  assert.equal(ids(r,'ladeOut(c,o,false,C)'),null);
  assert.equal(ids(r,'o.stores.grain'),11);
  assert.equal(ids(r,'ladeOut.why'),'driver');
  assert.equal(ids(r,'o._unmet.carter'),ids(r,'freight(o,7,10,"cart")'));
  assert.equal(ids(r,'o._wait.cart'),1);
});

