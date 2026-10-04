#!/usr/bin/env node
/* Local rendering regression: matched paused views, shader linking, geometry/texture budgets,
   off-centre camera uniforms, live rebuilds and a short deterministic history against a Git ref.
   Node 22+ and Chrome; all snapshots and measurements remain on disk.
   node tools/render-check.mjs --baseline HEAD --seeds 1001:sea,2002:land --days 720 --out /tmp/furlong-render-check
   --webgl1 exercises the r128 fallback using a temporary source snapshot, not an app setting.
   --touch --width 390 --height 844 emulates a phone viewport on this host. */
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const CHROME=process.env.CHROME||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p)),RENDER=true;
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
    ...(RENDER?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const kill=()=>{active.delete(kill);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(kill);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);
    p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',c=>{clearTimeout(t);rej(new Error('Chrome exited '+c));});p.on('error',e=>{clearTimeout(t);rej(e);});});
  const port=new URL(ws).port,list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(),pg=list.find(t=>t.type==='page');
  const c=new CDP(pg.webSocketDebuggerUrl);await c.open;
  const cleanup=()=>{c.close();kill();};return {c,kill:cleanup};
  }catch(e){kill();throw e;}}

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
if(args.help){console.log(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('/*')[1].split('*/')[0]);process.exit(0);}
if(!CHROME)throw new Error('Chrome not found; set CHROME to its executable');
const OUT=path.resolve(args.out||path.join(os.tmpdir(),'furlong-render-'+Date.now()));
if(fs.existsSync(path.join(OUT,'results.json')))throw new Error('choose a fresh output directory');
fs.mkdirSync(OUT,{recursive:true});
const days=Number(args.days??720),worlds=String(args.seeds||'1001:sea,2002:land').split(',').map(s=>{const[seed,coast]=s.split(':');return{seed:Number(seed),coast};});
if(!Number.isInteger(days)||days<0||worlds.some(w=>!Number.isInteger(w.seed)||!['sea','land'].includes(w.coast)))throw new Error('invalid days or seed:coast');
const sources={candidate:fs.readFileSync(path.join(ROOT,'index.html'),'utf8')};
if(args.baseline)sources.baseline=execFileSync('git',['show',String(args.baseline)+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:10e6});
const run={sourceSHA256:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,createHash('sha256').update(s).digest('hex')])),args,startedUTC:new Date().toISOString(),node:process.version};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
for(const[k,s]of Object.entries(sources))fs.writeFileSync(path.join(OUT,k+'.html'),args.webgl1?s.replace('renderer=new THREE.WebGLRenderer(', 'renderer=new THREE.WebGL1Renderer('):s);

const INSPECT=`(()=>{
  const gl=renderer.getContext(),count=m=>m?(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1):0;
  const parts=[G.terrain,G.apron,G.roads,G.roadJoins,G.bridges,G.rivers,G.lakes,G.sea,G.bodies,G.roofs,...G.treeChunks,G.regrow,...Object.values(G.det)];
  const textures=new Set();for(const m of parts.filter(Boolean)){if(m.material.map)textures.add(m.material.map);for(const t of Object.values(renderer.properties.get(m.material).uniforms||{}))if(t?.value?.isTexture)textures.add(t.value);}
  const P=renderer.properties.get(G.terrain.material).currentProgram,name=G.land.uni.uSurfaceEye?'uSurfaceEye':'cameraPosition',loc=gl.getUniformLocation(P.program,name),eye=loc?Array.from(gl.getUniform(P.program,loc)):null;
  return{errors:errN,linked:renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),webgl2:renderer.capabilities.isWebGL2,
    camera:camera.position.toArray(),terrainEye:eye,textureSizes:[...textures].map(t=>[t.image.width,t.image.height]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
    textureCount:renderer.info.memory.textures,triangles:Object.fromEntries(parts.filter(Boolean).map((m,i)=>[i,count(m)])),geometryTriangles:parts.filter(Boolean).reduce((n,m)=>n+count(m),0),
    render:{...renderer.info.render},shadow:{extent:G.sun.shadow.camera.right,normalBias:G.sun.shadow.normalBias}};
})()`;
const HISTORY=`(()=>({day:W.clock.day,treasury:W.treasury,monarch:W.monarch.id,houses:W.houses.map(h=>({name:h.name,gold:h.gold,seat:h.seat,exiled:h.exiled})),
  places:W.settlements.map(s=>({name:s.name,owner:s.owner,pop:s.pop,prosperity:s.prosperity,stores:s.stores,
    buildings:s.buildings.map(b=>({arch:b.arch,tier:b.tier,state:b.state,x:b.x,z:b.z,w:b.w,d:b.d,h:b.h,removed:b.removed,ch:b.ch})),
    folk:s.folk.map(p=>({id:p.id,age:p.age,w:p.w,alive:p.alive,home:p.home?.idx}))})),errors:errN}))()`;

