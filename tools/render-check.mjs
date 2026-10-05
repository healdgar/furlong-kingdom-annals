#!/usr/bin/env node
/* Local rendering regression: matched paused views, shader linking, geometry/texture budgets,
   off-centre camera uniforms, live rebuilds and a short deterministic history against a Git ref.
   Node 22+ and Chrome; all snapshots and measurements remain on disk.
   node tools/render-check.mjs --baseline HEAD --seeds 1001:sea,2002:land --days 720 --out /tmp/furlong-render-check
   --webgl1 exercises the r128 fallback using a temporary source snapshot, not an app setting.
   --touch --width 390 --height 844 emulates a phone viewport on this host.
   --seasons checks seasonal production shaders and saves matched seasonal views.
   --world-visuals checks winter silhouettes, animal models and river contact.
   --candidate-ref checks an existing commit, useful for reproducing a suspected baseline failure.
   --woodland-density allows at most 65% more tree instances; other geometry stays unchanged.
   --river-banks checks flat water and budgets the carved ground and recessed channel bed. */
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {auditUIReferences} from './ui-reference-audit.mjs';
import {auditChurchyardsNative} from './graveyard-audit.mjs';
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
const sources={candidate:args['candidate-ref']?execFileSync('git',['show',String(args['candidate-ref'])+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:10e6}):fs.readFileSync(path.join(ROOT,'index.html'),'utf8')};
if(args.baseline)sources.baseline=execFileSync('git',['show',String(args.baseline)+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:10e6});
const run={sourceSHA256:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,createHash('sha256').update(s).digest('hex')])),args,startedUTC:new Date().toISOString(),node:process.version};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
for(const[k,s]of Object.entries(sources))fs.writeFileSync(path.join(OUT,k+'.html'),args.webgl1?s.replace('renderer=new THREE.WebGLRenderer(', 'renderer=new THREE.WebGL1Renderer('):s);

