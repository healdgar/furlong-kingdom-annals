import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
// Exercise real downsampling with synthetic adjacent materials and alternating grain.
class Canvas{
  getContext(){return{getImageData:()=>({data:this.data}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{this.data=image.data;}};}
}
const context=vm.createContext({document:{createElement:()=>new Canvas()}});
vm.runInContext(source.slice(source.indexOf('function miniatureMipmaps('),source.indexOf('function initMiniatureMaterials(')),context);
function atlas(){const c=new Canvas();c.width=c.height=512;c.data=new Uint8ClampedArray(512*512*4);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const cell=Math.floor(y/128)*4+Math.floor(x/128),i=(y*512+x)*4;c.data[i]=cell*16+((x+y)%2?8:0);c.data[i+1]=cell*8;c.data[i+2]=240-cell*8;c.data[i+3]=255;}return c;}
test('minification averages grain without mixing adjacent materials',()=>{
  const levels=context.miniatureMipmaps(atlas());assert.deepEqual(Array.from(levels,c=>c.width),[512,256,128,64,32,16,8,4,2,1]);
  for(const c of levels.slice(1,8))for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const cell=Math.floor(y/(c.width/4))*4+Math.floor(x/(c.width/4)),i=(y*c.width+x)*4;
    assert.deepEqual(Array.from(c.data.slice(i,i+4)),[cell*16+4,cell*8,240-cell*8,255]);
  }
});
test('filtering preserves source pixels and opacity',()=>{
  const c=atlas(),before=c.data.slice(),levels=context.miniatureMipmaps(c);assert.equal(levels[0],c);assert.deepEqual(c.data,before);
  for(const level of levels)for(let i=3;i<level.data.length;i+=4)assert.equal(level.data[i],255);
});
