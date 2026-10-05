#!/usr/bin/env node
/*
  Isolated motte-and-bailey integration probe. Boots a throwaway HTTP copy of
  index.html at AD 1000, inspects terrain and circuits, upgrades stone works,
  adds a town wall, and compares each seed against a fresh boot.

  node tools/fortification-render-check.mjs
  node tools/fortification-render-check.mjs --seeds 6006:sea,2002:land,3003:sea --out /tmp/furlong-fortification-check
*/
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),active=new Set();
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const stop of active)stop();process.exit(sig==='SIGINT'?130:143);});
class CDP{
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();
    this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=e=>rej(new Error('websocket: '+(e.message||'failed')));});
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(new Error('Chrome connection closed'));this.wait.clear();};
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.wait.has(m.id)){const w=this.wait.get(m.id);this.wait.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result);}else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.wait.set(id,{res,rej}));}
  on(method,f){if(!this.subs.has(method))this.subs.set(method,[]);this.subs.get(method).push(f);}
  close(){try{this.ws.close();}catch{}}}
async function ev(c,expression){const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function launch(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-fort-chrome-'));
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const stop=()=>{active.delete(stop);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(stop);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',c=>{clearTimeout(t);rej(new Error('Chrome exited '+c));});p.on('error',e=>{clearTimeout(t);rej(e);});});
    const port=new URL(ws).port,list=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(),pg=list.find(t=>t.type==='page'),c=new CDP(pg.webSocketDebuggerUrl);await c.open;return{c,stop};
  }catch(e){stop();throw e;}}
if(args.help){console.log('Runs isolated AD 1000 fortification rendering and structure checks for one diagnostic seed or three test seeds. Options: --seeds 6006:sea,2002:land,3003:sea --out DIR --boot-timeout 180');process.exit(0);}
if(!CHROME)throw new Error('Chrome not found; set CHROME to its executable');
const worlds=String(args.seeds||'6006:sea,2002:land,3003:sea').split(',').map(v=>{const[seed,coast,foundation]=v.split(':');return{seed:Number(seed),coast,foundation:Number(foundation||seed)};});
if(![1,3].includes(worlds.length)||worlds.some(w=>!Number.isInteger(w.seed)||!['sea','land'].includes(w.coast)))throw new Error('supply one diagnostic or exactly three seed:sea-or-land entries');
const OUT=path.resolve(args.out||path.join(os.tmpdir(),'furlong-fortification-'+Date.now()));if(fs.existsSync(path.join(OUT,'results.json')))throw new Error('choose a fresh output directory');fs.mkdirSync(OUT,{recursive:true});
const original=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),needle='const FOUNDING_AD=850;';if(original.split(needle).length!==2)throw new Error('founding-year fixture seam changed');
const testworld=original.replace(needle,'const FOUNDING_AD=1000;');
const sha=s=>createHash('sha256').update(s).digest('hex');
fs.writeFileSync(path.join(OUT,'index.html'),testworld);
const run={startedUTC:new Date().toISOString(),node:process.version,sourceSHA256:sha(original),testworldSHA256:sha(testworld),testworld:'isolated source copy changes only FOUNDING_AD 850 to 1000; no prehistory ticks',worlds};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
const server=http.createServer((req,res)=>{if(req.url?.split('?')[0]!=='/index.html'){res.writeHead(404);return res.end('not found');}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(testworld);});
await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});const httpPort=server.address().port;
const FOUNDATION=`(()=>{
 const norm=x=>x==null?null:ArrayBuffer.isView(x)?Array.from(x,v=>+Number(v).toFixed(4)):x;
 const num=x=>Number.isFinite(x)?+x.toFixed(4):null;
 const sites=W.settlements.filter(s=>s.motte||s.bailey).map(s=>({name:s.name,kind:s.kind,role:s.role,pos:{x:num(s.pos.x),z:num(s.pos.z)},
  motte:s.motte&&{x:num(s.motte.x),z:num(s.motte.z),r:num(s.motte.r),summitR:num(s.motte.summitR),height:num(s.motte.height),topY:num(s.motte.topY),gateA:num(s.motte.gateA)},
  bailey:s.bailey&&{x:num(s.bailey.x),z:num(s.bailey.z),r:num(s.bailey.r),courtR:num(s.bailey.courtR),gateA:num(s.bailey.gateA),gates:(s.bailey.gates||[]).map(num)},
  buildings:s.buildings.filter(b=>b.motte||b.bailey).map(b=>({arch:b.arch,tier:b.tier,x:num(b.x),z:num(b.z),w:num(b.w),d:num(b.d),rot:num(b.rot),ownerId:b.ownerId??null,district:b.district,motte:!!b.motte,bailey:!!b.bailey})),
  circuits:fortCircuits(s).map(c=>({kind:c===s?'town':c===s.motte?'motte':c===s.bailey?'bailey':'outer',x:num(c.x),z:num(c.z),r:num(c.wallR),gateAngles:fortGateAngles(s,c).map(num),wallRad:norm(c.wallRad),wallKind:norm(c.wallKind),wallDmg:norm(c.wallDmg)}))})).sort((a,b)=>a.name.localeCompare(b.name));
 return sites;
})()`;
const CHECK=`(()=>{
 const num=x=>Number.isFinite(x)?+x.toFixed(4):null;
 const s=W.settlements.find(q=>q.kind==='capital'&&q.motte)||W.settlements.find(q=>q.motte);if(!s)return{failed:'no motte found',settlements:W.settlements.length};
 const m=s.motte,b=s.bailey,angle=m.gateA+Math.PI/2,x=m.x+Math.cos(angle)*(m.r+4),z=m.z+Math.sin(angle)*(m.r+4),gx=m.x+Math.cos(m.gateA)*(m.r+4),gz=m.z+Math.sin(m.gateA)*(m.r+4);
 const ditch=fortSurface(s,m,x,z),gate=fortSurface(s,m,gx,gz),base=hAt(x,z),circuits=fortCircuits(s),baileyGates=fortGateAngles(s,b),ba=baileyGates[0],br=wallRadAt(b,ba+Math.PI/2),bx=b.x+Math.cos(ba+Math.PI/2)*(br+4),bz=b.z+Math.sin(ba+Math.PI/2)*(br+4),bd=fortSurface(s,b,bx,bz),bb=hAt(bx,bz);
 const baileyGateCauseways=baileyGates.map(a=>{const rr=wallRadAt(b,a),X=b.x+Math.cos(a)*(rr+4),Z=b.z+Math.sin(a)*(rr+4);return Math.abs(fortSurface(s,b,X,Z)-hAt(X,Z))<0.02;});
 const perimeterSamples=128,courtR=b.courtR||30;
 let courtContained=true,motteContained=true;for(let k=0;k<perimeterSamples;k++){const a=k/perimeterSamples*Math.PI*2,CX=b.x+Math.cos(a)*courtR,CZ=b.z+Math.sin(a)*courtR,MX=m.x+Math.cos(a)*(m.r+7),MZ=m.z+Math.sin(a)*(m.r+7);if(!fortContains(b,CX,CZ))courtContained=false;if(!fortContains(b,MX,MZ))motteContained=false;}
 const townA=Math.atan2(s.pos.z-b.z,s.pos.x-b.x),townGateOnly=baileyGates.length===1&&Math.abs(Math.atan2(Math.sin(baileyGates[0]-townA),Math.cos(baileyGates[0]-townA)))<0.4;
 const noRearOpenings=!!b.wallKind&&b.wallKind.length>0&&Array.from(b.wallKind).every(k=>k!==1)&&baileyGates.length===1;
 const publicChurches=s.buildings.filter(q=>q.arch==='temple'&&!q.removed&&q.state!=='gone'&&!q.castle&&!q.friary&&Math.min(dist2d(q.x,q.z,m.x,m.z),dist2d(q.x,q.z,b.x,b.z))<520);
 const walker={house:s.owner,settlement:s,placed:s._lay?.placed};
 const churchAccesses=publicChurches.map(ch=>{const spec=chOf(ch),door=spec.door==='W'?locW(ch,0,(spec.W||1)*(ch.d/2+1.2)):locW(ch,spec.door*(ch.w/2+1.2),0),p={x:door[0],z:door[1]},candidates=[];
   for(const st of s.streets||[])if(!st.hidden&&!st.gone&&st.kind!=='edge'&&!st.churchAccess&&(!st.castlePath||ch.castle))for(let j=1;j<st.pts.length;j++){const a=st.pts[j-1],q=st.pts[j],dx=q.x-a.x,dz=q.z-a.z,L2=dx*dx+dz*dz||1,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/L2,0,1),x=a.x+dx*t,z=a.z+dz*t;candidates.push({x,z,d:dist2d(p.x,p.z,x,z),hw:st.hw||2});}
   candidates.sort((a,b)=>a.d-b.d);const direct=candidates.find(q=>q.d<q.hw+1.5&&armySegmentClear(walker,p,q));
   const lane=(s.streets||[]).find(st=>st.churchAccess&&!st.hidden&&!st.gone&&st.pts.length>2&&dist2d(st.pts[1].x,st.pts[1].z,p.x,p.z)<2&&st.pts.slice(2).every((q,k)=>armySegmentClear(walker,st.pts[k+1],q))&&candidates.some(q=>dist2d(q.x,q.z,st.pts[st.pts.length-1].x,st.pts[st.pts.length-1].z)<q.hw+1.5));
   const junction=direct||lane?.pts[lane.pts.length-1];return{arch:ch.arch,x:num(ch.x),z:num(ch.z),door:{x:num(p.x),z:num(p.z)},path:!!junction,junction:junction&&{x:num(junction.x),z:num(junction.z)},accessLane:!!lane};});
 const churchAccessIdempotent=publicChurches.every(ch=>{const n=s.streets.length;return s._lay.churchAccess(ch)&&s._lay.churchAccess(ch)&&s.streets.length===n;});
 const routeCircuit=activeFort(s)||b||m,routeAngle=routeCircuit.gateA??fortGateAngles(s,routeCircuit)[0]??0,routeR=wallRadAt(routeCircuit,routeAngle),routeCenter=fortCenter(routeCircuit),inside={x:routeCenter.x+Math.cos(routeAngle)*(routeR-5),z:routeCenter.z+Math.sin(routeAngle)*(routeR-5)},outside={x:routeCenter.x+Math.cos(routeAngle)*(routeR+8),z:routeCenter.z+Math.sin(routeAngle)*(routeR+8)},friendlyGate=armySegmentClear(walker,inside,outside);
 const hostile={house:s.owner===0?1:0,settlement:s,placed:s._lay?.placed};if(!W.feuds)W.feuds=[];const hadFeud=W.feuds.some(f=>f.a===hostile.house&&f.b===s.owner||f.b===hostile.house&&f.a===s.owner);if(!hadFeud)W.feuds.push({a:hostile.house,b:s.owner});const hostileStart={x:routeCenter.x+Math.cos(routeAngle)*(routeR+90),z:routeCenter.z+Math.sin(routeAngle)*(routeR+90)},hostileGoal=armyDestination(hostile,s,hostileStart),hostileStopsOutside=!!hostileGoal&&dist2d(hostileGoal.x,hostileGoal.z,routeCenter.x,routeCenter.z)>wallRadAt(routeCircuit,Math.atan2(hostileGoal.z-routeCenter.z,hostileGoal.x-routeCenter.x))+18;if(!hadFeud)W.feuds.pop();
 const courtPath=(s.streets||[]).find(st=>st.castlePath&&st.earthwork==='motte'),pathPts=courtPath?.pts||[];let approachMaxGrade=0;
 for(let k=1;k<pathPts.length;k++){const p=pathPts[k-1],q=pathPts[k],run=dist2d(p.x,p.z,q.x,q.z);if(run)approachMaxGrade=Math.max(approachMaxGrade,Math.abs(fortSurface(s,m,p.x,p.z)-fortSurface(s,m,q.x,q.z))/run);}
 let courtDry=true,courtMinY=Infinity,courtMaxSlope=0,courtSamples=0;
 for(let a=0;a<16;a++)for(let r=0;r<=courtR;r+=6){const X=b.x+Math.cos(a*Math.PI/8)*r,Z=b.z+Math.sin(a*Math.PI/8)*r,i=cIdx(toCell(X),toCell(Z)),y=hAt(X,Z),sl=slopeAt(toCell(X),toCell(Z));courtSamples++;courtMinY=Math.min(courtMinY,y);courtMaxSlope=Math.max(courtMaxSlope,sl);if(W.water[i]===1||riverAt(X,Z,0)||lakeAt(s,X,Z,0)||y<4||sl>=0.35)courtDry=false;}
 const profiles={summit:motteSurface(m,m.x,m.z),topY:m.topY,ditchY:ditch,ditchBase:base,ditchDepth:base-ditch,gateY:gate,gateBase:hAt(gx,gz),
  ditchMatches:motteSurface(m,x,z)===ditch,ditchBelowGround:ditch<base-1,gateCauseway:Math.abs(gate-hAt(gx,gz))<0.02,baileyDitchDepth:bb-bd,baileyDitchBelowGround:bd<bb-0.8,baileyGateCauseways,approachMaxGrade,court:{dry:courtDry,minY:courtMinY,maxSlope:courtMaxSlope,samples:courtSamples},naturalRise:hAt(m.x,m.z)-hAt(b.x,b.z),courtContained,motteContained,townGateOnly,noRearOpenings};
 const arrays=circuits.map(c=>({kind:c===s?'town':c===m?'motte':c===b?'bailey':'other',rad:c.wallRad?.length||0,kindArray:c.wallKind?.length||0,dmgArray:c.wallDmg?.length||0,gates:fortGateAngles(s,c)}));
 return{churchAccessIdempotent,settlement:s.name,sites:W.settlements.filter(q=>q.motte).length,profiles,arrays,churchAccesses,friendlyGate,hostileStopsOutside,ownerInventory:(()=>{const ids=[...s.buildings.filter(v=>v.bailey||v.arch==='keep'&&dist2d(v.x,v.z,m.x,m.z)<m.r)].map(v=>[v.arch,ownerOf(v,s),v.district,v.storageId??null]);
 const owners=[...(s._owners||new Map())].map(([o,v])=>[typeof o==='object'?(o.id??o.ownerId??o.head?.id??String(o)):o,v.held,v.sale,v.reserve,v.animals]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const lots=s.storage?.lots?[...s.storage.lots.values()].map(l=>[l.id,l.owner,l.good,+l.qty.toFixed(6),l.location,l.availability,l.pendingPurchase||false]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))):[];
 return{ids,stores:Object.keys(s.stores||{}).sort().map(g=>[g,+s.stores[g]||0]),owners,lots};})()};
})()`;
const runOne=async(w,mutate)=>{
 const {c,stop}=await launch(),id=`${w.seed}-${w.coast}-${mutate?'exercise':'repeat'}`,errors=[];
 try{
  await c.send('Page.enable');await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  c.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.description||a.value).join(' '));});
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__fortRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await c.send('Page.navigate',{url:`http://127.0.0.1:${httpPort}/index.html#s=${w.seed}&f=${w.foundation}&c=${w.coast}`});
  const timeout=Number(args['boot-timeout']||180)*1000,deadline=Date.now()+timeout;let ready=false;
  while(Date.now()<deadline){if(errors.length)throw Error(errors.join('\n'));ready=await ev(c,"document.getElementById('loading')===null&&typeof renderer!=='undefined'&&!!W").catch(()=>false);if(ready)break;await sleep(200);}if(!ready)throw Error('boot timeout');
  const foundations=await ev(c,FOUNDATION),result={id,seed:w.seed,coast:w.coast,foundationSHA256:sha(JSON.stringify(foundations)),foundations,errors};
  if(!foundations.length){result.eligibility=await ev(c,`(()=>({ad:AD(),settlements:W.settlements.map(s=>({name:s.name,kind:s.kind,role:s.role,pos:{x:+s.pos.x.toFixed(1),z:+s.pos.z.toFixed(1)},motteEligible:(s.role==='seat'||s.role==='fort')&&AD()<1070,hasKeep:s.buildings.some(b=>b.arch==='keep'&&!b.removed)}))}))()`);result.failed='no motte-and-bailey settlements';return result;}
  const details=await ev(c,CHECK);if(details.failed)throw Error(details.failed);result.details=details;
  if(mutate){
   const beforeUpgrade=await ev(c,`(()=>{const s=W.settlements.find(q=>q.kind==='capital'&&q.motte)||W.settlements.find(q=>q.motte),m=s.motte,b=s.bailey,a=fortGateAngles(s,b)[0],r=wallRadAt(b,a),gx=b.x+Math.cos(a)*r,gz=b.z+Math.sin(a)*r,ch=s.buildings.filter(q=>q.arch==='temple'&&!q.removed&&q.state!=='gone'&&!q.castle&&!q.friary).sort((p,q)=>Math.min(dist2d(p.x,p.z,m.x,m.z),dist2d(p.x,p.z,b.x,b.z))-Math.min(dist2d(q.x,q.z,m.x,m.z),dist2d(q.x,q.z,b.x,b.z)))[0],lane=ch&&(s.streets||[]).find(st=>st.churchAccess&&st.pts.some(q=>dist2d(q.x,q.z,ch.x,ch.z)<ch.w+ch.d+12)),joint=lane?.pts?.[Math.floor(lane.pts.length/2)]||ch;setSpeed(0);cam.mode='free';return{materials:{motteStone:!!s.motteStone,baileyStone:!!s.baileyStone,keepTimber:!!s.buildings.find(q=>q.motte&&!q.removed)},views:[{name:'timber-overview',x:(m.x+b.x)/2,z:(m.z+b.z)/2,d:180,yaw:a+2.4},{name:'timber-gate',x:gx,z:gz,d:48,yaw:a+Math.PI},...(ch?[{name:'church-access',x:(ch.x+joint.x)/2,z:(ch.z+joint.z)/2,d:58,yaw:Math.atan2(joint.z-ch.z,joint.x-ch.x)+Math.PI}]:[])]};})()`);
   result.initialMaterials=beforeUpgrade.materials;const views=beforeUpgrade.views;
   for(const v of views){await ev(c,`(()=>{flyTo(${v.x},${v.z},${v.d},${v.yaw});cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);scene.updateMatrixWorld(true);renderer.render(scene,camera);})()`);
    const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`motte-${w.seed}-${w.coast}-${v.name}.png`),Buffer.from(shot.data,'base64'));}
   result.bandits=await ev(c,`(()=>{const s=W.capital,sites=[s,...((W.adj?.[W.settlements.indexOf(s)]||[]).slice(0,2).map(e=>W.settlements[e.to]))],households=new Set();
    for(const home of sites)for(const p of (home.folk||[]).slice(0,32)){const h=householdAccount(p);if(h&&!households.has(h)){households.add(h);h.hunger=.8;h.assets._debt=Math.max(h.assets._debt||0,foodYr()*2);}}
    const camp={id:++campN,x:s.pos.x+50,z:s.pos.z+50,raids:0,born:day(),men:[],nextRecruit:day()},before=W.settlements.reduce((n,t)=>n+(t.folk?.length||0),0);W.banditCamps.push(camp);
    for(let k=0;k<64&&!camp.men.length;k++){camp.recruitCursor=0;recruitBandit(camp,true);}const p=camp.men[0];if(!p){outlawCampEnds(camp,'fixture ended');return{recruited:false};}
    const home=W.settlements[p.si],h=householdAccount(p),debt=h.assets._debt,pantryBefore=JSON.stringify(h.assets.pantry||{}),g=campGroup(0x4a4038);g.position.set(camp.x,hAt(camp.x,camp.z),camp.z);scene.add(g);G.campMeshes.set(camp,g);
    flyTo(camp.x,camp.z,100,0);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);animateWorld(0,1);const count1=G.citIdx.filter(q=>q?.p===p).length;animateWorld(0,2);const count2=G.citIdx.filter(q=>q?.p===p).length;
    const samePerson=home.folk.includes(p)&&camp.men[0]===p&&p._hh===h,peopleUnchanged=before===W.settlements.reduce((n,t)=>n+(t.folk?.length||0),0),workStopped=p.tr===null&&p.away?.why==='outlaw';
    outlawCampEnds(camp,'fixture camp scattered');animateWorld(0,3);return{recruited:true,samePerson,peopleUnchanged,workStopped,pickedOncePerFrame:count1===1&&count2===1,returnPreserved:!p.dead&&!p.outlawCampId&&home.folk.includes(p)&&p._hh===h&&h.assets._debt===debt&&JSON.stringify(h.assets.pantry||{})===pantryBefore};})()`);
   result.initialRender=await ev(c,`(()=>{const gl=renderer.getContext();return{drawCalls:renderer.info.render.calls,programs:renderer.info.programs.length,linked:renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS))};})()`);
   result.mutation=await ev(c,`(()=>{const s=W.settlements.find(q=>q.kind==='capital'&&q.motte)||W.settlements.find(q=>q.motte),ops=s._lay.live;
    const before=${JSON.stringify(null)};W.startAD=1070;
    const keep=ops.rebuildKeep();if(keep)s.motteStone=true;const bailey=ops.stoneBailey();fortPrepare(s);if(keep)wallWorks(s.motte,true);
    const m=s.motte,b=s.bailey,damageAngle=m.gateA+Math.PI/2;damageWalls(m,damageAngle,0.30,0.4);damageWalls(b,b.gateA+Math.PI,0.30,0.25);
    const damaged={motte:wallDmgAt(m,damageAngle),bailey:wallDmgAt(b,b.gateA+Math.PI)};
    const townWall=ops.wall();fortPrepare(s);G.wallsDirty=true;rebuildWalls();rebuildRoadMesh();rebuildDetails();
    const circuits=fortCircuits(s),arrays=circuits.map(c=>({kind:c===s?'town':c===m?'motte':c===b?'bailey':'outer',rad:c.wallRad?.length||0,kindArray:c.wallKind?.length||0,dmgArray:c.wallDmg?.length||0,gates:fortGateAngles(s,c)}));
    const ownership=(()=>{const buildings=s.buildings.filter(v=>v.bailey||v.arch==='keep'&&dist2d(v.x,v.z,m.x,m.z)<m.r).map(v=>[v.arch,ownerOf(v,s),v.district,v.storageId??null]);
      const owners=[...(s._owners||new Map())].map(([o,v])=>[typeof o==='object'?(o.id??o.ownerId??o.head?.id??String(o)):o,v.held,v.sale,v.reserve,v.animals]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
      const lots=s.storage?.lots?[...s.storage.lots.values()].map(l=>[l.id,l.owner,l.good,+l.qty.toFixed(6),l.location,l.availability,l.pendingPurchase||false]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))):[];
      return{ids:buildings,stores:Object.keys(s.stores||{}).sort().map(g=>[g,+s.stores[g]||0]),owners,lots};})();
    flyTo((m.x+b.x)/2,(m.z+b.z)/2,180,b.gateA+2.4);cam.cur.focus.copy(cam.focus);cam.cur.dist=cam.dist;cam.cur.yaw=cam.yaw;updateCamera(0,0);scene.updateMatrixWorld(true);renderer.info.reset();renderer.render(scene,camera);
    const gl=renderer.getContext(),parts=[G.terrain,G.roads,G.roadJoins,G.bridges,G.walls,...Object.values(G.det)].filter(Boolean),triangles=parts.reduce((n,o)=>n+(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1),0);
    const earthwork=[];scene.traverse(o=>{if(o.userData?.earthwork&&o.userData.s===s)earthwork.push({triangles:o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3,vertices:o.geometry.attributes.position.count,triangleCap:50000});});
    return{keepRebuilt:keep,baileyStone:bailey,townWall,stoneMaterials:{motteStone:!!s.motteStone,baileyStone:!!s.baileyStone,motteWallHeight:m.wallHeight,baileyWallHeight:b.wallHeight,keepTimber:!!s.buildings.find(q=>q.arch==='keep'&&!q.removed&&q.motte)},damage:damaged,arrays,ownership,render:{errors:typeof errN==='number'?errN:0,drawCalls:renderer.info.render.calls,triangles,earthwork,programs:renderer.info.programs.length,linked:renderer.info.programs.every(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS))}};})()`);
   const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,`motte-${w.seed}-${w.coast}-upgraded.png`),Buffer.from(shot.data,'base64'));
  }
  if(errors.length)throw Error(errors.join('\n'));return result;
 }catch(e){return{id,seed:w.seed,coast:w.coast,failed:e.message,errors};}finally{stop();}
};
const results=[];
for(const w of worlds){console.log(`Booting AD 1000 testworld ${w.seed}:${w.coast}`);const a=await runOne(w,true);results.push(a);fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));if(!a.failed){const repeat=await runOne(w,false);results.push(repeat);fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));}}
server.close();
const checks=worlds.map(w=>{const a=results.find(r=>r.id===`${w.seed}-${w.coast}-exercise`),b=results.find(r=>r.id===`${w.seed}-${w.coast}-repeat`),profile=a?.details?.profiles,mut=a?.mutation;
 return{seed:w.seed,coast:w.coast,motteFound:!!a&&!a.failed,baselineEligible:!!a&&!a.failed||!!a?.eligibility&&a.eligibility.settlements.some(s=>s.motteEligible),foundationDeterministic:!!a&&!!b&&!a.failed&&!b.failed&&a.foundationSHA256===b.foundationSHA256,
  ditchProfile:!!profile?.ditchMatches&&profile.ditchBelowGround&&profile.gateCauseway&&profile.summit===profile.topY&&profile.baileyDitchBelowGround&&profile.baileyGateCauseways?.every(Boolean),
  access:!!profile&&profile.approachMaxGrade<0.35&&profile.court.dry&&profile.court.maxSlope<0.35&&profile.courtContained&&profile.motteContained,
  banditPeople:!!a?.bandits&&Object.values(a.bandits).every(Boolean),
  churchAccess:!!a?.details?.churchAccessIdempotent&&!!a?.details?.churchAccesses&&a.details.churchAccesses.length>0&&a.details.churchAccesses.every(x=>x.path),
  friendlyGate:!!a?.details?.friendlyGate,
  hostileStopsOutside:!!a?.details?.hostileStopsOutside,
  enceinte:!!profile&&profile.townGateOnly&&profile.noRearOpenings,
  circuits:!!mut&&mut.arrays.some(c=>c.kind==='town')&&mut.arrays.some(c=>c.kind==='motte')&&mut.arrays.some(c=>c.kind==='bailey')&&mut.arrays.every(c=>c.rad>0&&c.rad===c.kindArray&&c.gates.length>0&&c.gates.every(Number.isFinite)),
  damage:!!mut&&mut.damage.motte>0.1&&mut.damage.bailey>0.1,
  upgrades:!!mut&&mut.keepRebuilt&&mut.baileyStone&&mut.townWall,
  stoneUpgrades:!!mut&&a.initialMaterials?.keepTimber&&!a.initialMaterials.motteStone&&!a.initialMaterials.baileyStone&&mut.stoneMaterials.motteStone&&mut.stoneMaterials.baileyStone&&!mut.stoneMaterials.keepTimber&&mut.stoneMaterials.motteWallHeight>=4&&mut.stoneMaterials.baileyWallHeight>=6,
  ownershipInventoryStable:!!a?.details?.ownerInventory&&!!mut&&JSON.stringify(a.details.ownerInventory)===JSON.stringify(mut.ownership),
  earthworkMesh:!!mut&&mut.render.earthwork.length===1&&mut.render.earthwork[0].triangles>0&&mut.render.earthwork[0].triangles<=50000,
  rendered:!!a?.initialRender?.drawCalls&&a.initialRender.linked&&!!mut&&mut.render.drawCalls>0&&mut.render.triangles>0&&mut.render.linked&&mut.render.errors===0&&!a.errors?.length};});
fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(checks,null,2));
console.log(JSON.stringify({out:OUT,sourceSHA256:run.sourceSHA256,testworldSHA256:run.testworldSHA256,checks,failures:results.filter(r=>r.failed).map(r=>({id:r.id,failed:r.failed,errors:r.errors}))},null,2));
process.exit(checks.every(c=>Object.entries(c).filter(([k])=>!['seed','coast','motteFound'].includes(k)).every(([,v])=>v))?0:1);
