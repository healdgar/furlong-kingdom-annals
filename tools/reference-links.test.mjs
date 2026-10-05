import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function runtime(){
  const a={name:'Duneithin',folk:[],dead:[],buildings:[],streets:[]},b={name:'Rødvad',folk:[],dead:[],buildings:[],streets:[]},h={id:'hh7',members:new Set()};
  const p={id:17,gn:'Elen',fam:0,si:1,_hh:h,tr:'brewer'};h.head=p;h.members.add(p);b.folk.push(p);
  const W={settlements:[a,b],fams:[{n:'Yrhŷd'}],households:new Map([[h.id,h]]),houses:[{name:'House Ælfred'}],notables:[{id:3,name:'Ælfred',alive:true}],armies:[],travellers:[],banditCamps:[]};
  const C=vm.createContext({W,G:{},esc,day:()=>0,fullTitle:n=>'Lord '+n.name,livingNotables:()=>W.notables.filter(n=>n.alive),folkName:p=>p.gn+' '+(p.sur||W.fams[p.fam]?.n||''),famName:p=>p.sur||W.fams[p.fam]?.n||'',GOODBASE:{grain:2,timber:3},TRADE_W:{brewer:1},ARCH:{mill:[9,9,8,0,'water-mill']},findPerson:id=>{for(const s of W.settlements){const p=[...s.folk,...s.dead].find(p=>p.id===id);if(p)return{p,s};}},notableById:id=>W.notables.find(n=>n.id===id),landName:()=> 'woodland',STREET_NAME:{lane:'Lane'}});
  vm.runInContext(['referenceRegex','referenceAdd','nameLinker','referenceMap','linkNames','buildingReference','linkRenderedReferences','referenceTarget'].map(fn).join('\n'),C);
  return{C,W,a,b,p,h,link:(text,scope=a)=>C.linkNames(text,scope)};
}
test('migration prose links household, both towns and trade including Unicode names',()=>{
  const {link}=runtime(),html=link('The Yrhŷd household leaves Duneithin for Rødvad, where a brewer can do better.');
  for(const code of ['household:hh7','s0','s1','trade:0:brewer'])assert.ok(html.includes(`data-nm="${code}"`),html);
  assert.match(html,/>Yrhŷd household<\/a>/);assert.match(html,/href="#ref=/);
});
test('markup, attributes and existing interactive controls are never rewritten or nested',()=>{
  const {link}=runtime(),html=link('<p title="Duneithin"><a class="pp" data-pid="17">Elen Yrhŷd</a> <button>Duneithin</button> <code>Rødvad</code> Rødvad</p>');
  assert.ok(html.startsWith('<p title="Duneithin"><a class="pp" data-pid="17">Elen Yrhŷd</a> <button>Duneithin</button> <code>Rødvad</code>'));
  assert.equal((html.match(/class="nm"/g)||[]).length,1);
});
test('existing entity rows and disclosure controls keep their own navigation',()=>{
  const {link}=runtime(),html=link('<div data-cmd="notable" data-arg="3"><b>Lord Ælfred</b></div><summary>Duneithin</summary><p>Duneithin</p>');
  assert.ok(html.startsWith('<div data-cmd="notable" data-arg="3"><b>Lord Ælfred</b></div><summary>Duneithin</summary>'));
  assert.equal((html.match(/class="nm"/g)||[]).length,1);
});
test('escaped names stay escaped, and Unicode boundaries prevent partial word links',()=>{
  const {link,W,a}=runtime();a.name='A&B <Vale>';const html=link(esc(a.name)+' · Yrhŷdŷ · Yrhŷd');
  assert.match(html,/>A&amp;B &lt;Vale&gt;<\/a>/);assert.ok(html.includes(' · Yrhŷdŷ · '));assert.equal((html.match(/data-nm="family:0"/g)||[]).length,1);
});
test('proper names cannot capture ordinary words with different capitalization',()=>{
  const {link,W}=runtime();W.fams.push({n:'Wood'});const html=link('Wood needs wood and timber.');
  assert.match(html,/>Wood<\/a>/);assert.ok(html.includes(' needs wood and '));
});
test('duplicate people and households produce explicit choices rather than select the wrong person',()=>{
  const {link,b,p}=runtime();b.folk.push({...p,id:18,_hh:{id:'hh8'}});b.folk[1]._hh.head=b.folk[1];
  const html=link('Elen Yrhŷd · Yrhŷd household'),choices=[...html.matchAll(/data-nm="choose:([^"]+)"/g)].map(m=>JSON.parse(decodeURIComponent(m[1])));
  assert.ok(choices.some(c=>c.includes('p17')&&c.includes('p18')));assert.ok(choices.some(c=>c.includes('household:hh7')&&c.includes('household:hh8')));
});
test('dead villagers and nobles remain linkable in historical prose',()=>{
  const {link,W,b,p}=runtime();b.folk=[];b.dead=[{...p,dead:true}];W.notables[0].alive=false;
  const html=link('Elen Yrhŷd died at Rødvad. Lord Ælfred remembered her.');assert.ok(html.includes('data-nm="p17"'));assert.ok(html.includes('data-nm="n3"'));
});
test('render-only candidates never create accounts, goods, building names or simulation writes',()=>{
  const {link,W,b}=runtime();b.buildings.push({nm:'Old Mill',x:9,z:12,arch:'mill'});const stable=structuredClone(W);
  link('Old Mill holds grain and timber; Elen Yrhŷd works here.');assert.deepEqual(W,stable);
  assert.equal(W.households.size,1);
});
test('building links retain identity when another building is inserted into the town array',()=>{
  const {C,link,b}=runtime(),mill={nm:'Old Mill',x:9,z:12,arch:'mill'};b.buildings.push(mill);
  const html=link('Old Mill at Rødvad'),code=html.match(/data-nm="(building:[^"]+)"/)[1];b.buildings.unshift({nm:'Other Mill',x:99,z:12,arch:'mill'});
  assert.equal(C.referenceTarget(code).pick.b,mill);
});
test('the cheap annals path never traverses household or property records',()=>{
  const {C,a,b}=runtime();Object.defineProperty(a,'folk',{get(){throw Error('hidden annals scanned people');}});Object.defineProperty(b,'buildings',{get(){throw Error('hidden annals scanned buildings');}});
  assert.ok(C.linkNames('Duneithin trades with Rødvad').includes('data-nm="s1"'));
});
test('unchanged rendered prose reuses its local result without another resolution pass',()=>{
  const {C,a}=runtime();let calls=0;C.linkNames=()=>{calls++;return 'linked';};const el={};assert.equal(C.linkRenderedReferences(el,'text',a),'linked');assert.equal(C.linkRenderedReferences(el,'text',a),'linked');assert.equal(calls,1);
});
test('the existing small name cache belongs to the current world',()=>{
  const {C,W}=runtime();C.linkNames('Duneithin');C.W={...W,settlements:[{name:'Newtown'}]};assert.ok(C.linkNames('Newtown').includes('data-nm="s0"'));assert.equal(C.linkNames('Duneithin'),'Duneithin');
});
