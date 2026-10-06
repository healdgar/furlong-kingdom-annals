#!/usr/bin/env node
/* The advisor's surface, live: boots the game in headless Chrome (worker build, seed 1001, fate 42, sea, 1440×900) and drives
   window.FURLONG as an agent would, recording what it can find, read and press. Built from the advisor audit (#32); it reruns the
   audit's live checks and tolerates an older build that lacks a verb (the step records the error).
     node tools/advisor-live-check.mjs --out <fresh dir> [--html <index.html>]
   One Chrome, one page, a hard timeout. It never presses Reforge or a load, and answers any JS dialog with Cancel. The page and
   Chrome's profile live in --out; the profile is removed at the end. results.json there. Exit 0 ok, 1 a check failed, 2 setup. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const A=Object.fromEntries(process.argv.slice(2).reduce((o,x,i,a)=>(x.startsWith('--')&&o.push([x.slice(2),a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:true]),o),[]));
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),HTML=path.resolve(A.html||path.join(ROOT,'index.html'));
const HARD_MS=12*60*1000,BOOT_MS=4*60*1000;
const CHROME=A.chrome||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

class CDP{
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=()=>rej(Error('websocket failed'));});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data),w=this.wait.get(m.id);if(w){this.wait.delete(m.id);m.error?w.rej(Error(m.error.message)):w.res(m.result);}else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(Error('Chrome closed'));this.wait.clear();};}
  send(method,params={}){const id=++this.n;return new Promise((res,rej)=>{this.wait.set(id,{res,rej});this.ws.send(JSON.stringify({id,method,params}));});}
  on(m,f){if(!this.subs.has(m))this.subs.set(m,[]);this.subs.get(m).push(f);}
  async eval(expression){let timer;const r=await Promise.race([this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}),new Promise((_,rej)=>{timer=setTimeout(()=>rej(Error('evaluate timed out: '+expression.slice(0,120))),60000);})]).finally(()=>clearTimeout(timer));
    if(r.exceptionDetails)throw Error((r.exceptionDetails.exception?.description||r.exceptionDetails.text).slice(0,500));return r.result.value;}
  close(){try{this.ws.close();}catch{}}
}

/* one worker hook, as tools/speed-check.mjs does: FURLONG_WORKER_AUDIT arms a petition raised at the end of the next worker tick */
const MARK='function simulationWorkerRuntime(){';
const INJECT=`\nlet __arm=false;globalThis.FURLONG_WORKER_AUDIT=p=>{__arm=true;return{ok:1};};
const __t=simTick;simTick=function(){const r=__t.apply(this,arguments);if(__arm){__arm=false;W.player.pause=true;petition({key:'advisor-check',to:W.player.house|0,title:'A reeve’s petition',pos:W.capital.pos,days:30,ai:0,text:'The reeve of a hungry village asks leave to open the granary at the purse of the crown; the cost is 100 gold.',opts:[{label:'Open the granary',cost:100,act(){}},{label:'Refuse the reeve',act(){}}]});}return r;};\n`;

const READY=`document.getElementById('loading')===null&&typeof renderer!=='undefined'&&!!renderer&&!!W&&!!BACKGROUND&&!BACKGROUND.closed&&(G.workerRevision||0)>0&&!!document.getElementById('speedselect')`;
const UI=`(()=>({tab:drawerTab,drawerClosed:document.getElementById('drawer').classList.contains('closed'),drawerInert:document.getElementById('drawer').inert,hudInert:document.getElementById('hud').inert,menuHidden:document.getElementById('toolmenu').hidden,
  ctxKind:contextUI.kind,ctxExpanded:contextUI.expanded,inspView:inspectorView,placeMode,saveboxOpen:document.getElementById('savebox').style.display,advchatInert:(document.getElementById('advchat')||{}).inert??null,speed:speedIdx,sov:!!(W.player&&W.player.on),petitions:W.petitions.length,day:day()}))()`;
