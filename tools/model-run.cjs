#!/usr/bin/env node
/* Model run: the game's own simulation without Chrome or graphics, for timing, CPU profiles and identity digests.
   It loads the game script into Node's main context (as tools/simulation-boundary.mjs does in a fresh one) and plays
   day after day with simTick, waiting on the storage journal as the game does.

   node tools/model-run.cjs --seed 1001 --fate 42 --coast sea --days 7200 --out run.json
   Options: --src index.html (default: this checkout's)  --y AD (start year: history before it is played first)  --km N (map size)  --days N  --out file.json
     --every N            a measured window every N days (time, CPU, instructions if --ru, parts of the day if --phases 1)
     --measure a:b,c:d    measured windows: ticks a+1..b (ticks count from the day the world is ready)
     --phases 1           time each part of the day inside measured windows
     --prof a:b,...       CPU-profile these windows; default the first, middle and last 360-day years of the run; 0: none
     --profile-interval µs (1000)   --hotlist file (default tools/soak-results/hotlist.json; 0: none)
     --digest d1,d2       identity digest after these ticks: sha256 of simulation-boundary's capture (world graph,
                          world-only graph, RNG streams, people, households, journals); never inside a measured window
     --sizes 1            sizes of every list on the world, the places, buildings, households and folk, each year
     --ru path            a program printing "instructions cycles cputime" for a pid (macOS proc_pid_rusage), for instruction counts
     --serve PORT         afterwards stay idle and run POSTed probe code (body of an async function with RUN, tick(n),
                          prof(n,file), require and fs in scope; returns JSON); POST /exit ends it
   Each profiled window is scored by tools/cpu-score.mjs: functions (own and total time) and parts of the day in ms per
   simulated day, printed, kept in the output, and added to the hot list with the change since this world's last run.
   A V8 startup snapshot of a played world also works (pass options in MODEL_RUN_ARGS):
     MODEL_RUN_ARGS='--days 3600' node --snapshot-blob w.blob --build-snapshot tools/model-run.cjs
     MODEL_RUN_ARGS='--days 30 --digest 3630' node --snapshot-blob w.blob
   It resumes with an identical world, but building it costs about 2.6x the instructions per day and a resumed world
   about 1.4x, so snapshots are for probes and identity, not timing. */
const fs=require('fs'),vm=require('vm'),v8=require('v8'),os=require('os'),path=require('path');
const HIDE=['localStorage','sessionStorage','navigator']; // browser-only globals the headless game must not see (V8 cannot snapshot them)
const BUILD=v8.startupSnapshot.isBuildingSnapshot(),HERE=__dirname;
function args(){const a=process.env.MODEL_RUN_ARGS!==undefined?process.env.MODEL_RUN_ARGS.split(/\s+/).filter(Boolean):process.argv.slice(2),o={};
  for(let i=0;i<a.length;i++)if(a[i].startsWith('--')){const k=a[i].slice(2);o[k]=a[i+1]!==undefined&&!a[i+1].startsWith('--')?a[++i]:'1';}return o;}
