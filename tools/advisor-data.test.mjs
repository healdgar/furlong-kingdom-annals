// The advisor's all-data view: panels read as text with their links, the annals by category and day, and reads that keep the
// world as it was (a town read neither stores a price the market has not found nor takes the year's trade tally).
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const i=html.indexOf('function '+name+'(');assert.ok(i>=0,name);let d=0,j=html.indexOf('{',i);for(;j<html.length;j++){if(html[j]==='{')d++;else if(html[j]==='}'&&!--d)break;}return html.slice(i,j+1);};
const advSrc=html.slice(html.indexOf('const ADV={muted:false,'),html.indexOf('\n/* The advisor in the page itself'));

test('a panel reads as rows and cells without markup, and keeps what it names with their codes',()=>{
  const g={};vm.runInNewContext(fn('advisorText')+fn('advisorLinks')+';this.T=advisorText;this.L=advisorLinks;',g);
  const panel='<div class="dhead">Kingdom ledger</div><table><tr><th>Account</th><th>Gold</th></tr><tr><td>Royal treasury</td><td>2,200</td></tr></table><p>Owed by <a class="nm" data-nm="h2">House Vane</a> &amp; <a class="pp" data-pid="77">Edmund Ware</a><br>since spring</p><button class="cbtn" data-cmd="x"><span>Honour<small>a feast</small></span></button>';
  assert.equal(g.T(panel),'Kingdom ledger\nAccount | Gold\nRoyal treasury | 2,200\nOwed by House Vane & Edmund Ware\nsince spring\nHonour a feast');
  assert.deepEqual(JSON.parse(JSON.stringify(g.L(panel))),[{name:'House Vane',code:'h2'},{name:'Edmund Ware',code:'p77'}]);
});

test('the annals by category, by day and by words, newest last',()=>{
  const g={allLines:['THE ANNALS OF ARDEN','[Spring 1, AD 850] The crown is set upon a young head.','\n=== Here begin the years of King Hal. ===\n','[Spring 9, AD 850] War! House Vane rises.','[Summer 2, AD 850] A great fair at Ashby.','[Summer 30, AD 850] Vane’s host is broken at the ford.'],
    ANNAL_META:[],W:{startAD:850},dateStr:d=>'day '+d};
  Object.assign(g.ANNAL_META,{1:{d:0,c:'crown'},2:{d:3,c:'crown',r:1},3:{d:8,c:'war'},4:{d:91,c:'trade'},5:{d:119,c:'war'}});
  vm.runInNewContext(fn('advisorAnnals')+';this.A=advisorAnnals;',g);
  const J=x=>JSON.parse(JSON.stringify(x));
  assert.deepEqual(J(g.A({cat:'war'})).map(x=>x.text),['War! House Vane rises.','Vane’s host is broken at the ford.']);
  assert.deepEqual(J(g.A({n:2})).map(x=>x.day),[91,119]);
  assert.deepEqual(J(g.A({from:5,to:100})).map(x=>x.cat),['war','trade']);
  assert.equal(J(g.A({q:'fair'}))[0].text,'A great fair at Ashby.');
  assert.equal(J(g.A({cat:'crown'}))[1].text,'Here begin the years of King Hal.');
  assert.deepEqual(J(g.A({fromAD:850,toAD:850,cat:'trade'})).map(x=>x.day),[91]);
  assert.match(html,/ANNAL_META\[allLines\.length-1\]=\{d:ev\.day,c:cat\};/,'every entry the annalist writes keeps its day and category');
});

test('reading a town stores nothing in it: no price the market has not found, no trade tally the year has not taken',()=>{
  let tallied=0;const s={name:'Ashby',kind:'town',pos:{x:10,z:20},owner:1,pop:300,prosperity:50,unrest:5,stores:{grain:40,sheep:12},cult:'anglo',px:{grain:3}};
  const g={W:{settlements:[s],houses:[{name:'Crown'},{name:'House Vane'}],ships:[]},GOODS:['grain','wool'],GOODBASE:{grain:2,wool:4},BEASTS:['sheep','cattle'],CULT:{anglo:{name:'English'}},
    price0:(t,gd)=>gd==='wool'?8:99,price:()=>{throw Error('price() stores what it reckons');},tradeCounts:()=>{tallied++;return{};},day:()=>100,year:()=>1,dateStr:d=>'day '+d,wallProg:()=>1,detailPopulation:t=>t.pop};
  const ADV=vm.runInNewContext(advSrc+';ADV',g),r=JSON.parse(JSON.stringify(ADV.place(s)));
  assert.equal(r.prices.grain,3);assert.equal(r.prices.wool,8);assert.equal(r.prices_vs_usual.wool,2);assert.equal(s.px.wool,undefined);assert.equal(tallied,0);
  assert.deepEqual(r.herds,{sheep:12,cattle:0});assert.equal(r.tongue,'English');assert.deepEqual(r.at,{x:10,z:20});
});
