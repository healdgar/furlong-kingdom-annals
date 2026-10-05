import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function between(start,end){const a=html.indexOf(start);assert.notEqual(a,-1,`missing ${start}`);const b=html.indexOf(end,a);assert.notEqual(b,-1,`missing ${end}`);return html.slice(a,b);}
const source=between('/* ARMY_SETTLEMENT_INDEX_HELPERS_BEGIN */','/* ARMY_SETTLEMENT_INDEX_HELPERS_END */')+
  between('function sheltered(','function prominence(s){');

function fixture(){
  const c={};
  runInNewContext(source+'\nglobalThis.sheltered=sheltered;globalThis.armySetSettlement=armySetSettlement;globalThis.armiesAtSettlement=armiesAtSettlement;globalThis.armySettlementIndex=armySettlementIndex;',c);
  const towns=[{owner:1},{owner:2},{owner:1}];
  const armies=[
    {at:0,house:1,strength:10,state:'idle'},
    {at:0,house:1,strength:20,state:'arrived'},
    {at:0,house:2,strength:30,state:'idle'},
    {at:1,house:1,strength:40,state:'idle',field:{x:1,z:2}},
    {at:2,house:1,strength:50,state:'march'},
  ];
  c.W={settlements:towns,armies};
  return {c,towns,armies};
}
function scan(armies,towns,town){const si=towns.indexOf(town);return armies.filter(a=>!a.gone&&!a.field&&a.house===town.owner&&a.at===si&&(a.state==='idle'||a.state==='arrived')).reduce((n,a)=>n+a.strength,0);}

test('sheltered matches the original predicate and reflects current mutable state',()=>{
  const {c,towns,armies}=fixture();
  assert.equal(c.sheltered(towns[0]),30);
  armies[0].field={x:0,z:0};armies[1].state='march';armies[2].house=1;
  assert.equal(c.sheltered(towns[0]),30);
  armies[2].gone=true;
  assert.equal(c.sheltered(towns[0]),scan(armies,towns,towns[0]));
});

test('location changes, new armies, replacement, and removal rebuild or update membership',()=>{
  const {c,towns,armies}=fixture();
  assert.equal(c.sheltered(towns[0]),30); // warm index
  const moved=armies[0];c.armySetSettlement(moved,2);
  assert.equal(c.sheltered(towns[0]),20);
  assert.equal(c.sheltered(towns[2]),10);

  const added={at:0,house:1,strength:7,state:'idle'};armies.push(added);
  assert.equal(c.sheltered(towns[0]),27);
  c.W.armies=c.W.armies.filter(a=>a!==added);
  assert.equal(c.sheltered(towns[0]),20);

  c.W.armies=[{at:0,house:1,strength:3,state:'arrived'}];
  assert.equal(c.sheltered(towns[0]),3);
});

test('indexed candidate order matches W.armies order after moves and same-length replacement',()=>{
  const {c,towns,armies}=fixture();
  armies.splice(0,armies.length,
    {at:0,house:1,strength:1e16,state:'idle'},
    {at:1,house:1,strength:9,state:'idle'},
    {at:0,house:1,strength:1,state:'idle'},
    {at:0,house:1,strength:1,state:'idle'});
  assert.equal(c.sheltered(towns[0]),1e16);
  c.armySetSettlement(armies[1],0);
  assert.deepEqual(Array.from(c.armiesAtSettlement(0)),armies);
  assert.equal(c.sheltered(towns[0]),scan(armies,towns,towns[0]));

  c.W.armies=[armies[3],armies[2],armies[1],armies[0]];
  assert.deepEqual(Array.from(c.armiesAtSettlement(0)),[armies[3],armies[2],armies[1],armies[0]]);
  assert.equal(c.sheltered(towns[0]),scan(c.W.armies,towns,towns[0]));
});

test('a fresh world gets an independent settlement index even when it reuses the army array',()=>{
  const {c,towns,armies}=fixture();
  const oldIndex=c.armySettlementIndex();
  const newTowns=[{owner:1},{owner:2},{owner:1}];
  c.W={settlements:newTowns,armies};
  const newIndex=c.armySettlementIndex();
  assert.notEqual(newIndex,oldIndex);
  assert.equal(c.sheltered(newTowns[0]),30);
  c.armySetSettlement(armies[0],2);
  assert.equal(c.sheltered(newTowns[0]),20);
  assert.equal(c.sheltered(newTowns[2]),10);
  assert.deepEqual(Array.from(oldIndex.bySettlement.get(0)),[armies[0],armies[1],armies[2]]);
});
