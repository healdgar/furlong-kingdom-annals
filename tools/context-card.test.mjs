import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function contextPlacement('),html.indexOf('function contextTitle('));
const placement=vm.runInNewContext(source+'\ncontextPlacement');

test('anchored cards stay within the map viewport, including narrow and short screens',()=>{
  for(const [width,height,top,w,h] of [[1440,900,48,350,253],[834,1194,48,350,253],[390,844,96,330,253],[390,460,96,330,253]]){
    for(let x=0;x<=width;x+=13)for(let y=top;y<=height;y+=17){
      const p=placement({x,y,d:1},w,h,{width,height,top},null);
      assert.ok(p.x>=12&&p.x+w<=width-12);
      assert.ok(p.y>=top+12&&p.y+h<=height-12);
    }
  }
});

test('objects behind the eye or outside the map lose their speech pointer',()=>{
  const v={width:1440,height:900,top:48};
  for(const a of [null,{x:500,y:500,d:-1},{x:-1,y:500,d:1},{x:500,y:47,d:1},{x:1441,y:500,d:1},{x:500,y:901,d:1}]){
    const p=placement(a,350,253,v,'left');assert.equal(p.detached,true);assert.equal(p.side,null);
  }
});

test('a viable pointer side is retained while the camera moves slightly',()=>{
  const v={width:1440,height:900,top:48};
  assert.equal(placement({x:600,y:450,d:1},350,253,v,'right').side,'right');
  assert.equal(placement({x:605,y:450,d:1},350,253,v,'right').side,'right');
  assert.equal(placement({x:1300,y:450,d:1},350,253,v,'right').side,'left');
});

test('a clamped card covering its object hides the pointer',()=>{
  const p=placement({x:180,y:150,d:1},330,253,{width:390,height:460,top:80},null);
  assert.equal(p.detached,true);
});
