#!/usr/bin/env node
// Native-Chrome test of seed/journal save replay after household ownership changes.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT=path.resolve(process.argv[2]||'tools/soak-results/ownership-replay');
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


const snap=`(()=>({day:day(),pop:W.settlements.map(s=>s.pop),households:[...W.households.values()].map(h=>({id:h.id,head:h.head&&h.head.id,cash:h.assets.w,debt:h.assets._debt,members:[...h.members].map(p=>p.id).sort((a,b)=>a-b),pop:[...h.population].map(([s,n])=>[W.settlements.indexOf(s),n])})),owners:W.settlements.map(s=>[...s._owners].map(([o,x])=>[o&&o.household?o.id:o==='crown'?'crown':o&&o.gn?o.id:o&&o.ch?'church':o&&o.buildings?'town':o&&o.name||'institution',x.held,x.sale,x.animals]))}))()`;
async function ready(c){const start=Date.now();while(!await ev(c,"!document.getElementById('loading')&&typeof W!=='undefined'&&!!W?.settlements").catch(()=>false)){if(Date.now()-start>120000)throw new Error('loading timed out');await sleep(250);}}
const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),node:process.version},base='#s=688673834&f=688673834&c=sea';let code,before;
for(const replay of [false,true]){const {c,kill}=await launch();try{await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__soakRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'});await c.send('Page.navigate',{url:PAGE+base+(replay?'&save='+code:'')});await ready(c);
  const gpu=await ev(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()");assert.ok(!/SwiftShader|llvmpipe|Software Rasterizer/i.test(gpu));result.gpu=gpu;
  if(!replay){await ev(c,'ownershipTick()');await ev(c,'(async()=>{for(let i=0;i<360;i++){simTick();if(day()%30===15||day()%360===0)await new Promise(r=>setTimeout(r,0));}})()');before=await ev(c,snap);code=await ev(c,"packSave(makeSave('ownership replay'))");}
  else{await ev(c,'ownershipTick()');const after=await ev(c,snap);result.equal=JSON.stringify(before)===JSON.stringify(after);fs.writeFileSync(OUT+'/before.json',JSON.stringify(before,null,2));fs.writeFileSync(OUT+'/after.json',JSON.stringify(after,null,2));result.day=after.day;result.errors=await ev(c,'errN');assert.equal(result.errors,0);}
  result.browser=await c.send('Browser.getVersion');
}finally{kill();}}
fs.writeFileSync(OUT+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(result.equal,true,'household state differs after a seed/journal save replay');
