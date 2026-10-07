import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// While one death's heirs are reckoned, inherit keeps each person's living issue (estateChildren) and the reckoning asks
// for it again rather than scanning every household (#15). With the memory and without it, landHeirs and estateShares
// must give the same heirs and shares, in the same order, for families of every shape: dead children with living issue,
// natural children, widows, partible and Anglo customs, kin found only through households; and the memory is cleared after.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
test('heirs and shares are the same with the memory as without it',()=>{
  const ctx=vm.createContext({Math,Map,Set,Number});
  vm.runInContext(`var HOUSEHOLDS=[],YEAR=1100;function AD(){return YEAR;}function* nonemptyHouseholds(){for(const h of HOUSEHOLDS)if(h.members.size)yield h;}
    function householdAccount(p){return p._hh||null;}function parishOf(s){return s.parish||null;}function lordAcct(s){return 'lord';}
    ${line('const PARTIBLE=')}\n${line('function inheritanceCustom(s){')}\n${block('let ESTATE_CHILDREN=','\nfunction offerLand(')}
    function reckon(p,s,memo){if(memo)ESTATE_CHILDREN=new Map();try{return [landHeirs(p,s),estateShares(p,s),landHeirs(p,s,true),estateKin(p)];}finally{ESTATE_CHILDREN=null;}}`,ctx);
  let asked=0,deadLines=0;
  for(let seed=1;seed<=80;seed++){const r=rng(seed*9973),people=[];let id=0;
    const person=(pa,ma)=>{const p={id:id++,b:Math.floor(r()*80)*360+(r()<.1?0:Math.floor(r()*360)),sx:r()<.5?'m':'f',dead:r()<.3,pa,ma,kids:[],bast:r()<.1};people.push(p);if(pa&&r()<.85)pa.kids.push(p);if(ma&&r()<.85)ma.kids.push(p);return p;};
    for(let g=0;g<4;g++){const n=people.length;for(let k=0;k<(g?n*1.5:6);k++){const pa=g?people[Math.floor(r()*n)]:null,ma=g?people[Math.floor(r()*n)]:null;person(pa,ma);}}
    for(const p of people)if(r()<.4){const q=people[Math.floor(r()*people.length)];if(q!==p){p.sp=q;}}
    const hh=Array.from({length:3+Math.floor(r()*8)},(_,i)=>({id:'h'+i,members:new Set()}));for(const p of people)if(!p.dead||r()<.2){const h=hh[Math.floor(r()*hh.length)];h.members.add(p);p._hh=h;}
    ctx.HOUSEHOLDS=hh;
    for(let q=0;q<20;q++){const p=people[Math.floor(r()*people.length)],s={cult:['anglo','celtic','german','norman','slavic'][Math.floor(r()*5)],parish:r()<.5?{id:'church'}:null,custom:r()<.1?{land:'youngest'}:undefined};
      ctx.P=p;ctx.S=s;ctx.YEAR=r()<.5?1100:1200;const show=x=>JSON.stringify(x,(k,v)=>v&&typeof v==='object'&&'id'in v&&k!==''?'#'+v.id:v);
      const a=show(vm.runInContext('reckon(P,S,false)',ctx)),b=show(vm.runInContext('reckon(P,S,true)',ctx));assert.equal(b,a,`seed ${seed} person ${p.id}`);
      assert.equal(vm.runInContext('ESTATE_CHILDREN',ctx),null);asked++;if((p.kids||[]).some(k=>k.dead&&k.kids.length))deadLines++;}}
  assert.ok(asked>=1600&&deadLines>50,`asked ${asked}, with dead children's lines ${deadLines}`);
});
test('inherit reckons heirs and shares under the memory and clears it',()=>{
  const inh=block('function inherit(p){','\n/* ====');
  assert.match(inh,/let heirs,shares;ESTATE_CHILDREN=new Map\(\);try\{heirs=landHeirs\(p,s\);shares=isHead\?estateShares\(p,s\):\[\];\}finally\{ESTATE_CHILDREN=null;\}/);
  assert.equal((inh.match(/ESTATE_CHILDREN/g)||[]).length,2,'the memory is set and cleared only around the reckoning');
});