const RUN=c=>vm.runInThisContext(c);
const PARTS=['ownershipTick','tickWeather','tickEconomy','tickPopulation','tickPolitics','tickMilitary','tickDomains','tickThreats','tickGrowth','tickLand','tickHistory','tickProjects','tickFolk','tickLivestock','tickShips','tickStone','tickTravel','tickErrands','tickMetro','tickTenure','tickStreets','tickChurches','tickCastles','tickCourts','tickInfill','tickSettlers','tickRepairs','tickVictory','tickWallWorks','tickGarrisons','tickCallToArms','tickMigration','tickMarket','tickHouseholds','tickWays','tickTitles','tickSovereign','tickEnvoys','routingPrepare','commoditySettleAll'];
function load(A){
  for(const k of HIDE)Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
  const src=path.resolve(A.src||path.join(HERE,'..','index.html'));
  const html=fs.readFileSync(src,'utf8'),m='<script>',a=html.indexOf(m),b=html.indexOf(m,a+m.length)+m.length,source=html.slice(b,html.indexOf('</script>',b));
  const seed=+(A.seed??1001),fate=+(A.fate??42),coast=A.coast||'sea',startAD=+(A.y||850);
  const km=A.km?+A.km:null,hash=`#s=${seed>>>0}&f=${fate>>>0}${coast==='none'?'':'&c='+coast}&y=${startAD}${km?'&km='+km:''}`;
  Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
  vm.runInThisContext(source,{filename:'index.html',lineOffset:html.slice(0,b).split('\n').length-1}); // profile lines are index.html's
  const sibling=path.join(path.dirname(src),'tools/simulation-boundary.mjs'),bt=fs.readFileSync(A.boundary||(fs.existsSync(sibling)?sibling:path.join(HERE,'simulation-boundary.mjs')),'utf8');
  const i0=bt.indexOf('export function captureExpression(){'),i1=bt.lastIndexOf('}',bt.indexOf('\nexport ',i0+10));
  globalThis.__hashWorldGraph=graph=>{const digest=require('crypto').createHash('sha256');const feed=v=>{ // as simulation-boundary.mjs
      if(v===null||typeof v!=='object'){digest.update(JSON.stringify(v));return;}
      if(Array.isArray(v)){digest.update('[');for(let i=0;i<v.length;i++){if(i)digest.update(',');feed(v[i]);}digest.update(']');return;}
      digest.update('{');const keys=Object.keys(v);for(let i=0;i<keys.length;i++){if(i)digest.update(',');digest.update(JSON.stringify(keys[i])+':');feed(v[keys[i]]);}digest.update('}');};
    feed(graph);return {sha256:digest.digest('hex'),nodes:graph.state.length,changes:graph.changes.length,functions:graph.code.length};};
  globalThis.__CAPTURE=new Function(bt.slice(i0+'export function captureExpression(){'.length,i1))();
  globalThis.__STATE={src,seed,fate,coast,startAD,km,ticks:0,srcSHA:require('crypto').createHash('sha256').update(html).digest('hex')};
  if(A.phases==='1'||BUILD)wrapParts();
}
function wrapParts(){ // a timer on each part of the day, running only inside measured windows
  globalThis.__PH={};globalThis.__PHON=false;
  for(const n of PARTS){const o=globalThis[n];if(typeof o!=='function')continue;
    globalThis[n]=function(...a){if(!__PHON)return o.apply(this,a);const t=performance.now();try{return o.apply(this,a);}finally{__PH[n]=(__PH[n]||0)+performance.now()-t;}};}
  globalThis.__PHWRAPPED=true;
}
async function boot(){
  const S=globalThis.__STATE,t0=Date.now();
  await RUN(`startSimulation({seed:${S.seed>>>0},fate:${S.fate>>>0},coast:${S.coast==='none'?'null':JSON.stringify(S.coast)},startAD:${S.startAD},outcomeJournal:new OutcomeJournal(async entry=>({chunk:entry.chunk,first:entry.first,last:entry.last}),{maxPendingBytes:64*1024*1024})})`);
  console.error('booted',Date.now()-t0,'ms; settlements',RUN('W.settlements.length'),'day',RUN('W.clock.day'));
}
const COUNTS=`(()=>{const s=W.settlements;let b=0,lots=0,folk=0,str=0;for(const x of s){b+=x.buildings.length;folk+=(x.folk||[]).length;str+=(x.streets||[]).length;lots+=x.storage?.lots?.size||0;}
  return {day:W.clock.day,places:s.length,towns:s.filter(x=>x.kind!=='village').length,pop:Math.round(s.reduce((t,x)=>t+x.pop,0)),folk,households:W.households?.size,buildings:b,streets:str,lots,
   armies:(W.armies||[]).filter(a=>!a.gone).length,roads:W.roads?.length,routes:Object.keys(W.routes||{}).length,annals:allLines.length,houses:W.houses?.length,fields:W.land?.F?.length,projects:W.projects?.length};})()`;
