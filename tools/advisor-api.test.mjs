import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.split('/* ---------- API-key advisor (key stays in this tab\'s closure) ---------- */')[1].split('/* ---------- end API-key advisor ---------- */')[0];
const make=fetch=>new Function('fetch',source+'\nreturn createAPIAdvisor;')(fetch);
const answer=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
const response=data=>({ok:true,json:async()=>data});
const call=(name,args='{}')=>({type:'function_call',name,arguments:args,call_id:'call-1'});

test('key goes only to fixed OpenAI endpoint; game context and model are sent without storing the response',async()=>{
  let request,rendered;
  const sample=make(async(url,opts)=>{request={url,opts};return response(answer('Your granary is full.'));})('test-key','gpt-5-mini');
  assert.deepEqual(await sample([{role:'user',content:'How is my granary?'}],{onText:({text})=>rendered=text}),{text:'Your granary is full.',truncated:false});
  assert.equal(rendered,'Your granary is full.');assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.opts.headers.Authorization,'Bearer test-key');assert.equal(request.opts.credentials,'omit');assert.equal(request.opts.redirect,'error');
  const body=JSON.parse(request.opts.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-5-mini');assert.equal(request.opts.body.includes('test-key'),false);
});

test('reuses the current game tools and returns their results with reasoning context',async()=>{
  let requests=[],executed;
  const sample=make(async(_,opts)=>{requests.push(JSON.parse(opts.body));return response(requests.length===1?{status:'completed',output:[{type:'reasoning',encrypted_content:'opaque'},call('state','{"path":"realm"}')]}:answer('Population: 42.'));})('test-key','model');
  const result=await sample([{role:'user',content:'Population?'}],{tools:[{name:'state',description:'Read realm',inputSchema:{type:'object'},execute:args=>{executed=args;return '{"population":42}';}}]});
  assert.equal(result.text,'Population: 42.');assert.deepEqual(executed,{path:'realm'});
  assert.equal(requests[0].tools[0].type,'function');assert.equal(requests[0].tools[0].strict,false);
  assert.equal(requests[1].input.at(-1).output,'{"population":42}');assert.equal(requests[1].input.at(-1).call_id,'call-1');
  assert.equal(requests[1].input.some(x=>x.type==='reasoning'),true);
});

test('unknown tools and malformed arguments do not execute game actions',async()=>{
  for(const invocation of [call('unknown'),call('state','bad JSON'),call('state','[]')]){
    let count=0,executed=false,last;
    const sample=make(async(_,opts)=>{last=JSON.parse(opts.body);return response(++count===1?{status:'completed',output:[invocation]}:answer('Could not do that.'));})('test-key','model');
    await sample([],{tools:[{name:'state',inputSchema:{type:'object'},execute:()=>{executed=true;}}]});
    assert.equal(executed,false);assert.match(last.input.at(-1).output,/error/);
  }
});

test('API failures do not expose provider text that might echo a key',async()=>{
  for(const [status,code] of [[402,'api_credit'],[401,'api_key_invalid'],[403,'api_access'],[429,'api_limit'],[404,'api_model'],[400,'api_request']]){
    let read=false;
    const sample=make(async()=>({ok:false,status,json:async()=>{read=true;return {error:{message:'test-key'}};}}))('test-key','model');
    await assert.rejects(sample([]),e=>e.code===code&&!e.message.includes('test-key'));assert.equal(read,false);
  }
});

test('stopping before or during a request prevents further requests and game actions',async()=>{
  const before=new AbortController();before.abort();let fetched=false;
  await assert.rejects(make(async()=>{fetched=true;})('test-key','model')([],{signal:before.signal}),e=>e.code==='cancelled');assert.equal(fetched,false);
  const during=new AbortController();let executed=false;
  const sample=make(async()=>{during.abort();return response({status:'completed',output:[call('execute')]});})('test-key','model');
  await assert.rejects(sample([],{signal:during.signal,tools:[{name:'execute',execute:()=>{executed=true;}}]}),e=>e.code==='cancelled');assert.equal(executed,false);
});

