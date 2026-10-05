import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const choose=vm.runInNewContext(source.slice(source.indexOf('function eventViewCandidate('),source.indexOf('function postEventDialog('))+'\neventViewCandidate');
const bounds={width:1440,height:900,top:48},project=p=>p;
const event=(x,y,d=1)=>({pos:{x,y,d},text:'Local event'});
test('off-screen and expired events never build an explanation queue',()=>{
  const items=[event(-30,300),event(500,25),event(1500,500),event(500,1000),event(500,500,-1)].map(ev=>({ev,until:200}));
  assert.equal(choose(items,100,project,bounds),null);assert.equal(choose([{ev:event(500,500),until:99}],100,project,bounds),null);
});
test('only the latest event in the current view is shown; a camera pan changes availability',()=>{
  const a={ev:event(300,400),until:200},b={ev:event(800,500),until:200};
  assert.equal(choose([a,b],100,project,bounds).ev,b.ev);
  assert.equal(choose([a,b],100,p=>({...p,x:p.x+1000}),bounds).ev,a.ev);
});
test('a hovered or focused explanation remains readable until released',()=>{
  const a={ev:event(300,400),until:90},b={ev:event(800,500),until:200};
  assert.equal(choose([a,b],100,project,bounds,a.ev).ev,a.ev);assert.equal(choose([a,b],100,project,bounds).ev,b.ev);
});
