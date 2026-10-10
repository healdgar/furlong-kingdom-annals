import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
function declaration(name){
  const match=new RegExp('^function '+name+'\\b','m').exec(source);
  assert.ok(match,`${name} source declaration is available`);
  const start=match.index,open=source.indexOf('{',match.index),text=source.slice(open);
  let depth=0,quote='',escape=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
    if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
    if(c==='/'&&text[i+1]==='/'){while(i<text.length&&text[i]!=='\n')i++;continue;}
    if(c==='/'&&text[i+1]==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;i++;continue;}
    if(c==='{')depth++;
    else if(c==='}'&&!--depth)return source.slice(start,open+i+1);
  }
  assert.fail(`unterminated ${name} declaration`);
}
const investmentSource=declaration('storageInvestment');
const sitesSource=declaration('storageInvestmentSites');
const sharedSource=declaration('storageInvestmentShared');
const projectTickSource=declaration('storageProjectTick');

const TYPES={
  grange:{capacity:800,cost:360,days:90,timber:24,stone:0},
  warehouse:{capacity:1000,cost:700,days:150,timber:30,stone:30}
};

function fixture({lots=[],owners=[],sites=[{ok:true,cost:100}],grainPrice=10,land=0,report=0,day=1,commodity=false}={}){
  const s={name:'fixture',owner:0,pos:{x:0,z:0},furl:[{x:0,z:0,state:1}],places:[{kind:'market',x:0,z:0}],streets:[{pts:[{x:-100,z:0},{x:100,z:0}]}]};
  let now=day,quoteCalls=0;
  const events=[],projects=[],commissions=[],quotePayers=[];
  class StorageLedger{event(cause,lotRef,qty,metadata){events.push({cause,lot:lotRef,qty,metadata});}}
  class CommodityBalanceLedger{event(cause,lotRef,qty,metadata){events.push({cause,lot:lotRef,qty,metadata});}}
  const K=commodity?new CommodityBalanceLedger():new StorageLedger();Object.assign(K,{volume:()=>1,exposedLots:()=>lots});
  const W={settlements:[s],projects};
  Object.assign(s,{storageReport:{exposed:report}});
  const state={grainPrice,land,sites,lord:owners.find(o=>o.id==='lord')||owners[0],quoteEffect:null};
  const liveOps={storageSite:(x,z,arch,dry)=>({x,z,arch,dry})};
  s._lay={live:liveOps};
  const nativeMeans=o=>o?.cash||0,nativePrice=(town,good)=>good==='grain'?state.grainPrice:1,nativeLand=()=>({c:state.land});
  const nativeRoute=(town,a,b)=>{let road=0;for(const st of town.streets||[])for(let i=1;i<(st.pts||[]).length;i++)road+=Math.hypot(st.pts[i].x-st.pts[i-1].x,st.pts[i].z-st.pts[i-1].z);return Math.hypot(a.x-b.x,a.z-b.z)+road/1000;},nativeAccess=()=>true,nativeGraph=()=>({});
  const nativeNear=()=>true,nativeDoor=f=>({x:f.x,z:f.z}),nativeFootprint=()=>false,nativeRoadPlan=()=>null,nativeObstacle=()=>false,nativeSegment=()=>true,nativeFrontage=()=>true,nativeRoad=()=>true,nativeOnRoad=()=>true,nativeTrack=()=>null,nativeLandPrice=()=>0,nativeLandValue=()=>0,nativeNearest=()=>Infinity,nativePrice0=()=>1,nativeTitleEvent=()=>{},nativeAssert=()=>{};
  const nativeQuote=(si,arch,x,z,payer,routes)=>{
    quoteCalls++;quotePayers.push(payer?.id||null);state.quoteEffect?.(x,z,payer);
    if(!liveOps.storageSite(x,z,arch,'survey'))return {ok:false};
    const offer=state.sites[0]||{};
    const marketDistance=nativeRoute(s,{x,z},s.pos);
    return {ok:offer.ok!==false&&Number.isFinite(marketDistance),si,arch,x,z,payer,cost:(offer.cost??100)+nativeLand().c,marketDistance,handlingPerLoad:offer.handlingPerLoad??marketDistance*0.00002,capacity:TYPES[arch].capacity};
  };
  const nativeEvent=StorageLedger.prototype.event,commodityEvent=CommodityBalanceLedger.prototype.event;
  const surveySites=new WeakSet([liveOps.storageSite]);
  const context=vm.createContext({
    W,s,console,STORAGE_TYPES:TYPES,LS:{TILLED:1},
    STORAGE_ROUTE_BATCHES:new Map([[s,null]]),
    STORAGE_INVESTMENT_SURVEYS:surveySites,
    STORAGE_INVESTMENT_NATIVE:{quote:nativeQuote,land:nativeLand,price:nativePrice,means:nativeMeans,route:nativeRoute,access:nativeAccess,graph:nativeGraph,near:nativeNear,door:nativeDoor,footprint:nativeFootprint,roadPlan:nativeRoadPlan,obstacle:nativeObstacle,segment:nativeSegment,frontage:nativeFrontage,road:nativeRoad,onRoad:nativeOnRoad,track:nativeTrack,landPrice:nativeLandPrice,landValue:nativeLandValue,nearest:nativeNearest,price0:nativePrice0,titleEvent:nativeTitleEvent,legacyEvent:nativeEvent,commodityEvent},
    StorageLedger,CommodityBalanceLedger,
    STORAGE_TITLE_ASSERT:nativeAssert,
    day:()=>now,
    storageRouteBatch:(town,fn)=>fn(),
    storageFacilities:()=>K,
    commodityActive:()=>commodity,commodityExposed:()=>lots,
    lordAcct:()=>state.lord,
    storageOwnerId:o=>o?.id||'unassigned',
    means:nativeMeans,price:nativePrice,planLand:nativeLand,storageRoute:nativeRoute,storageAccess:nativeAccess,streetGraph:nativeGraph,
    storageRoadNear:nativeNear,serviceDoor:nativeDoor,streetFootprintOverlap:nativeFootprint,storageRoadPlan:nativeRoadPlan,armyObstacle:nativeObstacle,armySegmentClear:nativeSegment,streetAccessAt:nativeFrontage,roadAccessClear:nativeRoad,onRoad:nativeOnRoad,trackAt:nativeTrack,landPrice:nativeLandPrice,landValue:nativeLandValue,nearestBuildingDist:nativeNearest,price0:nativePrice0,storageTitleEvent:nativeTitleEvent,
    storageSiteQuote:nativeQuote,
    storageOutcome:null,STORAGE_TITLE_OUTCOME:null,
    storageOutcomeAssert:nativeAssert,
    storageCommission:q=>{commissions.push(q);const p={...q,type:'storage',si:0,dead:false};projects.push(p);return p;},
    emit:()=>{}
  });
  vm.runInContext('STORAGE_TITLE_OUTCOME=storageOutcome=()=>{};',context);
  vm.runInContext(sitesSource+'\n'+sharedSource+'\n'+investmentSource+'\nSTORAGE_INVESTMENT_NATIVE.sites=storageInvestmentSites;',context);
  const run=nextDay=>{now=nextDay;context.storageInvestment(s);};
  return {context,s,W,K,events,projects,commissions,quotePayers,run,get quoteCalls(){return quoteCalls;},get shared(){return context.storageInvestmentShared(s,K);},get grainPrice(){return state.grainPrice;},set grainPrice(v){state.grainPrice=v;},set land(v){state.land=v;},set lord(v){state.lord=v;},set sites(v){state.sites=v;},set quoteEffect(v){state.quoteEffect=v;},set report(v){s.storageReport.exposed=v;}};
}

