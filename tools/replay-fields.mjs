import assert from 'node:assert/strict';
export class ReplayFieldOracle{
  constructor(){this.fields=new Map();this.effects=0;this.skipped=0;this.transactions=0;this.structured=0;}
  key(entity,path){return JSON.stringify([entity,path]);}
  apply(tx){const fields=new Map(this.fields);let effects=0,skipped=0,structured=0;for(const e of tx.fields){const add=(path,state,before)=>{assert.equal(typeof state.present,'boolean','Missing field presence');if(state.accessor||before?.accessor){skipped++;return;}const key=this.key(e.entity,path),prior=fields.get(key);if(before)assert.ok(prior,'Missing field definition '+key);if(before&&prior)assert.deepEqual(prior.state,before,'Recorded field precondition gap '+key);if(!before&&prior)return;fields.set(key,{entity:e.entity,path,state});effects++;if(state.present&&state.value!==null&&typeof state.value==='object')structured++;};if(e.kind==='definition')for(const [key,state] of e.fields)add([...e.path,key],state);else add(e.path,e.after,e.before);}this.fields=fields;this.effects+=effects;this.skipped+=skipped;this.structured+=structured;this.transactions++;}
  queries(){return [...this.fields.values()];}
  compare(actual){assert.equal(actual.length,this.fields.size,'Raw field oracle coverage');for(const row of actual){const expected=this.fields.get(this.key(row.entity,row.path));assert.ok(expected,'Unknown raw field');assert.deepEqual(row.state,expected.state,'Live field differs from recorded effects '+this.key(row.entity,row.path));}}
}
// Executed only in correctness Chrome passes. Independent of the production replay encoder.
export const TRANSACTION_VALUE_ORACLE=`function independentTransactionValue(v,seen=new Set()){
 if(v===null||typeof v!=='object')return v;
 let id=null;if(v===W)id='world';else if(v.household)id='household:'+v.id;else if(v.gn!==undefined&&v.id!=null)id='person:'+v.id;else {const h=W.houses.indexOf(v),s=W.settlements.indexOf(v);if(h>=0)id='house:'+h;else if(s>=0)id='settlement:'+s;else if(v.storageOwnerId)id=v.storageOwnerId;}
 if(id!==null){if(FURLONG_TRANSACTIONS.resolve(id,[])!==v)throw Error('Replay reference identity differs '+id);return {$ref:id};}
 if(seen.has(v))throw Error('Cyclic raw transaction field');const next=new Set(seen);next.add(v);
 if(v instanceof Map)return {$map:[...v].map(([k,x])=>[independentTransactionValue(k,next),independentTransactionValue(x,next)])};
 if(v instanceof Set)return {$set:[...v].map(x=>independentTransactionValue(x,next))};
 const out=Array.isArray(v)?new Array(v.length):{};for(const k of Reflect.ownKeys(v)){if(Array.isArray(v)&&k==='length')continue;if(typeof k!=='string')throw Error('Symbol raw transaction field');const d=Object.getOwnPropertyDescriptor(v,k);if(!('value'in d))throw Error('Accessor raw transaction field');Object.defineProperty(out,k,{value:independentTransactionValue(d.value,next),writable:true,enumerable:true,configurable:true});}return out;
}`;
