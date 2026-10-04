import test from 'node:test';import assert from 'node:assert/strict';
import {moneyFlowGap} from './money-flow.mjs';
function fixture(){const F={},purses={payer:100,buyer:0},api={};const flow=(k,v)=>F[k]=(F[k]||0)+v;
  api.transfer=(from,to,v,why)=>{if(!from){flow('<'+(why||'paid')+'*',v);flow('<>lost',-v);}else if(from==='out')flow('<import',v);else purses[from]-=v;if(to==='out')flow('>export',v);else if(!to)flow('<>lost',v);else purses[to]=(purses[to]||0)+v;return v;};
  api.payAmong=(list,v,payer,why)=>{for(const p of list)api.transfer(payer,p,v/list.length,why);};api.soldiersPay=(host,v,payer)=>api.payAmong(host,v,payer,'hosts');
  const flows=()=>({...F}),sum=()=>Object.values(purses).reduce((a,b)=>a+b,0);
  return {api,F,purses,flows,sum};}
for(const [name,run,expectedResidual]of [
  ['ordinary internal transfer',f=>f.api.transfer('payer','buyer',7),0],
  ['external inflow',f=>f.api.transfer('out','buyer',7),0],
  ['external outflow',f=>f.api.transfer('payer','out',7),0],
  ['unfunded null payout is detected',f=>f.api.transfer(null,'buyer',7,'gift'),7],
  ['genuine loss',f=>f.api.transfer('payer',null,7),0],
  ['prepaid pass-through',f=>{f.purses.payer-=7;f.api.payAmong(['buyer'],7,null);},0],
  ['prepaid soldier wages',f=>{f.purses.payer-=7;f.api.soldiersPay(['buyer'],7,null);},0],
  ['spoils distribute existing looted coin',f=>{f.purses.payer-=7;f.api.payAmong(['buyer'],7,null,'spoils');},0],
  ['missing upstream debit remains detectable',f=>f.api.payAmong(['buyer'],7,null),7],
  ['omitted recipient purse remains detectable',f=>{f.purses.payer-=7;f.api.payAmong(['buyer'],7,null);delete f.purses.buyer;},-7],
])test(name,()=>{const f=fixture(),before=f.sum(),flows=f.flows();run(f);assert.equal(f.sum()-before-moneyFlowGap(flows,f.flows()).expect,expectedResidual);});
test('diagnostics retain minted and prepaid distinctions',()=>{const f=fixture();f.purses.payer-=7;f.api.payAmong(['buyer'],7,null);const g=moneyFlowGap({},f.flows());assert.equal(g.prepaid,7);assert.equal(g.mintT,7);assert.equal(g.expect,0);});
test('prepaid null recipient preserves the actual lost-coin outflow',()=>{const f=fixture(),before=f.sum();f.purses.payer-=7;f.api.transfer(null,null,7,'paid');assert.equal(f.sum()-before,-7);assert.equal(moneyFlowGap({},f.flows()).expect,-7);});
