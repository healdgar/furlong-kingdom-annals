#!/usr/bin/env node
// Isolated renderer/worker play-flow probe. Uses an owned Chrome profile and a frozen local HTML snapshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((out,v,i,all)=>{if(v.startsWith('--'))out.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return out;},[]));
const OUT=path.resolve(args.out||`/tmp/furlong-worker-play-${Date.now()}`);
if(fs.existsSync(OUT))throw Error('Choose a fresh --out directory');fs.mkdirSync(OUT,{recursive:true});
const input=fs.readFileSync(args.source||path.join(ROOT,'index.html'),'utf8');
const baselineSHA256=createHash('sha256').update(input).digest('hex');
const auditInjection=`\nglobalThis.FURLONG_PACKET_AUDIT=[];\nconst __playInstallPresentation=installPresentation;installPresentation=function(packet){const a=packet?.buildings;globalThis.FURLONG_PACKET_AUDIT.push({revision:packet?.revision,day:packet?.day,buildings:a?{count:a.length,holes:[...a.keys()].filter(i=>!a[i]).slice(0,40),idxs:a.map(b=>b?.idx).filter(Number.isInteger).slice(0,40),lastIdx:a.map(b=>b?.idx).filter(Number.isInteger).slice(-10)}:null,settlements:packet?.settlements?.map(s=>({si:s.si,count:s.buildings?.length,ids:s.buildings?.slice(0,8)}))});if(globalThis.FURLONG_PACKET_AUDIT.length>100)globalThis.FURLONG_PACKET_AUDIT.shift();return __playInstallPresentation(packet);};\nglobalThis.FURLONG_TICK_TRACE=[];const __playSimTick=simTick;simTick=function(){const value=__playSimTick();const d=day();if(d===1||d%10===0)globalThis.FURLONG_TICK_TRACE.push({day:d,rng:Object.fromEntries(Object.entries(RS).map(([k,r])=>[k,r.state()])),population:W.settlements.map(s=>+s.pop),treasury:+W.treasury,houseGold:W.houses.map(h=>+(h.gold||0)),folkCount:W.settlements.reduce((n,s)=>n+(s.folk?.length||0),0),player:{on:!!W.player?.on,pause:!!W.player?.pause,campLen:W.player?.campLen},lvf:W.settlements.map(s=>s._lvf?.y??null),sgKey:W.settlements.map(s=>s._sg?.key??null),commands:JOURNAL.map(e=>({...e}))});return value;};\nglobalThis.FURLONG_WORKER_AUDIT=(payload={})=>{\n  if(payload.action==='endgame')endGame('fall',0,null);\n  if(payload.action==='saveBest')saveBest(Number(payload.value));\n  const households=[...W.households.values()].map(h=>({id:h.id,head:h.head?.id??null,members:[...h.members].map(p=>p.id).sort((a,b)=>a-b),w:+(h.assets.w||0),debt:+(h.assets._debt||0),hunger:+(h.hunger||0),herd:Object.fromEntries(Object.entries(h.assets.herd||{}).sort(([a],[b])=>a.localeCompare(b))),pantry:W.settlements.flatMap((s,si)=>{const held=s._owners?.get(h)?.held;return held?[{si,goods:Object.fromEntries(Object.entries(held).sort(([a],[b])=>a.localeCompare(b)))}]:[];})})).sort((a,b)=>a.id.localeCompare(b.id));\n  const towns=W.settlements.map((s,si)=>({si,pop:+s.pop,stores:Object.fromEntries(Object.entries(s.stores||{}).sort(([a],[b])=>a.localeCompare(b))),owners:s._owners?[...s._owners].map(([o,v])=>[o?.id??o?.ownerId??o?.head?.id??String(o),v.held||null,v.sale||null,v.reserve||null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))):[],storageSeq:s.storage?.seq??null,storageLots:s.storage?.lots instanceof Map?[...s.storage.lots.values()].map(l=>[l.id,l.owner?.id??l.owner?.ownerId??String(l.owner),l.good,+(+l.qty||0).toFixed(6),l.location,l.availability]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))):[]}));\n  const accounts=[['crown',W.crownBook,W.treasury],...W.houses.slice(1).map((h,i)=>['house:'+i,h,h.gold]),...W.settlements.map((s,i)=>['town:'+i,s,s.murage||0])].filter(([,h])=>h?.cashY).map(([id,h,cash])=>{const books=[h.cashY,h.cashPrev].filter(Boolean).map(B=>({...B,towns:[...B.towns].map(([s,T])=>[W.settlements.indexOf(s),T])})),B=h.cashY,sum=o=>Object.values(o).reduce((a,b)=>a+b,0),inc=sum(B.receipts),exp=sum(B.payments);return{id,cash,books,gap:B.closing-B.opening-inc+exp,liveGap:cash-B.closing,tolerance:1e-7*Math.max(1,Math.abs(cash),Math.abs(B.opening),inc,exp)};});\n  const named=W.settlements.flatMap(s=>(s.folk||[]).map(p=>({id:p.id,si:p.si,dead:!!p.dead,hunger:+(p.fed??0)}))).sort((a,b)=>a.id-b.id);\n  return JSON.stringify({accounts,day:day(),commands:JOURNAL.map(e=>({...e})),rng:Object.fromEntries(Object.entries(RS).map(([k,r])=>[k,r.state()])),population:towns.map(t=>[t.si,t.pop]),named,households,towns,treasury:+W.treasury,houseGold:W.houses.map(h=>+(h.gold||0)),tax:+MOD.tax,dues:W.houses.map(h=>+(h.dues||0)),storageSeq:STORAGE_OUTCOMES.journal?.seq??null,personId:named[0]?.id??null,notableId:W.notables.find(n=>n.alive)?.id??null,pause:!!W.player?.pause,readCaches:{lvf:W.settlements.map(s=>s._lvf?.y??null),sgKey:W.settlements.map(s=>s._sg?.key??null)},player:{on:!!W.player?.on,pause:!!W.player?.pause,campLen:W.player?.campLen},replaying:!!REPLAYING,tickTrace:globalThis.FURLONG_TICK_TRACE.slice(),buildingMeta:{length:W.bldList.length,holes:Array.from({length:W.bldList.length},(_,i)=>W.bldList[i]?null:i).filter(Number.isInteger).slice(0,80),bad:Array.from({length:W.bldList.length},(_,i)=>{const b=W.bldList[i];return b&&b.idx!==i?{i,idx:b.idx,state:b.state}:null;}).filter(Boolean).slice(0,30),missingReferenced:W.settlements.flatMap(s=>(s._buildingIds||[]).filter(i=>!W.bldList[i]).map(i=>({si:s.si,id:i}))).slice(0,40)}});\n};\n`;
const marker='function simulationWorkerRuntime(){';
if(!input.includes(marker))throw Error('Source lacks the worker runtime marker');
const snapshot=input.replace(marker,auditInjection+'\n'+marker),sourceSHA256=createHash('sha256').update(snapshot).digest('hex');
fs.writeFileSync(path.join(OUT,'index.snapshot.html'),snapshot);
const seed=Number(args.seed||1001),fate=Number(args.fate||42),coast=args.coast||'sea',startAD=Number(args['start-ad']||850);
const hash=`#s=${seed}&f=${fate}&c=${coast}&y=${startAD}`;
const run={baselineSHA256,sourceSHA256,seed,fate,coast,startAD,hash,node:process.version,started:new Date().toISOString(),evidenceDir:OUT};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const file=pathname==='/index.html'||pathname==='/'?null:path.resolve(ROOT,'.'+pathname);
  if(file&&(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())){res.writeHead(404);return res.end('not found');}
  res.writeHead(200,{'content-type':file?mime[path.extname(file).toLowerCase()]||'application/octet-stream':'text/html; charset=utf-8','cache-control':'no-store'});
  if(file)fs.createReadStream(file).pipe(res);else res.end(snapshot);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port,CHROME=process.env.CHROME||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!CHROME)throw Error('Chrome or Chromium was not found');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),profile=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-worker-play-profile-'));
