// What the advisor knows before it reads the realm: the rules it searches (the README and the guide to the screen, embedded in
// the page as the bridge would bundle them), the paragraph a question finds, and the primer its brief carries.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rulesFiles,rulesText} from './embed-advisor.mjs';

const root=new URL('..',import.meta.url).pathname,html=fs.readFileSync(root+'index.html','utf8'),bridge=fs.readFileSync(root+'advisor/furlong-advisor.mjs','utf8');
const embedded=id=>{const m=html.match(new RegExp(`<script type="text/plain" id="${id}">\\n([\\s\\S]*?)\\n</script>`));assert.ok(m,'no #'+id);return m[1];};
const esc=t=>t.replace(/<\/script/gi,'<\\/script');
const corpus='\n'+embedded('advrules')+'\n'; // the page's #advrules as its textContent reads

/* the bridge's search, lifted out of the bridge without starting its server */
const bridgeSearch=()=>{const a=bridge.indexOf('const RULES ='),b=bridge.indexOf('for (const f of RULES)');return new Function(bridge.slice(a,b)+';return{addDocs,searchDocs,DOCS};')();};
/* the page's search, ADVCHAT's rules methods over the embedded corpus */
const pageSearch=()=>{const a=html.indexOf('  RSTOP:new Set('),b=html.indexOf('\n  toolList(){',a);
  return vm.runInNewContext('const ADVCHAT=({'+html.slice(a,b)+'});ADVCHAT',{document:{getElementById:id=>id==='advrules'?{textContent:corpus}:null}});};

test('the embedded bridge and rules are the sources as they stand (run node tools/embed-advisor.mjs, or tools/stamp.sh, after changing them)',()=>{
  assert.deepEqual(rulesFiles(bridge),['README.md','docs/UI-GUIDE.md'],'the rules are the player-facing docs only');
  assert.ok(embedded('advbridge')===esc(bridge),'index.html carries a stale advisor bridge: run node tools/embed-advisor.mjs');
  assert.ok(embedded('advrules')===esc(rulesText(root,rulesFiles(bridge))),'index.html carries stale rules (README.md or docs/UI-GUIDE.md changed): run node tools/embed-advisor.mjs');
});

test('a question finds the paragraph that answers it',()=>{
  const B=bridgeSearch();B.addDocs('README.md',corpus);
  const tax=B.searchDocs('how do I raise taxes')[0],walls=B.searchDocs('how do walls get built')[0];
  assert.equal(tax.rules,'docs/UI-GUIDE.md › Taxes and dues');assert.match(tax.text,/crown tax rate/);assert.ok(tax.text.length<1500,'a paragraph, not a section');
  assert.match(walls.text,/^- \*\*Walls\*\* are paid for by the burghers' murage and raised/);
  assert.match(B.searchDocs('what do the speeds mean')[0].rules,/Speeds/);
  assert.deepEqual(B.searchDocs('how do i'),[],'stop words alone find nothing');
});

test('the page searches the rules exactly as the bridge does',()=>{
  const B=bridgeSearch(),P=pageSearch();B.addDocs('README.md',corpus);
  for(const q of ['how do I raise taxes','how do walls get built','what do the speeds mean','how do I save the game','how do petitions work','how do I march an army','why is my town hungry','legitimacy','dragon'])
    assert.deepEqual(JSON.parse(JSON.stringify(P.rules(q))),B.searchDocs(q),q);
});

test('the brief and the bridge carry the same primer: the screen, stable names, async presses, and a speed legend',()=>{
  const primer=html.match(/const ADV_PRIMER=`([\s\S]*?)`;/)[1];
  assert.match(primer,/Speeds \(realm\.speed\): 0 paused, 1 Normal .*6 Life pace/);assert.match(primer,/Menu opens the panels/);assert.match(primer,/scope:command:argument/);
  assert.ok(bridge.includes(primer),'the bridge’s instructions say what the brief says');
  assert.match(html,/\$\{ADV_PRIMER\}\n\nThe realm now:/);
});

test('on the API-key path a tool’s own error reaches the model, so it can put the call right',async()=>{
  const source=html.split('/* ---------- API-key advisor (key stays in this tab\'s closure) ---------- */')[1].split('/* ---------- end API-key advisor ---------- */')[0];
  let n=0,last;const answer=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
  const sample=new Function('fetch',source+'\nreturn createAPIAdvisor;')(async(_,o)=>{last=JSON.parse(o.body);return{ok:true,json:async()=>++n===1?{status:'completed',output:[{type:'function_call',name:'execute',arguments:'{"tool":"crown:h-honour:9"}',call_id:'c1'}]}:answer('Done.')};})('k','model');
  await sample([],{tools:[{name:'execute',inputSchema:{type:'object'},execute:()=>{throw Error('no such control here now; discover() again');}}]});
  assert.match(last.input.at(-1).output,/no such control here now; discover\(\) again/);
});
