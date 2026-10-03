import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const names=['lordAcct','houseAcct','acct','flow','transfer','borrow','mkt','rsv','offer','lard','forSale','avail','purchase','clearMarket','heads_','means','craftWork','shareOutput','reconcile','topUpFood','eatHouseholds','tickPopulation','headsOf','folkIndex','repay','inherit','inheritanceCustom','estateChildren','estateKin','landHeirs','estateShares','offerLand','moveStock','herdOf','herdSync','dropPerson','yearOfFolk','removeAt','provision'];
const ownership=source.slice(source.indexOf('function oldHouseholdHead('),source.indexOf('function houseFolk(s)'));
const functions=names.map(n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0]||'').join('\n');
const constants=['GOODS','GOODBASE','NEED','LU','MARGIN','PRODUCE','foodYr','BEAST_YR','HH_FIELDS','PARTIBLE','SHARE'].map(n=>source.match(new RegExp('^const '+n+'=.*$','m'))?.[0]||'').join('\n');

export function realm({grain=20,fish=20,grainLard=0,fishLard=0,cash=20,crown=0,pop=150,households=1}={}){
  const H=Array.from({length:households},(_,i)=>({id:i+1,gn:'household',w:cash,tr:'labourer',si:0}));
  const s={name:'fixture',owner:0,pop,kind:'town',stores:{grain,fish},_lard:{grain:grainLard,fish:fishLard},folk:H.slice(),buildings:[],pos:{x:0,z:0},prosperity:50,unrest:0,_room:1000,infected:0,px:{grain:1,fish:2,ore:1,timber:1},_made:{},res:{}};
  const W={treasury:crown,houses:[],settlements:[s],_pl:1};
  const C=vm.createContext({W,s,H,console,waterMill:()=>false,GV:0,GB:1,GD:2,GWa:3,GF:4,nameUse:()=>{},archivePerson:()=>{},life:()=>{},folkName:p=>p.gn,beastsWord:()=>"beasts",MOD:{tax:12,birth:0,mort:0},BIRTH0:0,HOUSEHOLD:5,G:{bldList:[]},
    day:()=>1,year:()=>0,AD:()=>850,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),ageYrs:p=>p.age??30,BEASTS:['sheep','cattle','horses','swine'],
    price:(x,g)=>x.px[g]??1,tilledOf:()=>[],parishOf:()=>null,payAmong:()=>assert.fail('fixture has no demesne wages'),
    tradeCounts:()=>Object.fromEntries(H.map(h=>[h.tr,1])),marketFor:()=>null,book:()=>{},lordTake:()=>{},folkIndex:()=>new Map(H.map(h=>[h.id,h])),carryingCap:()=>1000,
    emit:()=>{},vary:(k,L)=>L[0](),randi:()=>0,famineStrikes:()=>{}});
  vm.runInContext(constants+'\n'+ownership+'\nconst isHouse=x=>x&&W.houses.includes(x);\n'+functions,C);
  vm.runInContext("offer(s,'grain','crown',s.stores.grain);offer(s,'fish','crown',s.stores.fish)",C);
  const run=()=>vm.runInContext('tickPopulation()',C),eval_=s=>vm.runInContext(s,C);
  const coins=()=>W.treasury+H.reduce((t,h)=>t+h.w,0)+Object.values(s._poolBy||{}).reduce((t,v)=>t+v,0);
  return {C,W,s,H,run,eval:eval_,coins};
}
export const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
