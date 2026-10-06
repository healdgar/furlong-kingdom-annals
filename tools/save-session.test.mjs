// Saves and the tab's session: a refresh resumes the tab's game (#5), an off-day settlement is journaled and replayed
// at the same point (#25), and a two-click confirmation never reaches the journal half-given (#26).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {inlineGameScript} from './simulation-boundary.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=inlineGameScript(html);
const fn=n=>{const m=source.match(new RegExp('^(?:async )?function '+n+'\\b[\\s\\S]*?(?=^(?:async )?function |^const |^let |^/\\*|^// |$(?![\\s\\S]))','m'));assert.ok(m,`function ${n} exists`);return m[0];};
const line=prefix=>{const l=source.split('\n').find(x=>x.startsWith(prefix));assert.ok(l,`line ${prefix} exists`);return l;};
const region=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`region ${from}`);return source.slice(a,b);};

/* ---------------- #5: the tab's session ---------------- */
const sessionSource=region('/* TAB SESSION BEGIN','// TAB SESSION END');
const saveCodec=[line('const b64u='),...['worldIdentity','workerSaveNameValid','workerSaveCameraValid','validateSaveDocument','packSave','unpackSave','saveToDay'].map(fn)].join('\n');
function memoryStorage({failSet=()=>false,failGet=false}={}){
  const m=new Map(),writes=[];
  return{m,writes,getItem(k){if(failGet)throw Error('SecurityError: storage is disabled');return m.has(k)?m.get(k):null;},
    setItem(k,v){if(failSet(k,String(v)))throw Object.assign(Error('QuotaExceededError'),{name:'QuotaExceededError'});writes.push(k);m.set(k,String(v));},removeItem(k){m.delete(k);}};
}
function session({store=memoryStorage(),refuse=false}={}){
  const clock={t:1000},timers=[];
  const c={performance:{now:()=>clock.t},setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},
    Blob,Response,CompressionStream,DecompressionStream,TextEncoder,TextDecoder,btoa,atob,escape,unescape,encodeURIComponent,decodeURIComponent,Math,JSON,Number,String,Array,Object,Error,
    W:{clock:{day:0}},REPLAYING:false,saveDocument:()=>{throw Error('the foreground capture is not under test here');}};
  if(refuse)Object.defineProperty(c,'sessionStorage',{get(){throw Error('The document is sandboxed and lacks the "allow-same-origin" flag.');}});else c.sessionStorage=store;
  vm.createContext(c);vm.runInContext(saveCodec+'\n'+sessionSource+'\nglobalThis.S=TAB_SESSION;',c);
  return{c,store,clock,timers,run:x=>vm.runInContext(x,c)};
}
const HASH='#s=1001&f=42&y=850&c=sea';
const record=(day=40,hash=HASH.slice(1))=>({v:2,name:'',hash,build:'test',day,ad:850+Math.floor(day/360),realm:'Fixture',saved:1,who:'the crown',cam:null,
  j:[{k:'sov',on:true,hi:0,d:3},{k:'set',n:'tax',v:17,d:3},{k:'c',c:'s-relief',a:'2',d:day}]});
const camera={x:12.5,z:-40,d:900,yaw:0.5};

test('a refresh resumes the tab’s own game at the day it reached, through the save resume path',async()=>{
  const s=session();s.c.rec=record();s.c.cam=camera;
  assert.deepEqual(JSON.parse(JSON.stringify(await s.run(`tabSessionBoot(${JSON.stringify(HASH)},null)`))),{resumed:null,code:null,day:null},'nothing to resume in a new tab');
  assert.equal(s.run('tabSessionCapture(rec)'),true);
  s.clock.t+=1000;s.run('tabSessionDay(41,cam)');
  for(let d=42;d<=200;d++)s.run(`tabSessionDay(${d},cam)`); // a burst within 250 ms: one trailing write
  assert.equal(s.store.writes.filter(k=>k==='furlong-session-day').length,2,'the capture and the first day');
  assert.equal(s.timers.length,1);s.clock.t+=300;s.timers.shift()();
  assert.equal(JSON.parse(s.store.getItem('furlong-session-day')).day,200);
  // a later page of the same tab, refreshed: the link carries the same realm (a house to begin as is no part of it)
  const later=session({store:s.store});const boot=await later.run(`tabSessionBoot(${JSON.stringify(HASH+'&h=0')},null)`);
  assert.equal(boot.day,200);assert.equal(boot.resumed.day,200);assert.deepEqual({...boot.resumed.cam},camera);assert.match(boot.code,/^(F1|J1)/);
  const opened=await later.run(`unpackSave(${JSON.stringify(boot.code)})`);
  assert.deepEqual(JSON.parse(JSON.stringify(opened.j)),record().j);assert.equal(opened.day,40,'the code is the journal; the day travels beside it');
  later.c.o=opened;later.run('saveToDay(o,200)');assert.equal(opened.day,200);assert.equal(opened.ad,850);
  assert.equal(later.run('S.n'),s.run('S.n'),'the resumed entry is kept: day writes continue to match it');
  later.run(`tabSessionDay(260,null,true)`);assert.equal(later.run(`tabSessionResume(${JSON.stringify(HASH)})`).day,260);
});

