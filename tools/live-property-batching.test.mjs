import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath=process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
// Frozen, unbatched methods from tools/soak-results/live-growth-20261010/pre-batching.html.
// Kept inline so the test does not depend on ignored snapshots or Git history.
const frozen=`
function homeScore(h,s,x,z,st,wk){const means=Math.max(0,h.w||0),fear=(s.raidedUntil>day()?1:0)+(s.siegeBy?1:0)+(W.war?0.4:0)+(s.walls>0?0.2:0);return -dist2d(x,z,wk.x,wk.z)/80-lotRentAt(s,x,z,st)*4/(1+means/6)+(inWalls(s,x,z)?0.3+fear:0)+((TRADE_ARCH[h.tr]||h.tr==='merchant')&&st&&(st.market||st.kind==='road')?0.5:0);}
function houseFolk(s){const homes=(s.buildings||[]).filter(b=>RESID.has(b.arch)&&b.state==='sound'&&!b.removed),cap=new Map();for(const b of homes){cap.set(b,capOf(b));b.hh=[];}const heads=new Set();for(const p of s.folk||[])heads.add(householdHead(p));const later=[];for(const h of heads){const b=h.bh;if(b&&cap.get(b)>0){cap.set(b,cap.get(b)-1);b.hh.push(h);}else later.push(h);}let rr=0;for(const h of later){const want=TRADE_ARCH[h.tr];let b=null;if(want)b=homes.find(x=>x.arch===want&&cap.get(x)>0);if(!b){const wk=workOf(h,s);let bs=-1e9;const st=Math.max(1,Math.floor(homes.length/40)),o0=(h.id>>>0)%st;for(let ii=o0;ii<homes.length;ii+=st){const x=homes[ii];if(!(cap.get(x)>0))continue;const v=homeScore(h,s,x.x,x.z,x.st,wk)+(TILLERS.has(h.tr)&&(x.arch==='house'||x.arch==='longhouse'||x.arch==='cot')?0.4:0);if(v>bs){bs=v;b=x;}}}if(!b)b=homes.find(x=>cap.get(x)>0)||null;if(!b&&homes.length)b=homes[(rr++)%homes.length];if(b){cap.set(b,(cap.get(b)||0)-1);b.hh.push(h);}h.bh=b;}for(const b of homes)if(b.hh.length)b._vac=0;if(typeof resetVacantResidentials==='function')resetVacantResidentials(s,homes.filter(b=>!(b.hh&&b.hh.length)));s._hhY=year();}
function moveIn(s){let empty=null;const vacated=new Set();for(const h of heads_(s,x=>!x.bh||x.bh.removed||x.bh.s!==s||x.bh.state!=='sound'||(x.bh.hh||[]).indexOf(x)>=capOf(x.bh)).sort((a,b)=>(b.w||0)-(a.w||0))){if(!empty)empty=[...vacantResidentials(s)];if(!empty.length)break;const wk=workOf(h,s);let bi=0,bs=-1e9;empty.forEach((x,i)=>{const v=homeScore(h,s,x.x,x.z,x.st,wk);if(v>bs){bs=v;bi=i;}});const b=empty.splice(bi,1)[0],old=h.bh;vacantResidentials(s).delete(b);if(old&&old.hh){old.hh=old.hh.filter(x=>x!==h);vacated.add(old);}b.hh=[h];h.bh=b;b._vac=0;}for(const b of vacated)vacantResidentialChanged(b.s||s,b);}
function houseBuyer(s,cost){const C=s._hbC&&s._hbC.d===day()?s._hbC:(s._hbC={d:day(),want:heads_(s,h=>!h.bh||h.bh.removed||h.bh.s!==s||(h.bh.hh||[]).indexOf(h)>=capOf(h.bh)).sort((a,b)=>(b.w||0)-(a.w||0)),rent:(()=>{const R=s.buildings.filter(b=>RESID.has(b.arch)&&b.state==='sound'&&!b.removed).slice(0,40);return R.length?R.reduce((t,b)=>t+propValue(b),0)/R.length*0.12:0;})()});const want=C.want.filter(h=>!h.bh||h.bh.removed||h.bh.s!==s||h.bh.hh&&h.bh.hh.indexOf(h)>=capOf(h.bh));if(!want.length)return null;if((want[0].w||0)>=cost)return{acct:want[0],id:want[0].id};const rent=C.rent*(W._pl||1);if(rent*12<cost)return null;const L=heads_(s,h=>(h.w||0)>=cost*2).sort((a,b)=>(b.w||0)-(a.w||0))[0];if(L)return{acct:L,id:L.id};const lord=lordAcct(s);return means(lord)>=cost?{acct:lord,id:'lord'}:null;}
function ownerOf(b,s){if(b.ownerId!==undefined)return b.ownerId;s=s||b.s;if(CHURCH_ARCH.has(b.arch)||b.ch)return b.ownerId='church';if(LORD_ARCH.has(b.arch)||b.motte||b.bailey)return b.ownerId='lord';if(TOWN_ARCH.has(b.arch))return b.ownerId='town';const occ=(b.hh||[])[0],P=W._pm||(W._pm=folkIndex());if(occ&&(s.kind==='village'||(occ.w||0)>propValue(b)*6||b.rural))return b.ownerId=occ.id;const rich=s.folk?headsOf(s).filter(h=>!h.role&&(h.w||0)>propValue(b)*10).sort((a,c)=>(c.w||0)-(a.w||0))[0]:null;return b.ownerId=rich?rich.id:'lord';}
`;
const declaration=(html,name)=>{
  const re=new RegExp(`^function ${name}\\([\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m');
  const match=html.match(re);assert.ok(match,`missing function ${name}`);return match[0];
};
const nativeRead=html=>{
  const match=html.match(/^const LV_READ_NATIVE=.*;$/m);
  return match?match[0]:'function lvReadNative(){return false;}';
};

function houses(n=5){return Array.from({length:n},(_,i)=>({id:`b${i}`,arch:'house',state:'sound',removed:false,tier:0,
  x:i*12,z:(i%2)*9,w:8,d:8,value:80+i*4,capacity:1,hh:[]}));}
function households(n=5){return Array.from({length:n},(_,i)=>({id:i+1,w:8+i*6,tr:'laborer',work:{x:i*9-8,z:(i%2)*10},bh:null}));}
function world(kind){
  const buildings=houses(kind==='owner'?1:5),folk=households(kind==='owner'?2:5),s={kind:'town',name:'Fixture',pos:{x:0,z:0},walls:0,wallRad:null,raidedUntil:0,siegeBy:null,
    buildings,folk,pop:300,extentR:80,stores:{timber:8},growSlots:[]};
  for(const b of buildings)b.s=s;
  if(kind==='owner'){
    folk[0].w=50;folk[1].w=500;folk[0].bh=buildings[0];buildings[0].hh=[folk[0]];
  }else if(kind==='buyer'){
    folk[0].w=1;folk[0].bh=null;folk[1].w=500;folk[1].bh=buildings[0];buildings[0].hh=[folk[1]];
    for(let i=1;i<buildings.length;i++){buildings[i].hh=[folk[1]];}
  }
  return s;
}

function realm(html,kind){
  const s=world(kind),W={war:null,_pl:1,_pm:new Map(),settlements:[s]},metrics={fields:0,prop:0,propField:0,fieldIds:[]};
  const prelude=`const RESID=new Set(['court','cot','house','longhouse','burgher','shop','tavern','smithy','bakery','inn','tannery','dyer','hospital','toll']);
    const CHURCH_ARCH=new Set(['temple','hospital','friary']),LORD_ARCH=new Set(['keep','hall','mill','windmill','granary','warehouse','toll','quarry','barn']),TOWN_ARCH=new Set(['guildhall','wharf','bath','market']);
    const TRADE_ARCH={},TILLERS=new Set();let lvSequence=0;
    function lvNative(){return true;}function lvField(s){metrics.fields++;return{id:++lvSequence,scale:1,s};}
    function lvAtField(F,x,z){metrics.fieldIds.push(F.id);return 20+x*0.13-z*0.07;}
    function lvAt(){return 0;}function useOf(){return 0;}
    function lotRentAt(s,x,z,st){const F=lvField(s);return lvAtField(F,x,z)*F.scale*0.144*(st&&st.planned?0.7:1);}
    function propValue(b){metrics.prop++;lvField(b.s);return b.value;}
    function propValueField(b,F){metrics.propField++;metrics.fieldIds.push(F.id);return b.value;}
    function workOf(h){return h.work||{x:0,z:0};}
    function heads_(s,pred=()=>true){return(s.folk||[]).filter(pred);}function headsOf(s){return s.folk||[];}
    function capOf(b){return b.capacity||1;}function householdHead(p){return p;}
    function inWalls(){return false;}function dist2d(x,z,X,Z){return Math.hypot(X-x,Z-z);}
    function folkIndex(){return new Map();}function day(){return 100;}function year(){return 4;}function frand(){return 0.2;}function randi(){return 0;}
    function resetVacantResidentials(){}function vacantResidentialChanged(){}
    function vacantResidentials(s){return new Set(s.buildings.filter(b=>RESID.has(b.arch)&&b.state==='sound'&&!b.removed&&!(b.hh&&b.hh.length)));}
    function means(){return 1000;}function lordAcct(){return{gold:1000};}`;
  // The host metrics object must be available before the extracted helpers execute.
  const bodies=['homeScore','houseFolk','moveIn','houseBuyer','ownerOf'].map(name=>declaration(html,name));
  const readBody=html.includes('function lvReadNative(')?declaration(html,'lvReadNative'):'';
  const code=[prelude,...bodies,nativeRead(html),readBody,';globalThis.api={houseFolk,moveIn,houseBuyer,ownerOf,homeScore,lvReadNative};'].join('\n');
  const c=vm.createContext({s,W,metrics});vm.runInContext(code,c,{filename:`live-property-batching-${kind}.js`});
  return{s,W,metrics,c,api:c.api};
}

function assigned(s){return s.folk.map(h=>h.bh&&h.bh.id);}
function op(html,kind,name){const r=realm(html,kind);const result=name==='ownerOf'?r.api[name](r.s.buildings[0],r.s):name==='houseBuyer'?r.api[name](r.s,45):r.api[name](r.s);return{...r,result,assigned:assigned(r.s)};}

test('home placement and move-in reuse one field and keep the pre-batching choices',()=>{
  for(const operation of ['houseFolk','moveIn']){
    const old=op(frozen,'home',operation),now=op(source,'home',operation);
    assert.deepEqual(now.assigned,old.assigned,`${operation}: residents keep the same homes`);
    assert.equal(now.metrics.fields,1,`${operation}: one lazy field serves the whole selection pass`);
    assert.equal(old.metrics.fields,15,`${operation}: the frozen path rereads for every still-eligible household/house pair`);
    assert.ok(now.metrics.fieldIds.every(id=>id===now.metrics.fieldIds[0]),`${operation}: every query uses the same certificate`);
  }
});

test('native operation guard falls back when home scoring, work, or RNG helpers are overridden',()=>{
  for(const edit of [
    "const original=homeScore;homeScore=(h,s,x,z,st,wk)=>original(h,s,x,z,st,wk)",
    "const original=workOf;workOf=(h,s)=>original(h,s)",
    "frand=()=>0.2"
  ]){
    const now=realm(source,'home');vm.runInContext(edit,now.c);
    assert.equal(now.api.lvReadNative('home'),false,'an operation with an overridden dependency is not certified');
    now.api.houseFolk(now.s);
    const old=op(frozen,'home','houseFolk');
    assert.deepEqual(assigned(now.s),old.assigned,'fallback preserves the original choice');
    assert.equal(now.metrics.fields,15,'fallback returns to one ordinary rent read per eligible candidate');
  }
});

test('owner valuation is memoized per building while house-buyer rent uses one pass field',()=>{
  const oldOwner=op(frozen,'owner','ownerOf'),newOwner=op(source,'owner','ownerOf');
  assert.equal(newOwner.result,oldOwner.result,'the same landlord is selected');
  assert.equal(newOwner.s.buildings[0].ownerId,oldOwner.s.buildings[0].ownerId);
  assert.equal(newOwner.metrics.prop,1,'the same building value is read once in the native owner decision');
  assert.equal(oldOwner.metrics.prop,3,'the frozen owner decision reevaluates the same value during the rich-household scan');
  assert.equal(newOwner.metrics.fields,1);assert.equal(oldOwner.metrics.fields,3);

  const fallbackOwner=realm(source,'owner');vm.runInContext('const original=propValue;propValue=b=>original(b)',fallbackOwner.c);
  assert.equal(fallbackOwner.api.lvReadNative('property'),false,'an overridden public value reader disables memoization');
  assert.equal(fallbackOwner.api.ownerOf(fallbackOwner.s.buildings[0],fallbackOwner.s),oldOwner.result);
  assert.equal(fallbackOwner.metrics.prop,3,'the fallback re-reads each ordinary owner valuation');

  const oldBuyer=op(frozen,'buyer','houseBuyer'),newBuyer=op(source,'buyer','houseBuyer');
  assert.ok(newBuyer.s._hbC.rent>0,`fixture rent was ${newBuyer.s._hbC.rent}`);
  assert.equal(newBuyer.result.id,oldBuyer.result.id,'the same payer funds the proposed house');
  assert.equal(newBuyer.s._hbC.rent,oldBuyer.s._hbC.rent,'mean rent is unchanged');
  assert.equal(newBuyer.metrics.fields,1,'native rents share one live property field');
  assert.equal(newBuyer.metrics.propField,newBuyer.s.buildings.length);
  assert.equal(oldBuyer.metrics.fields,oldBuyer.s.buildings.length,'the frozen path evaluates each rent separately');
  assert.equal(oldBuyer.metrics.prop,oldBuyer.s.buildings.length);
});

