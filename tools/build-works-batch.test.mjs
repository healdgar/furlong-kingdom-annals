import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// buildWorks finds a place's builders and carters once per storage tick (its route batch) and keeps them for the
// tick's other carriage bills (#15). Against the original (frozen from cd69fe4) every bill must pay the same people the
// same sums in the same order and note the same wants, inside a batch or not, while the folk change between ticks
// (trades, deaths, households, places without folk, the hungry) and a batch also bills other places.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const frozen="function buildWorks(s,cost,payer,why){ // building work: wages to the masons, carpenters, thatchers and carters of the place (or the nearest that has them); the payer has paid\n  if(!(cost>0)||!s)return;let B=workers_(s,h=>h.tr==='mason'||h.tr==='carpenter'||h.tr==='thatcher'),C=workers_(s,h=>h.tr==='carter');\n  if(!B.length){const U=s._unmet||(s._unmet={});U.mason=(U.mason||0)+cost*0.4;U.carpenter=(U.carpenter||0)+cost*0.35;const o=W.settlements.filter(x=>x!==s&&x.folk).sort((a,c)=>dist2d(a.pos.x,a.pos.z,s.pos.x,s.pos.z)-dist2d(c.pos.x,c.pos.z,s.pos.x,s.pos.z)).find(x=>workers_(x,h=>h.tr==='mason'||h.tr==='carpenter').length);if(o){B=workers_(o,h=>h.tr==='mason'||h.tr==='carpenter'||h.tr==='thatcher');if(!C.length)C=workers_(o,h=>h.tr==='carter');}}\n  if(!B.length)B=workers_(s,()=>true);const H=hungryHands(s),lab=H.length?cost*0.25:0; /* the labourers who dig and carry for the masons: the hungry of the place, hired by the day (#23; paid in coin: works are paid from a purse, and the payer's corn may be the very load being carted) */\n  payAmong(B,(cost-lab)*(C.length?0.75:1),payer,why);if(C.length)payAmong(C,(cost-lab)*0.25,payer,why);if(lab>0)payAmong(H,lab,payer,why);}";
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
const harness=`${line('const dist2d=')}
var W={settlements:[]},LOG=[];function householdsOf(s){return s.households||[];}
function hungryHands(s){return s.hungry.map(i=>s.households[i]?.head).filter(Boolean);}
function transfer(a,b,v,why){LOG.push([a.id,b.id,v,why]);return v;}function acct(x,v){LOG.push(['acct',x,v]);}
${line('function workers_(s,pred){')}
${block('function payAmong(','\nfunction buildWorks(')}
${block('const STORAGE_ROUTE_BATCHES=','\nlet STORAGE_NODE_DIST')}
${line('function storageRouteBatch(s,fn){')}
// the world, played identically in each realm
function apply(op){const S=W.settlements;
  if(op.k==='world'){W.settlements=op.places.map(p=>({...p,households:p.households.map(h=>({head:h.head&&{...h.head}}))}));return;}
  const s=S[op.s];if(op.k==='tr'){const h=s.households[op.h];if(h&&h.head)h.head.tr=op.v;}else if(op.k==='dead'){const h=s.households[op.h];if(h&&h.head)h.head.dead=!h.head.dead;}
  else if(op.k==='add')s.households.push({head:{...op.head}});else if(op.k==='folk')s.folk=s.folk?undefined:[1];else if(op.k==='hungry')s.hungry=op.v;
  else if(op.k==='bills'){const run=()=>{for(const x of op.bills)buildWorks(S[x.t],x.cost,{id:x.payer},x.why);};if(op.batch)storageRouteBatch(s,run);else run();}}
function wants(){return W.settlements.map(s=>s._unmet?[s._unmet.mason,s._unmet.carpenter]:null);}`;
function realm(text){const c=vm.createContext({Math,Map,Set,WeakMap,Infinity,NaN});vm.runInContext(harness+'\n'+text,c);return c;}
test('every bill pays as the original, in a storage tick or out of one',()=>{
  const TR=['mason','carpenter','thatcher','carter','carter','smith','ploughman','merchant',null];let bills=0,batched=0,wanting=0;
  for(let seed=1;seed<=60;seed++){const r=rng(seed*7907),a=realm(frozen),b=realm(block('function buildWorks(','\nfunction levy('));
    let pid=0;const person=()=>({id:'p'+(pid++),tr:TR[Math.floor(r()*TR.length)],dead:r()<.08,role:r()<.06?'priest':null,outlawCampId:r()<.05?1:null});
    const places=Array.from({length:2+Math.floor(r()*7)},(_,i)=>{const households=Array.from({length:Math.floor(r()*14)},()=>({head:r()<.05?null:person()}));
      return {id:'s'+i,pos:{x:Math.floor(r()*40)*50,z:Math.floor(r()*40)*50},folk:r()<.85?[1]:undefined,households,hungry:households.map((_,k)=>k).filter(()=>r()<.3)};});
    const play=op=>{for(const c of [a,b]){c.OP=JSON.parse(JSON.stringify(op));vm.runInContext('apply(OP)',c);}};
    play({k:'world',places});const sizes=places.map(p=>p.households.length);
    for(let step=0;step<120;step++){
      if(r()<.5){const si=Math.floor(r()*places.length),k=r(),h=Math.floor(r()*Math.max(1,sizes[si]));
        if(k<.35)play({k:'tr',s:si,h,v:TR[Math.floor(r()*TR.length)]});else if(k<.55)play({k:'dead',s:si,h});else if(k<.75){play({k:'add',s:si,head:person()});sizes[si]++;}
        else if(k<.85)play({k:'folk',s:si});else play({k:'hungry',s:si,v:Array.from({length:sizes[si]},(_,k)=>k).filter(()=>r()<.3)});}
      const si=Math.floor(r()*places.length),n=1+Math.floor(r()*6),batch=r()<.6,list=[];
      for(let k=0;k<n;k++)list.push({t:r()<.8?si:Math.floor(r()*places.length),cost:r()<.05?0:r()*50,payer:'payer'+Math.floor(r()*3),why:r()<.5?'carriage':'works'});
      play({k:'bills',s:si,batch,bills:list});bills+=n;if(batch)batched+=n;
      assert.equal(vm.runInContext('JSON.stringify(LOG)',b),vm.runInContext('JSON.stringify(LOG)',a),`seed ${seed} step ${step}`);
      assert.equal(vm.runInContext('JSON.stringify(wants())',b),vm.runInContext('JSON.stringify(wants())',a),`wants, seed ${seed} step ${step}`);
      for(const c of [a,b])vm.runInContext('LOG.length=0',c);}
    wanting+=vm.runInContext('wants()',a).filter(Boolean).length;}
  assert.ok(bills>10000&&batched>5000&&wanting>50,`bills ${bills}, in a batch ${batched}, places that wanted masons ${wanting}`);
});
