import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// settleParcels passes over a road or river edge unmeasured when a bound on its reach cannot meet the batch (#15). Such an
// edge must be one the exact test would not keep, for any edge, width and batch box, NaN and huge values included.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const between=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j+end.length);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
test('an edge passed over is never one the batch would keep',()=>{
  const ctx=vm.createContext({Math,Infinity,NaN});
  vm.runInContext([line('const dist2d='),line('function parcelSeg(')].join('\n'),ctx);
  vm.runInContext('var minX,maxX,minZ,maxZ;const batchSegs=[];'+between('const batchSegs=[],keep=','batchSegs.push(g);').replace('const batchSegs=[],keep=','const keep=')+'\n'+between('const far=(a,c,hw)=>','};'),ctx);
  const r=rng(5);let passed=0,kept=0,n=0;
  const coord=()=>{const k=r();return k<.01?NaN:k<.02?1e300*(r()-.5):k<.05?(r()-.5)*1e-9:Math.round((r()-.5)*20000*r()*64)/64;};
  for(let b=0;b<300;b++){const cx=(r()-.5)*15000,cz=(r()-.5)*15000,w=r()*600,h=r()*600;Object.assign(ctx,{minX:cx-w,maxX:cx+w,minZ:cz-h,maxZ:cz+h});
    for(let e=0;e<400;e++){const near=r()<.5,a={x:near?cx+(r()-.5)*2*(w+150):coord(),z:near?cz+(r()-.5)*2*(h+150):coord()},len=r()<.1?0:r()*300*r(),th=r()*6.3,
        c=r()<.05?{x:a.x,z:a.z}:{x:a.x+Math.cos(th)*len,z:a.z+Math.sin(th)*len},hw=r()<.02?NaN:r()<.5?3.2:r()*12;
      ctx.a=a;ctx.c=c;ctx.hw=hw;n++;
      const far=vm.runInContext('far(a,c,hw)',ctx),keep=!!vm.runInContext('keep(parcelSeg(a,c,hw,null))',ctx);
      if(far){passed++;assert.equal(keep,false,JSON.stringify({a,c,hw,box:[ctx.minX,ctx.maxX,ctx.minZ,ctx.maxZ]}));}if(keep)kept++;}}
  assert.ok(passed>n/4&&kept>n/10,`edges ${n}, passed over ${passed}, kept ${kept}`);
});
