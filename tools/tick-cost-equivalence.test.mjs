import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Equivalence of the per-day helpers that were rewritten without changing what they decide, each run against its
// original text (frozen from 0f60c68) on randomized inputs: household head lists, the best dealer for a load,
// the slope at a cell and the nearest reachable street node of a storage route.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const frozen={"headsOf": "function headsOf(s){return householdsOf(s).map(h=>h.head).filter(p=>p&&!p.dead);} // an orphan household remains an owner even before its heir is grown", "heads_": "function heads_(s,pred){return s.folk?headsOf(s).filter(h=>!h.role&&pred(h)):[];}", "workers_": "function workers_(s,pred){return s.folk?headsOf(s).filter(h=>!h.role&&!h.outlawCampId&&pred(h)):[];}", "merchantFor": "function merchantFor(o,cost,d){const ok=h=>(h.tr==='merchant'||h.tr==='carter'||h.tr==='boatman')&&(h.w||0)>cost*0.5,L=heads_(o,ok);if(d&&d!==o)L.push(...heads_(d,ok));L.sort((a,c)=>(c.tr==='merchant')-(a.tr==='merchant')||(c.w||0)-(a.w||0));return L[0]||null;} // a merchant of the place, or a dealer of the market the goods will go to, riding out to buy (strangers come only by sea), with the means to buy the load", "slopeAt": "function slopeAt(cx,cz){\n  const h=W.h,c=h[cIdx(cx,cz)];let m=0;\n  for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])if(inB(cx+dx,cz+dz))m=Math.max(m,Math.abs(h[cIdx(cx+dx,cz+dz)]-c));\n  return m/CELL;\n}", "storageRoute": "function storageRoute(s,a,b,batch){\n  if(s.siegeBy||s.quarantineUntil>day())return Infinity;\n  const fortified=typeof fortCircuits==='function'&&fortCircuits(s).length;\n  const signature=(s.streets||[]).map(st=>`${!!st.gone}:${!!st.hidden}:${st.pts?.length||0}`).join('|')+(fortified?':'+streetGraph(s).key:'');\n  if(s._storageRouteSignature!==signature){s._storageRouteSignature=signature;s._storageGraph=streetGraph({...s,_sg:null,streets:(s.streets||[]).filter(st=>!st.gone&&!st.hidden)});}\n  const g=s._storageGraph,C=batch?.s===s?batch:STORAGE_ROUTE_BATCHES.get(s);if(!g.N.length)return Infinity;\n  if(C&&C.g!==g){C.g=g;C.points.clear();C.paths.clear();}\n  const accessible=p=>{const key=p.x+','+p.z;if(C?.points.has(key))return C.points.get(key);let best=-1,bd=Infinity;\n    for(let i=0;i<g.N.length;i++){const d=dist2d(p.x,p.z,g.N[i].x,g.N[i].z);if(d<bd&&storageAccess(s,p,g.N[i])){best=i;bd=d;}}\n    if(C&&C.points.size<4096)C.points.set(key,best);return best;};\n  const ai=accessible(a),bi=accessible(b);if(ai<0||bi<0)return Infinity;\n  const key=ai+','+bi;let P=C?.paths.get(key);if(P===undefined){P=streetPath(g,ai,bi);if(C&&C.paths.size<4096)C.paths.set(key,P);}\n  if(!P)return Infinity;let d=dist2d(a.x,a.z,g.N[ai].x,g.N[ai].z)+dist2d(b.x,b.z,g.N[bi].x,g.N[bi].z);\n  for(let i=1;i<P.length;i++)d+=dist2d(g.N[P[i-1]].x,g.N[P[i-1]].z,g.N[P[i]].x,g.N[P[i]].z);return d;\n}"};
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
const current={headsOf:line('function headsOf(s){'),heads_:line('function heads_(s,pred){'),workers_:line('function workers_(s,pred){'),merchantFor:line('function merchantFor(o,cost,d){'),
  slopeAt:block('function slopeAt(cx,cz){','\n}\n')+'\n}',storageRoute:block('function storageRoute(s,a,b,batch){','\n/* Match legal claims').trimEnd()};