test('incomplete, malformed and refused responses remain failures',async()=>{
  for(const [data,code] of [[{status:'incomplete',output:[]},'api_incomplete'],[{status:'completed',output:[]},'api_response'],[{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Cannot help.'}]}]},'refused']])
    await assert.rejects(make(async()=>response(data))('test-key','model')([]),e=>e.code===code);
});

test('bounds requests and tool execution instead of retrying indefinitely',async()=>{
  let fetched=0,executed=0;
  const sample=make(async()=>{fetched++;return response({status:'completed',output:[call('state')]});})('test-key','model');
  await assert.rejects(sample([],{tools:[{name:'state',inputSchema:{type:'object'},execute:()=>{executed++;return 'ok';}}]}),e=>e.code==='api_tool_limit');
  assert.equal(fetched,8);assert.equal(executed,7);
});

test('Claude native account path remains the default when its host capability is present',async()=>{
  assert.match(html,/if\(window\.claude&&window\.claude\.use\)\{ADV\.claudeDialog\(box\);return;\}/);
  const init=html.split('  async init(){')[1].split("  useAPI(key,model,provider='openai'){")[0].trim().replace(/},$/,'}');
  let capability;
  const nativeSample=Object.assign(()=>{}, {limits:async()=>({tools:true})});
  const claude={use:async name=>{capability=name;return nativeSample;}},chat={};
  await new Function('window','claude','ADVCHAT','return (async function(){'+init+')();')({claude},claude,chat);
  assert.equal(capability,'sample');assert.equal(chat.sample,nativeSample);assert.equal(chat.state,'ready');assert.equal(chat.provider,'Claude');assert.equal(chat.tools,true);
  assert.equal(source.includes('localStorage'),false);assert.equal(source.includes('sessionStorage'),false);
});

test('OpenRouter keeps tool calls and results on its fixed endpoint with full conversation context',async()=>{
  const requests=[];
  const sample=make(async(url,opts)=>{requests.push({url,opts,body:JSON.parse(opts.body)});return response(requests.length===1?{status:'completed',output:[{type:'reasoning',summary:[],encrypted_content:'opaque'},call('state','{"path":"realm"}')]}:answer('Population: 42.'));})('router-test-key','openai/gpt-5-mini','openrouter');
  const messages=[{role:'user',content:'Advisor brief'},{role:'assistant',content:'Earlier answer'},{role:'user',content:'Population?'}];
  assert.equal((await sample(messages,{tools:[{name:'state',inputSchema:{type:'object'},execute:()=>({population:42})}]})).text,'Population: 42.');
  for(const {url,opts,body} of requests){
    assert.equal(url,'https://openrouter.ai/api/v1/responses');assert.equal(opts.headers.Authorization,'Bearer router-test-key');
    assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');assert.equal(body.model,'openai/gpt-5-mini');assert.equal(body.store,false);
    assert.equal('previous_response_id' in body,false);assert.equal('include' in body,false);assert.deepEqual(body.input.slice(0,3),messages);
    assert.equal(body.parallel_tool_calls,false);assert.equal(body.tools[0].name,'state');assert.equal(opts.body.includes('router-test-key'),false);
  }
  assert.equal(requests[1].body.input.at(-1).output,'{"population":42}');assert.equal(requests[1].body.input.at(-1).call_id,'call-1');
  assert.equal(requests[1].body.input.some(x=>x.encrypted_content==='opaque'),true);
});

test('provider and model validation prevents arbitrary key destinations and accepts OpenRouter model slugs',()=>{
  let fetched=false;const factory=make(async()=>{fetched=true;});
  for(const provider of ['https://example.com','__proto__','constructor','unknown'])assert.throws(()=>factory('key','openai/gpt-5-mini',provider));
  for(const model of ['gpt-5-mini','openai/gpt-5-mini?key=secret','openai/../model','openai/model extra'])assert.throws(()=>factory('key',model,'openrouter'));
  for(const model of ['openai/gpt-5-mini','anthropic/claude-sonnet-4.5','vendor/model:free'])assert.equal(typeof factory('key',model,'openrouter'),'function');
  assert.throws(()=>factory('key','openai/gpt-5-mini','openai'));assert.equal(fetched,false);
});

test('switching provider aborts the old request and clears conversation without retaining the key',()=>{
  const methods=html.split("  useAPI(key,model,provider='openai'){")[1].split('  clip(v,n){')[0];
  const chat={busy:new AbortController(),turns:[{role:'user',content:'old context'}]};const old=chat.busy;let cleared=0,removed=0;
  const document={getElementById:id=>id==='achlog'?{replaceChildren:()=>cleared++}:id==='advchat'?{remove:()=>removed++}:null};
  const api=new Function('fetch','ADVCHAT','document',source+"\nreturn {useAPI(key,model,provider='openai'){"+methods+'};')(async()=>response(answer('ok')),chat,document);
  api.useAPI('router-test-key','openai/gpt-5-mini','openrouter');
  assert.equal(old.signal.aborted,true);assert.equal(chat.provider,'OpenRouter');assert.equal(chat.apiProvider,'openrouter');assert.deepEqual(chat.turns,[]);assert.equal(cleared,1);
  assert.equal(JSON.stringify(chat).includes('router-test-key'),false);
  api.disconnectAPI();assert.equal(chat.sample,null);assert.deepEqual(chat.turns,[]);assert.equal(removed,1);
});