const owner=(id,cash=10000,role='farmer')=>({id,cash,household:true,head:{tr:role}});
const lot=(who,qty,good='grain')=>({owner:who,qty,good});
const chosen=r=>r.commissions[0];

test('storage investment proposes on the first day from current exposed stock, regardless of a low stale report',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],report:0,day:1});
  r.run(1);
  assert.equal(r.quoteCalls,8);
  assert.equal(chosen(r).payer,o);
  assert.equal(r.events.at(-1).cause,'investment-decision');
  assert.equal(r.events.at(-1).metadata.exposed,250);
});

test('native numeric balances use current exposure after title changes',()=>{
  const o=owner('balance-owner'),r=fixture({owners:[o],lots:[lot(o,250)],commodity:true,report:0});
  assert.equal(r.shared,true);r.run(3);assert.equal(chosen(r).payer,o);
  assert.equal(r.events.at(-1).metadata.exposed,250);assert.equal(r.K.day,3);
});

test('an unprofitable upper bound skips surveys and negative notes, then prices are checked next day',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],grainPrice:0.1});
  assert.equal(r.shared,true);r.run(2);assert.equal(r.quoteCalls,0);assert.equal(r.events.length,0);
  r.grainPrice=10;r.run(3);assert.equal(r.quoteCalls,8);assert.equal(chosen(r).payer,o);
});

