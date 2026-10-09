// CPU scoring for soaks and model runs. From a sampled V8/DevTools CPU profile it ranks the functions (self and total
// time) and the parts of the day by CPU, in ms per simulated day; a running hot list keeps those numbers for every
// run, so each run shows what grew or shrank since the last run of the same world. No dependencies.
import fs from 'node:fs';
import path from 'node:path';

// What simTick calls, in order: a sample belongs to the outermost of these on its stack.
export const DAY_PARTS=['ownershipTick','tickWeather','tickEconomy','tickPopulation','tickPolitics','tickMilitary','tickDomains','tickThreats','tickGrowth','tickLand','tickHistory','tickProjects','tickFolk','tickLivestock','tickShips','tickStone','tickTravel','tickErrands','tickMetro','tickTenure','tickJustice','tickStreets','tickChurches','tickCastles','tickCourts','tickInfill','tickSettlers','tickRepairs','tickVictory','tickWallWorks','tickGarrisons','tickCallToArms','tickMigration','tickMarket','tickHouseholds','tickWays','tickTitles','tickSovereign','tickEnvoys','routingPrepare','commoditySettleAll'];
const VM=new Set(['(root)','(program)','(idle)','(garbage collector)']);

/* Score a profile that covers `days` simulated days. Functions are named by their own name where only one function
   in the profile has it (so a name follows its function from build to build), otherwise name@line. Time outside
   simTick is '(outside the day)' (the harness, journal flushes, deferred callbacks); '(idle)' is not CPU and is left
   out of every total. Only the game's own functions are ranked (`game` tells them by script URL): the harness's and
   the runtime's own time is '(harness)', and their frames are left out of total time. Returns ms per day, largest first. */
export const gameScript=url=>/\.html?(?:[?#]|$)/.test(url||'');
export function scoreProfile(p,{days=1,parts=DAY_PARTS,game=gameScript}={}){
  const partSet=new Set(parts),byId=new Map(p.nodes.map(n=>[n.id,n])),parent=new Map();
  for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
  const nameOf=n=>n.callFrame.functionName||'(anonymous)',locs=new Map();
  for(const n of p.nodes){const f=n.callFrame,name=nameOf(n);if(!locs.has(name))locs.set(name,new Set());locs.get(name).add(f.url+':'+f.lineNumber+':'+f.columnNumber);}
  const key=new Map(),where=new Map();
  for(const n of p.nodes){const f=n.callFrame,name=nameOf(n);
    const k=VM.has(name)&&!f.url?name:locs.get(name).size===1&&name!=='(anonymous)'?name:`${name}@${f.lineNumber+1}`;key.set(n.id,k);
    if(!where.has(k)&&f.url)where.set(k,`${path.basename(f.url.split(/[?#]/)[0])||f.url}:${f.lineNumber+1}`);}
  const partMemo=new Map(),dayMemo=new Map(); // the outermost part on the stack; whether simTick is on it
  const climb=id=>{const chain=[];let c=id;while(c!==undefined&&!partMemo.has(c)){chain.push(c);c=parent.get(c);}
    let part=c===undefined?null:partMemo.get(c),inDay=c===undefined?false:dayMemo.get(c);
    for(let i=chain.length-1;i>=0;i--){const n=byId.get(chain[i]),name=nameOf(n);if(part===null&&partSet.has(name))part=name;if(name==='simTick')inDay=true;partMemo.set(chain[i],part);dayMemo.set(chain[i],inDay);}
    return part;};
  const self=new Map(),total=new Map(),part=new Map(),add=(m,k,v)=>m.set(k,(m.get(k)||0)+v);
  let busy=0,idle=0;const dt=p.timeDeltas||[];
  for(let i=0;i<p.samples.length;i++){const id=p.samples[i],t=(dt[i]||0)/1000,n=byId.get(id);if(!n)continue;const name=nameOf(n);
    if(name==='(idle)'){idle+=t;continue;}busy+=t;add(self,VM.has(name)&&!n.callFrame.url||game(n.callFrame.url)?key.get(id):'(harness)',t);
    const seen=new Set();for(let c=id;c!==undefined;c=parent.get(c)){const k=key.get(c),cn=byId.get(c);if(k==='(root)'||seen.has(k)||!game(cn.callFrame.url)&&!VM.has(nameOf(cn)))continue;seen.add(k);add(total,k,t);}
    const pt=climb(id);add(part,pt??(dayMemo.get(id)?'(simTick)':VM.has(name)?name:'(outside the day)'),t);}
  const perDay=m=>[...m].map(([k,v])=>[k,v/days]).sort((a,b)=>b[1]-a[1]);
  return {days,busyMs:busy,idleMs:idle,msDay:busy/days,parts:perDay(part),self:perDay(self),total:perDay(total),where:Object.fromEntries(where)};
}

// A compact score for keeping: every part, and the functions down to `min` ms/day (at most `top` of each).
export function compactScore(s,{top=80,min=0.01}={}){
  const cut=L=>Object.fromEntries(L.filter(([,v])=>v>=min).slice(0,top).map(([k,v])=>[k,+v.toFixed(3)]));
  const self=cut(s.self),total=cut(s.total);
  return {days:s.days,msDay:+s.msDay.toFixed(3),parts:Object.fromEntries(s.parts.map(([k,v])=>[k,+v.toFixed(3)])),self,total,
    where:Object.fromEntries(Object.entries(s.where).filter(([k])=>k in self||k in total))};
}

const f2=v=>v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2);
// Markdown tables: by part of the day, by function's own (self) time and by total time, in ms/day and share of CPU.
export function formatScore(s,{top=15,title=''}={}){
  const tot=s.msDay||1,table=(head,L,where)=>`| ${head} | ms/day | share |\n|---|---|---|\n`+L.slice(0,top).map(([k,v])=>`| ${k}${where&&where[k]?` (${where[k]})`:''} | ${f2(v)} | ${(100*v/tot).toFixed(1)}% |`).join('\n')+'\n';
  const L=o=>Array.isArray(o)?o:Object.entries(o).sort((a,b)=>b[1]-a[1]);
  return `${title?`### ${title}\n\n`:''}CPU ${f2(s.msDay)} ms per simulated day over ${s.days} days.\n\nBy part of the day:\n\n${table('part',L(s.parts))}\nBy function, own time:\n\n${table('function',L(s.self),s.where)}\nBy function, total time (including what it calls):\n\n${table('function',L(s.total),s.where)}`;
}

/* The hot list: one record per run and world, newest last, `keep` per tool and world. A record is
   {at, tool, world, seed, fate, coast, build, commit, load:[start,end], fault, ages:[{year, days, msDay, parts, self, total, where}]}.
   Returns the previous record of the same tool and world (null for the first). Written whole and renamed into place. */
export function readHotlist(file){try{const h=JSON.parse(fs.readFileSync(file,'utf8'));if(h&&Array.isArray(h.runs))return h;}catch{}return {schema:1,runs:[]};}
export function updateHotlist(file,record,{keep=30}={}){
  const h=readHotlist(file),same=r=>r.tool===record.tool&&r.world===record.world,prev=h.runs.filter(same).at(-1)||null;
  h.runs.push(record);const mine=h.runs.filter(same);if(mine.length>keep){const drop=new Set(mine.slice(0,mine.length-keep));h.runs=h.runs.filter(r=>!drop.has(r));}
  fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(h));fs.renameSync(tmp,file);
  return prev;
}

