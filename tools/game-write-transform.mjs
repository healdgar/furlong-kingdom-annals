import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
let acorn;try{acorn=require('internal/deps/acorn/acorn/dist/acorn');}catch{throw Error('Prototype parser requires node --expose-internals; portable parser packaging remains outstanding.');}
const MUTATORS=new Set(['push','pop','shift','unshift','splice','sort','reverse','fill','copyWithin','set','add','delete','clear','defineProperty','defineProperties','assign','setPrototypeOf','setInt8','setUint8','setInt16','setUint16','setInt32','setUint32','setFloat32','setFloat64','setBigInt64','setBigUint64']);
const sha=s=>createHash('sha256').update(s).digest('hex');
function children(n){const a=[];for(const [k,v]of Object.entries(n)){if(['start','end','loc'].includes(k))continue;if(Array.isArray(v)){for(const x of v)if(x?.type)a.push(x);}else if(v?.type)a.push(v);}return a.sort((a,b)=>a.start-b.start||b.end-a.end);}
function suspended(n){if(!n)return false;if(['AwaitExpression','YieldExpression'].includes(n.type))return true;if(['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(n.type))return false;return children(n).some(suspended);}
function directEval(n){if(!n)return false;if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='eval')return true;if(['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(n.type))return false;return children(n).some(directEval);}
function names(pattern){if(!pattern)return[];if(pattern.type==='Identifier')return[pattern];if(pattern.type==='RestElement')return names(pattern.argument);if(pattern.type==='AssignmentPattern')return names(pattern.left);if(pattern.type==='ArrayPattern')return pattern.elements.flatMap(names);if(pattern.type==='ObjectPattern')return pattern.properties.flatMap(p=>names(p.type==='RestElement'?p.argument:p.value));return[];}
function directives(body){return body?.body?.some((n,i)=>n.directive==='use strict'&&body.body.slice(0,i).every(v=>v.directive))||false;}
/** Returns generated JavaScript and exhaustive syntactic-site classifications, never writes product source.
 * bindings: [{name,declarationStart?,token}] names resolve lexical declarations, token identifies an activation.
 * nativeContracts: {methodName:'audited-contract-id'} explicitly allows a runtime intrinsic adapter.
 * excludeRanges: [{start,end,reason}] are source-pinned explicit exclusions.
 */
export function transformWrites(source,options={}){
 const ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:options.sourceType||'script',locations:true,allowHashBang:true});
 const facade=options.facade||'GLOG';if(!/^[$A-Z_a-z][$\w]*(?:\.[$A-Z_a-z][$\w]*)*$/.test(facade))throw Error('Invalid runtime facade');
 const scopes=new WeakMap(),stricts=new WeakMap(),contexts=new WeakMap(),root={parent:null,bindings:new Map(),functionScope:true};
 function scan(n,scope,strict,context='<program>'){let here=scope;
  if(n.type==='Program')strict=directives(n);
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)){
   if(n.type==='FunctionDeclaration'&&n.id)scope.bindings.set(n.id.name,n.id);
   context=n.id?.name||`<function@${n.start}>`;here={parent:scope,bindings:new Map(),functionScope:true};if(n.id)here.bindings.set(n.id.name,n.id);for(const p of n.params)for(const id of names(p))here.bindings.set(id.name,id);strict ||= directives(n.body);
  }else if(n.type==='BlockStatement'||n.type==='CatchClause'||['ForStatement','ForInStatement','ForOfStatement','SwitchStatement'].includes(n.type))here={parent:scope,bindings:new Map(),functionScope:false};
  if(n.type==='ClassDeclaration'||n.type==='ClassExpression')strict=true;
  scopes.set(n,here);stricts.set(n,strict);contexts.set(n,context);
  if(n.type==='VariableDeclaration'){let dest=here;if(n.kind==='var')while(!dest.functionScope)dest=dest.parent;for(const d of n.declarations)for(const id of names(d.id))dest.bindings.set(id.name,id);}
  if(n.type==='CatchClause')for(const id of names(n.param))here.bindings.set(id.name,id);
  if(n.type==='ClassDeclaration'&&n.id)scope.bindings.set(n.id.name,n.id);
  for(const c of children(n))scan(c,here,strict,context);
 }
 scan(ast,root,false);
 const contracts=options.bindings||[];for(const c of contracts){if(!c.name||c.token===undefined)continue;const token=acorn.parseExpressionAt(c.token,0,{ecmaVersion:'latest'});if(c.token.slice(token.end).trim())throw Error('Cell token must be one expression');if(suspended(token)||directEval(token))throw Error('Cell token cannot suspend or directly eval');}const sites=[],ranges=options.excludeRanges||[];let serial=0;
 function exclusion(n){return ranges.find(r=>n.start>=r.start&&n.end<=r.end);}
 function resolved(n){let scope=scopes.get(n),decl;while(scope){if(scope.bindings.has(n.name)){decl=scope.bindings.get(n.name);break;}scope=scope.parent;}return {scope,decl};}
 function binding(n){const {scope,decl}=resolved(n);return contracts.find(c=>c.name===n.name&&(c.declarationStart===undefined?scope===root:c.declarationStart===decl?.start));}
 function site(n,kind,status,reason){const id=serial++,s={id,kind,status,reason,scope:contexts.get(n),start:n.start,end:n.end,line:n.loc.start.line,column:n.loc.start.column};sites.push(s);return id;}
 const literal=JSON.stringify;let prefix='__gw_';while(source.includes(prefix))prefix='_'+prefix;const valueName=prefix+'value',refName=prefix+'ref',objectName=prefix+'object',methodName=prefix+'method';
 function key(m){return m.computed?`${facade}.key((${render(m.property)}))`:literal(m.property.name);}
 function invalidMember(m){return m.optional||m.object.type==='Super'||m.property.type==='PrivateIdentifier';}
 function raw(n){const cs=children(n);let out='',at=n.start;for(const c of cs){if(c.start<at)continue;out+=source.slice(at,c.start)+render(c);at=c.end;}return out+source.slice(at,n.end);}
 function unsupported(n,kind,reason){site(n,kind,'unsupported',reason);return raw(n);}
 function cellRef(c,id,n){return `${facade}.cellRef(()=>${n.name},(${valueName})=>(${n.name}=${valueName}),(${c.token}),${id})`;}
 function render(n){
  const excluded=exclusion(n);
  const mutation=n.type==='AssignmentExpression'||n.type==='UpdateExpression'||n.type==='UnaryExpression'&&n.operator==='delete';
  const decl=n.type==='VariableDeclarator'&&n.init;
  const memberCall=n.type==='CallExpression'&&n.callee.type==='MemberExpression';
  if(excluded){if(mutation||decl||memberCall)site(n,mutation?n.type:decl?'binding-initialization':'call','excluded',excluded.reason);return raw(n);}
  if(decl){if(n.id.type!=='Identifier')return unsupported(n,'binding-initialization','destructuring initialization requires explicit lowering');const c=binding(n.id);if(c){if(!c.token)return unsupported(n,'binding-initialization','cell activation token required');const id=site(n,'binding-initialization','lowered','explicit binding contract');return `${source.slice(n.id.start,n.id.end)}=${facade}.cellInit((${render(n.init)}),(${c.token}),${id})`;}site(n,'binding-initialization','excluded','binding outside supplied cell contract');return raw(n);}
  if(mutation){
   const target=n.left||n.argument,strict=!!stricts.get(n),kind=n.type==='AssignmentExpression'?'assignment':n.type==='UpdateExpression'?'update':'delete';
   if(target.type!=='MemberExpression'&&target.type!=='Identifier')return unsupported(n,kind,'destructuring target requires explicit lowering');
   const c=target.type==='Identifier'?binding(target):null;
   if(target.type==='Identifier'&&!c){const {scope}=resolved(target);site(n,kind,scope&&scope!==root?'excluded':'unsupported',scope&&scope!==root?'local binding outside supplied cell contract':'global binding missing explicit cell/exclusion contract');return raw(n);}
   if(c&&!c.token)return unsupported(n,kind,'cell activation token required');
   if(target.type==='MemberExpression'&&invalidMember(target))return unsupported(n,kind,'optional/super/private reference unsupported');
   if(n.type==='UnaryExpression'&&target.type==='Identifier')return unsupported(n,kind,'identifier delete is not a mutable cell effect');
   const logical=n.type==='AssignmentExpression'&&['&&=','||=','??='].includes(n.operator);
   if(logical&&(suspended(n.right)||directEval(n.right)))return unsupported(n,kind,'logical assignment suspension requires per-activation statement lowering');
   const id=site(n,kind,'lowered',c?'explicit binding contract':'direct member effect');
   const obj=target.type==='MemberExpression'?`(${render(target.object)})`:null,k=obj?(target.computed?`(${render(target.property)})`:literal(target.property.name)):null;
   if(n.type==='UnaryExpression')return `${facade}.delete(${obj},${k},${strict},${id})`;
   if(n.type==='UpdateExpression')return c?`${facade}.cellUpdate(()=>${target.name},(${valueName})=>(${target.name}=${valueName}),${n.operator==='++'?1:-1},${n.prefix},(${c.token}),${id})`:`${facade}.update(${obj},${k},${n.operator==='++'?1:-1},${n.prefix},${strict},${id})`;
   const rhs=`(${render(n.right)})`;
   if(n.operator==='=')return c?`${facade}.cellSet((${valueName})=>(${target.name}=${valueName}),${rhs},(${c.token}),${id})`:`${facade}.set(${obj},${k},${rhs},${strict},${id})`;
   const ref=c?cellRef(c,id,target):`${facade}.ref(${obj},${k},${strict},${id})`;
   if(logical){const op=n.operator.slice(0,-1),guard=op==='&&'?`${refName}.value`:op==='||'?`!${refName}.value`:`${refName}.value==null`;return `((${refName})=>${guard}?${facade}.compound(${refName},${rhs},"="):${refName}.value)(${ref})`;}
   return `${facade}.compound(${ref},${rhs},${literal(n.operator.slice(0,-1))})`;
  }
  if(memberCall){const m=n.callee,method=m.computed&&m.property.type==='Literal'?m.property.value:!m.computed?m.property.name:null;
   if(!MUTATORS.has(method)){site(n,'call','unsupported','unclassified member call may hide native mutation');return raw(n);}
   const contract=options.nativeContracts?.[method];if(!contract)return unsupported(n,'native-call','native mutation requires explicit data/callback/partial-failure contract');
   if(n.optional||invalidMember(m)||suspended(m.property)||n.arguments.some(a=>suspended(a)||directEval(a))||directEval(m.property))return unsupported(n,'native-call','optional/super/private/suspended native call unsupported');
   const id=site(n,'native-call','lowered',contract),args=n.arguments.map(a=>a.type==='SpreadElement'?render(a):`(${render(a)})`).join(',');
   return `((${objectName})=>((${methodName})=>${facade}.call(${objectName},${methodName},[${args}],${id}))(${objectName}[${key(m)}]))((${render(m.object)}))`;
  }
  if(n.type==='CallExpression'&&n.callee.type!=='MemberExpression')site(n,'call','unsupported','unclassified callable may mutate canonical state');
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))for(const p of n.params)for(const id of names(p))if(binding(id))site(id,'parameter-binding','unsupported','selected parameter requires activation initialization lowering');
  if(n.type==='CatchClause')for(const id of names(n.param))if(binding(id))site(id,'catch-binding','unsupported','selected catch binding requires initialization lowering');
  if(['ForInStatement','ForOfStatement'].includes(n.type)){const selected=n.left.type==='VariableDeclaration'&&n.left.declarations.some(d=>names(d.id).some(binding));site(n,'loop-binding',n.left.type!=='VariableDeclaration'||selected?'unsupported':'excluded',n.left.type!=='VariableDeclaration'||selected?'loop assignment requires statement lowering':'loop local outside supplied cell contract');}
  return raw(n);
 }
 const code=render(ast),manifest={version:1,coverage:'Supplied lexical cells and classified member/native sites only; not a whole-game coverage claim',sourceSHA256:sha(source),generatedSHA256:sha(code),parser:`acorn-${acorn.version}`,facade,bindings:contracts,exclusions:ranges,nativeContracts:options.nativeContracts||{},sites,complete:sites.every(s=>s.status!=='unsupported')};
 if(options.failUnsupported&&!manifest.complete){const error=Error('Unsupported game mutation/call sites');error.manifest=manifest;throw error;}
 return {code,manifest};
}

/** Explicit source-pinned module fences; missing/unbalanced markers fail the build. */
export function markerExclusions(source,modules){return modules.map(({begin,end,reason})=>{const start=source.indexOf(begin),finish=source.indexOf(end,start+begin.length);if(start<0||finish<0)throw Error('Missing excluded module fence: '+begin);return {start,end:finish+end.length,reason};});}

/** Selects executable inline scripts; callers explicitly pin any module exclusion ranges. */
export function transformInlineScripts(html,options={}){const scripts=[];for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){if(/\bsrc\s*=|\btype\s*=\s*['"]text\/plain/i.test(m[1]))continue;const offset=m.index+m[0].indexOf('>')+1;scripts.push({offset,...transformWrites(m[2],options)});}return {htmlSHA256:sha(html),scripts};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [input,config]=process.argv.slice(2);if(!input)throw Error('Usage: node --expose-internals tools/game-write-transform.mjs INPUT_JS [OPTIONS_JSON]');const result=transformWrites(fs.readFileSync(input,'utf8'),config?JSON.parse(fs.readFileSync(config,'utf8')):{});process.stdout.write(JSON.stringify(result)+'\n');}