// Serve snapshots and their actual material assets; file:// canvases cannot read pixels reliably.
fs.cpSync(path.join(ROOT,'assets'),path.join(OUT,'assets'),{recursive:true});
const server=createServer((req,res)=>{
  const file=path.resolve(OUT,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(OUT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const type={'.html':'text/html','.png':'image/png','.webp':'image/webp','.js':'text/javascript'}[path.extname(file)];
  res.setHeader('Content-Type',type||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const previewURL='http://127.0.0.1:'+server.address().port+'/';

const INSPECT=`(()=>{
  const gl=renderer.getContext(),count=m=>m?(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1):0;
  const parts=[G.terrain,G.apron,G.roads,G.roadJoins,G.bridges,G.rivers,G.riverBed,G.lakes,G.sea,G.bodies,G.roofs,...G.treeChunks,G.regrow,...Object.values(G.det)];
  const textures=new Set();for(const m of parts.filter(Boolean)){if(m.material.map)textures.add(m.material.map);for(const t of Object.values(renderer.properties.get(m.material).uniforms||{}))if(t?.value?.isTexture)textures.add(t.value);}
  const P=renderer.properties.get(G.terrain.material).currentProgram,name=G.land.uni.uSurfaceEye?'uSurfaceEye':'cameraPosition',loc=gl.getUniformLocation(P.program,name),eye=loc?Array.from(gl.getUniform(P.program,loc)):null;
  return{errors:errN,glError:gl.getError(),linked:renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)),webgl2:renderer.capabilities.isWebGL2,
    camera:camera.position.toArray(),terrainEye:eye,textureSizes:[...textures].map(t=>[t.image.width,t.image.height]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
    textureCount:renderer.info.memory.textures,triangles:Object.fromEntries(parts.filter(Boolean).map((m,i)=>[i,count(m)])),geometryTriangles:parts.filter(Boolean).reduce((n,m)=>n+count(m),0),riverTriangles:count(G.rivers),terrainTriangles:count(G.terrain),bedTriangles:count(G.riverBed),apronTriangles:count(G.apron),
    treeTriangles:G.treeChunks.reduce((n,m)=>n+count(m),0),treeInstances:G.treeChunks.reduce((n,m)=>n+m.count,0),
    treePlacement:{wet:Object.values(G.treeSpots).flat().filter(t=>hAt(t.x,t.z)<=SEA_SURFACE||anyLake(t.x,t.z)||riverAt(t.x,t.z,2)).length,uncleared:Object.values(G.treeSpots).flat().filter(t=>t.shown!==false&&treeGone(furlongAt(t.x,t.z),t)).length},
    herdModels:Object.fromEntries(Object.entries(G.herdMesh||{}).map(([k,m])=>[k,(m.geometry.index?.count||m.geometry.attributes.position.count)/3])),millRaceDraws:(G.wheels||[]).reduce((n,w)=>n+(w.userData.race?.length||0),0),
    render:{...renderer.info.render},shadow:{extent:G.sun.shadow.camera.right,normalBias:G.sun.shadow.normalBias}};
})()`;
const HISTORY=`(()=>({day:W.clock.day,treasury:W.treasury,monarch:W.monarch.id,houses:W.houses.map(h=>({name:h.name,gold:h.gold,seat:h.seat,exiled:h.exiled})),
  places:W.settlements.map(s=>({name:s.name,owner:s.owner,pop:s.pop,prosperity:s.prosperity,stores:s.stores,
    buildings:s.buildings.map(b=>({arch:b.arch,tier:b.tier,state:b.state,x:b.x,z:b.z,w:b.w,d:b.d,h:b.h,removed:b.removed,ch:b.ch})),
    folk:s.folk.map(p=>({id:p.id,age:p.age,w:p.w,alive:p.alive,home:p.home?.idx}))})),errors:errN}))()`;


// Run the production bearing selector on a tiny atlas containing unlike adjoining plots.
function gardenBearingCheck(){
  const gl=renderer.getContext(),program=renderer.properties.get(G.terrain.material).currentProgram;
  const source=gl.getShaderSource(program.fragmentShader),start=source.indexOf('float gardenHeading(');
  if(start<0)throw Error('Missing garden bearing shader');
  const helper=source.slice(start,source.indexOf('\n}',start)+2);
  const tex=new THREE.DataTexture(new Uint8Array([0,0,255,51,0,0,255,204,0,0,0,0,0,0,0,0]),2,2,THREE.RGBAFormat);
  tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{uFeat2:{value:tex},uFeaturePixel:{value:1},uSize:{value:2}},
    vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D uFeat2;uniform float uFeaturePixel,uSize;varying vec2 vUV;'+helper+'\nvoid main(){gl_FragColor=vec4(gardenHeading(vUV)/3.14159265,0.,0.,1.);}'});
  const geometry=new THREE.PlaneGeometry(2,2),testScene=new THREE.Scene();testScene.add(new THREE.Mesh(geometry,material));
  const target=new THREE.WebGLRenderTarget(64,64),old=renderer.getRenderTarget(),pixels=new Uint8Array(64*64*4);
  try{
    renderer.setRenderTarget(target);renderer.render(testScene,new THREE.Camera());renderer.readRenderTargetPixels(target,0,0,64,64,pixels);
    const counts={empty:0,first:0,second:0,interpolated:0};
    for(let i=0;i<pixels.length;i+=4){const r=pixels[i];if(r<=1)counts.empty++;else if(Math.abs(r-51)<=1)counts.first++;else if(Math.abs(r-204)<=1)counts.second++;else counts.interpolated++;}
    return{...counts,valid:counts.first>0&&counts.second>0&&counts.interpolated===0};
  }finally{renderer.setRenderTarget(old);geometry.dispose();material.dispose();tex.dispose();target.dispose();}
}

// Exercise production materials under two unlike skies, without changing the simulation.
// Matte controls catch accidental sheen on timber, unglazed windows, thatch or gables.
function reflectivityCheck(){
  const target=new THREE.WebGLRenderTarget(96,96),old=renderer.getRenderTarget(),top=G.skyU.top.value.clone(),bot=G.skyU.bot.value.clone();
  const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),geometries=[],materials=[],savedSnow=G.seasonU.uGroundSnow.value;G.seasonU.uGroundSnow.value=0;
  const stage=new THREE.Scene(),light=new THREE.DirectionalLight(0xffffff,0.7);light.position.set(2,8,4);stage.add(light,new THREE.AmbientLight(0xffffff,0.3));
  const view=new THREE.PerspectiveCamera(40,1,0.1,100),a=new Uint8Array(96*96*4),b=new Uint8Array(a.length),results={};
  function measured(name,mesh,eye,focus=[0,0,0]){
    geometries.push(mesh.geometry);materials.push(mesh.material);stage.add(mesh);view.position.set(...eye);view.lookAt(...focus);view.updateMatrixWorld(true);
    G.skyU.top.value.setRGB(0.8,0.1,0.1);G.skyU.bot.value.setRGB(0.8,0.1,0.1);
    renderer.render(stage,view);renderer.readRenderTargetPixels(target,0,0,96,96,a);
    G.skyU.top.value.setRGB(0.1,0.1,0.8);G.skyU.bot.value.setRGB(0.1,0.1,0.8);
    renderer.render(stage,view);renderer.readRenderTargetPixels(target,0,0,96,96,b);
    let changed=0,total=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+2]-b[i+2]);if(d>2)changed++;total+=d;}
    results[name]={changedPixels:changed,meanDifference:total/(96*96)};stage.remove(mesh);
  }
  function kit(finish){const g=new THREE.PlaneGeometry(2,2),n=g.attributes.position.count;
    g.setAttribute('aFinish',new THREE.Float32BufferAttribute(new Array(n).fill(finish),1));
    g.setAttribute('color',new THREE.Float32BufferAttribute(new Array(n).fill([0.55,0.58,0.61]).flat(),3));const m=new THREE.InstancedMesh(g,agentMat(true),1);m.setMatrixAt(0,new THREE.Matrix4());m.setColorAt(0,new THREE.Color(0xffffff));return m;}
  function roof(kind){const g=G.roofs.geometry.clone();
    for(const[k,w,v]of [['aGableColor',3,[0.6,0.6,0.6]],['aKind',1,[1]],['aRoofKind',1,[kind]]])g.setAttribute(k,new THREE.InstancedBufferAttribute(new Float32Array(v),w));
    const m=new THREE.InstancedMesh(g,roofMaterial(),1);m.setMatrixAt(0,new THREE.Matrix4().makeScale(3,3,3));m.setColorAt(0,new THREE.Color(0x606876));return m;}
  function wall(kind){const g=new THREE.BoxGeometry(1,1,1);g.translate(0,0.5,0);
    g.setAttribute('aKind',new THREE.InstancedBufferAttribute(new Float32Array([kind]),1));g.setAttribute('aFront',new THREE.InstancedBufferAttribute(new Float32Array([0,0]),2));g.setAttribute('aBase',new THREE.InstancedBufferAttribute(new Float32Array([0]),1));
    const m=new THREE.InstancedMesh(g,wallMaterial(),1);m.setMatrixAt(0,new THREE.Matrix4().makeScale(3.1,2.8,3.1));return m;}
  try{
    renderer.setRenderTarget(target);renderer.setClearColor(0,1);
    const water=()=>{const g=new THREE.PlaneGeometry(4,4);g.rotateX(-Math.PI/2);return new THREE.Mesh(g,waterMaterial({color:0x2e6285}));};
    measured('waterAbove',water(),[0,6,0.1]);measured('waterGrazing',water(),[0,1,6]);
    measured('iron',kit(1),[1,0,4]);measured('timberControl',kit(0),[1,0,4]);
    measured('slate',roof(2),[4,5,5],[0,1,0]);measured('thatchControl',roof(0),[4,5,5],[0,1,0]);
    measured('glass',wall(1),[0,1.4,7],[0,1.4,0]);measured('unglazedControl',wall(2),[0,1.4,7],[0,1.4,0]);
    G.seasonU.uGroundSnow.value=.85;measured('frostedThatch',roof(0),[4,5,5],[0,1,0]);G.seasonU.uGroundSnow.value=0;
    const kitFinish=G.soldierKit.geometry.attributes.aFinish,kitColour=G.soldierKit.geometry.attributes.color;
    let iron=0,wrongFinish=0;for(let i=0;i<kitFinish.count;i++){const metal=kitColour.getZ(i)>kitColour.getX(i);if(kitFinish.getX(i)>0.5)iron++;if(metal!==(kitFinish.getX(i)>0.5))wrongFinish++;}
    results.ironMask={ironVertices:iron,otherVertices:kitFinish.count-iron,wrongFinish};
    results.valid=['waterAbove','waterGrazing','iron','slate','glass'].every(k=>results[k].changedPixels>0)&&results.frostedThatch.meanDifference>0.05&&
      ['timberControl','thatchControl','unglazedControl'].every(k=>results[k].changedPixels===0)&&
      results.waterGrazing.meanDifference>results.waterAbove.meanDifference&&iron>0&&wrongFinish===0;
    return results;
  }finally{G.seasonU.uGroundSnow.value=savedSnow;G.skyU.top.value.copy(top);G.skyU.bot.value.copy(bot);renderer.setRenderTarget(old);renderer.setClearColor(clear,alpha);
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();target.dispose();}
}

// Isolate context overlays with constant feature textures and real production materials.
// Texture/geometry allocation is confined to this probe; the simulation never advances.
function seasonalSurfaceCheck(){
  const target=new THREE.WebGLRenderTarget(64,64),old=renderer.getRenderTarget(),pixels=new Uint8Array(64*64*4),resources=[];
  const stage=new THREE.Scene();stage.add(new THREE.AmbientLight(0xffffff,1));
  const view=new THREE.OrthographicCamera(-8,8,8,-8,0.1,100),results={};
  const texture=bytes=>{const t=new THREE.DataTexture(new Uint8Array(bytes),1,1,THREE.RGBAFormat);t.needsUpdate=true;resources.push(t);return t;};
  const zero=texture([0,0,0,0]),mask=texture([255,255,0,255]);
  const contexts={meadow:[255,255,255,255,255,0],woodland:[255,255,255,0,255,0],margin:[255,255,255,36,255,0],bank:[8,255,255,255,255,0],garden:[255,255,255,255,48,255],boundary:[255,255,255,255,255,0],apron:null};
  try{
    renderer.setRenderTarget(target);
    for(const [name,feature]of Object.entries(contexts)){
      const x=name==='boundary'?SIZE*0.5-200:0,y=SEA+10;
      const geometry=new THREE.PlaneGeometry(16,16);geometry.rotateX(-Math.PI/2);geometry.translate(x,y,0);resources.push(geometry);
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Array(4).fill([1,1,1]).flat(),3));
      const original=name==='apron'?G.apron.material:G.terrain.material,material=original.clone();resources.push(material);
      const feat=feature&&texture(feature.slice(0,4)),feat2=feature&&texture([feature[4],255,feature[5],128]);
      material.onBeforeCompile=sh=>{original.onBeforeCompile(sh);if(feature)Object.assign(sh.uniforms,{uData:{value:zero},uMask:{value:mask},uFeat1:{value:feat},uFeat2:{value:feat2},uSurfaceEye:{value:view.position}});};
      const mesh=new THREE.Mesh(geometry,material);stage.add(mesh);view.position.set(x,y+40,0.01);view.lookAt(x,y,0);view.updateMatrixWorld(true);
      results[name]={};
      for(const [label,si]of [['summer',1],['autumn',2],['winter',3]]){
        lastSeasonKey='';updateTerrainColors(si,0,1);
        const c=G.seasonU.uSeasonGrass.value;for(let i=0;i<4;i++)geometry.attributes.color.setXYZ(i,c.r,c.g,c.b);geometry.attributes.color.needsUpdate=true;
        renderer.render(stage,view);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);
        const rgb=[0,0,0];let n=0;for(let yy=8;yy<56;yy++)for(let xx=8;xx<56;xx++){const j=(yy*64+xx)*4;for(let k=0;k<3;k++)rgb[k]+=pixels[j+k];n++;}
        results[name][label]=rgb.map(v=>v/n);
      }stage.remove(mesh);
    }
    const winterLeaf=G.treeMat.dec.color.clone(),winterPine=G.treeMat.pine.color.clone();
    lastSeasonKey='';updateTerrainColors(1,0,1);
    results.foliage={deciduousChanged:!winterLeaf.equals(G.treeMat.dec.color),winterDeciduousDormant:winterLeaf.r>winterLeaf.g,winterPineEvergreen:winterPine.g>winterPine.r};
    const geometry=new THREE.PlaneGeometry(16,16);geometry.rotateX(-Math.PI/2);resources.push(geometry);
    const material=new THREE.ShaderMaterial({uniforms:{uDormancy:G.seasonU.uDormancy},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:SURFACE_GLSL+'\nvoid main(){gl_FragColor=vec4(seasonalVegetation(vec3(0.3,0.9,0.4)),1.);}'});resources.push(material);
    const mesh=new THREE.Mesh(geometry,material);stage.add(mesh);view.position.set(0,40,0.01);view.lookAt(0,0,0);view.updateMatrixWorld(true);
    const colour=[];for(const si of [1,3]){lastSeasonKey='';updateTerrainColors(si,0,1);renderer.render(stage,view);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);colour.push(Array.from(pixels.slice((32*64+32)*4,(32*64+32)*4+3)));}stage.remove(mesh);
    results.texture={summerKeepsColour:colour[0][1]-colour[0][0]>30,winterNeutral:Math.max(...colour[1])-Math.min(...colour[1])<=1};
    const saved={day:W.clock.day,speed:speedIdx,calm:G.calm};
    try{W.clock.day=270;speedIdx=SPEEDS.length-1;G.calm=1;lastSeasonKey='';animateWorld(0,0);results.fastWinter=G.seasonU.uDormancy.value===1&&G.seasonU.uGroundSnow.value>0.8;}
    finally{W.clock.day=saved.day;speedIdx=saved.speed;G.calm=saved.calm;animateWorld(0,0);}
    const shader=renderer.getContext(),linked=renderer.info.programs.every(p=>shader.getProgramParameter(p.program,shader.LINK_STATUS));
    results.valid=linked&&Object.keys(contexts).every(name=>{const r=results[name],a=r.summer,b=r.winter;return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])>8&&(name==='garden'?b[0]+b[1]+b[2]>a[0]+a[1]+a[2]:b[1]-b[0]<a[1]-a[0]);})&&Object.values(results.foliage).every(Boolean)&&Object.values(results.texture).every(Boolean)&&results.fastWinter;
    return results;
  }finally{renderer.setRenderTarget(old);resources.forEach(r=>r.dispose());target.dispose();lastSeasonKey='';updateTerrainColors(seasonIdx(),(day()%90)/90,1);}
}