test('current exposed stock prevents a proposal even when the carriage report is stale high',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,80)],report:500,day:1});
  r.run(1);
  assert.equal(r.quoteCalls,0);
  assert.equal(r.commissions.length,0);
});

test('stock title transfer at constant physical quantity changes the investor immediately',()=>{
  const before=owner('before'),after=owner('after'),stock=lot(before,250);
  const r=fixture({owners:[before,after],lots:[stock],sites:[{cost:100,handlingPerLoad:1}],day:4});
  r.run(4);
  assert.equal(r.events.at(-1).metadata.owner,'before');
  r.commissions.length=0;r.events.length=0;stock.owner=after;
  r.run(5);
  assert.equal(r.events.at(-1).metadata.owner,'after');
  assert.equal(r.events.at(-1).metadata.exposed,250);
});

test('unowned exposed stock follows the current lord each day',()=>{
  const first=owner('first-lord'),next=owner('next-lord'),r=fixture({owners:[first,next],lots:[lot(null,250)],sites:[{cost:100,handlingPerLoad:1}],day:3});
  r.run(3);assert.equal(r.events.at(-1).metadata.owner,'first-lord');
  r.events.length=0;r.lord=next;r.run(4);
  assert.equal(r.events.at(-1).metadata.owner,'next-lord');
});

test('equal stock ranks preserve the canonical exposed-lot encounter order',()=>{
  const z=owner('z-owner'),a=owner('a-owner'),r=fixture({owners:[z,a],lots:[lot(z,250),lot(a,250)],day:1});
  r.run(1);
  assert.equal(chosen(r).payer,z);
});

test('same-arch owners share ordered proposals during one pass, with live economics on the next day',()=>{
  const a=owner('a-owner'),b=owner('b-owner'),r=fixture({owners:[a,b],lots:[lot(a,250),lot(b,250)],sites:[{ok:true,x:22,z:0,cost:100,handlingPerLoad:1}],day:1});
  assert.equal(r.shared,true);
  r.run(1);
  assert.equal(r.quoteCalls,8);
  assert.deepEqual(r.quotePayers,Array(8).fill('a-owner'),'the ordered shared quotes retain their first owner');
  assert.equal(r.events.filter(e=>e.cause==='investment-decision').length,2);
  r.commissions.length=0;r.events.length=0;r.grainPrice=1;
  r.run(2);
  assert.equal(r.quoteCalls,16,'a new day surveys current geometry again');
  assert.equal(r.commissions.length,0,'the lower live grain price removes the positive return');
  assert.ok(r.events.some(e=>e.cause==='investment-decision'&&e.metadata.chosen===false));
});

test('each new day surveys current site geometry after field or road inputs change',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],day:8});
  r.run(8);assert.equal(r.events.at(-1).metadata.x,22);assert.equal(r.quoteCalls,8);
  const firstReturn=r.events.at(-1).metadata.annualNet;
  r.events.length=0;r.W.projects.length=0;r.s.furl[0].x=22;r.s.furl[0].z=7;r.s.streets[0].pts[1].x=50000;
  r.run(9);assert.equal(r.events.at(-1).metadata.x,0);assert.ok(Math.abs(r.events.at(-1).metadata.z-7)<1e-12);assert.equal(r.quoteCalls,16);
  assert.notEqual(r.events.at(-1).metadata.annualNet,firstReturn,'same-count field and street-coordinate edits change the live quote');
});

test('current land value and payer means are reconsidered daily',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],sites:[{cost:100,handlingPerLoad:0}],day:2});
  r.land=5000;r.run(2);assert.equal(r.commissions.length,0);
  r.land=0;o.cash=500;r.run(3);assert.equal(r.quoteCalls,8,'insufficient current means skip even the proposal survey');
  assert.equal(r.commissions.length,0,'the current payer means fail the live eligibility check');
  o.cash=10000;r.run(4);assert.equal(r.quoteCalls,16,'the next eligible day repeats the live site quote');
  assert.equal(r.commissions.length,1,'restored means allow the live lower land cost to qualify');
});

