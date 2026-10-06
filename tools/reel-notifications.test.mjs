import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(){
  const nodes=new Map(),stats={renders:0,projections:0,dismissals:0};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},classList:{contains:()=>false,remove(){}},setAttribute(){},querySelector:()=>({setAttribute(){}})});return nodes.get(id);};
  const C=vm.createContext({MODEL_ONLY:false,WORLD_PARAMS:typeof hash==='string'?hash:'',speedIdx:1,lastSpeed:1,sovPausedFrom:0,SPEEDS:[0,.5,2,8,30,360,1/1800],W:{player:{on:true,house:0,pause:false},petitions:[]},eventUI:{recent:[],hold:null,bubble:null,position:''},contextUI:{ready:true,kind:null},document:{getElementById:node},performance:{now:()=>100},day:()=>10,G:{},VISUAL:{settle(){},queue(){}},esc:String,linkNames:String,dateStr:d=>'Day '+d,purse:()=>10000,sovOn:()=>true,petitionContext:()=>'',setHTML:(e,h)=>{stats.renders++;e._h=h;},sheet:()=>{C.contextUI.kind='petition';},contextDismiss:()=>{stats.dismissals++;C.contextUI.kind=null;},pickScr:()=>{stats.projections++;throw Error('Reeling projected a popup');},jot:()=>{throw Error('Notification visibility wrote a command');}});
  C.VISUAL.fast=()=>C.speedIdx===5;
  vm.runInContext(['postEventDialog','eventBubbleUpdate','reelNotificationTransition','renderPetition','petition','setSpeed'].map(fn).join('\n'),C);
  return{C,node,stats,run:s=>vm.runInContext(s,C)};
}
const pending=()=>({key:'famine',title:'Famine',text:'Relief requested',due:40,opts:[{label:'Send grain'}]});
test('reeling skips event queues and projection work; slowing admits fresh events',()=>{
  const {C,node,stats,run}=fixture();C.eventUI.recent.push({ev:{pos:{x:1,z:2}},until:200});C.eventUI.hold=C.eventUI.recent[0].ev;C.contextUI.kind='event';
  run('setSpeed(5)');assert.equal(node('eventbubble').hidden,true);assert.equal(C.eventUI.recent.length,0);assert.equal(C.eventUI.hold,null);assert.equal(stats.dismissals,1);
  run('for(let i=0;i<1000;i++)postEventDialog({pos:{x:1,z:2},text:"Event"});eventBubbleUpdate()');assert.equal(C.eventUI.recent.length,0);assert.equal(stats.projections,0);assert.equal(stats.renders,0);
  run('setSpeed(1);postEventDialog({pos:{x:1,z:2},text:"Fresh event"})');assert.equal(C.eventUI.recent.length,1);assert.equal(C.eventUI.recent[0].ev.text,'Fresh event');
});
test('reeling keeps petitions and deadlines intact behind a badge; slowing reveals them',()=>{
  const {C,node,stats,run}=fixture();C.W.petitions.push(Object.freeze(pending()));const before=JSON.stringify(C.W);
  run('setSpeed(5);renderPetition()');assert.equal(node('petition').style.display,'none');assert.equal(node('petitionbtn').hidden,false);assert.equal(node('petitionbtn').textContent,'Petitions (1)');assert.equal(stats.renders,0);assert.equal(C.contextUI.kind,null);assert.equal(JSON.stringify(C.W),before);
  run('setSpeed(2)');assert.equal(C.contextUI.kind,'petition');assert.equal(node('petition').style.display,'block');assert.ok(node('petition')._h.includes('Send grain'));assert.equal(JSON.stringify(C.W),before);
});
test('a petition can be explicitly opened while reeling and remains readable',()=>{
  const {C,node,run}=fixture();C.W.petitions.push(pending());run('setSpeed(5);renderPetition(true);renderPetition()');assert.equal(C.contextUI.kind,'petition');assert.equal(node('petition').style.display,'block');assert.ok(node('petition')._h.includes('Send grain'));
});
test('entering reel clears an old automatic petition card but preserves manual inspectors',()=>{
  const {C,node,stats,run}=fixture();C.W.petitions.push(pending());run('renderPetition();setSpeed(5)');assert.equal(stats.dismissals,1);assert.equal(C.contextUI.kind,null);assert.equal(node('petition').style.display,'none');
  run('setSpeed(1)');C.contextUI.kind='insp';run('setSpeed(5)');assert.equal(C.contextUI.kind,'insp');assert.equal(stats.dismissals,1);
});
test('the ruler’s pause preference still pauses reeling for new petitions',()=>{
  const {C,node,run}=fixture();C.W.player.pause=true;C.p=pending();run('setSpeed(5);petition(p)');assert.equal(C.speedIdx,0);assert.equal(C.sovPausedFrom,5);assert.equal(C.W.petitions.length,1);assert.equal(C.W.petitions[0].due,40);assert.equal(node('petition').style.display,'block');assert.equal(C.contextUI.kind,'petition');
});
