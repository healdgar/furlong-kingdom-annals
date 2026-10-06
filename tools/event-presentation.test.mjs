import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const region=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const run=(code,globals={},names='')=>vm.runInContext(code+`\n({${names}})`,vm.createContext(globals));

test('emit admits one authoritative event and projects that same object once',()=>{
  const src=region('function emit(cat,pri,pos,text,opts){','function referenceRegex(');
  const events=[],calls=[];
  const c=vm.createContext({MODEL_ONLY:false,W:{prehistory:false,houses:[]},day:()=>12,allLines:[],entryCount:0,dateStr:d=>`d${d}`,
    HISTORY:{event:(kind,payload)=>events.push([kind,payload])},
    document:{},chronicleAdd:ev=>calls.push(ev),director:{push:ev=>calls.push(ev)},fxEvent:ev=>calls.push(ev)});
  vm.runInContext(src+'\n({emit})',c);
  const ev=c.emit('trade',4,{x:2,z:3},'Market opens');
  assert.equal(events.length,1);assert.equal(events[0][0],'annal');
  assert.equal(calls.length,3);assert.ok(calls.every(q=>q===ev));
  assert.deepEqual(Array.from(c.allLines),['[d12] Market opens']);assert.equal(c.entryCount,1);
  assert.deepEqual(JSON.parse(JSON.stringify(ev)),{day:12,cat:'trade',pri:4,pos:{x:2,z:3},text:'Market opens',opts:{}});
});

test('event projection is inert without a DOM and calls existing journal, director and effect consumers once',()=>{
  const src=region('function projectEvent(ev){','function referenceRegex(');
  const calls=[];
  const headless=run(src,{MODEL_ONLY:true,chronicleAdd(){calls.push('journal');},director:{push(){calls.push('director');}},fxEvent(){calls.push('effects');}},'projectEvent');
  headless.projectEvent({});assert.deepEqual(calls,[]);
  const browser=run(src,{MODEL_ONLY:false,document:{},chronicleAdd(){calls.push('journal');},director:{push(){calls.push('director');}},fxEvent(){calls.push('effects');}},'projectEvent');
  const ev={day:1};browser.projectEvent(ev);
  assert.deepEqual(calls,['journal','director','effects']);
});

test('headless emit preserves the single authoritative event and journal admission',()=>{
  const src=region('function emit(cat,pri,pos,text,opts){','function referenceRegex(');
  const admitted=[];
  const c=run(src,{MODEL_ONLY:true,W:{prehistory:false,houses:[]},day:()=>4,dateStr:d=>`d${d}`,allLines:[],entryCount:0,
    HISTORY:{event:(kind,payload)=>admitted.push([kind,payload])},director:{push(){throw Error('headless director call');}},
    chronicleAdd(){throw Error('headless DOM journal call');},fxEvent(){throw Error('headless effect call');}},'emit,allLines,get entryCount(){return entryCount}');
  const ev=c.emit('war',5,{x:1,z:2},'A host marches');
  assert.equal(admitted.length,1);assert.equal(admitted[0][0],'annal');
  assert.deepEqual(Array.from(c.allLines),['[d4] A host marches']);assert.equal(c.entryCount,1);
  assert.equal(ev.text,'A host marches');
});

test('caravan display spawn bookkeeping is disposable and never writes the canonical record',()=>{
  const src=region('function ensureCaravanDisplay(c){','function trafficDistance(');
  const spawned=[],c={qty:4},G={};
  const x=run(src,{G,spawnCarts:q=>spawned.push(q)},'ensureCaravanDisplay');
  x.ensureCaravanDisplay(c);x.ensureCaravanDisplay(c);
  assert.deepEqual(spawned,[c]);assert.equal(Object.hasOwn(c,'_carts'),false);
  assert.equal(G.cartSpawned.has(c),true);
});

test('render cache stores army and settlement geometry outside canonical entities',()=>{
  const src=region('function entityView(o){','function campGroup('),army={id:8,_spos:{x:2,z:3}},town={name:'Mere'},G={entityViews:new WeakMap()};
  const x=run(src,{G},'entityView');const beforeArmy=Object.keys(army),beforeTown=Object.keys(town);
  const av=x.entityView(army),tv=x.entityView(town);av.plen=12;tv.muster={x:5,z:6};tv.yard=[{x:1,z:2}];
  assert.deepEqual(Object.keys(army),beforeArmy);assert.deepEqual(Object.keys(town),beforeTown);
  assert.equal(G.entityViews.get(army).plen,12);assert.equal(G.entityViews.get(town).muster.x,5);
  assert.equal(x.entityView(army),av);
});

