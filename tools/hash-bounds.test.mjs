import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// hashMisses lets settleParcels skip a layout hash whose cells all lie outside a query (#15). It may say "misses" only
// when near() would list nothing, through hashes that keep gaining objects, at any cell size, radius and position,
// including negative cells, queries on cell edges and NaN; and it must leave every object's near() stamp alone.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}

test('a query hashMisses skips would have listed nothing',()=>{
  const ctx=vm.createContext({Math,Map,WeakMap,Infinity,NaN});
  vm.runInContext('let HASH_STAMP=0;'+block('function makeHash(','\nfunction groundBuilding'),ctx);
  let asked=0,skipped=0,listed=0;
  for(const cs of [16,24,32,40,7]){const r=rng(cs*101);
    for(let world=0;world<6;world++){vm.runInContext(`var H=makeHash(${cs});`,ctx);
      const spread=[200,1500,7500][world%3],cx=(r()-.5)*spread*2,cz=(r()-.5)*spread*2;
      for(let step=0;step<400;step++){
        if(r()<.25){const x=cx+(r()-.5)*spread*(r()<.1?4:1),z=cz+(r()-.5)*spread,rad=r()<.2?0:r()*60;vm.runInContext(`H.add({x:${x},z:${z}},${rad})`,ctx);}
        const qx=r()<.1?Math.round((cx+(r()-.5)*spread*3)/cs)*cs:cx+(r()-.5)*spread*3,qz=r()<.05?NaN:cz+(r()-.5)*spread*3,qr=[0,1,cs,90,360,2000][Math.floor(r()*6)];
        ctx.x=qx;ctx.z=qz;ctx.q=qr;
        const stamp=vm.runInContext('HASH_STAMP',ctx),miss=vm.runInContext('hashMisses(H,x,z,q)',ctx);asked++;
        assert.equal(vm.runInContext('HASH_STAMP',ctx),stamp,'hashMisses stamps nothing');
        const n=vm.runInContext('H.near(x,z,q).length',ctx);if(miss){skipped++;assert.equal(n,0,`cell ${cs}, world ${world}, step ${step}: (${qx}, ${qz}) r ${qr}`);}else if(n)listed++;}}}
  assert.ok(skipped>asked/4&&listed>asked/10,`asked ${asked}, skipped ${skipped}, listed ${listed}`);
});
test('settleParcels asks hashMisses before each place-wide query, and the hash methods are untouched',()=>{
  const sp=block('function settleParcels(','\nfunction ');
  assert.equal((sp.match(/!hashMisses\(o\._lay\.(placed|segH),m\.x,m\.z,reach\)&&o\._lay\.\1\.near\(m\.x,m\.z,reach\)/g)||[]).length,2);
  assert.equal((sp.match(/!hashMisses\(t\._lay\.(placed|segH),o\.x,o\.z,reach\)&&t\._lay\.\1\.near\(o\.x,o\.z,reach\)/g)||[]).length,2);
  // the history graph records the hash's methods by their source: they must stay as they were (cfa6993)
  assert.ok(source.includes("near(x,z,r){const out=[],st=++HASH_STAMP; // an array, each object once (stamped): no Set to allocate on every call"));
  assert.ok(source.includes("add(o,r){for(let i=Math.floor((o.x-r)/cs);i<=Math.floor((o.x+r)/cs);i++)for(let j=Math.floor((o.z-r)/cs);j<=Math.floor((o.z+r)/cs);j++){"));
});
