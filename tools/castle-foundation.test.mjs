import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
function declaration(name){
  const m=new RegExp('^function '+name+'\\b','m').exec(html);assert.ok(m,`missing ${name}`);
  const start=m.index,open=html.indexOf('{',start),body=html.slice(open);let depth=0,quote='',escape=false;
  for(let i=0;i<body.length;i++){
    const c=body[i];
    if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
    if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
    if(c==='/'&&body[i+1]==='/'){while(i<body.length&&body[i]!=='\n')i++;continue;}
    if(c==='/'&&body[i+1]==='*'){i+=2;while(i<body.length&&!(body[i]==='*'&&body[i+1]==='/'))i++;i++;continue;}
    if(c==='{')depth++;else if(c==='}'&&!--depth)return html.slice(start,open+i+1);
  }
  assert.fail(`unterminated ${name}`);
}
const functions=['castleFoundationAuthority','castleFoundationSpec','castleFoundationProposal','castleFoundationCommission','castleFoundationTick','castleFoundationDemand','casKeep','casRing','tickProjects','tickCastles'];
const constructionMethods=html.match(/^const CONSTRUCTION_METHODS=.*$/m)?.[0];
assert.ok(constructionMethods,'missing shared construction methods');

function fixture({ad=1000,cash=10000,timber=0,stone=0,workers=true}={}){
  const account={gold:cash},workersAccount={gold:0},house={name:'Ash',seat:0,gold:cash,exiled:false},s={name:'Seat',owner:1,kind:'town',role:'seat',pos:{x:0,z:0},buildings:[],stores:{timber,stone},furl:[],places:[],streets:[],history:[]};
  const ward={x:30,z:0,r:25,wallRad:new Float32Array(32).fill(25),gateA:0},site={spec:null,f:{x:30,z:0,w:13,d:13,rot:0},ward,path:[{x:10,z:0},{x:20,z:0}]};
  const W={capital:null,settlements:[s],houses:[null,house],projects:[],roads:[],trackSet:new Set()};
  let reachable=true,siteAvailable=true,completeCalls=0,currentDay=17;const payments=[],events=[];
  s._lay={live:{keepFoundation(qsite){completeCalls++;if(!siteAvailable)return null;const keep={arch:'keep',x:qsite.f.x,z:qsite.f.z,w:qsite.f.w,d:qsite.f.d,tier:qsite.spec.tier,state:'sound',ownerId:1,timberKeep:!!qsite.spec.timber};s.buildings.push(keep);s.ward=qsite.ward;return keep;}}};
  const ctx=vm.createContext({W,s,G:{ordersDirty:false},ARCH:{keep:[20,24,18,1,'keep']},
    AD:()=>ad,PL:()=>1,day:()=>currentDay,year:()=>850,stoneFor:()=>12,wallCost:()=>100,circuitLen:()=>40,polyLen:()=>10,
    purse:hi=>hi===0?account.gold:account.gold,purseAcct:()=>account,houseAcct:()=>account,means:o=>o?.gold||0,
    townWorth:()=>10000,townThreat:()=>1,casLvl:()=>2,price:()=>1,landPrice:()=>0,furlongAt:()=>null,
    emit:(...e)=>events.push(e),bindPropertyRights:()=>{},syncLive:()=>{},markOccupiedGround:()=>{},castleFoundationGround:()=>({polys:[],cells:[]}),
    consumeOwnStock:(town,who,g,q)=>{const n=Math.min(q,town.stores[g]||0);town.stores[g]-=n;return n;},
    buyBuildingMaterial:(town,g,who,q)=>{const n=Math.min(q,reachable?Math.max(0,(who?.gold||0)-100):0);who.gold-=n;payments.push(['material',g,n]);return n;},
    buildWorks:(town,v,who,why)=>{const paid=workers>0?Math.min(v*workers,Math.max(0,who?.gold||0)):0;if(paid){who.gold-=paid;workersAccount.gold+=paid;}payments.push(['labour',why,paid]);return paid;},
    castleFoundationSite:(town,spec,retained=null)=>{if(!reachable||!siteAvailable)return null;if(!retained)site.spec=spec;return retained||site;},
  });
  vm.runInContext([constructionMethods,declaration('constructionCapability'),...functions.map(declaration)].join('\n'),ctx);
  return {ctx,W,s,house,account,site,payments,events,get completeCalls(){return completeCalls;},set reachable(v){reachable=v;},set siteAvailable(v){siteAvailable=v;},set cash(v){house.gold=v;account.gold=v;},set workers(v){workers=v;},set ad(v){ad=v;},set day(v){currentDay=v;},
    evaluate(code){return vm.runInContext(code,ctx);},propose(){ctx.s=s;return ctx.castleFoundationProposal(s,0);},commission(){return ctx.castleFoundationCommission(s,0);},tick(q){ctx.castleFoundationTick(q);}};
}

