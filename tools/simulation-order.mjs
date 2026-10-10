// Review the source's actual day against the data dependencies in its contract.
// This is a development tool; the game keeps direct calls in its single script.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as acorn from './vendor/acorn/acorn.mjs';
import {inlineGameScript} from './simulation-boundary.mjs';

export function dailyDispatch(html){
  const source=inlineGameScript(html),ast=acorn.parse(source,{ecmaVersion:'latest'});
  const functions=new Map(ast.body.filter(n=>n.type==='FunctionDeclaration').map(n=>[n.id.name,n]));
  const tick=functions.get('simTick');if(!tick)throw Error('No master tick');
  const phases=[];const walk=(node,depth=0)=>{if(!node?.type)return;
    if(node.type==='CallExpression'&&node.callee.name==='simPart'){
      const name=node.arguments[0]?.value;if(typeof name!=='string')throw Error('Unnamed daily phase');
      const body=node.arguments[1]?.body,callee=body?.type==='CallExpression'&&body.callee.type==='Identifier'?body.callee.name:null;
      phases.push({name,callee,conditional:depth>0});}
    for(const [key,value]of Object.entries(node)){if(key==='loc')continue;
      const nested=depth+(['IfStatement','ForStatement','ForOfStatement','WhileStatement','ConditionalExpression'].includes(node.type)?1:0);
      if(Array.isArray(value))value.forEach(n=>walk(n,nested));else if(value?.type)walk(value,nested);}};
  walk(tick.body);return {source,functions,tick,phases};
}

export function validateDailyOrder(dispatch,contract){
  const names=dispatch.phases.map(p=>p.name),expected=contract.stages.flatMap(s=>s.phases),positions=new Map(names.map((n,i)=>[n,i])),errors=[];
  if(positions.size!==names.length)errors.push('A daily phase is repeated');
  if(new Set(expected).size!==expected.length)errors.push('The contract repeats a phase');
  for(const n of expected)if(!positions.has(n))errors.push('Missing phase: '+n);
  for(const p of dispatch.phases){if(!expected.includes(p.name))errors.push('Unaudited phase: '+p.name);if(p.conditional)errors.push('Conditional daily dispatch: '+p.name);
    if(p.name!=='dragonWake'&&(p.callee!==p.name||!dispatch.functions.has(p.name)))errors.push('Wrong phase callback: '+p.name);}
  for(const e of contract.edges)if(!(positions.get(e.before)<positions.get(e.after)))errors.push(e.before+' must precede '+e.after+': '+e.reason);
  if(names.at(-1)!=='commoditySettleAll')errors.push('Commodity settlement must close the day');
  // Review real edges, rather than pinning one entire order which could hide a missing prerequisite.
  const indegree=new Map(expected.map(n=>[n,0])),out=new Map(expected.map(n=>[n,[]]));
  for(const e of contract.edges){if(!indegree.has(e.before)||!indegree.has(e.after)){errors.push('Unknown edge: '+e.before+' -> '+e.after);continue;}
    out.get(e.before).push(e.after);indegree.set(e.after,indegree.get(e.after)+1);}
  const ready=expected.filter(n=>indegree.get(n)===0);let visited=0;
  while(ready.length){const n=ready.shift();visited++;for(const to of out.get(n)){indegree.set(to,indegree.get(to)-1);if(indegree.get(to)===0)ready.push(to);}}
  if(visited!==expected.length)errors.push('Dependency contract contains a cycle');
  return errors;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const html=fs.readFileSync(process.argv[2]||new URL('../index.html',import.meta.url),'utf8');
  const contract=JSON.parse(fs.readFileSync(new URL('../docs/SIMULATION-ORDER.json',import.meta.url),'utf8'));
  const dispatch=dailyDispatch(html),errors=validateDailyOrder(dispatch,contract);
  console.log(JSON.stringify({phases:dispatch.phases.length,edges:contract.edges.length,pass:errors.length===0,errors},null,2));
  if(errors.length)process.exitCode=1;
}