function worldVisualCheck(){
  const stage=new THREE.Scene();stage.background=new THREE.Color(0xffffff);stage.add(new THREE.HemisphereLight(0xffffff,0x807768,1));
  const light=new THREE.DirectionalLight(0xffffff,0.6);light.position.set(10,12,8);stage.add(light);
  const view=new THREE.PerspectiveCamera(40,1,0.1,100);view.position.set(12,7,10);view.lookAt(0,4.5,0);
  const target=new THREE.WebGLRenderTarget(128,128),pixels=new Uint8Array(128*128*4),oldTarget=renderer.getRenderTarget(),oldEye=G.surfaceU.uSurfaceEye.value;
  const source=G.treeChunks.find(m=>m.material.userData.branchDepth),tree=new THREE.InstancedMesh(source.geometry,source.material,1);tree.setMatrixAt(0,new THREE.Matrix4());stage.add(tree);
  const coverage=(si,angle)=>{view.position.set(Math.cos(angle)*15,7,Math.sin(angle)*15);view.lookAt(0,4.5,0);G.surfaceU.uSurfaceEye.value=view.position;
    lastSeasonKey='';updateTerrainColors(si,0.25,1);renderer.setRenderTarget(target);renderer.render(stage,view);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
    let total=0,spine=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<220&&pixels[i+1]<220&&pixels[i+2]<220){total++;const x=(i/4)%128,y=Math.floor(i/512);if(x>=60&&x<=68&&y>40)spine++;}return{total,spine};};
  const crowns=[0,Math.PI/4,Math.PI/2].map(angle=>({angle,summer:coverage(1,angle),winter:coverage(3,angle)}));
  stage.remove(tree);tree.dispose();target.dispose();renderer.setRenderTarget(oldTarget);G.surfaceU.uSurfaceEye.value=oldEye;lastSeasonKey='';updateTerrainColors(seasonIdx(),(day()%90)/90,1);
  const models={},meshes=[];for(const [i,k]of ['sheep','cattle','horses','swine'].entries()){
    const original=G.herdMesh[k],geometry=original.geometry.clone(),a=geometry.attributes.aAnimal;for(let j=0;j<2;j++)a.setXYZW(j,0.32+i*0.16,0,0,0);a.needsUpdate=true;
    const m=new THREE.InstancedMesh(geometry,original.material,2);for(let j=0;j<2;j++){const size=j?animalGrowth(k,day(),day()):1;m.setMatrixAt(j,new THREE.Matrix4().compose(new THREE.Vector3((i-1.5)*3.8,0,j*2.6),new THREE.Quaternion(),new THREE.Vector3(size,size,size)));}
    geometry.computeBoundingBox();const box=geometry.boundingBox;models[k]={triangles:geometry.attributes.position.count/3,height:box.max.y,width:box.max.x-box.min.x,parts:[...new Set(geometry.attributes.aBeastPart.array)]};meshes.push(m);stage.add(m);
  }
  view.aspect=renderer.domElement.width/renderer.domElement.height;view.position.set(14,9,20);view.lookAt(0,0.7,1);renderer.render(stage,view);window.__animalProbe={meshes};
  const P=G.rivers.geometry.attributes.position,I=G.rivers.geometry.index.array;let crossSlope=0;const exposed=[];
  for(let i=0;i<(G.riverCrossVertices||P.count);i+=5)for(let j=1;j<5;j++)crossSlope=Math.max(crossSlope,Math.abs(P.getY(i)-P.getY(i+j)));
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let exposedGround=0,recessedBed=0,checked=0;
  for(let i=0;i<I.length;i+=Math.max(3,Math.floor(I.length/144)*3)){const ids=[I[i],I[i+1],I[i+2]],x=ids.reduce((n,j)=>n+P.getX(j),0)/3,z=ids.reduce((n,j)=>n+P.getZ(j),0)/3,y=ids.reduce((n,j)=>n+P.getY(j),0)/3;
    ray.set(new THREE.Vector3(x,y+1000,z),down);const ground=ray.intersectObjects([G.terrain,G.apron],false)[0],bed=ray.intersectObject(G.riverBed,false)[0];if(ground&&ground.point.y>y-0.01){exposedGround++;exposed.push({x,z,y,ground:ground.point.y});}if(bed&&bed.point.y<y-0.5)recessedBed++;checked++;}
  const joins=[];for(const r of G.drawRivRuns||[])if(r.join){const F=r.join,x=F.reduce((n,p)=>n+p.x,0)/F.length,z=F.reduce((n,p)=>n+p.z,0)/F.length;
    ray.set(new THREE.Vector3(x,1000+hAt(x,z),z),down);const water=ray.intersectObject(G.rivers,false)[0],ground=ray.intersectObjects([G.terrain,G.apron],false)[0],bed=ray.intersectObject(G.riverBed,false)[0];
    joins.push({x,z,water:water?.point.y,ground:ground?.point.y,bed:bed?.point.y});}
  let overlayVertices=0,overlayFailures=0;const joinFlow=G.rivers.geometry.attributes.aJoinFlow;
  for(const r of G.drawRivRuns||[])if(r.join){const F=r.join;for(let i=F.overlayBase;i<F.overlayBase+F.overlayCount;i++){overlayVertices++;if(Math.abs(P.getY(i)-F.level)>.001||Math.hypot(joinFlow.getX(i)-F.flow[0],joinFlow.getY(i)-F.flow[1])>.001)overlayFailures++;}}
  const slopedBanks=(G.riverEmbankments||[]).every(F=>Math.hypot(F[3].x-F[0].x,F[3].z-F[0].z)>.1&&Math.abs(F[3].y-hAt(F[3].x,F[3].z))<.001);
  const seaLevel=!G.sea||Math.abs(G.sea.position.y-SEA_SURFACE)<.001,transparentDepth=!G.rivers.material.depthWrite&&(!G.sea||!G.sea.material.depthWrite);
  const attributes=G.terrain.geometry.attributes,attributeCapacity=Object.values(attributes).every(a=>a.count>=attributes.position.count);
  const fortSurfaces=[];G.wallGrp?.traverse(o=>{if(o.userData?.earthwork){const m=o.material;fortSurfaces.push({derivatives:Object.hasOwn(m.defines||{},'SURFACE_DERIVATIVES'),textureGrad:Object.hasOwn(m.defines||{},'SURFACE_TEXTURE_GRAD'),ready:renderer.properties.get(m).uniforms?.uMiniatureReady?.value});}});
  const fortTextures=fortSurfaces.length>0&&fortSurfaces.some(m=>m.ready===1)&&fortSurfaces.every(m=>(!G.surfaceDerivatives||m.derivatives)&&(!G.surfaceTextureGrad||m.textureGrad));

  const gl=renderer.getContext(),linked=renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS));
  return{crowns,models,fortSurfaces,river:{joins,crossSlope,exposed,exposedGround,recessedBed,checked,attributeCapacity,overlayVertices,overlayFailures,slopedBanks,seaLevel,transparentDepth},valid:linked&&fortTextures&&crowns.every(c=>c.winter.total<c.summer.total*0.8&&c.winter.total>c.summer.total*0.02&&c.winter.spine>10)&&Object.values(models).every(m=>m.triangles<=216)&&models.horses.height>models.cattle.height&&models.cattle.parts.includes(6)&&!models.horses.parts.includes(6)&&overlayVertices>0&&overlayFailures===0&&slopedBanks&&seaLevel&&transparentDepth&&crossSlope<0.001&&exposedGround===0&&recessedBed===checked&&attributeCapacity&&joins.every(q=>q.water!==undefined&&(q.ground===undefined||q.ground<q.water)&&(q.bed!==undefined&&q.bed<q.water-0.5))};
}

