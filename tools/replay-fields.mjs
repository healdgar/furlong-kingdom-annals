import assert from 'node:assert/strict';
const scalar=v=>v===null||typeof v!=='object'||Object.hasOwn(v,'$auditType')||Object.hasOwn(v,'$auditNumber')||Object.hasOwn(v,'$auditBigInt');
export class ReplayFieldOracle{
  constructor(){this.fields=new Map();this.effects=0;this.skipped=0;this.transactions=0;}
  key(entity,path){return JSON.stringify([entity,path]);}
  apply(tx){this.transactions++;for(const e of tx.fields){const add=(path,state,before)=>{if(state.accessor||state.present&&!scalar(state.value)||before&&(before.accessor||before.present&&!scalar(before.value))){this.skipped++;return;}const key=this.key(e.entity,path),prior=this.fields.get(key);if(before)assert.ok(prior,'Missing field definition '+key);if(before&&prior)assert.deepEqual(prior.state,before,'Recorded field precondition gap '+key);if(!before&&prior)return;this.fields.set(key,{entity:e.entity,path,state});this.effects++;};if(e.kind==='definition')for(const [key,state] of e.fields)add([...e.path,key],state);else add(e.path,e.after,e.before);}}
  queries(){return [...this.fields.values()];}
  compare(actual){assert.equal(actual.length,this.fields.size,'Raw field oracle coverage');for(const row of actual){const expected=this.fields.get(this.key(row.entity,row.path));assert.ok(expected,'Unknown raw field');assert.deepEqual(row.state,expected.state,'Live field differs from recorded effects '+this.key(row.entity,row.path));}}
}