const SIZES=`(()=>{const sz=v=>v==null||typeof v!=='object'?null:Array.isArray(v)||ArrayBuffer.isView(v)?v.length:v instanceof Map||v instanceof Set?v.size:Object.keys(v).length;
  const keep=o=>Object.fromEntries(Object.entries(o).filter(e=>e[1]>=40).sort((a,b)=>b[1]-a[1])),sum=(L,o)=>{for(const x of L)for(const k of Object.keys(x)){const n=sz(x[k]);if(n!=null)o[k]=(o[k]||0)+n;}return o;};
  const top={};for(const k of Object.keys(W)){const n=sz(W[k]);if(n!=null)top[k]=n;}
  const folk=W.settlements.flatMap(s=>s.folk||[]),blds=W.settlements.flatMap(s=>s.buildings||[]);
  return {W:keep(top),settlement:keep(sum(W.settlements,{})),building:keep(sum(blds,{})),household:keep(sum([...(W.households?.values()||[])],{})),folk:keep(sum(folk,{})),folkN:folk.length,
    glob:{annals:allLines.length,history:HISTORY.records?.length??null,commands:typeof JOURNAL!=='undefined'?JOURNAL.length:null}};})()`;
const ruPath=A=>A.ru||process.env.FURLONG_RU||null;
function ru(A){const p=ruPath(A);if(!p)return {i:NaN,c:NaN};const [i,c]=require('child_process').execFileSync(p,[String(process.pid)]).toString().trim().split(' ').map(Number);return {i,c};}
const worldId=S=>`s${S.seed}-${S.coast}${S.fate!==S.seed?'-f'+S.fate:''}${S.km?'-km'+S.km:''}${S.startAD!==850?'-y'+S.startAD:''}`; // a grown world (larger map, later start) is its own world
function score(R,A,profiles){ // CPU scores of the profiled windows, printed, kept and added to the hot list
  if(!profiles.length)return;let C;try{C=require('./cpu-score.mjs');}catch(e){console.error('no CPU scoring:',e.message);return;}
  const S=globalThis.__STATE,ages=[];
  for(const {a,b,file} of profiles){const s=C.scoreProfile(JSON.parse(fs.readFileSync(file,'utf8')),{days:b-a});const c=C.compactScore(s);R.scores[`${a}:${b}`]=c;
    ages.push({year:Math.ceil(b/360),days:b-a,msDay:c.msDay,parts:c.parts,self:c.self,total:c.total,where:c.where});}
  if(!ages.length)return;
  const last=profiles.at(-1);console.error('\n'+C.formatScore(C.scoreProfile(JSON.parse(fs.readFileSync(last.file,'utf8')),{days:last.b-last.a}),{top:15,title:`${worldId(S)}, ticks ${last.a+1}–${last.b}`}));
  const hot=A.hotlist==='0'?null:path.resolve(A.hotlist||path.join(HERE,'soak-results/hotlist.json'));
  const rec={at:new Date().toISOString(),tool:'node',world:worldId(S),seed:S.seed,fate:S.fate,coast:S.coast,build:S.srcSHA.slice(0,12),commit:null,load:[R.runs.at(-1).loadAtStart[0],os.loadavg()[0]],fault:null,args:process.argv.slice(2),ages};
  try{rec.commit=require('child_process').execFileSync('git',['-C',path.dirname(S.src),'rev-parse','--short','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{}
  try{const f=RUN('typeof SIM_FAULTS==="undefined"?null:SIM_FAULTS.first');if(f)rec.fault={day:f.day,part:f.part};}catch{}
  let prev=null;if(hot)try{prev=C.updateHotlist(hot,rec);}catch(e){console.error('hot list not updated:',e.message);}
  R.hotlist=C.hotlistReport(rec,prev);console.error('\n'+R.hotlist);
}
async function play(A){
  const S=globalThis.__STATE,days=+(A.days||0),t0=Date.now(),end=S.ticks+days;
  const win=s=>(s||'').split(',').filter(x=>x&&x!=='0').map(r=>r.split(':').map(Number));
  const years=Math.ceil(days/360),yearWin=y=>[S.ticks+(y-1)*360,Math.min(end,S.ticks+y*360)];
  const measure=win(A.measure).concat(A.every?Array.from({length:Math.ceil(days/+A.every)},(_,k)=>[S.ticks+k*+A.every,Math.min(end,S.ticks+(k+1)*+A.every)]):[]);
  const prof=BUILD?[]:A.prof!==undefined?win(A.prof):days>0?[...new Set([1,Math.ceil(years/2),years])].map(yearWin):[];
  const digestAt=new Set((A.digest||'').split(',').filter(Boolean).map(Number));
  if(A.phases==='1'&&!globalThis.__PHWRAPPED)wrapParts();
  const R=(A.out&&fs.existsSync(A.out)?JSON.parse(fs.readFileSync(A.out,'utf8')):null)||{src:S.src,srcSHA:S.srcSHA,seed:S.seed,fate:S.fate,coast:S.coast,startAD:S.startAD,windows:[],digests:{},counts:[],scores:{}};
  R.scores=R.scores||{};R.runs=(R.runs||[]).concat([{argv:process.argv.slice(2),fromTick:S.ticks,loadAtStart:os.loadavg(),started:new Date().toISOString()}]);
  const save=()=>{if(A.out)fs.writeFileSync(A.out,JSON.stringify(R,null,1));};
  const cpu=()=>{const u=process.cpuUsage();return (u.user+u.system)/1000;};
  let session=null;const post=(m,p)=>new Promise((res,rej)=>session.post(m,p||{},(e,r)=>e?rej(e):res(r)));
  if(prof.length){session=new (require('inspector').Session)();session.connect();}
  const profiles=[],base=(A.out||path.join(process.cwd(),'model-run.json')).replace(/\.json$/,'');let cur=null;
  const digest=()=>{const j=RUN(`JSON.stringify(${__CAPTURE})`),e=JSON.parse(j),h=x=>require('crypto').createHash('sha256').update(x).digest('hex');
    return {day:e.day,digest:h(j),worldGraph:e.worldGraph.sha256,worldOnly:e.worldOnlyGraph.sha256,rng:h(JSON.stringify(e.rng)),settlements:e.settlements.length,households:e.households.length,people:e.people.length};};
  while(S.ticks<end){
    const i=S.ticks+1;
    for(const [a,b] of measure)if(i===a+1){cur={from:a,to:b,n:0,wall:0,R0:ru(A),c0:cpu(),ph0:{...(globalThis.__PH||{})},load0:os.loadavg()[0]};globalThis.__PHON=!!globalThis.__PHWRAPPED;}
    for(const [a] of prof)if(i===a+1){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:+(A['profile-interval']||1000)});await post('Profiler.start');}
    await RUN('STORAGE_OUTCOMES.wait()');
    const w0=performance.now(),ran=RUN('simTick()'),w=performance.now()-w0;
    if(ran===false)throw Error('tick blocked at '+i);
    S.ticks=i;if(cur){cur.n++;cur.wall+=w;}
    if(i%8===0)await RUN('STORAGE_OUTCOMES.journal.flush()');
    for(const [a,b] of prof)if(i===b){const r=await post('Profiler.stop'),file=`${base}.${a}-${b}.cpuprofile`;fs.writeFileSync(file,JSON.stringify(r.profile));profiles.push({a,b,file});}
    if(cur&&i===cur.to){const R1=ru(A),c1=cpu(),ph=globalThis.__PH||{},n=cur.n;
      const b={from:cur.from,to:cur.to,n,minstrPerDay:Number.isFinite(R1.i)?+((R1.i-cur.R0.i)/n/1e6).toFixed(1):null,mcycPerDay:Number.isFinite(R1.c)?+((R1.c-cur.R0.c)/n/1e6).toFixed(1):null,cpuMsPerDay:+((c1-cur.c0)/n).toFixed(2),wallMsPerDay:+(cur.wall/n).toFixed(2),
        load:[cur.load0,os.loadavg()[0]].map(x=>+x.toFixed(1)),phaseMsPerDay:Object.fromEntries(Object.keys(ph).map(k=>[k,+((ph[k]-(cur.ph0[k]||0))/n).toFixed(3)]).filter(e=>e[1]>0).sort((x,y)=>y[1]-x[1])),counts:JSON.parse(RUN(`JSON.stringify(${COUNTS})`))};
      if(A.probe)b.probe=JSON.parse(RUN(`JSON.stringify(${A.probe})`));
      R.windows.push(b);console.error(JSON.stringify({...b,phaseMsPerDay:Object.fromEntries(Object.entries(b.phaseMsPerDay).slice(0,6))}));cur=null;globalThis.__PHON=false;save();}
    if(digestAt.has(i)){if(cur)throw Error('digest day inside a measured window');await RUN('STORAGE_OUTCOMES.journal.flush()');const d=digest();R.digests[i]=d;console.error('digest',i,JSON.stringify(d));save();}
    if(i%360===0){const c=JSON.parse(RUN(`JSON.stringify(${COUNTS})`));if(A.sizes)c.sizes=JSON.parse(RUN(`JSON.stringify(${SIZES})`));c.tick=i;c.elapsedMs=Date.now()-t0;c.load=+os.loadavg()[0].toFixed(1);R.counts.push(c);console.error('year',i/360,JSON.stringify({...c,sizes:undefined}));save();}
  }
  await RUN('STORAGE_OUTCOMES.journal.flush()');await RUN('STORAGE_OUTCOMES.wait()');
  if(session)session.disconnect();
  R.runs.at(-1).loadAtEnd=os.loadavg();R.runs.at(-1).toTick=S.ticks;score(R,A,profiles);save();
}
function serve(A){return new Promise(done=>{
  const tick=async n=>{const S=globalThis.__STATE;for(let k=0;k<n;k++){await RUN('STORAGE_OUTCOMES.wait()');if(RUN('simTick()')===false)throw Error('blocked');S.ticks++;if(S.ticks%8===0)await RUN('STORAGE_OUTCOMES.journal.flush()');}return S.ticks;};
  const prof=async(n,file,interval)=>{const s=new (require('inspector').Session)();s.connect();const post=(m,p)=>new Promise((res,rej)=>s.post(m,p||{},(e,r)=>e?rej(e):res(r)));
    await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:interval||1000});await post('Profiler.start');const t0=process.cpuUsage();await tick(n);const r=await post('Profiler.stop');fs.writeFileSync(file,JSON.stringify(r.profile));s.disconnect();const u=process.cpuUsage(t0);return {ticks:globalThis.__STATE.ticks,cpuMs:(u.user+u.system)/1000};};
  const srv=require('http').createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',async()=>{
    if(req.url==='/exit'){res.end('bye');srv.close();done();return;}
    try{const r=await (new Function('RUN','A','tick','prof','require','fs',`return (async()=>{${body}\n})();`))(RUN,A,tick,prof,require,fs);res.end(JSON.stringify(r===undefined?null:r));}
    catch(e){res.statusCode=500;res.end(String(e&&e.stack||e));}});});
  srv.listen(+A.serve,'127.0.0.1',()=>console.error('serving on',A.serve,'at tick',globalThis.__STATE.ticks));});}
const A=args();
load(A);
if(BUILD){
  (async()=>{await boot();await play(A);console.error('snapshot at tick',globalThis.__STATE.ticks);})();
  v8.startupSnapshot.setDeserializeMainFunction(()=>{const A2=args();play(A2).then(()=>A2.serve?serve(A2):null).then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});});
}else (async()=>{await boot();await play(A);if(A.serve)await serve(A);})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