function uiIntegrationCheck(){
  const money=()=>JSON.stringify({treasury:W.treasury,households:[...W.households.values()].map(h=>[h.id,h.assets?.w,h.assets?._debt]),stores:W.settlements.map(s=>s.stores)}),before=money();
  document.body.classList.remove('hideui');contextDismiss();const checks={};
  for(const [id,kind]of [['brand','about'],['datechip','timeline'],['goldchip','accounts']]){
    const button=document.getElementById(id);button.focus();button.click();checks[kind]=contextUI.kind==='info'&&infoUI.kind===kind&&document.getElementById('infobody').textContent.length>20;
    const content=document.getElementById('contextcontent');checks[kind+'Fits']=content.scrollWidth<=content.clientWidth+1;contextDismiss();checks[kind+'Focus']=document.activeElement===button;
  }
  openInfo('accounts',W.capital);checks.townAccounts=infoUI.town===W.capital&&document.getElementById('contexttitle').textContent.includes(W.capital.name);
  const cameraBefore=camera.position.toArray().join(','),kind=contextUI.kind,p=cam.cur.focus,event={cat:'trade',text:'A local grain delivery is completed.',day:day(),pos:{x:p.x,z:p.z}},savedRecent=eventUI.recent;
  eventUI.recent=[];postEventDialog(event);checks.noTakeover=contextUI.kind===kind&&camera.position.toArray().join(',')===cameraBefore;
  contextDismiss();eventBubbleUpdate();checks.localExplanation=!document.getElementById('eventbubble').hidden&&eventUI.bubble===event;
  document.getElementById('eventbubbledetails').click();checks.eventDetails=contextUI.kind==='event'&&contextUI.expanded&&document.getElementById('eventtext').textContent===event.text;
  contextDismiss();eventUI.recent=savedRecent;eventUI.hold=null;eventBubbleUpdate();
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);checks.uniqueIDs=new Set(ids).size===ids.length;checks.unchanged=before===money();document.body.classList.add('hideui');
  return{checks,valid:Object.values(checks).every(Boolean)};
}
function serviceRoadCheck(){
  const mills=[],quays=[];for(const s of W.settlements){
    const g=streetGraph(s),publicStreet=(s.streets||[]).find(st=>!st.hidden&&!st.gone&&!st.castlePath&&st.kind==='road');
    for(const b of s.buildings)if(b.arch==='mill'&&!b.removed&&b.state!=='gone'){
      const start=serviceDoor(b),n=s.streets.length,ok=s._lay.serviceAccess(b),walker={house:s.owner,settlement:s,placed:s._lay.placed,requireRoadCrossing:true};
      mills.push({town:s.name,riverWheel:b.millWater?.kind==='river'&&!lakeAt(s,b.millWater.x,b.millWater.z,0),connected:ok&&!!b.st&&!b.st.hidden&&!b.st.gone,idempotent:s.streets.length===n,dry:!armyObstacle(walker,start.x,start.z),clear:!!b.st?.serviceAccess&&b.st.pts.slice(2).every((q,k)=>armySegmentClear(walker,b.st.pts[k+1],q)),blocked:b.st?.pts.slice(2).map((q,k)=>{const p=b.st.pts[k+1];if(armySegmentClear(walker,p,q))return null;const n=Math.ceil(dist2d(p.x,p.z,q.x,q.z));for(let i=1;i<=n;i++){const x=lerp(p.x,q.x,i/n),z=lerp(p.z,q.z,i/n),reason=armyObstacle(walker,x,z);if(reason)return{x,z,reason,buildings:s._lay.placed.near(x,z,1).filter(o=>!o.removed&&o.state!=='gone').map(o=>({arch:o.arch,x:o.x,z:o.z,w:o.w,d:o.d}))};}return{p,q,reason:'grade'};}).filter(Boolean)});
    }
    for(const q of s.streets)if(q.kind==='quay'&&!q.hidden&&!q.gone){const p=q.pts[Math.floor(q.pts.length/2)],n=s.streets.length,ok=s._lay.quayAccess(q),a=nearestNode(g,p.x,p.z),dest=publicStreet?.pts[0],b=dest?nearestNode(g,dest.x,dest.z):-1;
      quays.push({town:s.name,connected:ok&&!!streetPath(g,a,b),idempotent:s.streets.length===n});}
  }
  let grange=null;
  for(const s of W.settlements){if(grange)break;const anchor=(s.places||[]).find(p=>p.kind==='market')||s.pos;
    for(const r of[30,50,80,120,180]){if(grange)break;for(let k=0;k<12;k++){const x=anchor.x+Math.cos(k*Math.PI/6)*r,z=anchor.z+Math.sin(k*Math.PI/6)*r;
      if(!s._lay.live.storageSite(x,z,'grange',true)||!Number.isFinite(storageRoute(s,{x,z},anchor)))continue;
      const oldN=s.streets.length,b=s._lay.live.storageSite(x,z,'grange',false);if(!b)continue;
      const n=s.streets.length,walker={house:s.owner,settlement:s,placed:s._lay.placed,requireRoadCrossing:true};grange={town:s.name,connected:!!b.st?.serviceAccess&&!b.st.hidden&&!b.st.gone,idempotent:s._lay.serviceAccess(b)&&n===s.streets.length,marketRoute:Number.isFinite(storageRoute(s,b,anchor)),clear:b.st.pts.slice(2).every((q,k)=>armySegmentClear(walker,b.st.pts[k+1],q))};
      b.removed=true;s.buildings.splice(s.buildings.indexOf(b),1);for(const st of s.streets.slice(oldN)){st.gone=true;st.hidden=true;}break;
    }}
  }
  return{mills,quays,grange,valid:mills.length>0&&mills.every(m=>m.riverWheel&&m.connected&&m.idempotent&&m.dry&&m.clear)&&quays.every(q=>q.connected&&q.idempotent)&&!!grange&&Object.entries(grange).every(([k,v])=>k==='town'||v)};
}

