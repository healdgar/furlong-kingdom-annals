const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const cmp=(a,b)=>a<b?-1:a>b?1:0;

function fail(message){throw new Error(message);}
function finite(value,label){if(typeof value!=='number'||!Number.isFinite(value))fail(`Invalid ${label}`);return Object.is(value,-0)?0:value;}
function nonempty(value,label){if(typeof value!=='string'||value.length===0)fail(`Invalid ${label}`);return value;}
function setOwn(record,key,value){Object.defineProperty(record,key,{value,enumerable:true,writable:true,configurable:true});}
function plainRecord(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))fail(`Invalid ${label}`);
  return value;
}
function cloneMetadata(value,label='location metadata',seen=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number')return finite(value,label);
  if(typeof value!=='object'||seen.has(value))fail(`Invalid ${label}`);
  seen.add(value);
  let result;
  if(Array.isArray(value)){
    result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value'in d))fail(`Invalid sparse ${label}`);result.push(cloneMetadata(d.value,label,seen));}
    for(const key of Reflect.ownKeys(value))if(key!=='length'&&!(typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length))fail(`Invalid ${label}`);
  }else{
    plainRecord(value,label);result={};
    const keys=Reflect.ownKeys(value);if(keys.some(k=>typeof k!=='string'))fail(`Invalid ${label}`);
    for(const key of keys.sort(cmp)){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))fail(`Invalid ${label}`);setOwn(result,key,cloneMetadata(d.value,label,seen));}
  }
  seen.delete(value);return result;
}
function finiteMapObject(value,label,{signed=false}={}){
  plainRecord(value,label);const out=[];
  for(const cause of Reflect.ownKeys(value)){
    if(typeof cause!=='string'||!cause)fail(`Invalid ${label}`);
    const d=Object.getOwnPropertyDescriptor(value,cause);if(!d||!('value'in d))fail(`Invalid ${label}`);
    const goods=plainRecord(d.value,`${label} entry`),items=[];
    for(const good of Reflect.ownKeys(goods)){
      if(typeof good!=='string'||!good)fail(`Invalid ${label}`);
      const gd=Object.getOwnPropertyDescriptor(goods,good);if(!gd||!('value'in gd))fail(`Invalid ${label}`);
      const amount=finite(gd.value,label);if(!signed&&amount<0)fail(`Invalid ${label}`);items.push([good,amount]);
    }
    items.sort((a,b)=>cmp(a[0],b[0]));out.push([cause,items]);
  }
  out.sort((a,b)=>cmp(a[0],b[0]));return out;
}
function group(root,key,create=false){
  if(!root)return undefined;
  let value=root.get(key);if(!value&&create)root.set(key,value=new Map());return value;
}
function balanceGet(realm,location,good,owner,availability){
  if(!realm)return 0;
  return group(group(group(realm.balances,location),good),owner)?.get(availability)??0;
}
function nestedSet(root,path,value){let current=root;for(let i=0;i<path.length-1;i++)current=group(current,path[i],true);current.set(path[path.length-1],value);}
function nestedGet(root,path){let current=root;for(let i=0;i<path.length-1;i++){current=current?.get(path[i]);if(!current)return undefined;}return current.get(path[path.length-1]);}
function walkRows(root,visit,path=[]){for(const[key,value]of root){const next=[...path,key];if(value instanceof Map)walkRows(value,visit,next);else visit(next,value);}}
function deltaTolerance(before,after,delta){return Number.EPSILON*8*Math.max(1,Math.abs(before),Math.abs(after),Math.abs(delta));}

