import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function extract(name){return source.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0]||'';}

test('commodity carriage partitions candidates across many owners and spoilage reuses the phase ledger',()=>{
  const rows=Array.from({length:20},(_,i)=>({id:'r'+i,location:'yard',owner:{id:'owner'+i},good:'grain',availability:'held',qty:1}));
  const nodes=Array.from({length:12},(_,i)=>({id:'f'+i,building:{},active:true,public:true,owner:null,x:i+1,z:0,capacity:100,used:0,protection:4}));
  nodes.push({id:'f12',building:{},active:true,public:false,owner:rows[17].owner,x:13,z:0,capacity:100,used:0,protection:4});
  const calls={sync:0,route:0,free:0};
  const balances=new Map([['grain',new Map(rows.map(r=>[r.owner,new Map([['held',r.qty]])]))]]);
  const K={locations:new Map([['yard',{id:'yard',exposed:true,x:0,z:0,protection:4,balances}],...nodes.map(n=>[n.id,n])]),facilityOrder(id){return Number(id.slice(1));},free(id){calls.free++;const n=this.locations.get(id);return n.capacity-n.used;},volume(){return 1;},entries({good}={}){return rows.filter(r=>r.qty>0&&(!good||r.good===good));},transfer(r,q,owner,{location}){r.qty-=q;balances.get(r.good).get(r.owner).set(r.availability,r.qty);this.locations.get(location).used+=q;},consume(r,q){r.qty-=q;balances.get(r.good).get(r.owner).set(r.availability,r.qty);}};
  const s={pop:100,buildings:nodes.map(n=>({arch:'warehouse',storageId:n.id})),storage:K};
  const context=vm.createContext({s,K,W:{},STORAGE_TYPES:{warehouse:{}},commodityActive:()=>true,day:()=>1,means:()=>1000,lordAcct:()=>({}),acct:()=>{},wages:()=>{},calls,
    commodityFacilities(){calls.sync++;return K;},commodityExposed(){return rows.filter(r=>r.qty>0);},storageOwnerId(o){return o?.id||'unassigned';},storageRoute(){calls.route++;return 1;}});
  vm.runInContext(extract('commodityStorageTick')+'\n'+extract('commoditySpoil'),context);
  vm.runInContext('commodityStorageTick(s); for(let i=0;i<8;i++)commoditySpoil(s,"grain",.01,K)',context);
  assert.equal(vm.runInContext('calls.route',context),nodes.length);
  assert.equal(vm.runInContext('calls.free',context),12+1+rows.length);
  assert.equal(vm.runInContext('calls.sync',context),1);
  vm.runInContext('commoditySpoil(s,"grain",.01)',context);
  assert.equal(vm.runInContext('calls.sync',context),2);
});
