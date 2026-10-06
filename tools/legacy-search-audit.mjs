#!/usr/bin/env node
// Static inventory of broad collection searches in the game's inline script.
// This is evidence for review, not a rule that every one-pass traversal is bad.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from './vendor/acorn/acorn.mjs';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const COLLECTIONS=new Set(['folk','_owners','buildings','streets']);
const SEARCH_HELPERS=new Set(['heads_','workers_','headsOf']);
const ITERATOR_METHODS=new Set(['forEach','map','filter','reduce','reduceRight','some','every','find','findLast','flatMap','sort']);
const LOOP_TYPES=new Set(['ForStatement','ForInStatement','ForOfStatement','WhileStatement','DoWhileStatement']);

const key=n=>n?.type==='MemberExpression'?(n.computed?(n.property?.value??(n.property?.type==='Identifier'?n.property.name:null)):n.property?.name):null;
const functionNode=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const fnName=(n,fallback)=>n.id?.name||fallback||`anonymous@${n.loc.start.line}`;
const emptyScopeCall=n=>!n.arguments.length||n.arguments.length===1&&n.arguments[0]?.type==='ObjectExpression'&&n.arguments[0].properties.length===0;

function memberCollection(n){
  if(!n)return null;
  if(n.type==='ChainExpression')return memberCollection(n.expression);
  if(n.type==='MemberExpression')return COLLECTIONS.has(key(n))?key(n):memberCollection(n.object);
  if(n.type==='LogicalExpression'||n.type==='SequenceExpression')return memberCollection(n.left||n.expressions?.at(-1))||memberCollection(n.right);
  if(n.type==='ConditionalExpression')return memberCollection(n.consequent)||memberCollection(n.alternate);
  return null;
}
function walk(node,visit,parent=null,keyName=null){if(!node||typeof node.type!=='string')return;visit(node,parent,keyName);for(const[k,v]of Object.entries(node)){if(k==='parent'||k==='loc'||k==='start'||k==='end')continue;if(Array.isArray(v)){for(const x of v)walk(x,visit,node,k);}else if(v&&typeof v.type==='string')walk(v,visit,node,k);}}