test('authority follows current capital, actual seat and defensive role, while ownership alone is insufficient',()=>{
  const r=fixture();
  assert.equal(r.evaluate('castleFoundationAuthority(s)'),true);
  r.s.role='village';r.house.seat=-1;assert.equal(r.evaluate('castleFoundationAuthority(s)'),false);
  r.W.capital=r.s;assert.equal(r.evaluate('castleFoundationAuthority(s)'),true);
  r.W.capital=null;r.house.seat=0;r.s.role='village';assert.equal(r.evaluate('castleFoundationAuthority(s)'),true);
  r.s.owner=0;assert.equal(r.evaluate('castleFoundationAuthority(s,1)'),false);
});

test('current purse and live site determine whether a first foundation can be proposed',()=>{
  const r=fixture();assert.ok(r.propose());
  r.cash=1;assert.equal(r.propose(),null,'a depleted current owner cannot commission it');
  r.cash=10000;r.reachable=false;assert.equal(r.propose(),null,'a lost site quote cannot commission it');
});

test('the first keep uses the shared historical method gate at its calendar boundary',()=>{
  const r=fixture({ad:1069});
  assert.equal(r.evaluate("constructionCapability(s,'stoneKeep').available"),false);
  assert.equal(r.evaluate('castleFoundationSpec(s).timber'),true);
  r.ad=1070;
  assert.equal(r.evaluate("constructionCapability(s,'stoneKeep').available"),true);
  assert.equal(r.evaluate('castleFoundationSpec(s).timber'),false);
  assert.equal(r.evaluate("constructionCapability(s,'unknown').available"),false);
});

test('commission stores one native project and suppresses a duplicate proposal',()=>{
  const r=fixture(),q=r.commission();assert.ok(q);assert.equal(q.type,'castle');assert.equal(q.worked,0);assert.equal(q.done,0);assert.equal(q.dead,false);
  assert.ok(q.spec&&q.site&&q.site.ward&&q.site.path);
  assert.equal(r.commission(),null);assert.equal(r.W.projects.length,1);
  assert.ok(r.evaluate("castleFoundationDemand(s,'timber')>0"));
});

test('the daily castle phase proposes a first project off the annual upgrade date, and the daily project phase completes it',()=>{
  const r=fixture({cash:10000});r.day=17;r.ctx.tickCastles();
  assert.equal(r.W.projects.length,1,'a seat may commission on this ordinary day');
  const q=r.W.projects[0];assert.equal(q.type,'castle');assert.equal(q.start,17);
  r.day=18;r.ctx.tickCastles();assert.equal(r.W.projects.length,1,'the following daily review does not duplicate its pending work');
  q.days=1;r.s.stores.timber=q.timber;r.s.stores.stone=q.stone;r.ctx.tickProjects();
  assert.equal(q.dead,true);assert.equal(q.done,1);assert.equal(r.W.projects.length,0,'the daily project dispatcher retires completed native work');
  assert.equal(r.s.buildings.filter(b=>b.arch==='keep').length,1);assert.equal(r.completeCalls,1);
});

test('exile and siege stall without buying materials or paying labour; loss of authority abandons the project',()=>{
  const r=fixture(),q=r.commission(),before=r.account.gold;r.house.exiled=true;r.tick(q);
  assert.equal(q.reason,'exile');assert.equal(q.worked,0);assert.equal(r.account.gold,before);
  r.house.exiled=false;r.s.siegeBy=7;r.tick(q);assert.equal(q.reason,'siege');assert.equal(q.worked,0);assert.equal(r.account.gold,before);
  r.s.siegeBy=null;r.s.role='village';r.house.seat=-1;r.tick(q);assert.equal(q.dead,true);assert.equal(q.worked,0);
});

