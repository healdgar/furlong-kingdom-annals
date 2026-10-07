import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Where a host at war marches: the enemy place most worth the march and the siege, among those a road or the sea leads to.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const s=html.indexOf(`function ${name}(`);assert.notEqual(s,-1,`missing ${name}`);const e=html.indexOf('\nfunction ',s+1);return html.slice(s,e<0?html.length:e);};
const line=prefix=>{const i=html.indexOf('\n'+prefix);assert.ok(i>=0,prefix);return html.slice(i+1,html.indexOf('\n',i+1));};
const dist2d=(x,z,a,b)=>Math.hypot(x-a,z-b);
const town=(owner,x,pop,worth,extra)=>({owner,pos:{x,z:0},pop,stores:{grain:0},garrison:0,militia:0,walls:0,worth,name:'T'+x,...extra});
function realm(settlements,routes){
  const marched=[];
  let now=100;const c=vm.createContext({W:{settlements,armies:[],war:null,feuds:[{a:0,b:1}],roads:[]},Math,dist2d,marched,day:()=>now,setDay:d=>{now=d;},plyH:()=>-1,clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),PL:()=>1,GOODBASE:{grain:2},
    MARCH_MPD:400,FIELD_MPD:250,seasonIdx:()=>1,armySimPos:a=>a.field?{...a.field}:{...settlements[a.at].pos},route:(a,b)=>routes[a+'_'+b]||null,townWorth:s=>s.worth,defenceOf:s=>s.pop*0.05+(s.garrison||0),
    hostileTo:(a,s)=>s.owner!==a.house,houseAtWar:()=>true,atWar:(x,y)=>x!==y,inRebellion:()=>false,fitToCampaign:()=>true,nearestSettlementIdx:()=>0,
    marchArmy:(a,t)=>{marched.push(t);if((c.blocked||[]).includes(t)){a.state='idle';a.field={...settlements[a.at].pos,x:settlements[a.at].pos.x+100};return false;}a.state='march';return true;},goHome:(a,why)=>{a.wentHome=why;a.state='march';},chance:()=>false,emit:()=>{},armyLand:()=>{},armiesAtSettlement:()=>[],musterSync:()=>{},rollLiving:()=>{}});
  vm.runInContext([line('const ARMY_NO_WAY_DAYS='),...['armyNoWay','armyNoWayNote','armyCampaignValue','armyObjective','tickMilitary'].map(fn)].join('\n'),c);return c;}
const host=extra=>({id:1,house:0,side:'host',at:0,home:0,state:'idle',strength:300,supply:100,morale:70,field:null,name:'Host',...extra});

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

test('a host remembers a place it found no way to: it weighs the next one, and that one again when a crossing changes or a season has passed',()=>{
  const c=realm([town(0,0,200,5000),town(1,800,60,4000),town(1,4000,600,30000)],{'0_1':{poly:[],len:800},'0_2':{poly:[],len:4000}});c.blocked=[2];
  const a=host();c.W.armies.push(a);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2],'the best first');assert.equal(a._noWay.length,1);
  a.state='idle';c.setDay(101);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2,1],'the next day, the next best');
  a.state='idle';c.blocked=[1,2];c.setDay(102);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2,1,1],'the next best is blocked now too');
  a.state='idle';c.setDay(103);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2,1,1],'both remembered: no search at all');assert.ok(a.wentHome,'and it goes home from the field');
  a.state='idle';c.W.roads.push({});c.setDay(104);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched,[2,1,1,2],'a road built: it looks again');
  a.state='idle';c.setDay(105);c.blocked=[];a._noWay=[{si:2,until:150,roads:1,owner:1,raft:-1}];vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched.at(-1),1,'still remembered');
  a.state='idle';c.setDay(150);vm.runInContext('tickMilitary()',c);assert.deepEqual(c.marched.at(-1),2,'a season gone: it looks again');
});