test('another realm, an explicit save, a new game and Reforge are never overridden by the session',async()=>{
  const s=session();s.c.rec=record();s.run('tabSessionStart(null,null);tabSessionCapture(rec);tabSessionDay(90,null,true)');
  for(const other of ['#s=1001&f=43&y=850&c=sea','#s=1002&f=42&y=850&c=sea','#s=1001&f=42&y=1066&c=sea','#s=1001&f=42&y=850&c=land','#s=1001&f=42&y=850&c=sea&km=12','#s=1001&f=42&y=850&c=sea&map=britain','#s=1001&f=42&y=850'])
    assert.equal(s.run(`tabSessionResume(${JSON.stringify(other)})`),null,other);
  assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH+'&save=F1abc')})`),null,'a link with a save opens that save');
  // a save opened in this tab: its link wins, and it becomes the tab's game (a refresh mid-load opens it again)
  const savedRecord=record(500);const code=await s.run(`packSave(${JSON.stringify(savedRecord)})`);
  const boot=await s.run(`tabSessionBoot(${JSON.stringify(HASH+'&save='+code)},${JSON.stringify(code)})`);
  assert.equal(boot.code,code);assert.equal(boot.resumed,null);assert.equal(boot.day,null);
  assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`).day,500);
  // a different link in this tab begins a new game: the old entry goes
  const fresh=await s.run(`tabSessionBoot('#s=7&f=8&y=850',null)`);assert.equal(fresh.resumed,null);
  assert.equal(s.store.getItem('furlong-session'),null);assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`),null);
  // Reforge (or opening a save) ends the tab's game; the page's last writes on leaving do not bring it back
  s.run('tabSessionCapture(rec)');assert.ok(s.run(`tabSessionResume(${JSON.stringify(HASH)})`));
  s.run('tabSessionEnd()');assert.equal(s.store.getItem('furlong-session'),null);assert.equal(s.store.getItem('furlong-session-day'),null);
  s.run('tabSessionDay(400,null,true)');assert.equal(s.run('tabSessionCapture(rec)'),false);
  assert.equal(s.store.m.size,0);assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`),null);
});