const DISC=`(async scope=>{const r=await FURLONG.discover(scope),by={};for(const x of r.tools){const s=x.kind==='verb'?'verb':String(x.scope||'').replace(/^drawer:/,'');by[s]=(by[s]||0)+1;}
  return{scopes:r.scopes,total:r.tools.length,by,tools:r.tools.filter(x=>x.kind!=='verb').map(x=>({name:x.name,label:x.label,disabled:!!x.disabled,why:x.why,cost:x.cost,target:x.target,risk:x.risk,place:x.place,kind:x.kind,view:x.view})),verbs:r.tools.filter(x=>x.kind==='verb').map(x=>x.name)};})`;

async function launch(dir){
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    '--allow-file-access-from-files',...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:[]),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  let c,b;const kill=()=>{c?.close();b?.close();try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{kill();process.exit(sig==='SIGINT'?130:143);});
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(Error('Chrome did not start')),30000);p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',x=>{clearTimeout(t);rej(Error('Chrome exited '+x));});});
    const pg=(await (await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json()).find(t=>t.type==='page');
    c=new CDP(pg.webSocketDebuggerUrl);b=new CDP(ws);await Promise.all([c.open,b.open]);return{c,b,kill};
  }catch(e){kill();throw e;}
}

async function main(){
  if(!CHROME){console.error('no Chrome found: pass --chrome <path>');return 2;}
  if(typeof WebSocket!=='function'){console.error('Node 22+ needed (global WebSocket)');return 2;}
  if(!A.out||A.out===true){console.error('--out <fresh dir> is required');return 2;}
  const OUT=path.resolve(A.out);if(fs.existsSync(OUT)){console.error('refusing to overwrite '+OUT+'; choose a fresh --out directory');return 2;}
  fs.mkdirSync(OUT,{recursive:true});
  const SRC=fs.readFileSync(HTML,'utf8');if(!SRC.includes(MARK)){console.error('index.html lacks the worker runtime marker');return 2;}
  fs.writeFileSync(path.join(OUT,'index.html'),SRC.replace(MARK,INJECT+MARK));try{fs.symlinkSync(path.join(path.dirname(HTML),'assets'),path.join(OUT,'assets'));}catch{}
  const PAGE=pathToFileURL(path.join(OUT,'index.html')).href+'#s=1001&f=42&c=sea&fresh=1';
  const R={schema:1,html:HTML,started:new Date().toISOString(),loadavgStart:os.loadavg(),steps:{},checks:{},dialogs:[],exceptions:[],consoleErrors:[]};
  const save=()=>fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(R,null,1));
  const {c,b,kill}=await launch(fs.mkdtempSync(path.join(OUT,'chrome-profile-')));
  const hard=setTimeout(()=>{R.failure='hard timeout';save();kill();process.exit(3);},HARD_MS);
  try{
    R.chrome=(await b.send('Browser.getVersion')).product;
    await c.send('Page.enable');await c.send('Runtime.enable');
    c.on('Runtime.exceptionThrown',p=>R.exceptions.push((p.exceptionDetails.exception?.description||p.exceptionDetails.text).slice(0,400)));
    c.on('Runtime.consoleAPICalled',p=>{if(p.type==='error')R.consoleErrors.push(p.args.map(a=>a.value!==undefined?String(a.value):a.description||'').join(' ').slice(0,300));});
    c.on('Page.javascriptDialogOpening',p=>{R.dialogs.push({type:p.type,message:String(p.message).slice(0,120)});c.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
    const ev=x=>c.eval(x),D=scope=>ev(`(${DISC})(${scope===undefined?'undefined':JSON.stringify(scope)})`),X=(tool,args)=>ev(`FURLONG.execute(${JSON.stringify(tool)},${JSON.stringify(args||{})})`),U=()=>ev(UI);
    const step=async(name,fn)=>{const t=Date.now();try{R.steps[name]=await fn();}catch(e){R.steps[name]={error:String(e.message||e)};}if(R.steps[name]&&typeof R.steps[name]==='object')R.steps[name]._ms=Date.now()-t;save();return R.steps[name];};
    const check=(name,ok,detail)=>{R.checks[name]={ok:!!ok,...(detail!==undefined?{detail}:{})};save();};
    const waitFor=async(expr,ms=15000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await ev(expr).catch(()=>false))return true;await sleep(200);}return false;};
    const pick=(d,re,scope)=>(d.tools||[]).filter(t=>!scope||String(t.name).replace(/^drawer:/,'').startsWith(scope+':')).find(t=>re.test(t.name)||re.test(t.label||''))?.name;
    const cmdNames=d=>(d.tools||[]).map(t=>t.name).filter(n=>/:(h-|s-|a-|lord|decree|sov|notable|army|camp-len|storage)/.test(n)).sort();

    await c.send('Page.navigate',{url:PAGE});
    const t0=Date.now();while(!await ev(READY).catch(()=>false)){if(Date.now()-t0>BOOT_MS)throw Object.assign(Error('boot timed out'),{exit:2});await sleep(500);}
    R.bootMs=Date.now()-t0;await ev('setSpeed(0)');await sleep(800);
    const cap=await ev('W.capital.name'),capCode=await ev('"s"+W.settlements.indexOf(W.capital)');R.capital=cap;

    /* ---------- the watcher ---------- */
    const boot=await step('W1_boot_discover',async()=>{const d=await D();return{total:d.total,by:d.by,scopes:d.scopes,verbs:d.verbs,ui:await U()};});
    check('boot: drawer tabs reachable with the drawer closed',['crown','rates','acts','over','world'].every(s=>boot.by?.[s]>0),boot.by);
    const insp=await step('W2_inspect_then_discover',async()=>{const r=await X('game:inspect',{name:cap});await sleep(400);const d=await D();return{code:r?.code,error:r?.error,cardTools:(r?.tools||[]).length,total:d.total,by:d.by,scopes:d.scopes,ui:await U()};});
    check('after inspect: drawer and card both reachable',insp.by?.rates>0&&insp.by?.card>0,insp.by);
    const menu=await step('W3_menu',async()=>{const d=await D('menu');return{count:d.total,names:d.tools.map(t=>t.name)};});
    check('menu items listed without opening the menu',menu.count>=10,menu.count);
    await step('W4_inspect_by_code_full',async()=>{const r=await X('game:inspect',{code:capCode,full:true});return{error:r?.error,code:r?.code,len:(r?.card||'').length,hasAccounts:/balance sheet|Accounts/i.test(r?.card||''),hasHouseholds:/Households/.test(r?.card||''),links:(r?.links||[]).length};});
    check('inspect by code, full card',R.steps.W4_inspect_by_code_full.code===capCode&&R.steps.W4_inspect_by_code_full.len>4000,R.steps.W4_inspect_by_code_full);
    await step('W5_close_card',async()=>{const d=await D('context');const close=pick(d,/close/i,'context');const r=close?await X(close):null;await sleep(300);return{close,r,ui:await U()};});
    const place=await step('W6_place_and_cancel',async()=>{const d=await D('acts'),fire=pick(d,/fire/i,'acts');if(!fire)return{error:'no fire act',names:d.tools.map(t=>t.name)};
      const lines=async()=>(await X('game:chronicle',{n:200})).map(x=>typeof x==='string'?x:x.text).filter(x=>/fire/i.test(x)).length;
      const f0=await lines(),p1=await X(fire),m1=await ev('placeMode'),pl1=await X('game:place',{at:cap});await sleep(600);const m2=await ev('placeMode'),pl2=await X('game:place',{at:cap});await sleep(400);const f1=await lines();
      const p2=await X(fire),m3=await ev('placeMode'),cancel=await X('game:place',{cancel:true}),m4=await ev('placeMode');
      return{fire,press:p1,modeAfterPress:m1,place1:pl1,modeAfterPlace:m2,place2:pl2,fireLines:f1-f0,modeBeforeCancel:m3,cancel,modeAfterCancel:m4};});
    check('game:place clears its mode (one fire, not two)',place.modeAfterPlace===null&&place.place2?.error&&place.fireLines<=1,{modeAfterPlace:place.modeAfterPlace,place2:place.place2,fireLines:place.fireLines});
    check('game:place {cancel:true}',place.modeBeforeCancel&&place.modeAfterCancel===null,{before:place.modeBeforeCancel,after:place.modeAfterCancel});

    /* ---------- the ruler ---------- */
    await step('R0_take_crown',async()=>{const d=await D();const rule=pick(d,/sov-on|take-the-crown|^hud:rule$/i);const r=rule?await X(rule):null;const ok=await waitFor('!!(W.player&&W.player.on)',15000);await sleep(1200);return{rule,result:r,ruler:ok};});
    const ruler=await step('R1_ruler_discover',async()=>{const d=await D();return{total:d.total,by:d.by,scopes:d.scopes,crown:d.tools.filter(t=>/^(drawer:)?crown:/.test(t.name)).map(t=>t.name+(t.disabled?' [disabled: '+(t.why||'')+']':'')+(t.cost?' ['+t.cost+' g]':'')+(t.target?' ['+(t.target.name||t.target.code)+']':''))};});
    const tax=await step('R2_tax_reply',async()=>{const d=await D('crown'),t=pick(d,/(^|:)tax$|crown-tax|tax-rate/i,'crown');if(!t)return{error:'no tax control',names:d.tools.map(x=>x.name)};
      const r=await X(t,{value:20}),rates=await X('game:state',{path:'rates'}),bad=await X(t,{value:99});return{tool:t,result:r,taxAfter:rates?.tax,outOfRange:bad};});
    check('execute returns the worker’s reply',tax.result?.worker?.length>0&&tax.taxAfter===20,{result:tax.result,taxAfter:tax.taxAfter});
    check('a value out of range is refused',!!tax.outOfRange?.error,tax.outOfRange);
    const card=await step('R3_card_orders',async()=>{await X('game:inspect',{name:cap});await sleep(500);const d=await D('card'),orders=d.tools.find(t=>t.view==='orders')?.name||pick(d,/orders/i,'card');
      const r=orders?await X(orders):null;await sleep(300);const ui=await U(),hud=await D('hud');return{tools:d.tools.map(t=>t.name),orders,press:r,expanded:ui.ctxExpanded,view:ui.inspView,hudTools:hud.total};});
    check('card orders reachable without pressing Orders',card.tools?.some(n=>/relief/.test(n)),card.tools);
    check('pressing Orders does not expand the card',card.expanded===false,card);
    const stable=await step('R4_names_stable_across_days',async()=>{const a=cmdNames(await D('card')).concat(cmdNames(await D('crown')));const d0=await ev('day()');await ev('setSpeed(3)');await sleep(3500);await ev('setSpeed(0)');await sleep(1500);
      const b2=cmdNames(await D('card')).concat(cmdNames(await D('crown')));return{days:await ev('day()')-d0,before:a.length,after:b2.length,lost:a.filter(n=>!b2.includes(n)),gained:b2.filter(n=>!a.includes(n))};});
    check('names stable across days',stable.days>0&&stable.before>0&&stable.lost.length===0,stable);
    const relief=await step('R5_relief_reply',async()=>{const d=await D('card'),t=d.tools.find(x=>/s-relief|relief/.test(x.name)&&!x.disabled)?.name;if(!t)return{error:'no relief order',names:d.tools.map(x=>x.name)};
      const g0=await ev('W.treasury'),r=await X(t);await sleep(300);return{tool:t,result:r,spent:g0-await ev('W.treasury')};});
    check('a card order answers with the worker’s reply and its annals',relief.result?.worker?.length>0,relief.result);
    await step('R6_advchat_not_inert',async()=>{await ev(`ADVCHAT.sample=async()=>({text:'ok'});ADVCHAT.state='ready';ADVCHAT.tools=true;ADVCHAT.open();`);await sleep(300);await ev('contextExpand(true)');await sleep(300);const inert=await ev(`document.getElementById('advchat').inert`);await ev('contextExpand(false)');return{inertWhileExpanded:inert};});
    check('the chat is not inert while a card is expanded',R.steps.R6_advchat_not_inert.inertWhileExpanded===false,R.steps.R6_advchat_not_inert);
    const sv=await step('R7_save_box',async()=>{const d=await D();const s=pick(d,/(^|:)save$/i,'menu')||pick(d,/save/i,'hud');if(!s)return{error:'no save control'};await X(s);await sleep(400);const all=await D(),dlg=await D('dialog');const hud=await D('hud');
      const close=await X('dialog:close');await sleep(200);return{save:s,scopes:all.scopes,dialogTools:dlg.tools.map(t=>t.name),hudTools:hud.total,close,after:await U()};});
    check('save box: controls listed and closable',sv.scopes?.includes('dialog')&&sv.dialogTools?.length>1&&sv.after?.saveboxOpen==='none',sv);
    await step('R8_storage_place',async()=>{const d=await D('card'),pickBtn=d.tools.find(t=>/storage-pick/.test(t.name))?.name;if(!pickBtn)return{error:'no storage site button',names:d.tools.map(t=>t.name)};const r=await X(pickBtn),cap2=await ev('W.capital.pos');
      const p=await X('game:place',{at:{x:cap2.x+60,z:cap2.z+40}});await sleep(800);return{press:r,place:p,mode:await ev('placeMode')};});
    const panels=await step('R9_panels',async()=>{const out={};for(const kind of ['crown','accounts','timeline','petitions','houses','plan']){const r=await X('game:panel',{kind});out[kind]=r?.error?{error:r.error}:{len:JSON.stringify(r).length,head:String(r?.text||'').slice(0,120)};}
      out.town=await X('game:panel',{kind:'accounts',town:cap}).then(r=>r?.error?{error:r.error}:{len:(r?.text||'').length});return out;});
    check('panel reads return data',['crown','accounts','timeline','houses'].every(k=>panels[k]?.len>200),panels);
    await step('R10_state_holes',async()=>{const r=await X('game:state',{path:'realm'}),s=await X('game:state',{path:'settlement:'+cap}),a=await X('game:state',{path:'armies'}),h=await X('game:state',{path:'houses'});
      return{realmKeys:Object.keys(r||{}),settlementKeys:Object.keys(s||{}),armyKeys:Object.keys((a||[])[0]||{}),houseKeys:Object.keys((h||[])[1]||{})};});
    await step('R11_chronicle_filters',async()=>{const war=await X('game:chronicle',{cat:'war',n:5}),range=await X('game:chronicle',{from:0,to:30,n:5});return{war,range};});
    await step('R12_plan_quote',async()=>{const p=await ev('W.capital.pos'),pts=[{x:p.x+80,z:p.z+80},{x:p.x+140,z:p.z+90}];return await X('game:plan',{kind:'street',points:pts});});
    await step('R13_rules',async()=>({taxes:await ev(`ADVCHAT.rules('how do I raise taxes')`),walls:await ev(`ADVCHAT.rules('how do walls get built')`)}));
    const pet=await step('R14_petition',async()=>{await ev(`BACKGROUND.request('view',{kind:'audit'})`);await ev('setSpeed(2)');const got=await waitFor('W.petitions.length>0',30000);await ev('setSpeed(0)');await sleep(800);
      const d=await D('petition'),state=await X('game:state',{path:'petitions'}),panel=await X('game:panel',{kind:'petitions'});return{arrived:got,tools:d.tools.map(t=>t.name),state,panel};});
    check('petitions read as objects with text and deadline',Array.isArray(pet.state)&&pet.state[0]?.text&&pet.state[0]?.due,pet.state);
    const link=await step('R15_link_people',async()=>ev(`(async()=>{const st=await FURLONG.execute('game:state',{path:'realm'}),name=st.monarch;const html=ADVCHAT.resolve?(await ADVCHAT.resolve('[['+name+']]'),ADVCHAT.md('[['+name+']]')):ADVCHAT.md('[['+name+']]');return{name,linked:/data-nm="n\\d+"/.test(html),html:html.slice(0,200)};})()`));
    check('chat links name lords and ladies through the worker',link.linked===true,link);
    R.promptsLeftOpen=R.dialogs.length;
  }catch(e){R.failure=String(e.stack||e);R.exit=e.exit??1;}
  finally{clearTimeout(hard);kill();}
  R.loadavgEnd=os.loadavg();R.finished=new Date().toISOString();R.failed=Object.entries(R.checks).filter(([,v])=>!v.ok).map(([k])=>k);save();
  console.log('results:',path.join(OUT,'results.json'),R.failure?'FAILED: '+R.failure:`${Object.keys(R.checks).length-R.failed.length}/${Object.keys(R.checks).length} checks pass`+(R.failed.length?'; failing: '+R.failed.join('; '):''));
  return R.failure?R.exit:R.failed.length?1:0;
}
main().then(code=>process.exit(code),e=>{console.error(e.stack||e);process.exit(2);});