test('polyline projection reads frozen canonical paths and memoizes length only in the shared view cache',()=>{
  const helpers=region('function polyLen(p){','function lerpPt('),entity=source.match(/function entityView\(o\)\{[^\n]+/)[0],memo=source.match(/function polyLengthView\(p\)\{[^\n]+/)[0],project=region('function polyPos(poly,f){','let smokeIdx='),views=new WeakMap();let lengthCalls=0;
  const entityView=o=>{let v=views.get(o);if(!v){v={};views.set(o,v);}return v;};
  const c=run(helpers+entity+memo+project,{G:{entityViews:views},dist2d:(x,z,X,Z)=>{lengthCalls++;return Math.hypot(X-x,Z-z);},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,f)=>a+(b-a)*f},'polyLengthView,polyPos');
  const path=Object.freeze([Object.freeze({x:0,z:0}),Object.freeze({x:10,z:0}),Object.freeze({x:10,z:10})]);
  assert.equal(c.polyLengthView(path),20);assert.equal(c.polyLengthView(path),20);assert.equal(lengthCalls,2);
  assert.deepEqual(JSON.parse(JSON.stringify(c.polyPos(path,0.25))),{x:5,z:0,dir:0});assert.equal(lengthCalls,3);
  assert.equal(Object.hasOwn(path,'_len'),false);assert.equal(Object.isFrozen(path),true);
  const other=Object.freeze([Object.freeze({x:0,z:0}),Object.freeze({x:0,z:5})]);assert.equal(c.polyLengthView(other),5);assert.equal(lengthCalls,4);
  assert.equal(views.get(path).polyLen,20);assert.equal(views.get(other).polyLen,5);
});

test('bird presentation uses a stable display hash without advancing simulation randomness',()=>{
  const birds=region('  // birds\n','\n}\n\n/* ---------------- particles'),settlements=[{pos:{x:1,z:2}},{pos:{x:3,z:4}}];
  class Mesh{constructor(){this.rotation={};}}
  const execute=()=>{const made=[],G={birds:[]};run(birds,{SEED:1001,W:{settlements},G,THREE:{ConeGeometry:class{},MeshBasicMaterial:class{},Mesh},scene:{add:m=>made.push(m)},hash01:n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);},rand(){throw Error('presentation consumed simulation RNG');},pick(){throw Error('presentation consumed simulation RNG');}});return{G,made};};
  const a=execute(),b=execute();assert.equal(a.made.length,14);assert.equal(a.G.birds.length,14);
  assert.ok(a.G.birds.every(x=>settlements.some(s=>s.pos===x.userData.c)));
  assert.deepEqual(JSON.parse(JSON.stringify(a.G.birds.map(x=>x.userData))),JSON.parse(JSON.stringify(b.G.birds.map(x=>x.userData))));
});

test('inspector sigil and family-link keys stay in disposable views',()=>{
  const tkey=source.match(/function tKey\(x\)\{[^\n]+/)[0],sigil=region('function sigURL(hi){','/* =========================================================================\n   SIMULATION'),G={entityViews:new WeakMap()},house={sigilHue:[0.1,0.2],charge:'stag'},person={id:91};let draws=0;
  const c=run(`const TREE=new Map();let treeN=0;${tkey}\n${sigil}`,{G,W:{houses:[house]},entityView(o){let v=G.entityViews.get(o);if(!v){v={};G.entityViews.set(o,v);}return v;},makeSigil:(h,q)=>({toDataURL:()=>{draws++;return String(h)+':'+q;}})},'tKey,sigURL');
  const key=c.tKey(person);assert.equal(c.tKey(person),key);assert.equal(c.sigURL(0),'0.1,0.2:stag');assert.equal(c.sigURL(0),'0.1,0.2:stag');assert.equal(draws,1);
  assert.equal(Object.hasOwn(person,'_tk'),false);assert.equal(Object.hasOwn(house,'_url'),false);
  assert.equal(G.entityViews.get(person).treeKey,key);assert.equal(G.entityViews.get(house).sigilURL,'0.1,0.2:stag');
});

test('battle memorial details persist on W without constructing a mesh or emitting a second event',()=>{
  const src=region('function addCairn(x,z,text,details){','function syncCairns('),W={},G={};
  const x=run(src,{W,G},'addCairn'),details={nobles:['A']};x.addCairn(4,9,'Battle of Mere',details);
  assert.deepEqual(JSON.parse(JSON.stringify(W.memorials)),[{x:4,z:9,text:'Battle of Mere',details:{nobles:['A']}}]);
  assert.equal(G.cairnDirty,true);assert.equal(Object.hasOwn(G,'cairnMesh'),false);
});
