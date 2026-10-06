#!/usr/bin/env node
// Map-site commission and physical custody checks in native Metal Chrome.
// Drives the main-thread reference simulation (foreground=1), not the simulation worker.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT=path.resolve(process.argv[2]||'tools/soak-results/storage-check');
fs.mkdirSync(OUT,{recursive:true});
const source=fs.readFileSync(ROOT+'/index.html');fs.writeFileSync(OUT+'/index.snapshot.html',source);
const PAGE=pathToFileURL(OUT+'/index.snapshot.html').href;
class CDP{ // the least of the DevTools protocol: send a command, await its answer, listen for events
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();
    this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=e=>rej(new Error('websocket: '+(e.message||'failed')));});
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(new Error('Chrome connection closed'));this.wait.clear();};
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.wait.has(m.id)){const w=this.wait.get(m.id);this.wait.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result);}
      else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.wait.set(id,{res,rej}));}
  on(method,f){if(!this.subs.has(method))this.subs.set(method,[]);this.subs.get(method).push(f);}
  close(){try{this.ws.close();}catch{}}}
async function ev(c,expr){const r=await c.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);return r.result.value;}
const active=new Set();
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const kill of active)kill();process.exit(sig==='SIGINT'?130:143);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function launch(){ // a headless Chrome of its own, with a throwaway profile
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-chrome-'));
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--enable-gpu','--ignore-gpu-blocklist']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const kill=()=>{active.delete(kill);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(kill);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);
    p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',c=>{clearTimeout(t);rej(new Error('Chrome exited '+c));});p.on('error',e=>{clearTimeout(t);rej(e);});});
  const port=new URL(ws).port,list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(),pg=list.find(t=>t.type==='page');
  const c=new CDP(pg.webSocketDebuggerUrl);await c.open;
  const cleanup=()=>{c.close();kill();};return {c,kill:cleanup};
  }catch(e){kill();throw e;}}

