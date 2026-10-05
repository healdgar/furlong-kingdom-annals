// Compare household and ownership semantics from independently captured world graphs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
function readGraph(file){
  const graph=JSON.parse(fs.readFileSync(file,'utf8')),objects=new Map();
  function read(v){
    if(!Array.isArray(v))return v;
    if(v[0]==='undefined')return undefined;
    if(v[0]==='number')return Number(v[1]);
    if(v[0]==='graphic')return null;
    if(v[0]!=='ref')return v;
    const id=v[1];if(objects.has(id))return objects.get(id);const node=graph.nodes[id],kind=node[0];
    const o=kind==='map'?new Map():kind==='set'?new Set():kind==='array'||kind==='typed'?[]:{};objects.set(id,o);
    if(kind==='map')for(const[k,x]of node[1])o.set(read(k),read(x));
    else if(kind==='set')for(const x of node[1])o.add(read(x));
    else if(kind==='array')for(const x of node[1])o.push(read(x));
    else if(kind==='typed'){} // Terrain bits do not enter the commodity/household projection.
    else if(kind==='object')for(const[k,x]of node[1])Object.defineProperty(o,k,{value:read(x),enumerable:true,writable:true,configurable:true});
    return o;
  }
  return read(graph.root);
}
export function projection(graph){
  const W=graph.world;
  const owner=o=>o==null?'unassigned':typeof o!=='object'?typeof o+':'+o:o.household?'household:'+o.id:W.houses.includes(o)?'house:'+W.houses.indexOf(o):W.settlements.includes(o)?'settlement:'+W.settlements.indexOf(o):o.storageOwnerId||'person:'+o.id;
  const numeric=o=>Object.fromEntries(Object.entries(o||{}).filter(([,q])=>typeof q==='number'&&q!==0).sort(([a],[b])=>a.localeCompare(b)));
  const person=p=>p==null?null:p.household?'household:'+p.id:p.id!=null?'person:'+p.id:String(p);
  const land=graph.land?.F;
  return {
    day:W.clock.day,treasury:W.treasury,
    houses:W.houses.map(h=>({w:h.w,extinct:h.extinct??false})),
    towns:W.settlements.map(s=>({name:s.name,pop:s.pop,fill:s._fill,stores:numeric(s.stores),owners:Object.fromEntries([...s._owners||[]]
      .map(([o,x])=>[owner(o),{held:numeric(x.held),sale:numeric(x.sale),animals:numeric(x.animals),reserve:numeric(x.reserve)}])
      .filter(([,x])=>Object.values(x).some(t=>Object.keys(t).length)))})),
    households:[...W.households||[]].map(([id,h])=>({id,head:h.head?.id??null,
      members:[...(h.members||[])].map(p=>p.id).sort((a,b)=>a-b),
      successors:(h.successors||[]).map(([to,f])=>[person(to),f]),guardian:person(h.guardian),
      hunger:h.hunger,w:h.assets.w??0,debt:h.assets._debt??0,
      owe:(h.assets._owe||[]).map(([o,q])=>[owner(o),q]).sort(([a],[b])=>a.localeCompare(b)),
      herd:numeric(h.assets.herd),population:[...h.population||[]].map(([s,q])=>[W.settlements.indexOf(s),q]).sort(([a],[b])=>a-b),estate:h.estate??null
    })).sort((a,b)=>String(a.id).localeCompare(String(b.id))),
    land:land?land.map(f=>({k:f.k,dom:f.dom,lord:f.lord,core:f.core,held:f.held,kind:f.kind,state:f.state,
      af:f.af,ar:f.ar,fo:f.fo,fl:f.fl,vi:f.vi,fa:f.fa,area:f.area,
      ten:f.ten==null?null:owner(f.ten),own:f.own==null?null:owner(f.own),wk:f.wk??null})):null
  };
}
export function compareCommodityGraphs(baseline,candidate,{relativeTolerance=1e-9}={}){
  const a=projection(readGraph(baseline)),b=projection(readGraph(candidate)),differences=[];let largestRelative=0,numbers=0;
  function compare(x,y,path){
    if(x===undefined&&typeof y==='number'&&Math.abs(y)<=relativeTolerance)x=0;else if(y===undefined&&typeof x==='number'&&Math.abs(x)<=relativeTolerance)y=0;
    if(typeof x==='number'&&typeof y==='number'){numbers++;const scale=Math.max(1,Math.abs(x),Math.abs(y)),relative=Math.abs(x-y)/scale;largestRelative=Math.max(largestRelative,relative);if(!Number.isFinite(x)||!Number.isFinite(y)||relative>relativeTolerance)differences.push({path,baseline:x,candidate:y,relative});return;}
    if(Array.isArray(x)&&Array.isArray(y)){if(x.length!==y.length){differences.push({path,baselineLength:x.length,candidateLength:y.length});return;}for(let i=0;i<x.length;i++)compare(x[i],y[i],path+'['+i+']');return;}
    if(x&&y&&typeof x==='object'&&typeof y==='object'){const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)compare(x[k],y[k],path+'.'+k);return;}
    if(!Object.is(x,y))differences.push({path,baseline:x,candidate:y});
  }
  compare(a,b,'world');return {pass:differences.length===0,scope:'Household pantry, hunger, population, purse, debt/creditors, herd, members/successors/guardian/estate; town stocks and owner balances; furlong land domain, lordship, tenure and state; treasury. Does not compare named-person purses/debts, market queues, or journal/lot identity.',relativeTolerance,numbers,largestRelative,differences};
}
function distribution(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
  const q=p=>n?sorted[Math.min(n-1,Math.floor((n-1)*p))]:null;
  return {n,sum:sorted.reduce((a,b)=>a+b,0),mean:n?sorted.reduce((a,b)=>a+b,0)/n:null,median:q(.5),p90:q(.9),p95:q(.95),max:n?sorted[n-1]:null,zeroOrLess:sorted.filter(x=>x<=0).length};
}
export function summarizeCommodityGraph(file){
  const {world:W}=readGraph(file),rows=[],pantries=new Map();
  for(const s of W.settlements){
    const K=s.storage;if(!K)continue;
    const add=(owner,good,availability,qty,transit)=>{
      if(transit||availability!=='held'||!owner?.household||!['grain','fish'].includes(good)||!(qty>0))return;
      const id=String(owner.id);let pantry=pantries.get(id);if(!pantry)pantries.set(id,pantry={grain:0,fish:0});pantry[good]+=qty;
    };
    if(K.version===3){for(const[,facility]of K.facilities||[])for(const[good,owners]of facility.balances||[])for(const[owner,availability]of owners)for(const[kind,qty]of availability)add(owner,good,kind,qty,facility.transit);}
    else for(const lot of K.lots?.values?.()||[])add(lot.owner,lot.good,lot.availability,lot.qty,K.locations?.get(lot.location)?.transit);
  }
  for(const[id,h]of W.households||[]){const population=[...(h.population||[])].reduce((n,[,q])=>n+(Number.isFinite(q)?q:0),0),pantry=pantries.get(String(id))||{grain:0,fish:0},members=[...(h.members||[])],livingMembers=members.filter(p=>!p.dead).length,markedDeadMembers=members.length-livingMembers;rows.push({id:String(id),population,hunger:Number.isFinite(h.hunger)?h.hunger:0,purse:Number.isFinite(h.assets?.w)?h.assets.w:0,debt:Number.isFinite(h.assets?._debt)?h.assets._debt:0,grain:pantry.grain,fish:pantry.fish,pantry:pantry.grain+pantry.fish,memberCount:members.length,livingMembers,markedDeadMembers,head:h.head?.id??null});}
  rows.sort((a,b)=>a.id.localeCompare(b.id));const totalPopulation=rows.reduce((n,r)=>n+r.population,0),weightedHunger=totalPopulation?rows.reduce((n,r)=>n+r.hunger*r.population,0)/totalPopulation:0;
  return {day:W.clock.day,population:{settlementTotal:W.settlements.reduce((n,s)=>n+(Number.isFinite(s.pop)?s.pop:0),0),householdCohorts:totalPopulation},householdCount:rows.length,activeHouseholdCount:rows.filter(r=>r.population>0).length,zeroPopulationHouseholdCount:rows.filter(r=>r.population<=0).length,memberCount:rows.reduce((n,r)=>n+r.memberCount,0),livingMemberCount:rows.reduce((n,r)=>n+r.livingMembers,0),membersMarkedDeadCount:rows.reduce((n,r)=>n+r.markedDeadMembers,0),householdsWithoutMembers:rows.filter(r=>r.memberCount===0).length,householdsWithoutLivingMembers:rows.filter(r=>r.livingMembers===0).length,weightedHunger,distributions:Object.fromEntries(['population','hunger','purse','debt','grain','fish','pantry'].map(k=>[k,distribution(rows.map(r=>r[k]))])),households:rows};
}
export function summarizeCommodityGraphs(baseline,candidate){
  const a=summarizeCommodityGraph(baseline),b=summarizeCommodityGraph(candidate),A=new Map(a.households.map(h=>[h.id,h])),B=new Map(b.households.map(h=>[h.id,h])),ids=[...new Set([...A.keys(),...B.keys()])].sort((x,y)=>x.localeCompare(y)),paired=ids.filter(id=>A.has(id)&&B.has(id));
  return {baseline:{...a,households:undefined},candidate:{...b,households:undefined},householdIds:{baseline:a.householdCount,candidate:b.householdCount,shared:paired.length,baselineOnly:ids.filter(id=>A.has(id)&&!B.has(id)).length,candidateOnly:ids.filter(id=>B.has(id)&&!A.has(id)).length},pairedDifferences:Object.fromEntries(['population','hunger','purse','debt','grain','fish','pantry'].map(k=>[k,distribution(paired.map(id=>B.get(id)[k]-A.get(id)[k]))]))};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const argv=process.argv.slice(2),stats=argv.includes('--stats'),args=argv.filter(x=>x!=='--stats'),[baseline,candidate,out]=args;assert.ok(baseline&&candidate,'Usage: node tools/commodity-parity.mjs baseline.state.json candidate.state.json [output.json] [--stats]');const exactParity=compareCommodityGraphs(baseline,candidate),result=stats?{exactParity,statistics:summarizeCommodityGraphs(baseline,candidate)}:exactParity;if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(stats?{...result,exactParity:{...exactParity,differences:exactParity.differences.slice(0,20)}}:{...exactParity,differences:exactParity.differences.slice(0,20)},null,2));if(!exactParity.pass)process.exitCode=1;}