function uiReferencesCheck(audit){
  const uiBefore=document.body.classList.contains('hideui');document.body.classList.remove('hideui');
  const scenes=[],names=()=>[...W.settlements.map(s=>s.name),...W.houses.map(h=>h.name),...W.notables.flatMap(n=>[n.name,fullTitle(n)]),...(W.fams||[]).map(f=>f.n),...W.settlements.flatMap(s=>[...(s.folk||[]),...(s.dead||[])].flatMap(p=>[folkName(p),p.sur])),...(W.travellers||[]).map(t=>folkName(t.p)),...(W.armies||[]).map(a=>a.name),...(W.banditCamps||[]).map(c=>c.name),...W.settlements.flatMap(s=>(s.buildings||[]).map(b=>b.nm)),...Object.keys(GOODBASE).flatMap(g=>[g,g[0].toUpperCase()+g.slice(1)]),...Object.keys(TRADE_W).flatMap(t=>[t,t[0].toUpperCase()+t.slice(1)]),...Object.values(ARCH).map(a=>a[4])];
  const record=(name,ids)=>{const results=ids.map(id=>audit(document.getElementById(id),names())).filter(r=>r.visibleTextNodes);scenes.push({name,results,valid:results.length>0&&results.every(r=>r.valid)});};
  const s=W.capital,head=s.folk.find(p=>p._hh?.head===p&&!p.dead&&famName(p)),to=W.settlements.find(t=>t!==s),h=head._hh,ev={day:day(),cat:'trade',pri:2,pos:s.pos,text:`The ${famName(head)} household leaves ${s.name} for ${to.name}, where a brewer can do better.`};
  contextDismiss();flyTo(s.pos.x,s.pos.z,420);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);
  postEventDialog(ev);eventBubbleUpdate();record('event bubble',['eventbubbletext']);
  const bubble=document.getElementById('eventbubbletext'),householdLink=[...bubble.querySelectorAll('a.nm')].find(a=>a.dataset.nm==='household:'+h.id||a.dataset.nm.startsWith('choose:')&&JSON.parse(decodeURIComponent(a.dataset.nm.slice(7))).includes('household:'+h.id)),places=[...bubble.querySelectorAll('a.nm')].filter(a=>/^s\d+$/.test(a.dataset.nm));
  const migration={household:!!householdLink,places:places.length===2,trade:!!bubble.querySelector('[data-nm^="trade:"]')};
  householdLink?.click();if(infoUI.reference?.startsWith('choose:')){record('household name chooser',['infobody']);document.querySelector(`#infobody [data-nm="household:${h.id}"]`)?.click();}migration.opensHousehold=infoUI.reference==='household:'+h.id;record('household',['infobody']);
  showEventDialog(ev);contextExpand(true);record('event details',['eventtext']);
  const eventLinks=[...document.querySelectorAll('#eventtext a.nm')],victim=eventLinks.find(a=>a.dataset.nm==='s'+W.settlements.indexOf(to)),text=document.createTextNode(victim.textContent);victim.replaceWith(text);const catchesMissing=audit(document.getElementById('eventtext'),names()).missing.some(m=>m.name===to.name);text.replaceWith(victim);
  const savedHref=victim.getAttribute('href');victim.removeAttribute('href');const catchesDeadLink=audit(document.getElementById('eventtext'),names()).deadLinks.includes(to.name);victim.setAttribute('href',savedHref);
  const trade=eventLinks.find(a=>a.dataset.nm.startsWith('trade:'));trade?.click();migration.opensTrade=infoUI.kind==='reference'&&infoUI.reference.startsWith('trade:');record('trade',['infobody']);
  for(const pk of [{type:'settlement',s},{type:'person',p:head,s},{type:'notable',n:W.monarch},...s.buildings.slice(0,6).map(b=>({type:'building',b})),...(s.furl||[]).slice(0,2).map(f=>({type:'land',f,x:f.x,z:f.z})),...s.streets.slice(0,1).map(st=>({type:'street',s,st})),...W.roads.slice(0,1).map(r=>({type:'road',r})),...G.rivStrips.slice(0,1).map(st=>({type:'river',st,o:riverAt(st.pts[0].x,st.pts[0].z,0)})),...W.armies.filter(a=>!a.gone).slice(0,1).map(a=>({type:'army',a})),...W.banditCamps.slice(0,1).map(camp=>({type:'camp',camp})),...s.buildings.filter(b=>b._graveyard&&!b._graveyard.removed).slice(0,1).map(b=>({type:'churchyard',s,b,yard:b._graveyard}))]){try{showInspect(pk);contextExpand(true);record('inspector '+pk.type,['inspbody','inspsub','contextsummary']);}catch(e){scenes.push({name:'inspector '+pk.type,valid:false,error:e.stack||String(e)});}}
  for(const kind of ['timeline','accounts']){openInfo(kind,kind==='accounts'?s:null);contextExpand(true);record(kind,['infobody']);}
  for(const tab of ['crown','rates','acts','world']){selectTab(tab);setDrawerClosed(false);contextExpand(true);record('menu '+tab,['dbody']);}
  const lineCount=allLines.length,entries=entryCount;chronicleAdd(ev);setChronMin(false);contextShow('chron');contextExpand(true);record('annals',['chronlist']);chronList().lastElementChild.remove();allLines.length=lineCount;entryCount=entries;
  contextDismiss();if(uiBefore)document.body.classList.add('hideui');
  return{scenes,migration,catchesMissing,catchesDeadLink,valid:catchesMissing&&catchesDeadLink&&Object.values(migration).every(Boolean)&&scenes.every(s=>s.valid)};
}