export function auditLegacySearches(source){
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true,allowHashBang:true});
  const records=[],byNode=new WeakMap(),nodeByRecord=new Map(),byName=new Map();
  const makeRecord=(n,name)=>{const named=!!(n.id?.name||name),base=fnName(n,name),count=(byName.get(base)||0)+1;byName.set(base,count);const r={function:count===1?base:`${base}#${count}`,line:n.loc.start.line,named,sites:[],directCallees:new Set(),aliases:new Map()};records.push(r);byNode.set(n,r);nodeByRecord.set(r,n);return r;};
  // First pass gives declarations and named callbacks stable call-graph nodes.
  walk(ast,(n,p,k)=>{if(!functionNode(n))return;let name=n.id?.name;if(!name&&p?.type==='VariableDeclarator'&&p.id.type==='Identifier')name=p.id.name;if(!name&&p?.type==='Property'&&!p.computed)name=p.key.name;if(!name&&p?.type==='MethodDefinition'&&!p.computed)name=p.key.name;if(!name&&p?.type==='PropertyDefinition'&&!p.computed)name=p.key.name;makeRecord(n,name);});
  // Recognize simple collection aliases within the enclosing function.
  function collectAliases(n,r,outerAliases=new Map()){
    if(!n||typeof n.type!=='string')return;
    if(functionNode(n)&&n!==nodeByRecord.get(r)){
      const child=byNode.get(n);if(child){child.aliases=new Map([...outerAliases,...r.aliases]);collectAliases(n,child,child.aliases);}return;
    }
    if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'){
      const c=memberCollection(n.init);if(c)r.aliases.set(n.id.name,c);
      else if(n.init?.type==='Identifier'&&(r.aliases.has(n.init.name)||outerAliases.has(n.init.name)))r.aliases.set(n.id.name,r.aliases.get(n.init.name)||outerAliases.get(n.init.name));
    }
    for(const[k,v]of Object.entries(n)){if(['parent','loc','start','end'].includes(k))continue;if(Array.isArray(v))for(const x of v)collectAliases(x,r,outerAliases);else if(v&&typeof v.type==='string')collectAliases(v,r,outerAliases);}
  }
  for(const r of records)if(!r.aliases.size)collectAliases(nodeByRecord.get(r),r);
  // The generic walk callback has no exit hook; use a second recursive traversal
  // to retain function and loop ancestry precisely.
  const sites=[];
  function visit(n,fnStack=[],loops=[]){
    if(!n||typeof n.type!=='string')return;
    let stack=fnStack;
    if(functionNode(n)){const r=byNode.get(n);stack=[...fnStack,r];}
    const r=stack.at(-1),loopDepth=loops.length;
    const add=(pattern,node,detail,depth=loopDepth)=>{const ownerFunction=[...stack].reverse().find(x=>x?.named)?.function||r?.function||'<top-level>';const site={function:r?.function||'<top-level>',ownerFunction,line:node.loc.start.line,pattern,loopNesting:depth,...detail};sites.push(site);if(r)r.sites.push(site);};
    const collectionOf=e=>memberCollection(e)||(e?.type==='Identifier'?r?.aliases.get(e.name):null);
    if(r&&n.type==='CallExpression'){
      const callee=n.callee,calleeName=callee.type==='Identifier'?callee.name:null;
      if(calleeName&&SEARCH_HELPERS.has(calleeName)){add(`helper:${calleeName}`,n,{expression:calleeName});}
      if(calleeName&&recordsByFunctionName.has(calleeName))r.directCallees.add(calleeName);
      if(callee.type==='MemberExpression'&&key(callee)==='entries'&&emptyScopeCall(n))add('unscoped-entries',n,{expression:source.slice(n.start,n.end)});
      if(callee.type==='MemberExpression'&&ITERATOR_METHODS.has(key(callee))){const c=collectionOf(callee.object);if(c)add(`collection:${c}`,n,{expression:source.slice(n.start,n.end)},loopDepth+1);for(const arg of n.arguments){if(functionNode(arg)){const callback=byNode.get(arg);if(callback)r.directCallees.add(callback.function);}}}
    }
    if(r&&(n.type==='ForOfStatement'||n.type==='ForInStatement')){
      const c=collectionOf(n.right);if(c)add(`collection:${c}`,n,{expression:source.slice(n.right.start,n.right.end)},loopDepth+1);
    }
    if(r&&n.type==='SpreadElement'){const c=collectionOf(n.argument);if(c)add(`collection:${c}`,n,{expression:source.slice(n.start,n.end)});}
    const nextLoops=LOOP_TYPES.has(n.type)?[...loops,n]:loops;
    const iteratingCall=n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&ITERATOR_METHODS.has(key(n.callee));
    for(const[k,v]of Object.entries(n)){if(['parent','loc','start','end'].includes(k))continue;const childLoops=iteratingCall&&k==='arguments'?[...loops,n]:nextLoops;if(Array.isArray(v)){for(const x of v)visit(x,stack,childLoops);}else if(v&&typeof v.type==='string')visit(v,stack,childLoops);}
  }
  const recordsByFunctionName=new Set();
  for(const n of ast.body){
    if(n.type==='FunctionDeclaration'&&n.id)recordsByFunctionName.add(n.id.name);
    if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.type==='Identifier'&&functionNode(d.init))recordsByFunctionName.add(d.id.name);
  }
  visit(ast);
  // Calls to declarations with duplicate synthesized callback labels are not
  // statically resolvable; identifier-named declarations/variables are.
  const directNames=new Map(records.map(r=>[r.function,r]));
  const broadNames=new Set(records.filter(r=>r.sites.length).map(r=>r.function));
  const output=records.map(r=>{
    const seen=new Set(),pending=[...r.directCallees];while(pending.length){const name=pending.pop();if(seen.has(name))continue;seen.add(name);const target=directNames.get(name);if(target)for(const next of target.directCallees)pending.push(next);}
    const transitive=[...seen].filter(name=>broadNames.has(name)).sort();
    return {function:r.function,line:r.line,broadSites:r.sites.map(({function:_f,...s})=>s),directCallees:[...r.directCallees].sort(),transitiveBroadCalls:transitive};
  }).filter(r=>r.broadSites.length||r.transitiveBroadCalls.length);
  return {sites,functions:output,limits:[
    'Syntactic inventory only: no runtime frequency, collection size, mutation rate, or cost estimate.',
    'Recognizes named helper calls heads_, workers_, headsOf; iteration/method scans of folk, _owners, buildings, streets, simple local aliases; and unscoped .entries()/entries({}).',
    'Does not infer computed property names, destructured/parameter aliases, arbitrary wrappers, dynamic dispatch, index-loop bounds, or whether a traversal is semantically avoidable.',
    'One-pass scans are reported as candidates, not defects; direct Map/Set .get() lookups are intentionally ignored.'
  ]};
}

export function auditLegacySearchHTML(html){
  const marker='<script>',first=html.indexOf(marker),start=html.indexOf(marker,first+marker.length),bodyStart=start+marker.length;
  const offset=html.slice(0,bodyStart).split('\n').length-1,report=auditLegacySearches(inlineGameScript(html));
  for(const site of report.sites)site.line+=offset;
  for(const fn of report.functions){fn.line+=offset;for(const site of fn.broadSites)site.line+=offset;}
  return report;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const html=fs.readFileSync(process.argv[2]||path.join(ROOT,'index.html'),'utf8');
  const report=auditLegacySearchHTML(html);console.log(JSON.stringify(report,null,2));
}
