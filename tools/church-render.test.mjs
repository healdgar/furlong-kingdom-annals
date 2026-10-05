import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=name=>source.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0];
const context=vm.createContext({Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),chOf:b=>b.ch});
vm.runInContext(['locW','chLay','drawChurch'].map(n=>{
  const code=extract(n);assert.ok(code,`missing ${n}`);return code;
}).join('\n'),context);

function fixture(ch,overrides={}){
  return{x:24,z:-17,w:16,d:30,h:11,y:8,y0:7.5,rot:0.37,ch:{W:1,stone:true,gothic:false,aisles:0,tower:2,spire:0,
    trans:false,ctower:false,twin:false,door:'W',porch:false,taste:0.5,...ch},...overrides};
}
function draw(b){const parts=[];context.b=b;context.put=(...args)=>parts.push(args);context.drawChurch(b,context.put);return parts;}

test('west tower roof bridge meets the nave at the computed seam',()=>{
  const b=fixture({W:-1}),L=context.chLay(b),parts=draw(b),bridge=parts.find(p=>p[0]==='gab'&&Math.abs(p[5]-1.6)<1e-8&&Math.abs(p[6]-L.nw*0.62)<1e-8);
  assert.ok(bridge,'west tower junction gable is emitted');
  const expected=context.locW(b,L.nx,L.westZ-L.Wz*L.tw);
  assert.ok(Math.abs(bridge[1]-expected[0])<1e-8);
  assert.ok(Math.abs(bridge[3]-expected[1])<1e-8);
  assert.equal(bridge[2],b.y+L.h+0.015);
  assert.ok(parts.flatMap(p=>p.slice(1)).every(Number.isFinite),'all emitted transforms and dimensions are finite');
});

test('plain bellcote and crossing tower branches emit finite geometry',()=>{
  const plain=draw(fixture({stone:false,tower:1,spire:0,door:'W'}));
  assert.ok(plain.some(p=>p[0]==='box')&&plain.some(p=>p[0]==='pyr'));
  const cross=draw(fixture({tower:1,trans:true,ctower:true,door:'W'},{w:20,d:38,h:13}));
  assert.ok(cross.filter(p=>p[0]==='gab').length>=2);
  assert.ok(cross.flatMap(p=>p.slice(1)).every(Number.isFinite),'all emitted transforms and dimensions are finite');
});