function paidCrossingCheck(){
  const before=JSON.stringify(G.bridgeSpans),s=W.capital,r=G.rivStrips.find(r=>!r.canal&&r.pts.length>12),k=Math.floor(r.pts.length/2),p=r.pts[k],a=r.pts[k-1],b=r.pts[k+1],L=dist2d(a.x,a.z,b.x,b.z)||1,nx=-(b.z-a.z)/L,nz=(b.x-a.x)/L,d=r.hw[k]+20,
    P=[{x:p.x-nx*d,z:p.z-nz*d},p,{x:p.x+nx*d,z:p.z+nz*d}],n=s.streets.length;
  try{
    for(const kind of['quay','alley','lane','road'])s.streets.push({kind,hw:3,pts:P,serviceAccess:kind==='alley'?'quay':undefined});
    rebuildRoadMesh();const unchanged=JSON.stringify(G.bridgeSpans)===before;
    const riverWheels=W.settlements.flatMap(t=>t.buildings.filter(b=>b.arch==='mill'&&!b.removed&&b.state!=='gone').map(b=>{const d=millDrive(t,b);return{town:t.name,kind:b.millWater?.kind,drive:d.mode,radius:d.radius,outsidePond:!lakeAt(t,b.millWater.x,b.millWater.z,0),damFeed:!t.lake||!!d.feed&&lakeAt(t,d.feed.a.x,d.feed.a.z,0)&&dist2d(b.millWater.x,b.millWater.z,t.lake.dam.x,t.lake.dam.z)<60&&d.feed.a.y>d.feed.b.y&&(d.mode==='overshot'?d.feed.b.y>d.axleY+d.radius*Math.sqrt(1-0.25**2):d.feed.b.y<d.axleY)};}));
    return{unpricedLanesLeaveBridgesUnchanged:unchanged,bridgeCount:G.bridgeSpans.length,ponds:W.settlements.filter(s=>s.lake).map(s=>({town:s.name,mill:!!s.mill,dam:s.lake.dam,pondLevel:s.lake.y})),riverWheels,raceMeshes:[G.millRaceWood,G.millRaceWater].filter(Boolean).length,valid:unchanged&&riverWheels.length>0&&[G.millRaceWood,G.millRaceWater].filter(Boolean).length<=2&&riverWheels.every(m=>m.kind==='river'&&m.outsidePond&&m.damFeed)};
  }finally{s.streets.splice(n);rebuildRoadMesh();}
}

