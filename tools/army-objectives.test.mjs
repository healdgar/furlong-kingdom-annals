import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Where a host at war marches: the enemy place most worth the march and the siege, among those a road or the sea leads to.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const s=html.indexOf(`function ${name}(`);assert.notEqual(s,-1,`missing ${name}`);const e=html.indexOf('\nfunction ',s+1);return html.slice(s,e<0?html.length:e);};
const dist2d=(x,z,a,b)=>Math.hypot(x-a,z-b);
const town=(owner,x,pop,worth,extra)=>({owner,pos:{x,z:0},pop,stores:{grain:0},garrison:0,militia:0,walls:0,worth,name:'T'+x,...extra});
function realm(settlements,routes){
  const marched=[];
  const c=vm.createContext({W:{settlements,armies:[],war:null,feuds:[{a:0,b:1}]},Math,dist2d,marched,day:()=>100,plyH:()=>-1,clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),PL:()=>1,GOODBASE:{grain:2},
    MARCH_MPD:400,FIELD_MPD:250,seasonIdx:()=>1,armySimPos:a=>a.field?{...a.field}:{...settlements[a.at].pos},route:(a,b)=>routes[a+'_'+b]||null,townWorth:s=>s.worth,defenceOf:s=>s.pop*0.05+(s.garrison||0),
    hostileTo:(a,s)=>s.owner!==a.house,houseAtWar:()=>true,atWar:(x,y)=>x!==y,inRebellion:()=>false,fitToCampaign:()=>true,nearestSettlementIdx:()=>0,
    marchArmy:(a,t)=>{marched.push(t);a.state='march';return true;},chance:()=>false,emit:()=>{},armyLand:()=>{},armiesAtSettlement:()=>[],musterSync:()=>{},rollLiving:()=>{}});
  vm.runInContext(['armyCampaignValue','armyObjective','tickMilitary'].map(fn).join('\n'),c);return c;}
const host=extra=>({id:1,house:0,side:'host',at:0,state:'idle',strength:300,supply:100,morale:70,field:null,name:'Host',...extra});

test('a host marches on the place most worth it, not merely the nearest',()=>{
  const c=realm([town(0,0,200,5000),town(1,800,60,400),town(1,4000,600,30000)],{'0_1':{poly:[],len:800},'0_2':{poly:[],len:4000}});
  c.W.armies.push(host());vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2]);
});
test('a place no road or sea route leads to is not chosen, however near',()=>{
  const c=realm([town(0,0,200,5000),town(1,300,600,30000),town(1,4000,200,8000)],{'0_2':{poly:[],len:4000}});
  c.W.armies.push(host());vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2]);
});
test('no march when nothing is worth the pay and bread, or the wagons would not last the way',()=>{
  const c=realm([town(0,0,200,5000),town(1,800,5,10)],{'0_1':{poly:[],len:800}});
  c.W.armies.push(host());vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[],'a hamlet worth less than the march');
  const d=realm([town(0,0,200,5000),town(1,40000,600,30000)],{'0_1':{poly:[],len:40000}});
  d.W.armies.push(host({supply:60}));vm.runInContext('tickMilitary()',d);assert.deepEqual(d.marched,[],'a hundred days\' march on sixty days\' bread');
});