test('a day written for another game, a corrupt entry or an implausible day is not trusted',()=>{
  const s=session();s.c.rec=record(40);s.run('tabSessionCapture(rec)');
  s.store.setItem('furlong-session-day',JSON.stringify({n:'another-game',day:999,cam:camera}));
  const r=s.run(`tabSessionResume(${JSON.stringify(HASH)})`);assert.equal(r.day,40);assert.equal(r.cam,null);
  s.store.setItem('furlong-session-day',JSON.stringify({n:s.run('S.n'),day:40+360*6000}));assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`).day,40);
  s.store.setItem('furlong-session','{not json');assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`),null);
  s.store.setItem('furlong-session',JSON.stringify({v:1,n:'x',record:{hash:HASH.slice(1),day:-1,j:[]}}));assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`),null);
});

test('storage that is refused, unreadable or full never breaks boot and never resumes an older journal',async()=>{
  // a sandboxed frame: touching sessionStorage throws
  const refused=session({refuse:true});refused.c.rec=record();
  assert.deepEqual(JSON.parse(JSON.stringify(await refused.run(`tabSessionBoot(${JSON.stringify(HASH)},null)`))),{resumed:null,code:null,day:null});
  assert.equal(refused.run('tabSessionCapture(rec)'),false);refused.run('tabSessionDay(5,null,true);tabSessionEnd()');
  const code=await refused.run(`packSave(${JSON.stringify(record(9))})`);
  assert.equal((await refused.run(`tabSessionBoot(${JSON.stringify(HASH+'&save='+code)},${JSON.stringify(code)})`)).code,code,'a save link still opens');
  // reads that throw
  const unreadable=session({store:memoryStorage({failGet:true})});
  assert.equal((await unreadable.run(`tabSessionBoot(${JSON.stringify(HASH)},null)`)).resumed,null);
  // full: the newer journal cannot be written, so the older one must not come back with a newer day
  let full=false;const store=memoryStorage({failSet:k=>full&&k==='furlong-session'});const s=session({store});s.c.rec=record(40);s.c.newer=record(80);
  s.run('tabSessionCapture(rec);tabSessionDay(60,null,true)');assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`).day,60);
  full=true;assert.equal(s.run('tabSessionCapture(newer)'),false);
  s.run('tabSessionDay(90,null,true)');assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`),null,'a refresh starts afresh rather than replay a stale journal');
  full=false;assert.equal(s.run('tabSessionCapture(newer)'),true);assert.equal(s.run(`tabSessionResume(${JSON.stringify(HASH)})`).day,80);
});

test('boot asks the session first and passes the day to both the worker and the foreground replay',()=>{
  const boot=fn('boot');
  assert.match(boot,/tabSessionBoot\(location\.hash,RESUME_CODE\)/);
  assert.match(boot,/resume:RESUME_CODE,resumeDay:RESUME_DAY/);
  assert.match(boot,/saveToDay\(await unpackSave\(RESUME_CODE\),RESUME_DAY\)/);
  assert.match(boot,/onsession=record=>tabSessionCapture\(record\)/);
  assert.match(boot,/onclock=c=>\{installClock\(c\);tabSessionDay\(c\.day,saveCamera\(\)\);\}/);
  assert.ok(boot.indexOf('history.replaceState')<boot.indexOf('tabSessionBoot('),'the realm is read from the normalized link');
  assert.match(fn('simulationWorkerModel'),/saveToDay\(save,options\.resumeDay\?\?null\);await replaySave\(save,progress\)/);
  assert.match(source,/addEventListener\('pagehide',autosaveOnPagehide\)/);
  assert.match(fn('resumeSave'),/tabSessionEnd\(\);location\.hash=/);
  assert.match(source,/tabSessionEnd\(\);location\.reload\(\); \/\/ a new game, deliberately/);
});

/* ---------------- the worker sends the session ---------------- */
const hostSource=region('// SIMULATION WORKER HOST BEGIN','// SIMULATION WORKER HOST END')+'\nglobalThis.Host=SimulationWorkerHost;globalThis.Client=SimulationWorkerClient;';
test('the worker sends the game’s save document after init and once per task in which the journal changed',async()=>{
  const jobs=[],out=[];let journal=[];
  const model={d:0,async init(){},day(){return this.d;},rate:()=>0,reeling:()=>false,speed(){},async wait(){},tick(){this.d++;return true;},validate(){},
    command(x){journal.push(x);host.journal();},view:()=>({day:0}),async flush(){return{};},session:()=>({day:model.d,j:journal.slice()})};
  const c=vm.createContext({model,send:m=>out.push(m),schedule:(f,ms)=>{jobs.push(f);return jobs.length;},cancel(){},Error,Map,Number,String,Promise,performance:{now:()=>0}});
  vm.runInContext(hostSource,c);const host=vm.runInContext('new Host(model,send,{now:()=>0,schedule,cancel,budget:5})',c);
  const drain=async()=>{for(let i=0;i<50&&jobs.length;i++){jobs.shift()();await new Promise(r=>setImmediate(r));}};
  host.receive({protocol:1,id:1,type:'init',payload:{seed:1}});await drain();
  const sessions=()=>out.filter(m=>m.type==='session');
  assert.equal(sessions().length,1,'one after init');assert.deepEqual(sessions()[0].value,{day:0,j:[]});
  host.receive({protocol:1,id:2,type:'command',payload:{k:'set',n:'tax',v:9}});host.journal();host.journal();await drain();
  assert.equal(sessions().length,2,'coalesced');assert.deepEqual(sessions()[1].value.j,[{k:'set',n:'tax',v:9}]);
  host.receive({protocol:1,id:3,type:'close'});await drain();host.journal();await drain();assert.equal(sessions().length,2,'none once closed');
  // a model without a session (the reference driver, older fixtures) sends none
  const quiet=vm.runInContext('new Host({...model,session:undefined},send,{now:()=>0,schedule,cancel})',c);out.length=0;quiet.journal();await drain();assert.equal(out.length,0);
  // the client hands it to the page
  const worker={postMessage(){},terminate(){}};const client=new c.Client(worker);let got;client.onsession=v=>got=v;
  worker.onmessage({data:{protocol:1,type:'session',value:{day:7,j:[]}}});assert.deepEqual(got,{day:7,j:[]});
  assert.match(fn('jot'),/JOURNAL_WATCH\?\.\(\);\}/);assert.match(fn('simulationWorkerRuntime'),/JOURNAL_WATCH=\(\)=>host\.journal\(\)/);
  assert.match(fn('simulationWorkerModel'),/session\(\)\{return saveDocument\(''\);\}/);
});

/* ---------------- #25: settlement before the day's end ---------------- */
const coreSource=html.slice(html.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */'),html.indexOf('/* Runtime adapters for numeric commodity custody. */'));
function ledgerRealm({replaying=false}={}){
  const c=vm.createContext({MODEL_ONLY:true,BACKGROUND:null,REPLAYING:replaying,W:{settlements:[],prehistory:false},events:[],watched:0,
    day:()=>7,storageOutcome:e=>c.events.push(e)});
  vm.runInContext(coreSource,c);
  vm.runInContext('let JOURNAL=[],JOURNAL_WATCH=()=>watched++;'+['commodityActive','commoditySettleAll','jot','journalCommands','replayEntry'].map(fn).join('\n')+
    "\nconst s={storage:new CommodityBalanceLedger({realmId:0,day:7})};s.storage.location('yard',{capacity:Infinity});W.settlements.push(s);globalThis.K=s.storage;globalThis.J=()=>JOURNAL;",c);
  return c;
}
test('a settlement before the day’s end is journaled; the daily one is not; a replay settles at the same point',()=>{
  const c=ledgerRealm(),run=x=>vm.runInContext(x,c);
  run("K.adjust('yard','grain','house','held',3,'relief');commoditySettleAll()");
  assert.deepEqual(JSON.parse(JSON.stringify(run('J()'))),[{k:'settle',d:7}]);assert.equal(c.events.length,1);assert.equal(run('K.settlementRevision'),1);assert.equal(c.watched,1);
  run('commoditySettleAll()');assert.equal(run('J().length'),1,'nothing left to settle: nothing journaled');
  run("K.adjust('yard','grain','house','held',2,'harvest');commoditySettleAll(true)");assert.equal(run('J().length'),1,'the day’s own settlement is not a command');assert.equal(run('K.settlementRevision'),2);
  assert.equal(run("journalCommands([{k:'c'},{k:'settle'},{k:'set'},{k:'settle'}])"),2);
  // the replay: same goods change, then the journaled settlement, then the day's end
  const r=ledgerRealm({replaying:true}),rr=x=>vm.runInContext(x,r);
  rr("K.adjust('yard','grain','house','held',3,'relief');replayEntry({k:'settle',d:7})");
  assert.equal(rr('K.settlementRevision'),1);assert.equal(r.events.length,1);assert.deepEqual(JSON.parse(JSON.stringify(r.events[0].deltas)),JSON.parse(JSON.stringify(c.events[0].deltas)));assert.equal(rr('J().length'),0,'a replay journals nothing');
  rr("K.adjust('yard','grain','house','held',2,'harvest');commoditySettleAll(true)");assert.equal(rr('K.settlementRevision'),2);
  assert.match(fn('simTick'),/commoditySettleAll\(true\);\n\}\n?$/);
  assert.match(fn('makeSave'),/commoditySettleAll\(\);return saveDocument\(name\);/);
  assert.match(fn('saveUIRender'),/journalCommands\(o\.j\)/);
});

/* ---------------- #26: confirmation in the interface ---------------- */
function confirmUI(){
  const clock={t:0},timers=[],runs=[];
  const c=vm.createContext({MODEL_ONLY:false,BACKGROUND:null,REPLAYING:false,W:{clock:{day:12},player:{on:true,house:1},prehistory:false},G:{},day:()=>12,
    performance:{now:()=>clock.t},setTimeout:f=>{timers.push(f);return timers.length;},runCmd:(cmd,arg)=>runs.push([cmd,arg])});
  vm.runInContext('let JOURNAL=[],JOURNAL_WATCH=null;'+line('const UI_CONFIRM_LABELS=')+'\n'+['uiConfirmKey','uiConfirmed','uiConfirmShow','jot'].map(fn).join('\n')+'\n'+source.match(/const cmdClick=e=>\{.*?\};/)[0]+';globalThis.J=()=>JOURNAL;',c);
  const button=(cmd,arg,label)=>{const text={nodeType:3,textContent:label},span={childNodes:[text]},b={dataset:{cmd,arg},disabled:false,text,querySelector:()=>span};
    b.parentNode={querySelectorAll:sel=>sel.includes(`[data-cmd="${cmd}"]`)?[b]:[]};b.closest=()=>b;return b;};
  const click=b=>vm.runInContext('cmdClick(e)',Object.assign(c,{e:{target:b}}));
  return{c,clock,timers,runs,button,click,journal:()=>JSON.parse(JSON.stringify(vm.runInContext('J()',c)))};
}
test('rebellion is armed in the interface; only the confirmed click is journaled and given',()=>{
  const u=confirmUI(),rebel=u.button('lord','rebel','Raise your banners against the crown');
  u.click(rebel);assert.deepEqual(u.journal(),[]);assert.deepEqual(u.runs,[]);assert.equal(rebel.text.textContent,'Confirm: raise your banners!');
  u.clock.t+=4000;u.click(rebel);assert.deepEqual(u.journal(),[{k:'c',c:'lord',a:'rebel',d:12}]);assert.deepEqual(u.runs,[['lord','rebel']]);
  assert.equal(rebel.text.textContent,'Raise your banners against the crown');
  u.click(rebel);u.clock.t+=5001;u.click(rebel);assert.equal(u.journal().length,1,'a confirmation that came too late arms again');assert.equal(u.runs.length,1);
  u.timers.forEach(f=>{try{f();}catch{}});
  // attainder: arming one house does not confirm another
  const a2=u.button('h-attaint','2','Attaint · 40%'),a3=u.button('h-attaint','3','Attaint · 55%');
  u.click(a2);u.click(a3);assert.equal(u.journal().length,1);assert.equal(a3.text.textContent,'Confirm attainder!');
  u.click(a3);assert.deepEqual(u.journal().at(-1),{k:'c',c:'h-attaint',a:'3',d:12});assert.deepEqual(u.runs.at(-1),['h-attaint','3']);
  // every other command is given at once
  u.click(u.button('lord','feast','Keep open table'));assert.deepEqual(u.runs.at(-1),['lord','feast']);
});
test('the simulation gives a confirmed rebellion or attainder at once and keeps no wall-clock time',()=>{
  const wars=[],c=vm.createContext({W:{war:null,truceUntil:9,legitimacy:50,player:{on:true,house:1},houses:[{},{name:'House A'},{name:'House B',loyalty:50,might:1,gold:0,seat:0}],settlements:[{owner:2,pos:{}}],capital:{pos:{}}},
    plyH:()=>1,lordHouse:()=>({h:{exiled:false},own:[],seat:{pos:{}},si:0}),startWar:(hi,why)=>{wars.push([hi,why]);c.W.war={hi};},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),chance:()=>false,attaintOdds:()=>0.4,emit(){},notableById(){},refreshOverlay(){}});
  vm.runInContext(['lordCmd','houseCmd'].map(fn).join('\n'),c);
  vm.runInContext("lordCmd('rebel')",c);assert.deepEqual(wars,[[1,'renounces its oaths and claims the throne']]);assert.equal(c.W.truceUntil,0);
  c.W.war=null;vm.runInContext("houseCmd('attaint',2)",c);assert.equal(c.W.legitimacy,44);assert.equal(wars.length,2,'a failed attainder: they rise');
  assert.deepEqual(Object.keys(c.W.player).sort(),['house','on']);
  assert.doesNotMatch(source,/confirmUntil|player\.confirm|P\.confirm/);
  assert.doesNotMatch(source,/\bW(?:\.[\w$]+)+\s*=\s*[^;]*\b(?:performance\.now|Date\.now)\(/,'no wall-clock time is stored in the world');
  assert.doesNotMatch(source,/pause:true,confirm:null/);
});
test('a v1 save keeps its reading: the first of two journaled clicks only armed the confirmation',()=>{
  const c=vm.createContext({W:{war:null,houses:[{},{exiled:false},{exiled:false}]},plyH:()=>1,lordHouse:()=>({h:{exiled:false},seat:{}})});
  vm.runInContext(fn('replayLegacyConfirm'),c);const L={armed:null},given=e=>!vm.runInContext('replayLegacyConfirm(e,L)',Object.assign(c,{e,L}));
  const rebel={k:'c',c:'lord',a:'rebel'},att=a=>({k:'c',c:'h-attaint',a});
  assert.deepEqual([rebel,rebel,rebel].map(given),[false,true,false]);
  L.armed=null;assert.deepEqual([att('1'),att('2'),att('2'),{k:'c',c:'lord',a:'feast'}].map(given),[false,false,true,true]);
  L.armed=null;c.W.war={};assert.equal(given(rebel),true,'at war a click armed nothing (and now does nothing)');
  assert.match(fn('replaySave'),/legacy=\(o\.v\|0\)<2\?\{armed:null\}:null/);assert.match(fn('saveDocument'),/\{v:2,/);
});
