import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A man can die away from his host: an outlaw levied from his village still belongs to his band, and is cut down when
// the band is broken. His record is archived (its skills let go) while he stands on the host's roll. The roll must
// strike him off before anyone weighs the men, or the muster and the battle read skills that are gone.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sourceFunction=name=>{
  const start=html.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing ${name}`);
  const end=html.indexOf('\nfunction ',start+1);
  return html.slice(start,end<0?html.length:end);
};
const man=(id,arms,extra={})=>{const sk=new Float32Array(9);sk[4]=arms;return {id,sk,merc:null,...extra};};
const archived=id=>({id,dead:true}); // dropPerson → archivePerson deletes sk

function muster(){
  let seed=1;const sent=[],dropped=[];
  const c=vm.createContext({Math,Float32Array,KA:4,KRi:5,GV:0,frand:()=>(seed=(seed*16807)%2147483647)/2147483647,trait:()=>0,
    sendHome:p=>sent.push(p.id),dropPerson:p=>{dropped.push(p.id);p.dead=true;},folkName:p=>'man '+p.id,levyMen:()=>{},takeHorses:()=>{},hireMen:()=>{},W:{settlements:[]}});
  vm.runInContext(['rollLiving','pickK','musterSync','menQuality','horseShare'].map(sourceFunction).join('\n'),c);
  return {c,sent,dropped};
}

test('a man who died away from the host is struck off before the muster weighs the roll',()=>{
  const {c,dropped}=muster(),gone=archived(9),a={name:'Host',strength:2,men:[man(1,0.2),gone,man(2,0.9),man(3,0.5)]};
  let dead;assert.doesNotThrow(()=>{dead=c.musterSync(a);});
  assert.equal(a.men.length,2);assert.ok(a.men.every(p=>!p.dead&&p.sk));assert.ok(!a.men.includes(gone));
  assert.equal(dead.length,1,'only the one man still missing falls');assert.equal(dropped.length,1);assert.notEqual(dropped[0],9,'the dead man is not killed twice');
});

test('a roll of living men is left exactly as it was',()=>{
  const {c}=muster(),men=[man(1,0.2),man(2,0.9)],a={name:'Host',strength:2,men},before=[...men];
  c.rollLiving(a);assert.equal(a.men,men);assert.deepEqual(a.men,before);
  assert.equal(c.musterSync(a).length,0);assert.deepEqual(a.men,before);
});

test('the dead are struck off at the start of the military day, so the battles weigh only living men',()=>{
  const gone=archived(9),a={id:1,house:1,side:'host',at:0,state:'idle',strength:3,supply:50,morale:60,hold:true,field:null,name:'Host',men:[man(1,0.4),gone,man(2,0.6),man(3,0.8)]};
  const synced=[];
  const c=vm.createContext({Math,W:{armies:[a],settlements:[{owner:1,pos:{x:0,z:0}}],war:null},day:()=>1,clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),
    musterSync:x=>synced.push(x.men.map(p=>p.id)),armySimPos:()=>({x:0,z:0}),armyLand:()=>{},armiesAtSettlement:()=>[],houseAtWar:()=>false,hostileTo:()=>false,atWar:()=>false,plyH:()=>-1});
  vm.runInContext(sourceFunction('rollLiving')+'\n'+sourceFunction('tickMilitary'),c);
  assert.doesNotThrow(()=>c.tickMilitary());
  assert.deepEqual(a.men.map(p=>p.id),[1,2,3]);assert.deepEqual(synced,[],'three living men for a host of three: nothing to muster');
});

test('a host\'s pay goes to the households of living men only',()=>{
  const paid=[],gone=archived(9),a={men:[man(1,0.3),gone,man(2,0.5)],home:0,at:0};
  const c=vm.createContext({Math,W:{settlements:[]},means:()=>100,transfer:(from,to,v)=>paid.push([to.id,v]),payAmong:()=>{throw Error('a host with men pays its men');},householdHead:p=>p});
  vm.runInContext(sourceFunction('rollLiving')+'\n'+sourceFunction('soldiersPay'),c);
  c.soldiersPay(a,10,{});
  assert.deepEqual(paid,[[1,5],[2,5]]);assert.equal(a.men.length,2);
});
