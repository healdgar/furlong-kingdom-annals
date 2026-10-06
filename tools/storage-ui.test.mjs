import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm} from './ownership-fixture.mjs';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const functions=['storagePlayerCommission','storagePreview','runCmd','replayEntry'].map(n=>source.match(new RegExp('^(?:async )?function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0]).join('\n');
function setup(){const r=realm({grain:0,fish:0,crown:2000});Object.assign(r.C,{MODEL_ONLY:false,BACKGROUND:null,backgroundUserRequest:()=>false,document:new Proxy({},{get(){throw Error('Replay consulted DOM');}}),sovOn:()=>true,plyH:()=>0,refreshCrownPanel:()=>{},refreshInspect:()=>{},updateHUD:()=>{},renderPetition:()=>{},showInspect:()=>{},setInspectorView:()=>{}});r.eval("const STORAGE_UI=new WeakMap();let uiDownAt=0;ARCH={grange:[12,10],warehouse:[12,10]};LS={TILLED:1};dist2d=(a,b,c,d)=>Math.hypot(a-c,b-d);planLand=()=>({c:0});storageRoute=()=>30;s._lay={live:{storageSite(x,z,arch,dry){if(dry)return {x,z};throw Error('Commission completed before construction');}}}");r.eval(functions);return r;}
test('recorded commission reconstructs exact site and payer in a fresh realm without controls or a pending survey',()=>{const entry={k:'c',c:'storage-commission',a:encodeURIComponent(JSON.stringify({si:0,arch:'warehouse',x:38.125,z:-42.75,payer:0}))};const first=setup(),fresh=setup();for(const r of [first,fresh]){r.eval('replayEntry('+JSON.stringify(entry)+')');assert.equal(r.W.projects.length,1);const q=r.W.projects[0];assert.equal(q.x,38.125);assert.equal(q.z,-42.75);assert.equal(q.arch,'warehouse');assert.equal(q.payer,0);assert.equal(q.done,0);assert.equal(r.W.treasury,2000);assert.equal(Object.hasOwn(r.s,'storageQuote'),false);}assert.deepEqual(JSON.parse(first.eval('JSON.stringify(W.projects)')),JSON.parse(fresh.eval('JSON.stringify(W.projects)')));});
test('invalid or unauthorized storage commands cannot create projects',()=>{const r=setup();for(const arg of ['bad','null',...[
  {si:0,arch:'grange',x:20,z:20,payer:1},
  {si:0,arch:'__proto__',x:20,z:20,payer:0},
  {si:0,arch:'grange',x:null,z:20,payer:0},
  {si:0.5,arch:'grange',x:20,z:20,payer:0}
].map(v=>encodeURIComponent(JSON.stringify(v)))])assert.equal(r.eval('storagePlayerCommission('+JSON.stringify(arg)+')'),false);assert.equal(r.W.projects,undefined);assert.equal(r.W.treasury,2000);});
test('surveying a map site retains the preview outside simulation state',()=>{const r=setup(),before=JSON.stringify(r.W);r.eval("storagePreview(0,'grange',30,-40)");assert.equal(JSON.stringify(r.W),before);assert.equal(r.eval('STORAGE_UI.get(s).x'),30);assert.equal(r.eval('STORAGE_UI.get(s).z'),-40);});