test('materials must be acquired in full before paid working days begin',()=>{
  const r=fixture({cash:10000,timber:0,stone:0}),q=r.commission();assert.ok(q);
  r.reachable=false;r.tick(q);
  assert.equal(q.reason,'site-obstructed');assert.equal(q.worked,0);
  r.reachable=true;r.cash=100;r.tick(q);
  assert.equal(q.worked,0);assert.equal(q.materials,undefined);assert.equal(q.reason,'materials');
  assert.equal(r.evaluate("castleFoundationDemand(s,'timber')"),q.timber-(q.timberInstalled||0));
});

test('completion follows funded days once, installs the canonical keep and ward, and leaves no remaining demand',()=>{
  const r=fixture({ad:900,cash:10000}),q=r.commission();assert.ok(q);assert.equal(q.spec.timber,true);
  // The project keeps its quoted material quantities. Give the real owner stock and let actual work consume it.
  r.s.stores.timber=q.timber;r.s.stores.stone=q.stone;
  const before=r.account.gold;
  for(let i=0;i<q.days;i++)r.tick(q);
  assert.equal(q.worked,q.days);assert.equal(q.done,1);assert.equal(q.dead,true);
  assert.equal(r.s.buildings.filter(b=>b.arch==='keep').length,1);assert.equal(r.s.buildings[0].ownerId,1);
  assert.equal(r.s.ward,r.site.ward);assert.equal(r.s.buildings[0].timberKeep,true);assert.equal(r.s.motte,undefined);assert.equal(r.s.buildings[0].motte,undefined);assert.equal(r.completeCalls,1);
  assert.equal(r.evaluate("castleFoundationDemand(s,'timber')"),0);assert.equal(r.evaluate("castleFoundationDemand(s,'stone')"),0);
  assert.ok(r.account.gold<before,'the owner paid real labour');
});

test('no crew means no free progress; partial paid work advances by the fraction actually earned',()=>{
  const r=fixture({cash:10000}),q=r.commission();r.s.stores.timber=q.timber;r.s.stores.stone=q.stone;
  r.workers=0;r.tick(q);assert.equal(q.worked,0);assert.equal(q.paid,0);assert.equal(q.reason,'workers');
  r.workers=0.4;r.tick(q);assert.equal(q.worked,0.4);assert.ok(Math.abs(q.paid-q.labour/q.days*0.4)<1e-9);
  assert.equal(q.done,q.worked/q.days);
});

test('a partly paid day resumes at its exact fraction and the last share never exceeds quoted labour',()=>{
  const r=fixture({cash:10000}),q=r.commission();q.days=2;r.s.stores.timber=q.timber;r.s.stores.stone=q.stone;
  r.workers=0.4;r.tick(q);assert.equal(q.worked,0.4);assert.equal(q.done,0.2);
  r.workers=1;r.tick(q);assert.equal(q.worked,1.4);assert.equal(q.done,0.7);
  r.tick(q);assert.equal(q.worked,2);assert.equal(q.done,1);assert.equal(q.dead,true);
  assert.equal(r.completeCalls,1);assert.equal(r.s.buildings.length,1);
  const paid=r.payments.filter(p=>p[0]==='labour').reduce((n,p)=>n+p[2],0);
  assert.ok(Math.abs(paid-q.labour)<1e-9,`actual wages ${paid} equal quoted labour ${q.labour}`);
});

test('an obstruction after partial work stalls without another payment; restored access resumes from paid progress',()=>{
  const r=fixture({cash:10000}),q=r.commission();r.s.stores.timber=q.timber;r.s.stores.stone=q.stone;
  r.tick(q);assert.ok(q.worked>0);const paid=q.paid,cash=r.account.gold;
  r.reachable=false;r.tick(q);assert.equal(q.reason,'site-obstructed');assert.equal(q.paid,paid);assert.equal(r.account.gold,cash);
  r.reachable=true;r.tick(q);assert.ok(q.worked>1);
});
