import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function realm(house=0){
  const C=vm.createContext({W:{player:{on:true,house},houses:[{name:'Crown'},{name:'Lord',dues:1},{name:'Rival',dues:1}],settlements:[{name:'Royal town',owner:0},{name:'Our town',owner:1},{name:'Rival town',owner:2}]},MOD:{tax:12},document:{body:{classList:{contains:()=>false}}},day:()=>10,esc:s=>String(s),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),houseDetailHTML:()=>'<p>House ledger</p>',contextUI:{expanded:true},cbtn:(c,a,l)=>`<button data-cmd="${c}" data-arg="${a}">${l}</button>`});
  vm.runInContext('let JOURNAL=[],REPLAYING=false;'+['sovOn','plyH','crownOn','lordOn','jot','applySetting','setRulerRate','rulerRateInput','rulerRevenueHTML','rulerGovernanceHTML','crownSections'].map(fn).join('\n'),C);
  return C;
}
test('Crown tax adjustments are immediate, bounded and coalesced, with no household mutation',()=>{
  const C=realm();const before=JSON.stringify(C.W);vm.runInContext("setRulerRate('tax',19);setRulerRate('tax',21);setRulerRate('tax',21)",C);
  assert.equal(C.MOD.tax,21);assert.equal(JSON.stringify(C.W),before);assert.equal(vm.runInContext('JOURNAL.length',C),1);assert.equal(vm.runInContext('JOURNAL[0].v',C),21);
  assert.equal(vm.runInContext("setRulerRate('tax',100)",C),30);assert.equal(vm.runInContext("setRulerRate('tax',-1)",C),5);assert.equal(vm.runInContext("setRulerRate('tax',NaN)",C),null);
});
test('lords adjust only their customary dues; watch mode gates commands without changing authority',()=>{
  const C=realm(1);assert.equal(vm.runInContext("setRulerRate('tax',25)",C),null);assert.equal(C.MOD.tax,12);
  assert.equal(vm.runInContext("setRulerRate('dues',137)",C),135);assert.equal(C.W.houses[1].dues,1.35);assert.equal(C.W.houses[2].dues,1);
  C.W.player.on=false;assert.equal(vm.runInContext("setRulerRate('dues',50)",C),null);
  C.W.player.on=true;C.document.body.classList.contains=()=>true;assert.equal(vm.runInContext('sovOn()',C),true);assert.equal(vm.runInContext("setRulerRate('dues',50)",C),null);
  C.document.body.classList.contains=()=>false;C.W.houses[1].exiled=true;assert.equal(vm.runInContext("setRulerRate('dues',50)",C),null);
});
test('unchanged rates produce no command and existing save settings replay identically',()=>{
  const C=realm(1);vm.runInContext("setRulerRate('dues',100)",C);assert.equal(vm.runInContext('JOURNAL.length',C),0);
  vm.runInContext("setRulerRate('dues',125);W.houses[1].dues=1;applySetting(JOURNAL[0].n,JOURNAL[0].v)",C);assert.equal(C.W.houses[1].dues,1.25);
  C.W.player.house=0;vm.runInContext("setRulerRate('tax',18);MOD.tax=12;applySetting(JOURNAL.at(-1).n,JOURNAL.at(-1).v)",C);assert.equal(C.MOD.tax,18);
});
test('typing a numeric rate waits for commitment, while range changes synchronize both controls',()=>{
  const C=realm(),range={value:'12'},number={value:'12'},label={textContent:''},row={querySelectorAll:()=>[range,number],querySelector:()=>label};
  C.e={type:'input',target:{dataset:{rulerRate:'tax'},type:'number',value:'2',closest:()=>row}};
  vm.runInContext('rulerRateInput(e)',C);assert.equal(C.MOD.tax,12);assert.equal(vm.runInContext('JOURNAL.length',C),0);
  C.e.type='change';C.e.target.value='25';vm.runInContext('rulerRateInput(e)',C);assert.equal(C.MOD.tax,25);assert.equal(range.value,'25');assert.equal(number.value,'25');assert.equal(label.textContent,'25%');
  C.e.type='input';C.e.target.type='range';C.e.target.value='18';vm.runInContext('rulerRateInput(e)',C);assert.equal(number.value,'18');
});
test('fiscal controls precede every court view; governance contains only the ruler’s towns',()=>{
  const h='<div class="dhead">The Sovereign</div>Progress<div class="dhead">Decrees</div>Orders<div class="dhead">The Great Houses</div>Houses<div class="dhead">Ambitions</div>Ambitions';
  for(const house of [0,1]){const C=realm(house);C.h=house?h.replace('Decrees','Your towns').replace('The Great Houses','The throne'):h;
    for(const view of ['overview','governance','orders','houses']){C.crownSection=view;const html=vm.runInContext(`crownSections(h,${house>0})`,C);assert.ok(html.indexOf('aria-label="Revenue controls"')<html.indexOf('role="tablist"'));assert.equal((html.match(/id="(?:sovtax|lorddues)"/g)||[]).length,1);assert.ok(html.includes('data-cview="governance"'));}
    const gov=vm.runInContext('rulerGovernanceHTML()',C);assert.ok(gov.includes(house?'Our town':'Royal town'));assert.ok(!gov.includes('Rival town'));assert.ok(!gov.includes(house?'Royal town':'Our town'));
  }
});
test('opening town orders enforces ownership and play mode without writing a save command',()=>{
  const C=realm(1),opened=[];Object.assign(C,{showInspect:pk=>opened.push(pk.s.name),setInspectorView:v=>assert.equal(v,'orders'),contextExpand:v=>assert.equal(v,true),refreshCrownPanel(){},refreshInspect(){},updateHUD(){},renderPetition(){}});
  vm.runInContext(fn('runCmd')+'\n'+source.match(/const cmdClick=e=>\{.*?\};/)[0],C);
  const click=si=>{C.e={target:{closest:()=>({dataset:{cmd:'s-manage',arg:String(si)}})}};vm.runInContext('cmdClick(e)',C);};
  click(0);click(2);assert.deepEqual(opened,[]);click(1);assert.deepEqual(opened,['Our town']);assert.equal(vm.runInContext('JOURNAL.length',C),0);
  C.W.player.on=false;click(1);assert.deepEqual(opened,['Our town']);
});
