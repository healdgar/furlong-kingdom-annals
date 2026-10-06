import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// settleTracks searches the track graph once per place. The search now judges each node and edge once for all places,
// reuses its tables, and stops once every field has met its nearest corner; this runs it against the original search
// (frozen from 0f60c68) on random track graphs and requires the identical lanes, in the identical order.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const take=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
const current=take('function settleTracks(){','\nconst FEUD_NAMES');
const frozen=String.raw`function settleTracks(){
  if(!W.land)return;const T=trackGraph(),used=new Set(),N=T.pts.length,F=W.land.F;
  const rural=[];for(const o of W.settlements)for(const b of o.buildings)if(b.rural&&!b.removed&&b.state!=='gone')rural.push(b);
  // Scratch wrappers keep spatial stamps out of authoritative towns and buildings.
  const townNodes=W.settlements.map(o=>({x:o.pos.x,z:o.pos.z,o})),yardNodes=rural.map(b=>({x:b.x,z:b.z,b})),fields=new Map();
  const townRadius=n=>Math.max(n.o.extentR||n.o.radius||60,n.o.radius||60),finite=n=>Number.isFinite(n.x)&&Number.isFinite(n.z);
  const towns=townNodes.every(n=>finite(n)&&Number.isFinite(townRadius(n))&&townRadius(n)>=0&&townRadius(n)<=4096)?makeHash(256):null,yards=yardNodes.every(finite)?makeHash(64):null;
  if(towns)for(const n of townNodes)towns.add(n,townRadius(n));if(yards)for(const n of yardNodes)yards.add(n,12);
  const candidates=(hash,nodes,x,z)=>hash&&Number.isFinite(x)&&Number.isFinite(z)?hash.near(x,z,0):nodes;
  for(const f of F)if((f.state===LS.TILLED||f.state===LS.PASTURE)&&f.kind!==LK.NONE){let list=fields.get(f.dom);if(!list)fields.set(f.dom,list=[]);list.push(f);}
  const SH=new Map(),sk=(i,j)=>i*100003+j;for(const o of W.settlements)for(const st of o.streets||[]){if(st.gone||st.kind==='edge')continue;const P=st.pts; // every street (made or waiting), hashed by 20 m cells
    for(let k=1;k<P.length;k++){const a=P[k-1],b=P[k];for(let t=0;t<=1;t+=0.25){const i=Math.floor((a.x+(b.x-a.x)*t)/20),j=Math.floor((a.z+(b.z-a.z)*t)/20),q=sk(i,j);if(!SH.has(q))SH.set(q,[]);SH.get(q).push([a,b,st.hw||3]);}}}
  const onStreet=(x,z)=>{const i=Math.floor(x/20),j=Math.floor(z/20);for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const L=SH.get(sk(i+di,j+dj));if(L)for(const[a,b,hw]of L)if(segDist(x,z,a,b)<hw+6)return true;}return false;};
  const urban=(x,z)=>candidates(towns,townNodes,x,z).some(({o})=>dist2d(x,z,o.pos.x,o.pos.z)<(o.extentR||o.radius||60))||candidates(yards,yardNodes,x,z).some(({b})=>Math.abs(b.x-x)<12&&Math.abs(b.z-z)<12)||onStreet(x,z); // a town's own ground is bought and laid out in lots and yards; a farmstead's yard is its own
  W.settlements.forEach((s,si)=>{
    const fs=fields.get(si)||[];if(!fs.length)return;
    const R=(s.extentR||s.radius||60)+15;let a0=-1,bd=1e18;
    for(let i=0;i<N;i++){const d=dist2d(T.pts[i].x,T.pts[i].z,s.pos.x,s.pos.z);if(d>R*4)continue;const dd=Math.abs(d-R);if(dd<bd){bd=dd;a0=i;}}
    if(a0<0)return;
    const dist=new Float64Array(N).fill(Infinity),via=new Array(N),heap=[];dist[a0]=0;
    const push=(d,v)=>{heap.push([d,v]);let k=heap.length-1;while(k>0){const q=(k-1)>>1;if(heap[q][0]<=heap[k][0])break;[heap[q],heap[k]]=[heap[k],heap[q]];k=q;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top;};
    push(0,a0);
    while(heap.length){const[dc,v]=pop();
      if(dc>dist[v])continue;if(dc>6000)break;
      for(const e of T.adj[v]){const w=e.a===v?e.b:e.a,P=T.pts[w];let c=e.c;const Pv=T.pts[v];if(v!==a0&&(urban(P.x,P.z)||urban((P.x+Pv.x)/2,(P.z+Pv.z)/2)))continue; // the lanes stop at the town's edge and go round the farmyards
        for(const {o} of candidates(towns,townNodes,P.x,P.z))if(o!==s&&dist2d(P.x,P.z,o.pos.x,o.pos.z)<(o.radius||60))c*=5; // not through another village's yards
        if(dc+c<dist[w]){dist[w]=dc+c;via[w]=e;push(dist[w],w);}}}
    for(const f of fs){let t=-1,td=1e18;for(const q of furlongPoly(f)){const i=T.V.get(tgKey(q));if(i!==undefined&&dist[i]<td){td=dist[i];t=i;}}
      for(let v=t,g=0;v>=0&&v!==a0&&via[v]&&g<400;g++){const e=via[v];used.add(e.k);v=e.a===v?e.b:e.a;}}});
  W.trackSet=used;prepareTrackBridges();G.tracksDirty=true;
}
`;
const shared=['const clamp=','const dist2d=','function segDist(','let HASH_STAMP','function makeHash(','const tgKey='].map(s=>{const i=source.indexOf(s);assert.ok(i>=0,s);const line=source.slice(i,source.indexOf('\n',i));return s==='function makeHash('?take('function makeHash(','\nfunction groundBuilding'):line;}).join('\n');
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
function world(seed,{n=34,places=6,rural=40,streets=5,ties=false}){
  const r=rng(seed),cell=45,pts=[],V=new Map(),adj=[],E=new Map(),key=p=>Math.round(p.x)+','+Math.round(p.z),at=(i,j)=>j*(n+1)+i;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const p={x:i*cell+Math.round((r()-.5)*10),z:j*cell+Math.round((r()-.5)*10)};V.set(key(p),pts.length);pts.push(p);adj.push([]);}
  const edge=(a,b)=>{const L=Math.hypot(pts[a].x-pts[b].x,pts[a].z-pts[b].z),dh=r()*14,k=a<b?a+'_'+b:b+'_'+a;if(r()<.07||E.has(k))return;const e={a,b,k,L,c:ties?[40,40,40,80][Math.floor(r()*4)]:L*(1+8*dh/Math.max(1,L))};E.set(k,e);adj[a].push(e);adj[b].push(e);};
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){if(i<n)edge(at(i,j),at(i+1,j));if(j<n)edge(at(i,j),at(i,j+1));if(i<n&&j<n&&r()<.2)edge(at(i,j),at(i+1,j+1));}
  const settlements=Array.from({length:places},(_,k)=>({name:'p'+k,pos:{x:cell*(3+r()*(n-6)),z:cell*(3+r()*(n-6))},radius:50+r()*70,extentR:r()<.7?60+r()*90:undefined,buildings:[],streets:[]}));
  for(const s of settlements){for(let k=0;k<rural/places;k++){const a=r()*6.28,d=60+r()*300;s.buildings.push({rural:true,removed:false,state:'sound',x:s.pos.x+Math.cos(a)*d,z:s.pos.z+Math.sin(a)*d});}
    for(let k=0;k<streets;k++){const a=r()*6.28,l=40+r()*160;s.streets.push({pts:[{x:s.pos.x,z:s.pos.z},{x:s.pos.x+Math.cos(a)*l,z:s.pos.z+Math.sin(a)*l}],hw:3,kind:r()<.2?'edge':'lane',gone:r()<.1});}}
  const F=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){const poly=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)].map(q=>({x:pts[q].x,z:pts[q].z,nb:1}));
    if(r()<.04)poly[1]={x:poly[1].x+.4,z:poly[1].z+.4,nb:1};if(r()<.03)poly.push({x:-5000,z:-5000,nb:1}); // a corner off the graph
    const cx=pts[at(i,j)].x+cell/2,cz=pts[at(i,j)].z+cell/2;let best=0,bd=1e18;settlements.forEach((s,k)=>{const d=Math.hypot(s.pos.x-cx,s.pos.z-cz);if(d<bd){bd=d;best=k;}});
    F.push({poly,x:cx,z:cz,dom:r()<.05?-1:best,state:[2,3,0,1][Math.floor(r()*4)],kind:r()<.1?0:1});}
  return {W:{land:{F},settlements,tg:{V,pts,adj,E},trackSet:null}};
}
function run(seed,opts){
  const ctx=vm.createContext({console,Math,Map,Set,Number,Float64Array,Int8Array,Int32Array,Uint8Array,Array,Object,Infinity,performance});
  const w=world(seed,opts);
  vm.runInContext('const LS={WILD:0,WOOD:1,TILLED:2,PASTURE:3,SCRUB:4,BURNT:5},LK={NONE:0,FIELD:1};const furlongPoly=f=>f.poly,trackGraph=()=>W.tg,prepareTrackBridges=()=>{},G={};',ctx);
  ctx.W=w.W;
  vm.runInContext(shared+'\n'+frozen.replace('function settleTracks(){','function settleTracksFrozen(){')+'\n'+current,ctx);
  vm.runInContext('settleTracksFrozen()',ctx);const before=[...ctx.W.trackSet];
  vm.runInContext('settleTracks()',ctx);const after=[...ctx.W.trackSet];
  return {before,after};
}
for(const [name,opts] of [['small world',{n:16,places:4,rural:20}],['many places',{n:24,places:10,rural:50,streets:6}],['no rural yards',{n:16,places:5,rural:0,streets:0}],['tied path costs',{n:20,places:6,rural:30,ties:true}]])
  test('settleTracks matches the frozen search: '+name,()=>{let lanes=0;for(let seed=1;seed<=5;seed++){const {before,after}=run(seed*7919,opts);assert.deepEqual(after,before,'seed '+seed);lanes+=before.length;}assert.ok(lanes>40,'the worlds produce lanes: '+lanes);});