const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),checks:{}};
const {c,kill}=await launch(),errors=[];
try{
  await c.send('Page.enable');await c.send('Runtime.enable');
  c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;window.setInterval=()=>0;'});
  // foreground=1 selects the page's main-thread reference driver: under the default worker, simTick() throws. Pre-worker builds ignore it.
  await c.send('Page.navigate',{url:PAGE+'#s=1001&f=1001&c=sea&y=850&foreground=1'});
  const start=Date.now();while(!await ev(c,"typeof W!=='undefined'&&!!W&&!document.getElementById('loading')").catch(()=>false)){if(errors.length)throw Error(errors.join('\n'));if(Date.now()-start>180000)throw Error('Boot timeout');await sleep(100);}
  result.gpu=await ev(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);})()");assert.ok(!/SwiftShader|llvmpipe|Software/i.test(result.gpu));
  await ev(c,"setSpeed(0);jot({k:'sov',on:true,hi:0});setSovereign(true,0);window.__storageTest={};");
  result.checks.site=await ev(c,`(()=>{for(let si=0;si<W.settlements.length;si++){const s=W.settlements[si];if(s.owner!==0)continue;for(const st of s.streets||[])for(const p of st.pts||[])for(const r of [18,25,36])for(let k=0;k<8;k++){const x=p.x+r*Math.cos(k*Math.PI/4),z=p.z+r*Math.sin(k*Math.PI/4),q=storageSiteQuote(si,'grange',x,z,0);if(q.ok){__storageTest.site=q;return {si,x,z,cost:q.cost,marketDistance:q.marketDistance,productionDistance:q.productionDistance};}}}return null;})()`);assert.ok(result.checks.site,'No valid commission site');
  result.checks.preview=await ev(c,`(()=>{const q=__storageTest.site,s=W.settlements[q.si];showInspect({type:'settlement',s});setInspectorView('orders');document.getElementById('storage-arch-'+q.si).value='grange';document.querySelector('[data-cmd="storage-pick"][data-arg="'+q.si+'"]').click();const placing=placeMode==='storage';
    cam.mode='free';cam.follow=null;cam.focus.set(q.x,surfY(q.x,q.z),q.z);cam.cur.focus.copy(cam.focus);cam.dist=cam.cur.dist=170;cam.yaw=cam.cur.yaw=0;updateCamera(0,perfNow());camera.updateMatrixWorld();const point=new THREE.Vector3(q.x,surfY(q.x,q.z),q.z).project(camera);onClick({clientX:(point.x+1)*innerWidth/2,clientY:(1-point.y)*innerHeight/2});
    const b=document.querySelector('[data-cmd="storage-commission"]'),Q=STORAGE_UI.get(s);__storageTest.arg=b?.dataset.arg;return {placing,quoted:!!b,worldQuote:Object.hasOwn(s,'storageQuote'),x:Q?.x,z:Q?.z,reason:Q?.reason,view:inspectorView};})()`);
  assert.equal(result.checks.preview.placing,true);assert.equal(result.checks.preview.quoted,true);assert.equal(result.checks.preview.worldQuote,false);assert.equal(result.checks.preview.view,'orders');assert.ok(Math.abs(result.checks.preview.x-result.checks.site.x)<1&&Math.abs(result.checks.preview.z-result.checks.site.z)<1);
  result.checks.command=await ev(c,`(()=>{document.querySelector('[data-cmd="storage-commission"]').click();const entry=JOURNAL.at(-1),q=W.projects.find(q=>q.type==='storage'&&q.x===JSON.parse(decodeURIComponent(__storageTest.arg)).x);__storageTest.project=q;return {entry,project:q?{id:q.storageProjectId,si:q.si,arch:q.arch,x:q.x,z:q.z,payer:q.payer,done:q.done,dead:q.dead}:null,previewCleared:!STORAGE_UI.has(W.settlements[__storageTest.site.si])};})()`);
  assert.equal(result.checks.command.entry.c,'storage-commission');assert.ok(result.checks.command.project);assert.equal(result.checks.command.project.done,0);assert.equal(result.checks.command.previewCleared,true);
  await ev(c,`window.__storageCheck=()=>{let lots=0,facilities=0;for(const s of W.settlements){const K=s.storage;if(!K)continue;const quantities=new Map(),volume=new Map();for(const l of K.lots.values()){if(!Number.isFinite(l.qty)||l.qty<0)throw Error('Invalid lot '+l.id);const n=K.locations.get(l.location);if(!n)throw Error('Missing location '+l.id);lots++;volume.set(l.location,(volume.get(l.location)||0)+l.qty*(STORAGE_GOODS[l.good]?.volume??1));if(!n.transit)quantities.set(l.good,(quantities.get(l.good)||0)+l.qty);}for(const n of K.locations.values())if(n.active&&Number.isFinite(n.capacity)){facilities++;const used=volume.get(n.id)||0;if(used>n.capacity+64*Number.EPSILON*Math.max(1,used)*Math.max(1,K.lots.size))throw Error('Capacity exceeded '+s.name+'/'+n.id);}for(const[g,q]of quantities){if(Math.abs(q-s.stores[g])>64*Number.EPSILON*Math.max(1,q)*Math.max(1,K.lots.size))throw Error('Stock sum differs '+s.name+'/'+g);}}if(errN)throw Error('Simulation errors: '+errN);return {day:day(),lots,facilities};};`);
  result.checks.annual=[];for(let batch=0;batch<12;batch++){const state=await ev(c,`(async()=>{for(let i=0;i<30;i++){if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;continue;}__storageCheck();if(day()%15===0)await new Promise(r=>setTimeout(r,0));}return {...__storageCheck(),project:{done:__storageTest.project.done,dead:__storageTest.project.dead,reason:__storageTest.project.reason},history:STORAGE_OUTCOMES.status()};})()`);result.checks.annual.push(state);console.log(JSON.stringify(state));}
  result.checks.completion=await ev(c,`(async()=>{await STORAGE_OUTCOMES.flush();const q=__storageTest.project,s=W.settlements[q.si],b=s.buildings.find(b=>b.arch===q.arch&&Math.abs(b.x-q.x)<0.01&&Math.abs(b.z-q.z)<0.01);return {done:q.done,days:q.days,dead:q.dead,reason:q.reason,building:b?{arch:b.arch,state:b.state,storageId:b.storageId}:null,history:STORAGE_OUTCOMES.status(),errors:errN};})()`);
  assert.equal(result.checks.completion.dead,true);assert.equal(result.checks.completion.done,result.checks.completion.days);assert.ok(result.checks.completion.building?.storageId);assert.equal(result.checks.completion.errors,0);
  await ev(c,"updateCamera(0,perfNow());animateWorld(0,perfNow());renderer.render(scene,camera)");const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,'commission.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);result.passed=true;
}catch(e){result.passed=false;result.error=e.stack;result.errors=errors;try{result.failureState=await ev(c,"({day:day(),history:STORAGE_OUTCOMES.status(),lots:W.settlements.reduce((n,s)=>n+(s.storage?.lots.size||0),0),project:__storageTest.project?{done:__storageTest.project.done,reason:__storageTest.project.reason}:null})");}catch{}process.exitCode=1;}
finally{kill();fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