export class CommoditySettlementReducer{
  constructor(){this.realms=new Map();}
  apply(event){
    plainRecord(event,'settlement event');
    if(event.kind!=='storage'||event.cause!=='daily-settlement'||event.version!==3)fail('Unsupported settlement event');
    const settlement=event.settlement,day=event.day,revision=event.revision;
    if(!Number.isSafeInteger(settlement)||settlement<0)fail('Invalid settlement');
    if(!Number.isSafeInteger(day)||day<0)fail('Invalid settlement day');
    if(!Number.isSafeInteger(revision)||revision<1)fail('Invalid settlement revision');
    if(!Array.isArray(event.deltas)||!Array.isArray(event.locations))fail('Invalid settlement rows');
    const realm=this.realms.get(settlement),expectedRevision=(realm?.revision||0)+1;
    if(revision!==expectedRevision)fail(`Noncontiguous settlement revision at ${settlement}`);
    if(realm&&day<realm.day)fail(`Settlement day moved backward at ${settlement}`);

    const nextLocations=new Map(realm?.locations||[]),locationChanges=new Map();
    for(const row of event.locations){
      plainRecord(row,'location update');const id=nonempty(row.id,'location ID');
      if(locationChanges.has(id)||!own(row,'after'))fail('Duplicate or malformed location update');
      const metadata=row.after===null?null:cloneMetadata(row.after);
      locationChanges.set(id,metadata);
      if(metadata===null)nextLocations.delete(id);else nextLocations.set(id,metadata);
    }

    const staged=new Map(),seen=new Map();
    for(const row of event.deltas){
      plainRecord(row,'balance delta');
      const location=nonempty(row.location,'balance location'),good=nonempty(row.good,'good'),owner=nonempty(row.owner,'owner'),availability=nonempty(row.availability,'availability');
      const before=finite(row.before,'balance before'),after=finite(row.after,'balance after'),delta=finite(row.delta,'balance delta');
      if(before<0||after<0||before===after)fail('Invalid balance quantity');
      const available=group(group(group(seen,location,true),good,true),owner,true);
      if(available.has(availability))fail('Duplicate balance delta');
      available.set(availability,true);
      const current=balanceGet(realm,location,good,owner,availability);
      if(before!==current)fail(`Balance before mismatch at ${settlement}/${location}/${good}/${owner}/${availability}`);
      if(Math.abs((after-before)-delta)>deltaTolerance(before,after,delta))fail('Balance delta arithmetic mismatch');
      if(!nextLocations.has(location)&&!realm?.locations.has(location))fail(`Unknown location ${location} at ${settlement}`);
      nestedSet(staged,[location,good,owner,availability],after);
    }

    for(const[id,metadata]of locationChanges)if(metadata===null){
      let occupied=false;
      if(realm)walkRows(realm.balances,(path,quantity)=>{if(path[0]!==id)return;const after=nestedGet(staged,path);if((after===undefined?quantity:after)>0)occupied=true;});
      walkRows(staged,(path,quantity)=>{if(path[0]===id&&quantity>0)occupied=true;});
      if(occupied)fail(`Cannot remove occupied location ${id}`);
    }

    const flowRows=finiteMapObject(event.flows,'settlement flows',{signed:true}),nextFlows=new Map();
    if(realm&&realm.day===day)for(const[cause,goods]of realm.flows)nextFlows.set(cause,new Map(goods));
    for(const[cause,goods]of flowRows){let target=nextFlows.get(cause);if(!target)nextFlows.set(cause,target=new Map());
      for(const[good,amount]of goods){const total=(target.get(good)||0)+amount;if(!Number.isFinite(total))fail('Settlement flow overflow');target.set(good,Object.is(total,-0)?0:total);}}

    const nextBalances=new Map(realm?.balances||[]);
    walkRows(staged,(path,quantity)=>{
      if(quantity===0){let parent=nextBalances;for(let i=0;i<path.length-1;i++)parent=group(parent,path[i]);parent?.delete(path.at(-1));}
      else nestedSet(nextBalances,path,quantity);
    });
    for(const[id,metadata]of locationChanges)if(metadata===null)nextLocations.delete(id);
    this.realms.set(settlement,{day,revision,locations:nextLocations,balances:nextBalances,flows:nextFlows});
    return this;
  }
  snapshot(){
    return [...this.realms].sort((a,b)=>a[0]-b[0]).map(([settlement,realm])=>{
      const balances=[];walkRows(realm.balances,(path,quantity)=>balances.push({location:path[0],good:path[1],owner:path[2],availability:path[3],quantity}));
      balances.sort((a,b)=>cmp(a.location,b.location)||cmp(a.good,b.good)||cmp(a.owner,b.owner)||cmp(a.availability,b.availability));
      const locations=[...realm.locations].sort((a,b)=>cmp(a[0],b[0])).map(([id,metadata])=>({id,metadata:cloneMetadata(metadata)}));
      const flows={};for(const[cause,goods]of [...realm.flows].sort((a,b)=>cmp(a[0],b[0]))){const row={};for(const[good,value]of [...goods].sort((a,b)=>cmp(a[0],b[0])))setOwn(row,good,value);setOwn(flows,cause,row);}
      return {settlement,day:realm.day,revision:realm.revision,locations,balances,flows};
    });
  }
}