/* The top `top` functions (own time) and parts of the latest age, with ms/day at every age and the change at that
   age since `prev` (the same world's previous run; at the same year, else its latest age, said so). */
export function hotlistReport(rec,prev,{top=10}={}){
  if(!rec.ages.length)return `${rec.world}: no profiled year.\n`;
  const last=rec.ages.at(-1),pa=prev?prev.ages.find(a=>a.year===last.year)||prev.ages.at(-1):null;
  const ageHead=rec.ages.map(a=>`y${a.year}`).join(' | '),sep=rec.ages.map(()=>'---').join('|');
  const delta=(v,w)=>w===undefined?'new':`${v-w>=0?'+':'−'}${f2(Math.abs(v-w))}${w>0?` (${v-w>=0?'+':'−'}${Math.abs(100*(v-w)/w).toFixed(0)}%)`:''}`;
  const rows=(kind,ranked)=>ranked.slice(0,top).map(([k,v])=>`| ${k}${last.where?.[k]&&kind!=='parts'?` (${last.where[k]})`:''} | ${rec.ages.map(a=>a[kind][k]===undefined?'–':f2(a[kind][k])).join(' | ')} | ${pa?delta(v,pa[kind][k]):'–'} |`).join('\n');
  const gone=kind=>{if(!pa)return '';const now=new Set(Object.entries(last[kind]).sort((a,b)=>b[1]-a[1]).slice(0,top).map(e=>e[0]));
    const left=Object.entries(pa[kind]).sort((a,b)=>b[1]-a[1]).slice(0,top).filter(([k])=>!now.has(k));
    return left.length?`\nLeft the top ${top}: ${left.map(([k,v])=>`${k} ${f2(v)} → ${last[kind][k]===undefined?'below the list':f2(last[kind][k])}`).join('; ')}.\n`:'';};
  const since=prev?`change at y${last.year} since ${prev.at.slice(0,16).replace('T',' ')} UTC (build ${prev.build}${prev.commit?' / '+prev.commit:''}${pa.year!==last.year?`; that run's latest profiled year was y${pa.year}`:''}; load ${prev.load?.map(x=>x.toFixed(0)).join('→')})`:'first run of this world in the hot list';
  const fault=[rec,prev].filter(Boolean).filter(r=>r.fault).map(r=>`${r===rec?'this run':'the previous run'} faulted from day ${r.fault.day} (${r.fault.part}), so its later years are no baseline`);
  const ranked=kind=>Object.entries(last[kind]).sort((a,b)=>b[1]-a[1]);
  return `### ${rec.world} (${rec.tool}, build ${rec.build}${rec.commit?' / '+rec.commit:''}, load ${rec.load?.map(x=>x.toFixed(0)).join('→')})\n\n`+
    `CPU ms per simulated day at each profiled year; the last column is the ${since}.${fault.length?' Note: '+fault.join('; ')+'.':''}\n\n`+
    `| function, own time | ${ageHead} | change |\n|---|${sep}|---|\n${rows('self',ranked('self'))}\n${gone('self')}\n`+
    `| part of the day | ${ageHead} | change |\n|---|${sep}|---|\n${rows('parts',ranked('parts'))}\n${gone('parts')}\n`+
    `| all CPU | ${rec.ages.map(a=>f2(a.msDay)).join(' | ')} | ${pa?delta(last.msDay,pa.msDay):'–'} |\n|---|${sep}|---|\n`;
}
