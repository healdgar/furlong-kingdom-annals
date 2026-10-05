import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'))?.[0]||assert.fail(`missing ${name}`);

function fixture({classes=[],contextReady=false,contextKind=null}={}){
  const nodes=new Map(),writes=[];let crownCalls=0,houseReads=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:id==='contextpanel',innerHTML:'',textContent:'',dataset:{},parentElement:{id:'old-parent'},classList:{contains:k=>classes.includes(k)},setAttribute(){},append(child){child.parentElement=this;},querySelector(){return null;}});return nodes.get(id);};
  const document={body:{classList:{contains:k=>classes.includes(k)}},getElementById:node};
  node('contextpanel').hidden=!(contextReady&&contextKind==='drawer');
  const W=new Proxy({monarch:null,houses:[null,{name:'House Alder',head:3,loyalty:61,gold:120,exiled:false}]},{get(target,key,receiver){if(key==='houses')houseReads++;return Reflect.get(target,key,receiver);}});
  const C=vm.createContext({document,contextUI:{ready:contextReady,kind:contextKind,side:null,expanded:false,scroll:new Map()},CONTEXT_IDS:{drawer:'drawer'},drawerTab:'crown',uiBusy:()=>false,W,
    crownPanelHTML:()=>{crownCalls++;return `crown-${houseReads}`;},setHTML:(el,html)=>{writes.push([el.id,html]);el.innerHTML=html;},sigURL:i=>`sig-${i}`,esc:String,notableById:()=>null,
    contextSync(){},contextPosition(){},
  });
  vm.runInContext([fn('drawerVisible'),fn('refreshCrownPanel'),fn('refreshHousePanel'),fn('contextShow')].join('\n'),C);
  return{C,node,writes,counts:()=>({crownCalls,houseReads})};
}

test('watch, hide UI, and a non-drawer context skip panel HTML and world reads',()=>{
  for(const options of [{classes:['watch']},{classes:['hideui']},{classes:['closed'],contextReady:true,contextKind:'drawer'},{contextReady:true,contextKind:'insp'},{contextReady:true,contextKind:null}]){
    const f=fixture(options);
    f.C.refreshCrownPanel();f.C.drawerTab='world';f.C.refreshHousePanel();
    assert.deepEqual(f.counts(),{crownCalls:0,houseReads:0});
    assert.deepEqual(f.writes,[]);
  }
});

test('visible crown and world panels render current state',()=>{
  const f=fixture({contextReady:true,contextKind:'drawer'});
  f.C.refreshCrownPanel();
  assert.equal(f.node('dbody').innerHTML,'crown-0');
  f.C.drawerTab='world';f.C.refreshHousePanel();
  assert.ok(f.node('housepanel').innerHTML.includes('Alder'));
  assert.equal(f.node('succpanel').innerHTML,'');
  assert.equal(f.counts().crownCalls,1);
  assert.equal(f.counts().houseReads,1);
});

test('opening the drawer through contextShow forces fresh panel data',()=>{
  const f=fixture({contextReady:true,contextKind:'insp'}),forced=[];
  f.C.refreshCrownPanel=force=>forced.push(['crown',force,f.C.drawerVisible()]);
  f.C.refreshHousePanel=force=>forced.push(['house',force,f.C.drawerVisible()]);
  f.C.contextShow('drawer');
  assert.equal(f.C.contextUI.kind,'drawer');
  assert.equal(f.node('contextpanel').hidden,false);
  assert.deepEqual(forced,[['crown',true,true],['house',true,true]]);
});
