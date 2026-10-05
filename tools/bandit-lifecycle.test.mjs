import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('const OUTLAW_MAX='),source.indexOf('function tickBandits(dis)'));
assert.ok(helpers.includes('function recruitBandit('),'production recruitment helper found');
function fixture(){
  const home={id:'hh1',assets:{w:2,_debt:8},hunger:0.8,members:new Set()},p={id:1,gn:'Alda',si:0,age:30,tr:'weaver',away:null,dead:false,merc:false,role:null,sk:new Float32Array(9),_hh:home},spouse={id:2,gn:'Eda',si:0,age:28,tr:'ploughman',dead:false,_hh:home};p.sp=spouse;spouse.sp=p;home.members.add(p);home.members.add(spouse);
  const s={name:'Mere',pos:{x:0,z:0},folk:[p]},camp={id:7,x:10,z:0,men:[],nextRecruit:1};
  const W={settlements:[s],adj:{0:[]},roads:[],banditCamps:[camp]};
  let removed=0;
  const C=vm.createContext({W,s,camp,p,home,spouse,OUTLAW_MAX:12,G:{campMeshes:new Map()},scene:{remove:()=>removed++},
    day:()=>14,year:()=>0,foodYr:()=>10,householdAccount:q=>q._hh,ageYrs:q=>q.age,folkName:q=>q.gn,
    nearestSettlementIdx:()=>0,dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    trait:(q,k)=>k===1?0.7:k===2?-0.2:k===3?-0.3:0,GB:1,GD:2,GWa:3,KLaw:0,
    chance:()=>true,life:(q,t)=>((q.ev||(q.ev=[])).push(t)),removeAt:(st,i)=>{const q=st.folk.splice(i,1)[0];return q;},
    dropPerson:q=>{q.dead=true;vm.runInContext('outlawMemberDied(p)',C);},dropMarker:()=>{}});
  vm.runInContext(helpers,C);
  return {C,W,s,camp,p,home,spouse,get removed(){return removed;}};
}

test('recruitment enlists an existing hungry debtor and return restores work and travel state',()=>{
  const f=fixture();
  assert.equal(vm.runInContext('recruitBandit(camp)',f.C),true);
  assert.equal(f.camp.men[0],f.p);
  assert.equal(f.s.folk[0],f.p);
  assert.equal(f.p._hh,f.home);
  assert.equal(f.home.assets._debt,8);
  assert.equal(f.p.tr,null);
  assert.equal(f.p.outlawCampId,f.camp.id);
  assert.equal(f.p.away.why,'outlaw');
  assert.match(f.p.ev[0],/Driven by hunger/);
  vm.runInContext("outlawReturn(p,'the camp scattered')",f.C);
  assert.equal(f.s.folk[0],f.p);
  assert.equal(f.p._hh,f.home);
  assert.equal(f.home.assets._debt,8);
  assert.equal(f.p.tr,'weaver');
  assert.equal(f.p.away,undefined);
  assert.equal(f.p.outlawCampId,undefined);
});

test('camp defeat records a casualty, returns survivors and removes the camp',()=>{
  const f=fixture(),p2={id:2,gn:'Bram',si:0,age:32,tr:'smith',away:null,dead:false,merc:false,_hh:f.home};
  f.s.folk.push(p2);f.camp.men=[f.p,p2];
  for(const p of f.camp.men){p.outlawCampId=f.camp.id;p._outlawState={tr:p.tr,hadAway:false,away:null};p.tr=null;p.away={until:Number.MAX_SAFE_INTEGER,why:'outlaw'};}
  vm.runInContext("outlawCampEnds(camp,'the riders prevailed',1)",f.C);
  assert.equal(f.camp.men.length,0);
  assert.equal(f.W.banditCamps.length,0);
  assert.equal(f.s.folk.filter(p=>p&&!p.dead).length,1);
  const survivor=f.s.folk.find(p=>!p.dead);
  assert.equal(survivor.outlawCampId,undefined);
  assert.equal(survivor.tr,survivor===f.p?'weaver':'smith');
  assert.equal(survivor._hh,f.home);
  assert.equal(f.home.assets._debt,8);
  assert.equal(f.removed,0);
});

test('an empty camp cannot raid and waits for its next recruitment day',()=>{
  const tick=source.slice(source.indexOf('function tickBandits(dis)'),source.indexOf('function wakeDragon('));
  assert.ok(tick.includes('function tickBandits(dis)'));
  const camp={id:3,x:0,z:0,raids:0,born:1,men:[],nextRecruit:20};
  const caravan={sea:false,river:false,robbed:false,poly:[{x:0,z:0}],departDay:0,arriveDay:30,origin:0,dest:0,qty:0,value:1};const W={settlements:[{name:'nearby',unrest:0,prosperity:50,stores:{}}],banditCamps:[camp],caravans:[caravan],war:false};
  let chanceCalls=0;const C=vm.createContext({W,camp,MOD:{bandit:1},G:{campMeshes:new Map()},scene:{remove(){}},
    day:()=>10,chance:()=>++chanceCalls===2,nearestSettlementIdx:()=>0,dist2d:()=>0,polyPos:()=>({x:0,z:0}),emit:()=>{},vary:(k,L)=>L[0](),
    });
  vm.runInContext(helpers+'\n'+tick+'\ntickBandits(0)',C);
  assert.equal(camp.raids,0);
  assert.equal(caravan.robbed,false);
  assert.equal(camp.king,undefined);
  assert.equal(W.banditCamps.length,1);
});

test('an expiring bandit title retires its notable without killing or detaching the villager',()=>{
  const f=fixture();
  vm.runInContext(`
    camp.men=[p];p.outlawCampId=camp.id;p._outlawState={tr:p.tr,hadAway:false,away:null};p.tr=null;p.away={until:Number.MAX_SAFE_INTEGER,why:'outlaw'};
    globalThis.king={id:9,name:'Alda the Red',alive:true,fp:p};camp.kingId=9;
    notableById=id=>id===9?king:null;notableSetAlive=(n,v)=>n.alive=v;nameUse=()=>{};
    outlawCampEnds(camp,'the camp dwindled');
  `,f.C);
  assert.equal(f.s.folk[0],f.p);
  assert.equal(f.p.dead,false);
  assert.equal(f.p.tr,'weaver');
  assert.equal(f.p.outlawCampId,undefined);
  assert.equal(f.p.sp,vm.runInContext('spouse',f.C));
  assert.equal(vm.runInContext('spouse.sp',f.C),f.p);
  assert.equal(f.p._hh,f.home);
  assert.equal(f.home.assets._debt,8);
  assert.equal(vm.runInContext('king.alive',f.C),false);
  assert.equal(vm.runInContext('king.endReason',f.C),'Bandit title ended when the camp scattered');
});