const rename=(text,name,to)=>text.replace('function '+name+'(','function '+to+'(');
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
const same=(a,b,label)=>assert.deepEqual(a,b,label);

function realm(extra){const ctx=vm.createContext({console,Math,Map,Set,Number,Float64Array,Int32Array,Array,Object,Infinity,...extra});return ctx;}
const names=['headsOf','heads_','workers_','merchantFor'];
test('household head lists and the best dealer match the original text',()=>{
  const ctx=realm({});
  vm.runInContext('let CALLS=0;function householdsOf(s){CALLS++;return s.households||[];}',ctx);
  for(const n of names)vm.runInContext(rename(frozen[n],n,n+'Old')+'\n'+current[n],ctx);
  const r=rng(7),TR=['merchant','carter','boatman','smith','weaver',undefined];
  const settlement=k=>({folk:r()<.1?undefined:[1],households:Array.from({length:Math.floor(r()*12)},(_,i)=>({head:r()<.1?null:{id:k*100+i,dead:r()<.15,role:r()<.15?'friar':undefined,outlawCampId:r()<.1?3:undefined,tr:TR[Math.floor(r()*TR.length)],w:r()<.1?undefined:Math.floor(r()*5)*10+(r()<.1?NaN:0)}}))});
  ctx.pred=h=>h.id%3!==0&&(h.w||0)>=0;
  for(let i=0;i<400;i++){
    const o=settlement(i),d=r()<.2?o:settlement(i+1000),cost=Math.floor(r()*5)*10;ctx.o=o;ctx.d=d;ctx.cost=cost;
    const out=e=>JSON.stringify(vm.runInContext(e,ctx));
    same(out('headsOf(o).map(h=>h.id)'),out('headsOfOld(o).map(h=>h.id)'));
    same(out('heads_(o,pred).map(h=>h.id)'),out('heads_Old(o,pred).map(h=>h.id)'));
    same(out('workers_(o,pred).map(h=>h.id)'),out('workers_Old(o,pred).map(h=>h.id)'));
    same(out('merchantFor(o,cost,d)?.id??null'),out('merchantForOld(o,cost,d)?.id??null'),'merchantFor '+i);
    same(out('merchantFor(o,cost,undefined)?.id??null'),out('merchantForOld(o,cost,undefined)?.id??null'));
  }
  const calls=vm.runInContext('CALLS',ctx);assert.ok(calls>0);
});
test('slopeAt matches the original at every edge and corner',()=>{
  const ctx=realm({});
  const G=9;vm.runInContext(`const GRID=${G},CELL=7,W={h:new Float64Array(${G*G})};const inB=(cx,cz)=>cx>=0&&cz>=0&&cx<GRID&&cz<GRID,cIdx=(cx,cz)=>cz*GRID+cx;`,ctx);
  vm.runInContext(rename(frozen.slopeAt,'slopeAt','slopeAtOld')+'\n'+current.slopeAt,ctx);
  const r=rng(3);for(let t=0;t<30;t++){const heights=Array.from({length:G*G},()=>r()<.05?NaN:Math.floor(r()*40)+r());ctx.heights=heights;vm.runInContext('W.h.set(heights)',ctx);
    for(let cx=0;cx<G;cx++)for(let cz=0;cz<G;cz++)assert.ok(Object.is(vm.runInContext(`slopeAt(${cx},${cz})`,ctx),vm.runInContext(`slopeAtOld(${cx},${cz})`,ctx)),`${cx},${cz}`);}
});
test('storageRoute finds the same nearest reachable street node as the original scan',()=>{
  for(let seed=1;seed<=40;seed++){
    const r=rng(seed*131),ctx=realm({});
    const nodes=Array.from({length:3+Math.floor(r()*40)},()=>({x:Math.floor(r()*30)*5,z:Math.floor(r()*30)*5})); // on a coarse grid: many equal distances
    if(r()<.15)nodes.push({x:NaN,z:3});
    const blocked=new Set();for(let i=0;i<4000;i++)if(r()<.5)blocked.add(i);
    vm.runInContext(`const W={};let day=()=>1;const dist2d=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);const fortCircuits=()=>[];
      const graph={N:${JSON.stringify(nodes).replace(/null/g,'NaN')},key:'k'};const streetGraph=()=>graph;const streetPath=(g,a,b)=>[a,b];
      let ACCESS=0;const blocked=new Set(${JSON.stringify([...blocked])});const storageAccess=(s,p,n)=>{ACCESS++;return !blocked.has(((p.x*31+p.z*17+n.x*7+n.z*13)|0)&4095);};
      const STORAGE_ROUTE_BATCHES=new WeakMap();`,ctx);
    vm.runInContext(line('let STORAGE_NODE_DIST=')+'\n'+rename(frozen.storageRoute,'storageRoute','storageRouteOld')+'\n'+current.storageRoute,ctx);
    // nodes are tested as string-ified literals; rebuild the NaN node
    vm.runInContext('graph.N.forEach(n=>{if(n.x===null)n.x=NaN;});',ctx);
    for(let q=0;q<25;q++){const a={x:Math.floor(r()*30)*5,z:Math.floor(r()*30)*5},b={x:Math.floor(r()*30)*5,z:Math.floor(r()*30)*5};
      ctx.s={streets:[{pts:[1,2]}],pos:{x:0,z:0}};ctx.a=a;ctx.b=b;
      const o=vm.runInContext('storageRouteOld(s,a,b)',ctx);ctx.s={streets:[{pts:[1,2]}],pos:{x:0,z:0}};const n=vm.runInContext('storageRoute(s,a,b)',ctx);
      assert.equal(n,o,`seed ${seed} query ${q}`);}
  }
});
test('riverAt reads the river hash cells in the order near() lists them',()=>{
  const ctx=realm({});
  vm.runInContext([line('const clamp='),line('let HASH_STAMP'),block('function makeHash(','\nfunction groundBuilding'),line('function segDist(')].join('\n'),ctx);
  vm.runInContext('const W={rivHash:makeHash(40)};',ctx);
  vm.runInContext('function riverAtOld(x,z,pad){for(const o of W.rivHash.near(x,z,1))if(segDist(x,z,o.a,o.b)<o.hw+pad)return o;return null;}',ctx);
  vm.runInContext(block('function riverAt(x,z,pad){','\n}\n')+'\n}',ctx); // the cell size comes from the hash (makeHash keeps it on near)
  const r=rng(11);
  vm.runInContext('globalThis.addSeg=(ax,az,bx,bz,hw)=>{const o={a:{x:ax,z:az},b:{x:bx,z:bz},hw,y:1,x:ax,z:az};W.rivHash.add(o,Math.hypot(bx-ax,bz-az)+hw);};',ctx);
  for(let k=0;k<60;k++){const ax=(r()-.5)*600,az=(r()-.5)*600,a=r()*6.28,l=10+r()*120;ctx.addSeg(ax,az,ax+Math.cos(a)*l,az+Math.sin(a)*l,2+r()*8);}
  let hits=0;for(let q=0;q<3000;q++){ctx.x=(r()-.5)*640;ctx.z=(r()-.5)*640;if(r()<.2){ctx.x=Math.round(ctx.x/40)*40;ctx.z=Math.round(ctx.z/40)*40;}ctx.pad=[0,0.4,0.5,2,4][Math.floor(r()*5)];
    const a=vm.runInContext('riverAtOld(x,z,pad)',ctx),b=vm.runInContext('riverAt(x,z,pad)',ctx);assert.equal(b,a,'query '+q);if(a)hits++;}
  assert.ok(hits>100,'queries meet the river: '+hits);
});