let child,cdp,closed=false;const errors=[],consoleErrors=[],frameDeltas=[],workerFaults=[];
class CDP{
  constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.events=new Map();this.open=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data),pending=this.pending.get(m.id);if(pending){this.pending.delete(m.id);m.error?pending.reject(Error(m.error.message)):pending.resolve(m.result);}else if(m.method)for(const f of this.events.get(m.method)||[])f(m.params);};this.ws.onclose=()=>{for(const p of this.pending.values())p.reject(Error('Chrome closed'));this.pending.clear();};}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  on(method,fn){if(!this.events.has(method))this.events.set(method,[]);this.events.get(method).push(fn);}
  async eval(expression){if(/\bawait\b/.test(expression)&&!expression.trimStart().startsWith('(async'))expression=`(async()=>{${expression}})()`;let timer;const r=await Promise.race([this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CDP evaluate timed out after 30s: '+expression.slice(0,180))),30000);})]).finally(()=>clearTimeout(timer));if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  close(){try{this.ws.close();}catch{}}
}
function cleanup(){if(closed)return;closed=true;cdp?.close();child?.kill('SIGKILL');server.close();fs.rmSync(profile,{recursive:true,force:true});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup();process.exit(signal==='SIGINT'?130:143);});
async function launch(){
  child=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader']), '--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const wsUrl=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),30000);child.stderr.on('data',data=>{stderr+=data;const m=/DevTools listening on (ws:\/\/\S+)/.exec(stderr);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('error',reject);});
  const tabs=await(await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/list`)).json();cdp=new CDP(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await cdp.open;await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')consoleErrors.push(e.args.map(a=>a.description||a.value).join(' '));});
  cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='warning'&&e.args.some(a=>String(a.value||a.description||'').includes('Background simulation')))workerFaults.push(e.args.map(a=>a.value||a.description).join(' '));});
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__frameLast=performance.now();window.__frameDeltas=[];const __raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>__raf(t=>{window.__frameDeltas.push(t-window.__frameLast);window.__frameLast=t;f(t);});`});
}
const timeout=Number(args['boot-timeout']||240)*1000;
async function waitFor(expression,label,limit=timeout){const until=Date.now()+limit;let nextDiagnostic=Date.now()+5000;while(Date.now()<until){if(errors.length){try{result.runtimeDiagnostics=await cdp.eval(`({url:location.href,resumed:typeof RESUMED==='undefined'?null:RESUMED,resumeCode:typeof RESUME_CODE==='undefined'?null:!!RESUME_CODE,revision:typeof G==='undefined'?null:G.workerRevision,buildingLength:W?.bldList?.length,buildingHoles:W?.bldList?Array.from({length:W.bldList.length},(_,i)=>W.bldList[i]?null:i).filter(Number.isInteger).slice(0,100):null,buildingBad:W?.bldList?Array.from({length:W.bldList.length},(_,i)=>{const b=W.bldList[i];return b&&b.idx!==i?{i,idx:b.idx,state:b.state}:null;}).filter(Boolean).slice(0,60):null,settlementIds:W?.settlements?.map(s=>({si:s.si,buildingIds:s._buildingIds?.length,missing:s._buildingIds?.filter(i=>!W.bldList?.[i]).slice(0,30)})),workerBuildHoles:W?.bldList?Array.from({length:W.bldList.length},(_,i)=>W.bldList[i]?null:i).filter(Number.isInteger).slice(0,100):null,packets:globalThis.FURLONG_PACKET_AUDIT?.slice(-12),detDirty:!!G?.detDirty})`);try{result.workerRuntimeAudit=await audit();}catch(e){result.workerAuditError=String(e.message||e);}fs.writeFileSync(path.join(OUT,'progress.json'),JSON.stringify(result,null,2));}catch(e){}throw Error(errors.join('\n'));}try{const value=await cdp.eval(expression);if(value)return value;}catch{}if(label.includes('worker save reload')&&Date.now()>=nextDiagnostic){try{const d=await cdp.eval(`(async()=>{let ready='pending';await Promise.race([BACKGROUND.ready.then(()=>ready='resolved',e=>ready='rejected:'+String(e)),new Promise(r=>setTimeout(r,300))]);let summary=null,summaryError=null;try{summary=await Promise.race([BACKGROUND.request('view',{kind:'summary'}),new Promise((_,j)=>setTimeout(()=>j(Error('summary timeout')),1500))]);}catch(e){summaryError=String(e.message||e);}return{url:location.href,loading:document.getElementById('loading')?.textContent||null,renderer:!!renderer,resumed:RESUMED,resumeCode:RESUME_CODE?String(RESUME_CODE).slice(0,4):null,optionResume:!!BACKGROUND.options?.resume,ready,closed:BACKGROUND.closed,pending:BACKGROUND.pending.size,revision:G.workerRevision,day:day(),speed:speedIdx,fault:BACKGROUND.fault?.message||null,summary,summaryError};})()`);result.replayDiagnostics||=[];result.replayDiagnostics.push(d);fs.writeFileSync(path.join(OUT,'progress.json'),JSON.stringify(result,null,2));}catch(e){result.replayDiagnostics||=[];result.replayDiagnostics.push({probeError:String(e)});}nextDiagnostic=Date.now()+5000;}await sleep(250);}throw Error(label+' timed out');}
async function audit(){return JSON.parse(await cdp.eval('BACKGROUND.request(\'view\',{kind:\'audit\'})'));}
async function stableAudit(){const a=await audit();return a;}
async function waitWorkers(){await cdp.eval('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
const result={...run,errors,consoleErrors,workerFaults,stages:[],passed:false};
function semanticAudit(a){return Object.fromEntries(Object.entries(a).filter(([k])=>!['tickTrace','buildingMeta','readCaches'].includes(k)));}
function traceState(trace){return trace.map(({lvf,sgKey,commands,...state})=>state);}
function cacheTrace(trace){return trace.map(({day,lvf,sgKey})=>({day,lvf,sgKey}));}
function auditDiff(left,right){const out=[];function walk(a,b,key='$'){if(JSON.stringify(a)===JSON.stringify(b))return;if(out.length>=40)return;if(a&&b&&typeof a==='object'&&typeof b==='object'){const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of keys){if(out.length>=40)break;walk(a[k],b[k],Array.isArray(a)?`${key}[${k}]`:`${key}.${k}`);}}else out.push({path:key,saved:a,replayed:b});}walk(left,right);return out;}
function checkpoint(name,details={}){result.stages.push({name,at:new Date().toISOString(),errors:errors.slice(),consoleErrors:consoleErrors.slice(),workerFaults:workerFaults.slice(),...details});fs.writeFileSync(path.join(OUT,'progress.json'),JSON.stringify(result,null,2));}
try{
  await launch();
  const url=`http://127.0.0.1:${port}/index.html${hash}`;
  await cdp.send('Page.navigate',{url});
  const boot=await waitFor('document.getElementById("loading")===null&&!!renderer&&!!W&&!!BACKGROUND','drawn application boot');
  await sleep(Number(args['settle-ms']||750));
  result.boot=await cdp.eval(`({day:day(),settlements:W.settlements.length,buildings:W.bldList.length,triangles:renderer.info.render.triangles,projection:{households:Object.hasOwn(W,'households'),townOwners:W.settlements.some(s=>Object.hasOwn(s,'_owners')),storage:W.settlements.some(s=>Object.hasOwn(s,'storage')),houseLedger:W.houses.some(h=>Object.hasOwn(h,'led')),population:W.settlements.map(s=>s.pop)},worker:!!BACKGROUND,revision:G.workerRevision,hash:location.hash})`);
  checkpoint('drawn-boot',{day:result.boot.day,triangles:result.boot.triangles});
  if(!result.boot.worker||result.boot.settlements<2||result.boot.triangles<=0)throw Error('Default drawn worker boot was incomplete');
  result.gpu=await cdp.eval(`(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()`);
  if(/SwiftShader|llvmpipe|Software Rasterizer/i.test(result.gpu))throw Error('Hardware GPU required for drawn play; got '+result.gpu);
  if(result.boot.projection.households||result.boot.projection.townOwners||result.boot.projection.storage||result.boot.projection.houseLedger)throw Error('Main presentation projection contains canonical account/storage ledgers');

  await cdp.eval("await BACKGROUND.request('pause')");
  const paused=await audit();if(paused.speed!==undefined&&paused.speed!==0)throw Error('Worker did not pause');
  await cdp.eval('await workerRefreshLandscapeBootstrap()');
  result.boot.projection.population=await cdp.eval('W.settlements.map(s=>s.pop)');
  result.paused={day:paused.day,commands:paused.commands.length,projection:result.boot.projection};
  if(JSON.stringify(result.boot.projection.population)!==JSON.stringify(paused.population.map(row=>row[1])))throw Error('Projected settlement populations differ from worker authority: '+JSON.stringify({projected:result.boot.projection.population,worker:paused.population}));
  checkpoint('paused-and-projection',{day:paused.day,population:result.boot.projection.population});
  await cdp.eval('await setSovereign(true,0)');
  const crownUI=await cdp.eval("({sov:document.body.classList.contains('sov'),drawerOpen:!document.getElementById('drawer').classList.contains('closed'),tab:drawerTab})");
  const afterSovereign=await audit();
  const rate=await cdp.eval("const input=document.querySelector('#sovtax-number');if(!input)throw Error('tax control missing');input.value='17';input.dispatchEvent(new Event('change',{bubbles:true}));let v;for(let i=0;i<80;i++){v=JSON.parse(await BACKGROUND.request('view',{kind:'audit'}));if(v.tax===17)break;await new Promise(r=>setTimeout(r,25));}return {audit:v,input:+document.querySelector('#sovtax-number').value,slider:+document.querySelector('#sovtax').value}");
  const afterTax=rate.audit;
  if(afterTax.tax!==17||rate.input!==17||rate.slider!==17)throw Error('Ruler tax UI command did not reach worker/control: '+JSON.stringify(rate));
  if(!crownUI.sov||!crownUI.drawerOpen||crownUI.tab!=='crown')throw Error('Sovereignty UI did not activate Crown drawer: '+JSON.stringify(crownUI));
  result.commands={day:afterTax.day,count:afterTax.commands.length,tax:afterTax.tax,sovereignStarted:afterSovereign.commands.some(c=>c.k==='sov'),crownUI};
  if(!result.commands.sovereignStarted||result.commands.count<2)throw Error('Paused semantic commands were not journaled');
  const beforePlay=await audit();if(beforePlay.pause)await cdp.eval("await runCmd('pause-toggle','')");const playState=await audit();if(playState.pause)throw Error('Sovereign pause-on-petition setting blocked play');
  checkpoint('sovereignty-and-tax',{count:result.commands.count,tax:result.commands.tax,crownUI,pauseOnPetition:beforePlay.pause,playPauseOnPetition:playState.pause});

  await cdp.eval("await workerOpenInfo('accounts')");
  await cdp.eval('await showInspect({type:\'settlement\',s:W.settlements[0]})');
  const settlementCard=await cdp.eval(`({type:inspTarget?.workerCard?.targetType||inspTarget?.type,hasWorkerCard:!!inspTarget?.workerCard,hasOrders:!!document.getElementById('inspacts').innerHTML})`);
  const personId=afterTax.personId;
  if(personId!=null)await cdp.eval(`await workerShowInspector({type:'person',workerCode:'p${personId}'})`);
  const personCard=personId==null?null:await cdp.eval(`({type:inspTarget?.workerCard?.targetType||inspTarget?.type,hasWorkerCard:!!inspTarget?.workerCard})`);
  result.inspection={infoKind:await cdp.eval('infoUI.kind'),settlement:settlementCard,personId,person:personCard};
  if(!settlementCard.hasWorkerCard||settlementCard.type!=='settlement')throw Error('Settlement inspector did not render from worker data');
  if(personId!=null&&(!personCard?.hasWorkerCard||personCard.type!=='person'))throw Error('Person inspector did not render from worker data');
  checkpoint('inspection',{settlement:settlementCard.type,person:personCard?.type||null});

  const overlayBefore=await audit();result.overlays=[];
  for(const mode of ['territory','tongue','trade','value','landuse','production','prosperity','plague','unrest']){
    const overlayData=await cdp.eval(`(async()=>{if(overlayMode)setOverlay(overlayMode);setOverlay(${JSON.stringify(mode)});if(['trade','value','landuse','production'].includes(${JSON.stringify(mode)}))await BACKGROUND.request('view',{kind:'overlay',mode:${JSON.stringify(mode)}});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {mode:overlayMode,workerData:!!G.overlayData,triangles:renderer.info.render.triangles};})()`);
    result.overlays.push(overlayData);
  }
  await cdp.eval('if(overlayMode)setOverlay(overlayMode)');
  await waitWorkers();
  const overlayAfter=await audit();
  result.overlayReadOnly=JSON.stringify(overlayBefore.commands)===JSON.stringify(overlayAfter.commands)&&JSON.stringify(overlayBefore.rng)===JSON.stringify(overlayAfter.rng)&&JSON.stringify(overlayBefore.population)===JSON.stringify(overlayAfter.population)&&JSON.stringify(overlayBefore.readCaches)===JSON.stringify(overlayAfter.readCaches)&&overlayBefore.day===overlayAfter.day;
  if(!result.overlayReadOnly)throw Error('Overlay views changed canonical state, commands, RNG, population, or day');
  checkpoint('overlays',{modes:result.overlays.map(x=>x.mode),readOnly:true});

  await cdp.eval("await setSpeed(5)");
  await cdp.eval("await BACKGROUND.request('watch',{kind:'landscape',everyDays:1})");
  await cdp.eval(`(()=>{const original=BACKGROUND.onview;BACKGROUND.__playOriginalOnView=original;BACKGROUND.onview=async packet=>{await new Promise(r=>setTimeout(r,120));return original(packet);};})()`);
  const reelStart=(await audit()).day;await sleep(Number(args['reel-ms']||5000));await cdp.eval("await setSpeed(0)");
  const reelPaused=(await audit()).day;await sleep(350);const reelSettled=(await audit()).day;
  result.reel={start:reelStart,paused:reelPaused,settled:reelSettled,advanced:reelPaused-reelStart,postPause:reelSettled-reelPaused};
  if(result.reel.advanced<=0)throw Error('Reel did not advance while its worker render acknowledgement was delayed');
  if(result.reel.postPause>0)throw Error('Reel kept advancing after pause acknowledgement');
  checkpoint('reel-pause',{...result.reel});
  await cdp.eval("BACKGROUND.onview=BACKGROUND.__playOriginalOnView;delete BACKGROUND.__playOriginalOnView;await BACKGROUND.request('watch',{kind:'landscape',everyDays:30})");
  await cdp.eval("await setSpeed(4)");await sleep(1200);const normal=(await audit()).day;await cdp.eval("await setSpeed(6)");await sleep(1400);const life=await cdp.eval("BACKGROUND.request('view',{kind:'summary'})");await cdp.eval("await setSpeed(0)");
  result.speeds={normalDay:normal,lifeDay:life.day,lifeIndex:life.speed,paused:(await audit()).day};
  if(life.speed!==6)throw Error('Life speed request did not reach the worker');
  checkpoint('normal-and-life-speeds',{...result.speeds});

  await cdp.eval("await BACKGROUND.request('pause')");
  const preSave=await stableAudit();
  const accountBefore=await stableAudit();
  await cdp.eval("await workerOpenInfo('accounts')");
  const kingdomCash=await cdp.eval("document.getElementById('infobody').textContent");
  await cdp.eval("await workerOpenInfo('accounts',W.settlements[0])");
  const townCash=await cdp.eval("document.getElementById('infobody').textContent");
  const domainCash=await cdp.eval("(async()=>{const q=await BACKGROUND.request('view',{kind:'ui',panel:'inspect',code:'h1',full:true});return JSON.stringify(q);})()");
  const accountAfter=await stableAudit();
  const unbalanced=(accountAfter.accounts||[]).filter(a=>Math.abs(a.gap)>a.tolerance||Math.abs(a.liveGap)>a.tolerance||a.books.some(B=>B.towns.some(([si])=>si<0)));
  if(unbalanced.length)throw Error('Annual cash books do not reconcile: '+JSON.stringify(unbalanced));
  result.annualAccounts={kingdom:kingdomCash.includes('Income')&&kingdomCash.includes('Expenses')&&kingdomCash.includes('Surplus / deficit'),town:townCash.includes('Town chest')&&townCash.includes('Income')&&townCash.includes('Expenses'),domain:domainCash.includes('Income')&&domainCash.includes('Expenses'),readOnly:JSON.stringify(semanticAudit(accountBefore))===JSON.stringify(semanticAudit(accountAfter))};
  if(Object.values(result.annualAccounts).some(v=>!v))throw Error('Annual accounts missing or changing canonical state: '+JSON.stringify(result.annualAccounts));
  fs.writeFileSync(path.join(OUT,'accounts.kingdom.txt'),kingdomCash);fs.writeFileSync(path.join(OUT,'accounts.town.txt'),townCash);fs.writeFileSync(path.join(OUT,'accounts.domain.json'),domainCash);
  await cdp.eval("document.querySelector('#infobody .detail-section[id*=ruler]')?.scrollIntoView({block:'start'})");
  const accountsShot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'accounts.png'),Buffer.from(accountsShot.data,'base64'));
  checkpoint('annual-accounts',result.annualAccounts);
  const save=await cdp.eval("BACKGROUND.request('save-record',{name:'drawn worker play check',cam:{x:+cam.focus.x.toFixed(1),z:+cam.focus.z.toFixed(1),d:Math.round(cam.dist),yaw:+cam.yaw.toFixed(3)}})");
  const saveCode=await cdp.eval(`packSave(${JSON.stringify(save)})`);
  result.save={day:save.day,commands:save.j.length,hash:save.hash,codePrefix:saveCode.slice(0,2),camera:save.cam};
  if(save.day!==preSave.day||save.j.length!==preSave.commands.length)throw Error('Canonical save record missed a committed day or command');
  checkpoint('save-record',{day:save.day,commands:save.j.length});
  result.savedDigest=createHash('sha256').update(JSON.stringify(semanticAudit(preSave))).digest('hex');result.savedAudit=preSave;
  await cdp.eval("await BACKGROUND.request('pause');await BACKGROUND.request('advance',{days:3})");
  const continued=await stableAudit();result.continued={day:continued.day,digest:createHash('sha256').update(JSON.stringify(continued)).digest('hex')};
  if(continued.day!==preSave.day+3)throw Error('Paused worker did not advance exactly three days');
  checkpoint('post-save-advance',{day:continued.day});

  result.preReloadErrors=errors.slice();result.preReloadConsoleErrors=consoleErrors.slice();result.preReloadWorkerFaults=workerFaults.slice();
  try{result.preReloadDiagnostics=await cdp.eval(`({day:day(),revision:G.workerRevision,buildingLength:W.bldList.length,buildingHoles:Array.from({length:W.bldList.length},(_,i)=>W.bldList[i]?null:i).filter(Number.isInteger).slice(0,100),buildingBad:Array.from({length:W.bldList.length},(_,i)=>{const b=W.bldList[i];return b&&b.idx!==i?{i,idx:b.idx,state:b.state}:null;}).filter(Boolean).slice(0,60),settlementIds:W.settlements.map(s=>({si:s.si,count:s._buildingIds?.length,missing:s._buildingIds?.filter(i=>!W.bldList[i]).slice(0,30)})),packets:FURLONG_PACKET_AUDIT.slice(-12),detDirty:!!G.detDirty})`);result.preReloadWorkerAudit=await audit();}catch(e){result.preReloadDiagnosticError=String(e.message||e);}
  fs.writeFileSync(path.join(OUT,'progress.json'),JSON.stringify(result,null,2));errors.length=0;consoleErrors.length=0;workerFaults.length=0;
  const resumedURL=`http://127.0.0.1:${port}/index.html${hash}&save=${saveCode}`;
  await cdp.send('Page.navigate',{url:'about:blank'});await cdp.send('Page.navigate',{url:resumedURL});
  await waitFor('document.getElementById("loading")===null&&!!renderer&&!!BACKGROUND&&RESUMED&&!!BACKGROUND.options.resume','same-profile worker save reload',90000);
  await sleep(1000);const replayed=await stableAudit();
  result.replay={day:replayed.day,commands:replayed.commands.length,digest:createHash('sha256').update(JSON.stringify(semanticAudit(replayed))).digest('hex'),camera:await cdp.eval('({x:+cam.focus.x.toFixed(1),z:+cam.focus.z.toFixed(1),d:Math.round(cam.dist),yaw:+cam.yaw.toFixed(3)})')};
  result.replayMatchesSave=result.savedDigest===createHash('sha256').update(JSON.stringify(semanticAudit(replayed))).digest('hex');const savedStateTrace=traceState(preSave.tickTrace),replayedStateTrace=traceState(replayed.tickTrace),traceMismatch=savedStateTrace.findIndex((x,i)=>JSON.stringify(x)!==JSON.stringify(replayedStateTrace[i]));result.tickTraceDiff=traceMismatch<0?(savedStateTrace.length===replayedStateTrace.length?null:{savedLength:savedStateTrace.length,replayLength:replayedStateTrace.length}):{index:traceMismatch,saved:savedStateTrace[traceMismatch],replayed:replayedStateTrace[traceMismatch]};result.readCacheTraceDiff=auditDiff(cacheTrace(preSave.tickTrace),cacheTrace(replayed.tickTrace));if(!result.replayMatchesSave){result.replayAudit=replayed;result.auditDiff=auditDiff(semanticAudit(preSave),semanticAudit(replayed));}
  if(!result.replayMatchesSave||replayed.day!==save.day||replayed.commands.length!==save.j.length)throw Error('Worker replay did not match the exact saved semantic snapshot');
  checkpoint('replay-match',{day:replayed.day,commands:replayed.commands.length});
  await cdp.eval("await BACKGROUND.request('pause');await BACKGROUND.request('advance',{days:3})");
  const continuedReplay=await stableAudit();result.replayContinue={day:continuedReplay.day,commands:continuedReplay.commands.length};
  if(continuedReplay.day!==replayed.day+3)throw Error('Resumed worker did not continue from the saved day');
  checkpoint('replay-advance',{day:continuedReplay.day});
  const profileKey='annals-best-'+seed,priorBest=await cdp.eval(`+(localStorage.getItem(${JSON.stringify('annals-best-'+seed)})||0)`);
  await cdp.eval("await BACKGROUND.request('view',{kind:'audit',action:'saveBest',value:98765});installPresentation(await BACKGROUND.request('view',{kind:'landscape'}))");
  const bestSaved=await cdp.eval(`+(localStorage.getItem(${JSON.stringify('annals-best-'+seed)})||0)`);
  if(bestSaved<98765)throw Error('Worker best score did not persist into the browser-local profile');
  await cdp.eval("await BACKGROUND.request('view',{kind:'audit',action:'endgame'});installPresentation(await BACKGROUND.request('view',{kind:'landscape'}))");
  const endgame=await cdp.eval("({visible:document.getElementById('endgame').style.display==='flex',text:document.getElementById('endgame').textContent.slice(0,80),speed:speedIdx,localBest:+localStorage.getItem('annals-best-'+SEED)})");
  result.endgame={...endgame,priorBest,bestSaved};
  if(!endgame.visible||endgame.speed!==0||endgame.localBest<98765)throw Error('Worker endgame/pause/profile presentation did not reach the drawn page: '+JSON.stringify(result.endgame));
  checkpoint('endgame-visible-and-profile-persisted',result.endgame);
  const final=await cdp.eval('({day:day(),triangles:renderer.info.render.triangles,revision:G.workerRevision,speed:speedIdx,journalCount:BACKGROUND?W._commandCount:null,storage:BACKGROUND?null:STORAGE_OUTCOMES.journal.seq,worldHouseholds:Object.hasOwn(W,"households")})');
  result.final=final;result.frameHeartbeat=await cdp.eval('({samples:window.__frameDeltas.length,maxMs:Math.max(0,...window.__frameDeltas),avgMs:window.__frameDeltas.reduce((a,b)=>a+b,0)/Math.max(1,window.__frameDeltas.length)})');
  const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'final.png'),Buffer.from(shot.data,'base64'));
  result.errors=[...(result.preReloadErrors||[]),...errors];result.consoleErrors=[...(result.preReloadConsoleErrors||[]),...consoleErrors];result.workerFaults=[...(result.preReloadWorkerFaults||[]),...workerFaults];result.passed=!result.errors.length&&!result.consoleErrors.length&&!result.workerFaults.length;result.finished=new Date().toISOString();
  if(!result.passed)throw Error('Browser exception, console error, or worker fault recorded');
}catch(error){result.failure=String(error.stack||error);result.errors=[...(result.preReloadErrors||[]),...errors];result.consoleErrors=[...(result.preReloadConsoleErrors||[]),...consoleErrors];result.workerFaults=[...(result.preReloadWorkerFaults||[]),...workerFaults];result.finished=new Date().toISOString();}
finally{
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:result.passed,failure:result.failure||null,baselineSHA256,sourceSHA256,stages:result.stages,boot:result.boot,commands:result.commands,inspection:result.inspection,overlays:result.overlays?.map(x=>x.mode),reel:result.reel,speeds:result.speeds,save:result.save,replayMatchesSave:result.replayMatchesSave,auditDiff:result.auditDiff,tickTraceDiff:result.tickTraceDiff,readCacheTraceDiff:result.readCacheTraceDiff,preReloadDiagnostics:result.preReloadDiagnostics,replayDiagnostics:result.replayDiagnostics,final:result.final,frameHeartbeat:result.frameHeartbeat,errors:result.errors,workerFaults:result.workerFaults,out:OUT},null,2));
  cleanup();
}
if(!result.passed)process.exitCode=1;