async function check(which,w){
  const {c,kill}=await launch(),id=which+'-'+w.seed+'-'+w.coast,errors=[];
  try{
    await c.send('Page.enable');await c.send('Runtime.enable');
    c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
    c.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.description||a.value).join(' '));});
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__renderRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'});
    await c.send('Emulation.setDeviceMetricsOverride',{width:Number(args.width||1440),height:Number(args.height||900),deviceScaleFactor:1,mobile:!!args.touch});
    if(args.touch)await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    await c.send('Page.navigate',{url:pathToFileURL(path.join(OUT,which+'.html')).href+`#s=${w.seed}&f=${w.seed}&c=${w.coast}`});
    const deadline=Date.now()+120000;let ready=false;
    while(Date.now()<deadline){if(errors.length)throw new Error(errors.join('\n'));ready=await ev(c,"document.getElementById('loading')===null&&typeof renderer!=='undefined'");if(ready)break;await sleep(200);}
    if(!ready)throw new Error('boot timeout');
    await ev(c,"setSpeed(0);cam.mode='free';document.body.classList.add('hideui');");
    const views={capital:"[W.capital.pos.x,W.capital.pos.z,110,2.3]",street:"(()=>{const b=W.capital.buildings.find(b=>b.arch==='house');return[b.x,b.z,48,b.rot+0.8];})()",
      woodland:"(()=>{const t=G.treeSpots.dec.find(t=>Math.hypot(t.x,t.z)<3200)||G.treeSpots.dec[0];return[t.x,t.z,95,0.6];})()",
      river:"(()=>{const r=G.rivStrips.find(r=>r.pts.length>50)||G.rivStrips[0],p=r.pts[Math.floor(r.pts.length*0.7)];return[p.x,p.z,110,0.9];})()",
      bridge:"(()=>{const q=G.bridgeSpans.reduce((a,b)=>Math.hypot(b.a.x-W.capital.pos.x,b.a.z-W.capital.pos.z)<Math.hypot(a.a.x-W.capital.pos.x,a.a.z-W.capital.pos.z)?b:a);return[(q.a.x+q.b.x)/2,(q.a.z+q.b.z)/2,95,Math.atan2(q.b.z-q.a.z,q.b.x-q.a.x)+0.6];})()",realm:"[0,0,4200,0.8]"};
    const result={id,views:{},errors};
    for(const[v,expr]of Object.entries(views)){
      await ev(c,`(()=>{const q=${expr};flyTo(...q);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);animateWorld(0,0);scene.updateMatrixWorld(true);renderer.render(scene,camera);})()`);
      result.views[v]=await ev(c,INSPECT);
      const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+v+'.png'),Buffer.from(shot.data,'base64'));
      // Submission time and actual GPU timer queries are separate; neither is device FPS.
      result.views[v].timing=await ev(c,`(async()=>{const gl=renderer.getContext(),ext=renderer.capabilities.isWebGL2?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null,a=[],queries=[];
        for(let i=0;i<12;i++){const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
          const t=performance.now();renderer.render(scene,camera);if(i>2)a.push(performance.now()-t);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}
          await new Promise(window.__renderRAF);}
        for(let i=0;i<20&&queries.some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE));i++)await new Promise(r=>setTimeout(r,10));
        const valid=ext&&!gl.getParameter(ext.GPU_DISJOINT_EXT),gpu=valid?queries.slice(3).filter(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)).map(q=>gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6):[];
        queries.forEach(q=>gl.deleteQuery(q));return{submitMs:a.reduce((a,b)=>a+b)/a.length,gpuMs:gpu.length?gpu.reduce((a,b)=>a+b)/gpu.length:null};})()`);
    }
    if(which==='candidate'){
      result.cameraCorrect=Object.values(result.views).every(v=>v.terrainEye&&v.terrainEye.every((x,i)=>Math.abs(x-v.camera[i])<0.001));
      result.liveRebuild=await ev(c,`(()=>{
        const b=W.capital.buildings.find(b=>b.arch==='house'),state=b.state,meshCount=G.roofs.count,colour=G.roofs.geometry.attributes.aGableColor.array.slice(0,meshCount*3);
        b.state='ruin';updateBuildingInstance(b);b.state=state;updateBuildingInstance(b);
        const old=G.roofs.instanceMatrix.count;bldRoom(old);rebuildDetails();rebuildRoadMesh();renderer.render(scene,camera);
        const now=G.roofs.geometry.attributes.aGableColor.array;
        const t=Object.values(G.treeSpots).flat().find(t=>t.shown!==false&&!t.cut),before=new THREE.Matrix4(),after=new THREE.Matrix4(),wood=G.feat.src[3].slice();
        t.m.getMatrixAt(t.ci,before);showTree(t,false);showTree(t,true);t.m.getMatrixAt(t.ci,after);
        return{capacityGrew:G.roofs.instanceMatrix.count>old,countPreserved:G.roofs.count===meshCount,coloursPreserved:colour.every((x,i)=>x===now[i]),
          treeRestored:before.equals(after)&&wood.every((x,i)=>x===G.feat.src[3][i]),
          roadEdges:G.roads.geometry.attributes.aEdge.count===G.roads.geometry.attributes.position.count};})()`);
    }
    for(let d=0;d<days;d+=30){await ev(c,`(async()=>{for(let i=0;i<${Math.min(30,days-d)};i++)if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;}})()`);await sleep(5);}
    const history=await ev(c,HISTORY);result.historySHA256=createHash('sha256').update(JSON.stringify(history)).digest('hex');result.simErrors=history.errors;
    fs.writeFileSync(path.join(OUT,id+'-history.json'),JSON.stringify(history,null,1));
    // Exercise round apses, stone bellcotes and Gothic parts without a centuries-long simulation.
    if(which==='candidate'){
      result.churchVariants=true;
      for(const [v,variant]of [['apse',{stone:true,gothic:false,aisles:2,tower:1,trans:false,ctower:false,spire:0}],
        ['church',{stone:true,gothic:true,aisles:2,tower:3,trans:true,ctower:true,spire:2}]]){
        const linked=await ev(c,`(()=>{const b=W.capital.buildings.find(b=>b.arch==='temple'),ch=chOf(b),saved={...ch};
          Object.assign(ch,${JSON.stringify(variant)});updateBuildingInstance(b);rebuildDetails();
          flyTo(b.x,b.z,${v==='apse'?60:90},b.rot+${v==='apse'?'(ch.W>0?Math.PI:0)':'0'}+0.5);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);animateWorld(0,0);renderer.render(scene,camera);
          const gl=renderer.getContext(),ok=renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS));Object.assign(ch,saved);return ok;})()`);
        result.churchVariants&&=linked;
        const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+v+'.png'),Buffer.from(shot.data,'base64'));
      }
    }
    return result;
  }catch(e){return{id,failed:e.message,errors};}finally{kill();}
}
const results=[];
for(const w of worlds)for(const which of Object.keys(sources)){console.log('Checking '+which+' '+w.seed+' '+w.coast);results.push(await check(which,w));fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));}
const checks=[];
for(const w of worlds){const candidate=results.find(r=>r.id==='candidate-'+w.seed+'-'+w.coast),baseline=results.find(r=>r.id==='baseline-'+w.seed+'-'+w.coast);
  const ok=r=>r&&!r.failed&&!r.errors.length&&r.simErrors===0&&Object.values(r.views).every(v=>v.linked&&v.errors===0);
  const row={seed:w.seed,coast:w.coast,compiled:ok(candidate),cameraCorrect:!!candidate?.cameraCorrect,liveRebuild:!!candidate?.liveRebuild&&Object.values(candidate.liveRebuild).every(Boolean),churchVariants:!!candidate?.churchVariants};
  if(baseline){row.baselineCompiled=ok(baseline);row.sameHistory=baseline.historySHA256===candidate?.historySHA256;
    row.sameGeometry=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>candidate.views[v].geometryTriangles===baseline.views[v].geometryTriangles);
    row.sameDrawCalls=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>candidate.views[v].render.calls===baseline.views[v].render.calls);
    row.sameTextureCounts=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>candidate.views[v].textureCount===baseline.views[v].textureCount);
    row.sameTextureSizes=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>JSON.stringify(candidate.views[v].textureSizes)===JSON.stringify(baseline.views[v].textureSizes));}
  checks.push(row);}
fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(checks,null,2));
console.log(JSON.stringify({out:OUT,days,checks},null,2));
process.exit(checks.every(c=>Object.entries(c).filter(([k])=>!['seed','coast'].includes(k)).every(([,v])=>v))?0:1);