async function check(which,w){
  const {c,kill}=await launch(),id=which+'-'+w.seed+'-'+w.coast,errors=[];
  try{
    await c.send('Page.enable');await c.send('Runtime.enable');
    c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
    c.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.description||a.value).join(' '));});
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__renderRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'});
    await c.send('Emulation.setDeviceMetricsOverride',{width:Number(args.width||1440),height:Number(args.height||900),deviceScaleFactor:1,mobile:!!args.touch});
    if(args.touch)await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    await c.send('Page.navigate',{url:previewURL+which+'.html'+`#s=${w.seed}&f=${args.founding||w.seed}&c=${w.coast}`});
    const deadline=Date.now()+120000;let ready=false;
    while(Date.now()<deadline){if(errors.length)throw new Error(errors.join('\n'));ready=await ev(c,"document.getElementById('loading')===null&&typeof renderer!=='undefined'");if(ready)break;await sleep(200);}
    if(!ready)throw new Error('boot timeout');
    await ev(c,"(async()=>{if(!await G.miniatureReady||!await G.waterRippleReady)throw Error('material images failed to load')})()");
    await ev(c,"setSpeed(0);cam.mode='free';document.body.classList.add('hideui');");
    const gardenView="(()=>{let best=-Infinity,q;for(let i=0;i<G.feat.d2.length;i+=4){if(G.feat.d2[i+2]<255)continue;const k=i/4,x=(k%FR+0.5)*FPX-SIZE/2,z=(Math.floor(k/FR)+0.5)*FPX-SIZE/2,d=Math.hypot(x-W.capital.pos.x,z-W.capital.pos.z);if(d>400)continue;const clearance=Math.min(G.feat.d2[i]/4,G.feat.d1[i]/4,G.feat.d1[i+2]/4),score=clearance-d*0.025;if(score>best){best=score;q=[x,z,38,G.feat.d2[i+3]/255*Math.PI+0.3,0.5];}}if(!q)throw Error('No visible capital garden');return q;})()";
    const joinView="[-3168.1078406073434,-3248.1033372513384,64.11971192656942,3.6702058129495168]"; // reported seed-1001 street view
        const views={mill:"(()=>{const s=W.settlements.find(s=>s.lake&&s.mill)||W.settlements.find(s=>s.mill),b=s.mill;return[b.x,b.z,95,b.rot+1.1];})()",streetJoin:joinView,waterGlint:"(()=>{const r=G.rivStrips.find(r=>r.pts.length>50)||G.rivStrips[0],p=r.pts[Math.floor(r.pts.length*0.7)],sun=G.skyU.sunPos.value;return[p.x,p.z,170,Math.atan2(-sun.z,-sun.x),-0.15];})()",garden:gardenView,gardenMiddle:gardenView.replace(',38,',',110,'),gardenFar:gardenView.replace(',38,',',380,'),capital:"[W.capital.pos.x,W.capital.pos.z,110,2.3]",street:"(()=>{const b=W.capital.buildings.find(b=>b.arch==='house');return[b.x,b.z,48,b.rot+0.8];})()",
      woodland:"(()=>{const t=G.treeSpots.dec.find(t=>Math.hypot(t.x,t.z)<3200)||G.treeSpots.dec[0];return[t.x,t.z,95,0.6];})()",
      fortCourt:"(()=>{const s=W.settlements.find(s=>s.motte&&s.bailey),b=s.bailey;return[b.x,b.z,65,1.1,.2];})()",
      river:"(()=>{const r=G.rivStrips.find(r=>r.pts.length>50)||G.rivStrips[0],p=r.pts[Math.floor(r.pts.length*0.7)];return[p.x,p.z,110,0.9];})()",
      riverMouth:"(()=>{const r=G.rivStrips.find(r=>hAt(r.pts[r.pts.length-1].x,r.pts[r.pts.length-1].z)<SEA+.2)||G.rivStrips[0],p=r.pts.findLast(p=>hAt(p.x,p.z)>SEA+.7)||r.pts[r.pts.length-2];return[p.x,p.z,200,.8,-.35];})()",
      riverJoin:"(()=>{const r=G.rivStrips.find(r=>!r.canal&&r.pts.length>40&&hAt(r.pts[r.pts.length-1].x,r.pts[r.pts.length-1].z)>SEA+2),p=r.pts[r.pts.length-1];return[p.x,p.z,180,.8];})()",
      riverReportedJoin:"(()=>{const r=G.rivStrips.filter(r=>!r.canal).sort((a,b)=>Math.hypot(a.pts.at(-1).x+2835,a.pts.at(-1).z+2990)-Math.hypot(b.pts.at(-1).x+2835,b.pts.at(-1).z+2990))[0],p=r.pts.at(-1);return[p.x,p.z,130,1.2,-.25];})()",
      riverInnerJoin:"(()=>{const r=G.rivStrips.find(r=>!r.canal&&r.pts.length>40&&Math.abs(r.pts.at(-1).x)<SIZE/2-200&&Math.abs(r.pts.at(-1).z)<SIZE/2-200&&hAt(r.pts.at(-1).x,r.pts.at(-1).z)>SEA+2)||G.rivStrips[0],p=r.pts.at(-1);return[p.x,p.z,180,.8];})()",
      millDrop:"(()=>{const b=W.settlements.flatMap(s=>s.buildings).filter(b=>b.arch==='mill')[5]||W.settlements.flatMap(s=>s.buildings).find(b=>b.arch==='mill');return[b.x,b.z,65,b.rot+1.3,-0.1];})()",bridge:"(()=>{const q=G.bridgeSpans.reduce((a,b)=>Math.hypot(b.a.x-W.capital.pos.x,b.a.z-W.capital.pos.z)<Math.hypot(a.a.x-W.capital.pos.x,a.a.z-W.capital.pos.z)?b:a);return[(q.a.x+q.b.x)/2,(q.a.z+q.b.z)/2,95,Math.atan2(q.b.z-q.a.z,q.b.x-q.a.x)+0.6];})()",town:"[W.capital.pos.x,W.capital.pos.z,480,2.3]",district:"[W.capital.pos.x,W.capital.pos.z,1100,2.3]",farmland:"[W.capital.pos.x,W.capital.pos.z,2200,2.3]",realm:"[0,0,4200,0.8]"};
    const result={id,views:{},errors};
    for(const[v,expr]of Object.entries(views)){
      if(args.views&&!String(args.views).split(',').includes(v))continue;
      await ev(c,`(()=>{const q=${expr};cam.pitchBias=cam.cur.pitchBias=q[4]||0;flyTo(...q);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);animateWorld(0,0);scene.updateMatrixWorld(true);renderer.render(scene,camera);})()`);
      result.views[v]=await ev(c,INSPECT);
      const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+v+'.png'),Buffer.from(shot.data,'base64'));
      // Matched quarter-pixel pans expose texture shimmer without advancing world time.
      if(['garden','gardenMiddle','gardenFar','town','district','farmland'].includes(v))for(let step=1;step<=3;step++){
        await ev(c,`(()=>{const q=${expr};cam.pitchBias=cam.cur.pitchBias=q[4]||0;flyTo(...q);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);
          const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),metres=2*cam.cur.dist*Math.tan(camera.fov*Math.PI/360)/renderer.domElement.height;
          cam.cur.focus.addScaledVector(right,metres*${step}*0.25);updateCamera(0,0);animateWorld(0,0);renderer.render(scene,camera);})()`);
        const pan=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+v+'-pan'+step+'.png'),Buffer.from(pan.data,'base64'));
      }
      // Submission time and actual GPU timer queries are separate; neither is device FPS.
      result.views[v].timing=await ev(c,`(async()=>{const gl=renderer.getContext(),ext=renderer.capabilities.isWebGL2?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null,a=[],queries=[];
        for(let i=0;i<12;i++){const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
          const t=performance.now();renderer.render(scene,camera);if(i>2)a.push(performance.now()-t);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}
          await new Promise(window.__renderRAF);}
        for(let i=0;i<20&&queries.some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE));i++)await new Promise(r=>setTimeout(r,10));
        const valid=ext&&!gl.getParameter(ext.GPU_DISJOINT_EXT),gpu=valid?queries.slice(3).filter(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)).map(q=>gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6):[];
        queries.forEach(q=>gl.deleteQuery(q));return{submitMs:a.reduce((a,b)=>a+b)/a.length,gpuMs:gpu.length?gpu.reduce((a,b)=>a+b)/gpu.length:null};})()`);
    }
    if(args.seasons){
      if(which==='candidate')result.seasons=await ev(c,`(${seasonalSurfaceCheck.toString()})()`);
      for(const [name,si]of [['spring',0],['summer',1],['autumn',2],['winter',3]]){
        for(const v of ['garden','river','woodland','realm']){
          await ev(c,`(()=>{const q=${views[v]};cam.pitchBias=cam.cur.pitchBias=q[4]||0;flyTo(...q);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);lastSeasonKey='';updateTerrainColors(${si},0.25,1);scene.updateMatrixWorld(true);renderer.render(scene,camera);})()`);
          const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+name+'-'+v+'.png'),Buffer.from(shot.data,'base64'));
        }
      }await ev(c,"lastSeasonKey='';updateTerrainColors(seasonIdx(),(day()%90)/90,1)");
    }
    await ev(c,'window.__renderLighting={visT:W.visT,frac:W.clock.frac,cycle:dayCycleOn}');
    for(const [name,frac]of [['waterDusk',0.735],['waterNight',1.]]){
      await ev(c,`(()=>{W.clock.frac=${frac};W.visT=${frac<.75?(frac-.25)*1.6:.8+(frac-.75)*.4};dayCycleOn=true;animateWorld(0,0);const q=${views.waterGlint};cam.pitchBias=cam.cur.pitchBias=q[4]||0;flyTo(...q);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);animateWorld(0,0);renderer.render(scene,camera);})()`);
      const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-'+name+'.png'),Buffer.from(shot.data,'base64'));
    }
    await ev(c,'W.visT=window.__renderLighting.visT;W.clock.frac=window.__renderLighting.frac;dayCycleOn=window.__renderLighting.cycle;delete window.__renderLighting;animateWorld(0,0)');
    if(which==='candidate'){
      if(args['world-visuals']){result.worldVisuals=await ev(c,`(${worldVisualCheck.toString()})()`);const animals=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-animal-models.png'),Buffer.from(animals.data,'base64'));await ev(c,'window.__animalProbe.meshes.forEach(m=>{m.geometry.dispose();m.dispose();});delete window.__animalProbe;renderer.render(scene,camera)');}
      result.reflectivity=await ev(c,`(${reflectivityCheck.toString()})()`);
      result.metalModel=await ev(c,`(()=>{
        const stage=new THREE.Scene();stage.background=new THREE.Color(0x29343e);
        const sun=new THREE.DirectionalLight(0xfff2dc,0.98);sun.position.set(4,7,4);stage.add(sun,new THREE.HemisphereLight(0xbcd2e8,0x5b5140,0.5));
        const meshes=[];for(const [source,tint]of [[G.soldiers,0x8d3e32],[G.soldierShields,0x8d3e32],[G.soldierKit,0xffffff]]){
          const m=new THREE.InstancedMesh(source.geometry,source.material,1);m.setMatrixAt(0,new THREE.Matrix4());m.setColorAt(0,new THREE.Color(tint));stage.add(m);meshes.push(m);}
        const view=new THREE.PerspectiveCamera(38,renderer.domElement.width/renderer.domElement.height,0.1,100);view.position.set(4,3.5,6);view.lookAt(0,1.5,0);renderer.render(stage,view);
        window.__metalProbe=meshes;
        const gl=renderer.getContext();return renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS));})()`);
      const metalShot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,id+'-metal-model.png'),Buffer.from(metalShot.data,'base64'));
      await ev(c,'window.__metalProbe.forEach(m=>m.dispose());delete window.__metalProbe;renderer.render(scene,camera)');
      result.gardenBearing=await ev(c,`(${gardenBearingCheck.toString()})()`);
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
    if(which==='candidate'&&args.ui)result.ui=await ev(c,`(${uiIntegrationCheck.toString()})()`);
    if(which==='candidate'&&args.graveyards)result.graveyards=await ev(c,`(${auditChurchyardsNative.toString()})()`);
    if(which==='candidate'&&args['ui-references'])result.uiReferences=await ev(c,`(${uiReferencesCheck.toString()})(${auditUIReferences.toString()})`);
    if(which==='candidate'&&args['service-roads'])result.paidCrossings=await ev(c,`(${paidCrossingCheck.toString()})()`);
    if(which==='candidate'&&args['service-roads'])result.serviceRoads=await ev(c,`(${serviceRoadCheck.toString()})()`);
    return result;
  }catch(e){return{id,failed:e.message,errors};}finally{kill();}
}
const results=[];
for(const w of worlds)for(const which of Object.keys(sources)){console.log('Checking '+which+' '+w.seed+' '+w.coast);results.push(await check(which,w));fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));}
const checks=[];
for(const w of worlds){const candidate=results.find(r=>r.id==='candidate-'+w.seed+'-'+w.coast),baseline=results.find(r=>r.id==='baseline-'+w.seed+'-'+w.coast);
  const ok=r=>r&&!r.failed&&!r.errors.length&&r.simErrors===0&&Object.values(r.views).every(v=>v.linked&&v.errors===0&&v.glError===0);
  const row={seed:w.seed,coast:w.coast,compiled:ok(candidate),reflectivity:!!candidate?.reflectivity?.valid,metalModel:!!candidate?.metalModel,gardenBearing:!!candidate?.gardenBearing?.valid,cameraCorrect:!!candidate?.cameraCorrect,liveRebuild:!!candidate?.liveRebuild&&Object.values(candidate.liveRebuild).every(Boolean),churchVariants:!!candidate?.churchVariants};
  if(args['world-visuals'])row.worldVisuals=!!candidate?.worldVisuals?.valid;
  if(args.seasons)row.seasons=!!candidate?.seasons?.valid;
  if(args.ui)row.ui=!!candidate?.ui?.valid;
  if(args['ui-references'])row.uiReferences=!!candidate?.uiReferences?.valid;
  if(args.graveyards)row.graveyards=!!candidate?.graveyards?.valid;
  if(args['service-roads']){row.serviceRoads=!!candidate?.serviceRoads?.valid;row.paidCrossings=!!candidate?.paidCrossings?.valid;}
  if(baseline){row.baselineCompiled=ok(baseline);row.sameHistory=baseline.historySHA256===candidate?.historySHA256;
    row[args['woodland-density']?'woodlandGeometryBudget':args['river-banks']?'bankGeometryBudget':args['geometry-budget']?'withinGeometryBudget':'sameGeometry']=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>{
      const a=candidate.views[v],b=baseline.views[v];return args['woodland-density']?a.geometryTriangles-a.treeTriangles===b.geometryTriangles-b.treeTriangles&&a.treeInstances>b.treeInstances&&a.treeInstances<=b.treeInstances*1.65&&a.treePlacement.wet===0&&a.treePlacement.uncleared===0:args['river-banks']?a.riverTriangles<=b.riverTriangles*1.03&&a.geometryTriangles-a.terrainTriangles-a.bedTriangles-a.riverTriangles-a.apronTriangles===b.geometryTriangles-b.terrainTriangles-b.riverTriangles-b.apronTriangles&&a.terrainTriangles+a.bedTriangles+a.apronTriangles<=b.terrainTriangles+b.apronTriangles+b.riverTriangles*4:args['geometry-budget']?a.geometryTriangles<=b.geometryTriangles:a.geometryTriangles===b.geometryTriangles;});
    row[args['world-visuals']?'waterworksDrawBudget':'sameDrawCalls']=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>args['world-visuals']?candidate.views[v].render.calls<=baseline.views[v].render.calls+candidate.views[v].millRaceDraws*1.5+(candidate.views[v].bedTriangles?1:0):candidate.views[v].render.calls===baseline.views[v].render.calls);
    row.textureCountBudget=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>candidate.views[v].textureCount<=baseline.views[v].textureCount);
    // Inland water reuses the ripple sampler instead of uploading an unused coastal height map.
    // Permit removals; every retained texture size must fit the baseline multiset.
    row.textureSizeBudget=!!candidate?.views&&!!baseline.views&&Object.keys(candidate.views).every(v=>{const remaining=baseline.views[v].textureSizes.map(s=>s.join('x'));return candidate.views[v].textureSizes.every(s=>{const i=remaining.indexOf(s.join('x'));if(i<0)return false;remaining.splice(i,1);return true;});});}
  checks.push(row);}
fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(checks,null,2));
console.log(JSON.stringify({out:OUT,days,checks},null,2));
server.close();
process.exit(checks.every(c=>Object.entries(c).filter(([k])=>!['seed','coast'].includes(k)).every(([,v])=>v))?0:1);
