// The advisor's every-button surface (ADV in index.html) read against a small stand-in for the page: which controls it finds,
// what it calls them, and how it presses them. The live page is checked by tools/advisor-live-check.mjs in Chrome.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const src=html.slice(html.indexOf('const ADV={muted:false,'),html.indexOf('\n/* The advisor in the page itself'));

/* ---- a page in miniature: elements, their attributes and text, and the few selectors the advisor uses ---- */
class El{
  constructor(tag,attrs={},kids=[]){this.tagName=tag.toUpperCase();this.nodeType=1;this.attrs={...attrs};this.childNodes=[];this.parentElement=null;this.style={display:attrs.style||''};this.listeners={};this.clicks=0;
    this.value=attrs.value??'';this.checked='checked' in attrs;for(const k of kids)this.append(k);}
  append(k){const n=typeof k==='string'?{nodeType:3,textContent:k}:k;n.parentElement=this;this.childNodes.push(n);return this;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get id(){return this.attrs.id||'';}get type(){return this.attrs.type||(this.tagName==='INPUT'?'text':'');}get disabled(){return 'disabled' in this.attrs;}get title(){return this.attrs.title||'';}
  get min(){return this.attrs.min;}get max(){return this.attrs.max;}get step(){return this.attrs.step;}
  get options(){return this.children.filter(c=>c.tagName==='OPTION').map(o=>({value:o.attrs.value,textContent:o.textContent}));}
  get dataset(){const d={};for(const[k,v]of Object.entries(this.attrs))if(k.startsWith('data-'))d[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);return d;}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  get classList(){const c=String(this.attrs.class||'').split(/\s+/);return{contains:x=>c.includes(x),toggle:(x,on)=>{const k=c.filter(y=>y!==x);if(on)k.push(x);this.attrs.class=k.join(' ');}};}
  hasAttribute(n){return n in this.attrs;}getAttribute(n){return n in this.attrs?String(this.attrs[n]):null;}setAttribute(n,v){this.attrs[n]=String(v);}
  replaceChildren(...k){this.childNodes=[];for(const x of k)this.append(x);}
  matches(sel){return sel.split(',').some(s=>one(this,s.trim().split(/\s+/).pop()));}
  closest(sel){for(let e=this;e;e=e.parentElement)if(e.nodeType===1&&e.matches(sel))return e;return null;}
  querySelectorAll(sel){const out=[],walk=e=>{for(const c of e.children){if(c.matches(sel))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  click(){this.clicks++;if(this.tagName==='INPUT'&&this.type==='checkbox')this.checked=!this.checked;this.onclick?.();}
  dispatchEvent(e){(this.listeners[e.type]||[]).forEach(f=>f(e));}
}
function one(e,s){const m=s.match(/^([a-z0-9]*)((?:#[\w-]+|\.[\w-]+|\[[^\]]+\])*)$/i);if(!m)return false;if(m[1]&&e.tagName!==m[1].toUpperCase())return false;
  for(const p of m[2].match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g)||[]){if(p[0]==='#'&&e.id!==p.slice(1))return false;if(p[0]==='.'&&!e.classList.contains(p.slice(1)))return false;
    if(p[0]==='['){const[k,v]=p.slice(1,-1).split('=');if(!e.hasAttribute(k)||v!==undefined&&e.getAttribute(k)!==v.replace(/"/g,''))return false;}}return true;}
const h=(tag,attrs,...kids)=>new El(tag,attrs||{},kids);

/* the screen: a top bar with a folded menu, a closed (inert, hidden) drawer showing the Crown tab, the annals, a card */
function page({tab='crown'}={}){
  const menu=h('div',{id:'toolmenu',hidden:''},h('button',{'data-context-tab':'rates'},'Rates'),h('button',{id:'menuexport'},'Export chronicle'),h('button',{id:'menulegend',hidden:''},'Map legend'));
  const hud=h('div',{id:'hud'},h('button',{id:'pausebtn'},'Pause'),h('select',{id:'speedselect','aria-label':'Simulation speed',value:'1'},h('option',{value:'1'},'Normal'),h('option',{value:'4'},'Fastest')),h('button',{id:'menubtn'},'Menu'),menu);
  const dbody=h('div',{id:'dbody'});
  const drawer=h('div',{id:'drawer',inert:'',hidden:'',class:'closed'},dbody);
  const chron=h('div',{id:'chron',class:'min'},h('div',{id:'chronfilters'},h('button',{class:'f on','data-f':'all'},'All'),h('button',{class:'f','data-f':'war'},'War')),h('div',{id:'chronlist'},h('div',{class:'centry',role:'button'},'An entry')));
  const insp=h('div',{id:'insp',style:'flex'},h('button',{id:'inspx'},'Close'),h('div',{id:'inspnav'},h('button',{id:'insporders','data-iview':'orders'},'Orders')),
    h('div',{id:'inspbody',role:'tabpanel'},h('a',{class:'nm','data-nm':'s1'},'Ashby')),
    h('div',{id:'inspacts',role:'tabpanel',hidden:''},h('button',{class:'cbtn','data-cmd':'s-relief','data-arg':'3'},h('span',{},'Send relief grain',h('small',{},'grain from the crown')),h('span',{class:'cost'},'250 g')),
      h('button',{class:'cbtn','data-cmd':'s-levy','data-arg':'3',disabled:''},h('span',{},'Levy a host here (~40 men)'),h('span',{class:'cost'},'ready in 60 d'))));
  const body=h('body',{},hud,drawer,chron,insp,h('div',{id:'contextpanel',hidden:''}),h('div',{id:'placehint'}),h('div',{id:'savebox',style:'none'}),h('div',{id:'endgame',style:'none'}));
  const byId=id=>{let f=null;const walk=e=>{if(e.id===id)f=e;else for(const c of e.children)if(!f)walk(c);};walk(body);return f;};
  const builds={
    crown:()=>[h('section',{id:'courtview-overview',role:'tabpanel'},h('button',{class:'cbtn','data-cmd':'h-honour','data-arg':'3'},h('span',{},'Honour',h('small',{},'a feast for their head')),h('span',{class:'cost'},'500 g'))),
      h('section',{id:'courtview-orders',role:'tabpanel',hidden:''},h('button',{class:'cbtn','data-cmd':'s-relief','data-arg':'5',disabled:''},h('span',{},'Send relief grain'),h('span',{class:'cost'},'ready in 60 d')))],
    rates:()=>[h('div',{class:'slrow'},h('label',{},h('span',{},'Harvest')),h('input',{type:'range','aria-label':'Harvest',min:'0.5',max:'1.5',step:'0.01',value:'1'}))],
    acts:()=>[h('button',{class:'actbtn'},'Great fire',h('span',{class:'tg'},'⌖'))],
    over:()=>[h('button',{class:'ovbtn','data-o':'trade'},'Trade network')],
    world:()=>[h('button',{class:'wbtn',id:'btnreforge'},'Reforge the realm'),h('div',{class:'succline pk','data-cmd':'notable','data-arg':'7'},'1. Prince Hal, age 12')],
  };
  const ctx={drawerTab:tab,build(t){dbody.childNodes=[];for(const k of builds[t]())dbody.append(k);ctx.drawerTab=t;}};
  ctx.build(tab);
  const document={getElementById:byId,body:Object.assign(body,{matches:()=>false}),querySelectorAll:sel=>body.querySelectorAll(sel)};
  const g={document,window:{},W:{settlements:[],houses:[]},inspTarget:{type:'settlement'},contextUI:{ready:true,kind:'insp',expanded:false},placeMode:null,placeArg:null,planUI:null,BACKGROUND:null,allLines:[],ADV_PENDING:null,
    selectTab(t){ctx.build(t);},contextSync(){},refreshCrownPanel(){},setInspectorView(v){g.view=v;},contextExpand(on){g.expanded=on;},contextDismiss(){g.dismissed=true;},Event:class{constructor(type){this.type=type;}},setTimeout};
  Object.defineProperty(g,'drawerTab',{get:()=>ctx.drawerTab,set:v=>{ctx.drawerTab=v;}});
  for(const b of [...document.querySelectorAll('button')])b.matches=b.matches.bind(b);
  const ADV=vm.runInNewContext(src+';ADV',g);g.window=g;return{ADV,g,dbody,byId,ctx,builds};
}

test('the drawer’s controls are found with the drawer closed and inert, and the player’s tab is left as it was',async()=>{
  const{ADV,g,dbody}=page({tab:'rates'}),before=dbody.childNodes[0];
  const all=await ADV.discover(),names=all.tools.map(t=>t.name);
  for(const sc of ['crown','rates','acts','over','world'])assert.ok(names.some(n=>n.startsWith(sc+':')),'no '+sc+' controls in '+names.join(' '));
  assert.equal(g.drawerTab,'rates');assert.equal(dbody.childNodes[0],before,'the open tab is put back as the same nodes, not rebuilt');
  assert.ok(names.some(n=>n.startsWith('menu:')),'a folded menu still lists its items');
  assert.ok(!names.some(n=>/legend/.test(n)),'an item hidden in its own right stays hidden');
  assert.ok(names.some(n=>n.startsWith('annals:')),'the annals filters are reachable');
  assert.ok(!names.some(n=>/an-entry/.test(n)),'annals entries are not controls');
  assert.ok(all.tools.some(t=>t.scope==='crown'&&t.disabled),'a court view that is not showing still lists its orders');
});

test('a card lists its orders whatever view it shows, and pressing Orders does not expand it',async()=>{
  const{ADV,g}=page(),card=(await ADV.discover('card')).tools;
  assert.ok(card.some(t=>t.label.startsWith('Send relief grain')),card.map(t=>t.name).join(' '));
  const orders=card.find(t=>t.view==='orders');assert.ok(orders);
  const r=await ADV.execute(orders.name,{});assert.equal(r.ok,true);assert.equal(g.view,'orders');assert.equal(g.expanded,undefined);
});

test('no state is a dead end: the context panel and dialogs can always be closed',async()=>{
  const{ADV,g,byId}=page();byId('contextpanel').attrs={id:'contextpanel'};
  assert.ok(ADV.scopes().includes('context'));
  const r=await ADV.execute('context:close',{});assert.equal(r.ok,true);assert.equal(g.dismissed,true);
  byId('savebox').style.display='flex';assert.ok(ADV.scopes().includes('dialog'));
  assert.equal((await ADV.execute('dialog:close',{})).ok,true);assert.equal(byId('savebox').style.display,'none');
});

test('the in-page chat is never made inert behind a dialog',()=>{
  assert.match(html,/if\(e!==next&&e\.id!=='advchat'&&!e\.matches\('script,style'\)\)\{inertBefore\.set\(e,e\.inert\);e\.inert=true;\}/);
});

test('controls are named by what they do, and a day’s costs and cooldowns are fields, not names',async()=>{
  const{ADV,g}=page();g.W.settlements=[{name:'Aldwick'},{name:'Ashby'},{name:'Brigg'},{name:'Colby'}];g.W.houses=[{name:'The Crown'},{name:'House Vane'},{name:'House Orme'},{name:'House Tarr'}];
  const crown=(await ADV.discover('crown')).tools,card=(await ADV.discover('card')).tools,hud=(await ADV.discover('hud')).tools;
  const honour=crown.find(t=>t.name==='crown:h-honour:3');assert.ok(honour,crown.map(t=>t.name).join(' '));
  assert.equal(honour.label,'Honour');assert.equal(honour.cost,500);assert.equal(honour.desc,'a feast for their head');assert.deepEqual({...honour.target},{code:'h3',name:'House Tarr'});
  const relief=crown.find(t=>t.name==='crown:s-relief:5');assert.equal(relief.disabled,true);assert.equal(relief.why,'ready in 60 d');assert.equal(relief.label,'Send relief grain');
  const levy=card.find(t=>t.name==='card:s-levy:3');assert.equal(levy.why,'ready in 60 d');assert.deepEqual({...levy.target},{code:'s3',name:'Colby'});
  assert.ok(hud.some(t=>t.name==='hud:pause')&&hud.some(t=>t.name==='hud:speed'),hud.map(t=>t.name).join(' '));
  assert.ok((await ADV.discover('annals')).tools.some(t=>t.name==='annals:filter:war'));
  assert.ok((await ADV.discover('over')).tools.some(t=>t.name==='over:trade'));
  assert.ok((await ADV.discover('world')).tools.some(t=>t.name==='world:notable:7'));
  assert.ok((await ADV.discover('acts')).tools.some(t=>t.name==='acts:great-fire'&&t.place));
});

test('a press answers with the worker’s reply and the annals it wrote; values are checked first',async()=>{
  const{ADV,g,byId}=page();g.BACKGROUND={};g.workerRefreshCourt=()=>null;
  const relief=byId('inspacts').children[0];relief.onclick=()=>g.ADV_PENDING.push(Promise.resolve({day:5,news:['[Spring 6, AD 850] Relief grain reaches Colby.']}));
  const r=await ADV.execute('card:s-relief:3',{});assert.equal(r.ok,true);assert.deepEqual([...r.news],['[Spring 6, AD 850] Relief grain reaches Colby.']);assert.equal(JSON.stringify(r.worker),'[{"day":5}]');
  relief.onclick=()=>g.ADV_PENDING.push(Promise.resolve({accepted:false,error:'Invalid settlement command'}));
  const bad=await ADV.execute('card:s-relief:3',{});assert.equal(bad.ok,false);assert.equal(bad.error,'Invalid settlement command');
  assert.match((await ADV.execute('hud:speed',{value:'99'})).error,/no such choice/);
  assert.match((await ADV.execute('rates:harvest',{value:9})).error,/from 0\.5 to 1\.5/);
  assert.match((await ADV.execute('card:s-levy:3',{})).error,/not now/);
});

test('a press that ends the game needs the player’s word; prompts are answered, never left open',async()=>{
  const{ADV,g,byId}=page({tab:'world'});
  const reforge=(await ADV.discover('world')).tools.find(t=>t.name==='world:reforge');assert.match(reforge.risk,/^reload/);
  const r=await ADV.execute('world:reforge',{});assert.match(r.error,/confirm:true/);
  const menuexport=byId('menuexport');menuexport.onclick=()=>g.window.prompt('Share this realm:','file:///x#s=1');
  const x=await ADV.execute('menu:export',{});assert.deepEqual([...x.asked],['Share this realm:']);assert.equal(typeof g.window.prompt,'undefined');
});

test('game:place gives the pick as a click would, spends the mode, and can be cancelled',async()=>{
  const{ADV,g}=page();const sent=[];g.W.settlements=[{name:'Aldwick',pos:{x:0,z:0}},{name:'Ashby',pos:{x:500,z:0}}];g.W.armies=[{id:7,name:'The Red Host',house:0},{id:9,name:'The Vane levy',house:1}];
  g.setPlaceMode=(m,arg)=>{g.placeMode=m;g.placeArg=arg??null;};g.jot=()=>{};g.serializePlaceArg=(m,arg)=>arg&&arg.id!=null?{id:arg.id}:arg;g.armyDisplayPos=a=>({x:a.id*10,z:1});g.nearestSettlementIdx=x=>x>250?1:0;
  g.doPlace=(mode,arg,p,pk)=>{sent.push({mode,p:{x:p.x,z:p.z},pk});g.ADV_PENDING?.push(Promise.resolve({day:3,news:['[Spring 4, AD 850] Fire!']}));};
  g.placeMode='fire';
  const r=await ADV.execute('game:place',{at:{x:500,z:3}});assert.equal(r.ok,true);assert.equal(g.placeMode,null,'the mode is spent');
  assert.match((await ADV.execute('game:place',{at:{x:500,z:3}})).error,/nothing is waiting/);assert.equal(sent.length,1,'one fire, not two');
  g.placeMode='order';g.placeArg=g.W.armies[0];await ADV.execute('game:place',{target:'a9'});
  assert.deepEqual(JSON.parse(JSON.stringify(sent[1])),{mode:'order',p:{x:90,z:1},pk:9},'a host is marched on by its id, at its point');
  g.placeMode='objective';g.placeArg={id:7,kind:'capture'};await ADV.execute('game:place',{at:{x:480,z:0}});assert.deepEqual({...sent[2].pk},{type:'settlement',si:1});
  g.placeMode='objective';g.placeArg={id:7,kind:'destroy'};assert.match((await ADV.execute('game:place',{at:{x:480,z:0}})).error,/building code/);assert.equal(g.placeMode,'objective','a refused pick leaves the question open');
  const c=await ADV.execute('game:place',{cancel:true});assert.equal(c.cancelled,'objective');assert.equal(g.placeMode,null);
});

test('the plan brush without a drag: points drawn out as the brush samples them, priced first, commissioned on request',()=>{
  const{ADV}=page(),st=ADV.stroke([{x:0,z:0},{x:30,z:0}]);
  assert.equal(st.length,11);assert.deepEqual({...st[1]},{x:3,z:0});assert.deepEqual({...st.at(-1)},{x:30,z:0});
  assert.equal(ADV.stroke([{x:0,z:0}]),null);assert.equal(ADV.stroke([{x:0,z:'a'},{x:1,z:1}]),null);
});
