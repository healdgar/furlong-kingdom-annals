import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {realm} from './ownership-fixture.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const life=html.match(/^function life\(.*$/m)[0];
test('life records every event, including prehistory and mercenaries, in order',()=>{
  let d=0;const p={},m={merc:true};const c=vm.createContext({W:{prehistory:true},p,m,day:()=>d});
  vm.runInContext(life,c);
  for(d=0;d<150;d++)vm.runInContext('life(p,"event "+day());life(m,"event "+day())',c);
  assert.equal(p.ev.length,150);assert.equal(m.ev.length,150);
  assert.deepEqual(Array.from(p.ev,e=>Array.from(e)),Array.from({length:150},(_,i)=>[i,'event '+i]));
});
test('death preserves the whole life and appends one death, without repeating inheritance',()=>{
  const r=realm({households:2});r.eval(life);
  const p=r.H[0];p.ev=Array.from({length:100},(_,i)=>[i,'Worked '+i]);
  r.eval("dropPerson(H[0],'Died');dropPerson(H[0],'Died again')");
  assert.equal(p.ev.length,101);assert.equal(p.ev[0][1],'Worked 0');assert.equal(p.ev[99][1],'Worked 99');assert.equal(p.ev[100][1],'Died');
});
test('archiving a deceased person retains the complete event ledger',()=>{
  const src=html.slice(html.indexOf('function archivePerson('),html.indexOf('\nfunction ',html.indexOf('function archivePerson(')+1));
  const p={g:[],ev:Array.from({length:100},(_,i)=>[i,'event '+i])};
  const c=vm.createContext({p,day:()=>200,natureWords:()=>'',learningWords:()=>''});vm.runInContext(src+';archivePerson(p)',c);
  assert.equal(p.ev.length,100);assert.equal(p.dd,200);
});