test('active storage projects suppress investment; cancelling one permits a fresh daily proposal',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],day:1});
  r.W.projects.push({type:'storage',si:0,dead:false});
  r.run(1);assert.equal(r.quoteCalls,0);
  r.W.projects[0].dead=true;
  r.run(2);assert.equal(r.quoteCalls,8);assert.equal(r.commissions.length,1);
});

test('overriding a quote input disables same-arch sharing',()=>{
  const a=owner('a-owner'),b=owner('b-owner'),r=fixture({owners:[a,b],lots:[lot(a,250),lot(b,250)],sites:[{ok:true,x:22,z:0,cost:100,handlingPerLoad:1}],day:1});
  r.context.planLand=()=>({c:0});
  r.run(1);
  assert.equal(r.quoteCalls,16,'each investor retains an independent quote path under an override');
});

test('overriding the title assertion disables same-arch sharing',()=>{
  const a=owner('a-owner'),b=owner('b-owner'),r=fixture({owners:[a,b],lots:[lot(a,250),lot(b,250)],sites:[{cost:100,handlingPerLoad:1}],day:1});
  r.context.storageOutcomeAssert=()=>{};
  assert.equal(r.shared,false);
  r.run(1);
  assert.equal(r.quoteCalls,16);
});

test('overriding the site proposal helper disables same-arch sharing',()=>{
  const a=owner('a-owner'),b=owner('b-owner'),r=fixture({owners:[a,b],lots:[lot(a,250),lot(b,250)],sites:[{cost:100,handlingPerLoad:1}],day:1});
  const native=r.context.storageInvestmentSites;r.context.storageInvestmentSites=(...args)=>native(...args);
  assert.equal(r.shared,false);
  r.run(1);
  assert.equal(r.quoteCalls,16);
});

test('fallback quote callbacks keep current price reads interleaved with each site quote',()=>{
  const o=owner('tenant'),r=fixture({owners:[o],lots:[lot(o,250)],day:1});
  r.context.planLand=()=>({c:0});
  r.quoteEffect=()=>{r.grainPrice++};
  r.run(1);
  assert.equal(r.quoteCalls,8);
  assert.ok(chosen(r),JSON.stringify(r.events.map(e=>e.metadata)));
  assert.ok(Math.abs(chosen(r).x-22*Math.cos(7*Math.PI/4))<1e-12);
  assert.ok(Math.abs(chosen(r).z-22*Math.sin(7*Math.PI/4))<1e-12,'the final price read selects the last ordered quote');
});

for(const [arch,days] of [['grange',90],['warehouse',150]])test(`${arch} construction needs ${days} paid working days and a stall adds no progress`,()=>{
  const payer=owner('builder',10000),s={name:'worksite',history:[],buildings:[]},events=[];
  let poor=false,work=0,placed=0;
  const location={capacity:arch==='grange'?800:1000};
  const K={day:0,locations:new Map([['new-store',location]]),event:(cause,lot,qty,metadata)=>events.push({cause,qty,metadata})};
  const project={si:0,payer,arch,x:12,z:8,land:0,labour:days,cost:days,days,timber:0,stone:0,materials:true,done:0,paid:0,dead:false,capacity:location.capacity};
  const context=vm.createContext({
    W:{settlements:[s],houses:[]},s,G:{},
    storageInit:()=>K,day:()=>44,year:()=>850,accountOwner:o=>o,
    means:()=>poor?0:10000,storageProjectState:q=>({...q}),
    buildWorks:(town,share)=>{work+=share;},
    storageFacilities:()=>K,bindPropertyRights:()=>{},syncLive:()=>{},emit:()=>{},
    storageOutcomeAssert:()=>{},
    storageOwnerId:o=>o?.id||'unassigned',
    arch,
  });
  context.s._lay={live:{storageSite(x,z,which,dry){if(dry)return {x,z};placed++;return {storageId:'new-store',arch:which,tier:0,state:'sound',x,z};}}};
  vm.runInContext(projectTickSource,context);
  const tick=()=>context.storageProjectTick(project);
  for(let i=0;i<12;i++)tick();
  const before={done:project.done,paid:project.paid,work,progress:events.filter(e=>e.cause==='construction-progress').length};
  poor=true;tick();poor=false;
  assert.deepEqual({done:project.done,paid:project.paid,work,progress:events.filter(e=>e.cause==='construction-progress').length},before);
  for(let i=before.done;i<days;i++)tick();
  assert.equal(project.done,days);
  assert.equal(events.filter(e=>e.cause==='construction-progress').length,days);
  assert.equal(placed,1);
  assert.equal(project.dead,true);
});
