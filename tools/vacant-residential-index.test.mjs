import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=(name)=>source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |$(?![\\s\\S]))`,'m'))?.[0];
function harness(){
  const c=vm.createContext({});
  const resid=source.match(/^const RESID=.*?;/m)?.[0];
  vm.runInContext(`${resid}\n${source.match(/^const VACANT_RESIDENTIALS=.*?;/m)?.[0]}\n${fn('vacantResidentials')}\n${fn('resetVacantResidentials')}\n${fn('vacantResidentialChanged')}\nfunction capOf(){return 1}\nfunction heads_(){return heads}\nfunction workOf(){return {x:0,z:0}}\nfunction homeScore(h,s,x){return x}\n${fn('moveIn')}\nlet heads=[];`,c);
  return {c,run:s=>vm.runInContext(s,c)};
}

test('moveIn chooses among the cached vacant set in building order on score ties',()=>{
  const r=harness();
  r.run(`const s={buildings:[
    {arch:'house',state:'sound',x:4,hh:[]},
    {arch:'cot',state:'sound',x:4,hh:[]},
    {arch:'house',state:'sound',x:9,hh:[{}]},
    {arch:'temple',state:'sound',x:99,hh:[]}
  ]};const h={w:5};heads=[h];`);
  r.run('moveIn(s)');
  assert.equal(r.run('h.bh===s.buildings[0]'),true);
  assert.deepEqual([...r.run('[...vacantResidentials(s)].map(b=>s.buildings.indexOf(b))')],[1]);
  assert.equal(r.run('VACANT_RESIDENTIALS.has(s)'),true);
});

test('occupancy and building changes are reflected after invalidation or array growth',()=>{
  const r=harness();
  r.run(`const a={arch:'house',state:'sound',hh:[{}]},b={arch:'house',state:'sound',hh:[]};const s={buildings:[a,b]};heads=[]`);
  assert.deepEqual([...r.run('[...vacantResidentials(s)]')],[r.run('b')]);
  r.run('a.hh=[];vacantResidentialChanged(s,a)');
  assert.deepEqual([...r.run('[...vacantResidentials(s)]')],[r.run('a'),r.run('b')]);
  r.run("s.buildings.push({arch:'burgher',state:'sound',hh:[]})");
  assert.equal(r.run('vacantResidentials(s).size'),3);
  r.run("s.buildings[2].arch='temple';vacantResidentialChanged(s,s.buildings[2])");
  assert.equal(r.run('vacantResidentials(s).size'),2);
  r.run("s.buildings[2].arch='burgher';vacantResidentialChanged(s,s.buildings[2])");
  assert.equal(r.run('vacantResidentials(s).size'),3);
  r.run("s.buildings[2].state='ruin';vacantResidentialChanged(s,s.buildings[2])");
  assert.equal(r.run('vacantResidentials(s).size'),2);
});

test('warm vacancy cache follows house-to-guildhall-to-house architecture changes',()=>{
  const r=harness();
  r.run("const b={arch:'house',state:'sound',hh:[]},s={buildings:[b]};");
  assert.equal(r.run('vacantResidentials(s).has(b)'),true);
  r.run("b.arch='guildhall';vacantResidentialChanged(s,b)");
  assert.equal(r.run('vacantResidentials(s).has(b)'),false);
  r.run("b.arch='house';vacantResidentialChanged(s,b)");
  assert.equal(r.run('vacantResidentials(s).has(b)'),true);
});

test('a moveIn pass keeps its initial vacancy snapshot; next pass sees newly emptied homes',()=>{
  const r=harness();
  r.run(`const old={arch:'house',state:'sound',hh:[]},first={arch:'house',state:'sound',x:1,hh:[]};const s={buildings:[old,first]};const h1={w:10,bh:old},h2={w:9};old.hh=[h1];heads=[h1,h2];capOf=()=>0`);
  r.run('moveIn(s)');
  assert.equal(r.run('h1.bh===first'),true);
  assert.equal(r.run('h2.bh===undefined'),true);
  r.run('heads=[h2];moveIn(s)');
  assert.equal(r.run('h2.bh===old'),true);
});

test('moveIn returning a household to another settlement updates the former home cache',()=>{
  const r=harness();
  r.run(`const old={arch:'house',state:'sound',hh:[]},home={arch:'house',state:'sound',x:3,hh:[]};const from={buildings:[old]},to={buildings:[home]};old.s=from;const h={w:4,bh:old};old.hh=[h];heads=[h];vacantResidentials(from);vacantResidentials(to)`);
  r.run('moveIn(to)');
  assert.equal(r.run('h.bh===home'),true);
  assert.equal(r.run('vacantResidentials(from).has(old)'),true);
  assert.equal(r.run('vacantResidentials(to).has(home)'),false);
});

test('reset settlements receive independent derived caches and no journal dependency',()=>{
  const r=harness();
  r.run("const a={buildings:[{arch:'house',state:'sound',hh:[]}]},b={buildings:[{arch:'cot',state:'sound',hh:[]}]};");
  assert.equal(r.run('vacantResidentials(a)!==vacantResidentials(b)'),true);
  r.run("a.buildings[0].hh=[{}];resetVacantResidentials(a)");
  assert.equal(r.run('vacantResidentials(a).size'),0);
  r.run("a.buildings[0].hh=[];a.buildings.reverse();resetVacantResidentials(a)");
  assert.deepEqual([...r.run('[...vacantResidentials(a)]')],[r.run('a.buildings[0]')]);
  assert.doesNotMatch(fn('vacantResidentials'),/event|journal|storage/i);
});
