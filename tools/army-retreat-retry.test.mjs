import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sourceFunction=name=>{
  const start=html.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing ${name}`);
  const end=html.indexOf('\nfunction ',start+1);
  return html.slice(start,end<0?html.length:end);
};
const points=p=>JSON.parse(JSON.stringify(p.map(q=>[q.x,q.z])));

function retreatRealm({routeResult={poly:[{x:100,z:0},{x:0,z:0}],len:100,time:100},roadPassable=false,terrainPassable=false,connector,spendOk=true}={}){
  if(connector!==undefined){roadPassable=connector;terrainPassable=connector;}
  let now=10,position={x:20,z:5};
  const calls={march:[],events:[],spend:[],paid:[],paths:[],connectors:[]};
  const settlements=[
    {owner:0,pos:{x:0,z:0},pop:10,stores:{grain:0}},
    {owner:1,pos:{x:100,z:0},pop:10,stores:{grain:0}}
  ];
  const army={id:7,house:0,at:1,state:'idle',strength:80,supply:5,morale:60,
    fatigue:0,field:{...position},name:'Host Test',side:'test'};
  const W={armies:[army],settlements,roads:[],houses:[{},{}],war:null,prehistory:true};
  const c=vm.createContext({W,Math,day:()=>now,dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),
    clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),plyH:()=>0,armySimPos:()=>({...position}),
    armyLand:()=>{},hostileTo:()=>false,houseAtWar:()=>false,atWar:()=>false,
    emit:(...args)=>calls.events.push(args),chance:()=>false,
    route:()=>routeResult,armyDestination:(_a,s)=>({x:s.pos.x,z:s.pos.z}),
    armyLandPath:(a,p)=>{calls.paths.push(p.map(q=>({...q})));const roadAttempt=!!routeResult&&p.length>2,ok=roadAttempt?roadPassable:terrainPassable;calls.connectors.push(ok);return ok?p:null;},
    armyRouteBlocked:a=>{a.field={...position};a.fieldTo=null;a.chase=null;a.state='idle';a.why='no passable route: a bridge, ford, or breach is needed';return false;},
    armyMarchPath:(a,p,speed)=>{a.poly=p;a.lastSpeed=speed;a.arriveDay=now+100;a.state='march';return true;},
    MARCH_MPD:400,FIELD_MPD:250,COG_MPD:2800,PORT_DELAY:1200,PL:()=>1,
    purse:(...args)=>{calls.spend.push(args);return spendOk?1e9:0;},purseAcct:()=>'crown',payAmong:(...args)=>calls.paid.push(args),
    heads_:()=>[],book:()=>{},houseName:()=> 'House Test',vary:(_k,options)=>options[0]()
  });
  vm.runInContext(sourceFunction('armyRouteBlocked')+'\n'+sourceFunction('armyRoadDeparture')+'\n'+sourceFunction('marchArmy')+'\n'+sourceFunction('tickMilitary'),c);
  return {c,W,army,calls,setDay:d=>{now=d;},setPosition:p=>{position=p;},setConnector:v=>{roadPassable=v;terrainPassable=v;},setRoadPassable:v=>{roadPassable=v;},setTerrainPassable:v=>{terrainPassable=v;},setRoute:r=>{routeResult=r;}};
}

test('failed automatic retreat retries after 30 days and emits no false forage report',()=>{
  const f=retreatRealm();
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.army.holdUntil,40);assert.equal(f.calls.events.length,0);
  assert.deepEqual({...f.army.field},{x:20,z:5},'both blocked attempts leave the host in place');
  for(let d=11;d<40;d++){f.setDay(d);vm.runInContext('tickMilitary()',f.c);}
  assert.equal(f.calls.paths.length,2,'road and terrain attempts occur once');
  f.setDay(40);vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.calls.paths.length,4,'both paths retry on the hold expiry day');
  assert.equal(f.army.holdUntil,70);assert.equal(f.calls.events.length,0);
  assert.deepEqual({...f.army.field},{x:20,z:5},'failed retry still leaves the host in place');
});

test('a pre-existing longer hold is preserved and respected',()=>{
  const f=retreatRealm();f.army.holdUntil=90;
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.army.holdUntil,90);
  for(let d=11;d<90;d++){f.setDay(d);vm.runInContext('tickMilitary()',f.c);}
  assert.equal(f.calls.paths.length,2);
  f.setDay(90);vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.calls.paths.length,4);assert.equal(f.army.holdUntil,120);
});

test('an explicit queued order bypasses the retreat cooldown and hungry fallback',()=>{
  const f=retreatRealm({routeResult:{poly:[{x:100,z:0},{x:0,z:0}],len:100,time:100},roadPassable:true,terrainPassable:true});
  f.army.holdUntil=90;f.army.why='no passable route: a bridge, ford, or breach is needed';f.army.nextOrder=0;
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.calls.paths.length,1);assert.equal(f.army.target,0);
  assert.equal(f.army.state,'march');assert.equal(f.army.holdUntil,90);
  assert.equal(f.calls.events.filter(x=>String(x.at(-1)).includes('falls back to forage')).length,0);
});

test('a newly passable path succeeds on the next retry and reports forage once',()=>{
  const f=retreatRealm({routeResult:{poly:[{x:100,z:0},{x:0,z:0}],len:100,time:100},roadPassable:false,terrainPassable:false});
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.army.holdUntil,40);assert.equal(f.calls.events.length,0);
  f.setConnector(true);f.setDay(40);vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.army.state,'march');assert.equal(f.army.target,0);assert.equal(f.army.holdUntil,40);
  assert.equal(f.calls.paths.length,3,'failed day tries road plus terrain; retry succeeds on the road');
  assert.equal(f.calls.events.filter(x=>String(x.at(-1)).includes('falls back to forage')).length,1);
});

test('open-country retreat succeeds when no road route exists',()=>{
  const f=retreatRealm({routeResult:null,terrainPassable:true});
  f.army.field=null;
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.calls.paths.length,1);
  assert.deepEqual(points(f.calls.paths[0]),[[20,5],[0,0]]);
  assert.equal(f.army.state,'march');assert.equal(f.army.target,0);
  assert.equal(f.army.lastSpeed,250,'cross-country fallback uses FIELD_MPD even from a town');
  assert.equal(f.army.holdUntil,undefined);
});

test('open-country fallback succeeds when the road connection is blocked',()=>{
  const f=retreatRealm({routeResult:{poly:[{x:100,z:0},{x:70,z:0},{x:0,z:0}],len:130,time:130},roadPassable:false,terrainPassable:true});
  f.army.field=null;
  vm.runInContext('tickMilitary()',f.c);
  assert.equal(f.calls.paths.length,2);
  assert.deepEqual(points(f.calls.paths[1]),[[20,5],[0,0]]);
  assert.equal(f.army.state,'march');assert.equal(f.army.holdUntil,undefined);
  assert.equal(f.army.lastSpeed,250,'cross-country fallback uses FIELD_MPD even from a town');
});

test('an impassable field connector preserves position and cannot use a direct chord',()=>{
  const f=retreatRealm({routeResult:{poly:[{x:100,z:0},{x:70,z:0},{x:0,z:0}],len:130,time:130},roadPassable:false,terrainPassable:false});
  f.army.field={x:85,z:8};f.setPosition({x:85,z:8});f.c.a=f.army;
  assert.equal(vm.runInContext('marchArmy(a,0)',f.c),false);
  assert.deepEqual(points(f.calls.paths[0]),[[85,8],[85,0],[70,0],[0,0]]);
  assert.deepEqual(points(f.calls.paths[1]),[[85,8],[0,0]]);
  assert.deepEqual({...f.army.field},{x:85,z:8});assert.equal(f.army.state,'idle');
  assert.equal(f.army.target,undefined);
});

test('field-origin retreat follows the road route and retains a sea crossing with one hire',()=>{
  const f=retreatRealm({routeResult:{poly:[{x:100,z:0},{x:70,z:0},{x:70,z:20,sea:true},{x:0,z:0}],len:140,time:140,sea:true,seaLen:500},roadPassable:true});
  f.army.field={x:85,z:8};f.army.strength=100;
  f.setPosition({x:85,z:8});f.setRoute({poly:[{x:100,z:0},{x:70,z:0},{x:70,z:20,sea:true},{x:0,z:0}],len:140,time:140,sea:true,seaLen:500});
  f.c.armyLandPath=(a,p)=>{f.calls.paths.push(p.map(q=>({...q})));return p;};f.c.armyShore=(a,p)=>p; // the shore points are army-obstacles.test's
  vm.runInContext(sourceFunction('armyMarchPath'),f.c);
  f.c.a=f.army;
  assert.equal(vm.runInContext('marchArmy(a,0)',f.c),true);
  assert.deepEqual(points(f.calls.paths[0]),[[85,8],[85,0],[70,0],[70,20],[0,0]]);
  assert.equal(f.calls.paths[0][3].sea,true);
  assert.equal(f.calls.spend.length,1);assert.equal(f.calls.paid.length,1);
  assert.equal(f.army.state,'march');assert.equal(f.army.tf?.length,5);
  assert.equal(f.army.tf?.at(-1),1);
});

test('road departure projects only onto the origin-side land before a sea crossing',()=>{
  const f=retreatRealm();
  const path=[{x:100,z:0},{x:70,z:0},{x:70,z:20,sea:true},{x:60,z:20,sea:true},{x:50,z:20}];
  f.c.P=path;f.c.from={x:52,z:20};
  const departed=vm.runInContext('armyRoadDeparture(from,P)',f.c);
  assert.deepEqual(points(departed),[[52,20],[70,0],[70,0],[70,20],[60,20],[50,20]]);
  assert.equal(departed[3].sea,true,'the itinerary still contains its canonical crossing');
});
