// Daughter villages are named from their mother's root with one affix, or for the man who led the pioneers out, and
// not at all from a daughter: the real naming code of index.html, loaded into a bare context.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {inlineGameScript} from './simulation-boundary.mjs';

const source=inlineGameScript(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
const slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,`cannot find ${a} … ${b}`);return source.slice(i,j);};
const TODAY=9000,ctx=vm.createContext({});
const run=code=>vm.runInContext(code,ctx);
run(`var SEED=1234567;var W={usedNames:new Set(),crownCult:'anglo'};const day=()=>${TODAY};`);
run(slice('function sfc32(','function seedStreams('));
run(slice('function ageYrs(','function trait('));
run(slice('function oldHouseholdHead(','function invalidateFolkIndex('));
run(slice('const CULT={','function siteFeatures('));
const TONGUES=[...run('Object.keys(CULT)')];
const fresh=(seed=1234567)=>{ctx.SEED=seed;ctx.W={usedNames:new Set(),crownCult:'anglo'};};
const stream=k=>run(`nameRng(${k})`);
const rootOf=(c,n)=>run(`rootOf(${JSON.stringify(c)},${JSON.stringify(n)})`);
// a village's people: men of every age, married and not, so the pioneers' leader has households to be taken from
const folk=(cult,names)=>names.map((gn,i)=>({sx:'m',gn,b:TODAY-(18+i*3)*360,dead:false,sp:{dead:false,si:0},si:0,ma:null}));
const mother=(cult,name,extra={})=>({name,cult,gen:undefined,folk:folk(cult,run(`CULT.${cult}.m.slice(0,8)`)),...extra});
const daughter=(cult,gen)=>({cult,gen});
const name=(m,s,k)=>{ctx.fr=m;ctx.s=s;ctx.k=k;return run('daughterName(s,fr,["farm","farm"],nameRng(k))');};
const plain=(c,k)=>run(`culturedName(${JSON.stringify(c)},["farm","farm"],nameRng(${k}))`);

// the words the tongue's own "new/upper/nether" patterns put on a name, counted independently of rootOf
const MARKS={anglo:/\b(?:New|Upper|Nether)\b/g,german:/Neu|Ober|Nieder/g,french:/Villeneuve-|-la-Neuve|-le-Haut/g,italian:/nuova|Borgo Nuovo di |Castelnuovo di /g,
  norse:/Ny(?=\p{L})|Øvre |Nedre /gu,slavic:/Nov|Horní |Dolní /g,celtic:/newydd/g,iberian:/Villanueva de |nueva| de Arriba/g};
const marks=(c,n)=>(n.match(MARKS[c])||[]).length;

test('every tongue has an affix vocabulary and a way of naming a place for a man',()=>{
  assert.deepEqual([...run('Object.keys(KIN)')].sort(),[...TONGUES].sort());
});

test('affixes come off a mother\'s name in her own tongue, however many are stacked',()=>{
  const cases={
    anglo:[['Nether New Thornwick','Thornwick'],['Upper New New Thornwick','Thornwick'],['New Nether New Nether Port-Neuf','Port-Neuf'],['Nether Nether Thornwick','Thornwick'],
      ['Great Yarmouth','Yarmouth'],['Little Rissington','Rissington'],['Lower Ashton','Ashton'],['Newbury','Newbury'],['Thornwick','Thornwick'],['St Albans','St Albans']],
    german:[['Neuburg','Burg'],['Nieder Neurosburg','Rosburg'],['Obermarburg','Marburg'],['Alt-Hirschberg','Hirschberg'],['Altburg','Altburg'],['Hohenburg','Hohenburg']],
    french:[['Villeneuve-Port-Neuf-la-Neuve','Port-Neuf'],['Villeneuve-Villeneuve-Beau-le-Haut','Beau'],['Haut-Clairval','Clairval'],['Petit-Pont-Neuf','Pont-Neuf'],
      ['Saint-Omer-la-Neuve','Saint-Omer'],['Saint-Lô','Saint-Lô'],['Grand-le-Gué','Grand-le-Gué'],['Pont-Grand','Pont-Grand'],['Neufville','Neufville']],
    italian:[['Pietranuova','Pietra'],['Borgo Nuovo di Fonte','Fonte'],['Castelnuovo di Rosa','Rosa'],['Alta Selva','Selva'],['Altaone','Altaone'],['Monte Verde','Monte Verde']],
    norse:[['Nysten','Sten'],['Øvre Askby','Askby'],['Nedre Nysten','Sten'],['Askby','Askby']],
    slavic:[['Novbelgrad','Belgrad'],['Horní Zlatbrod','Zlatbrod'],['Dolní Novstarý','Starý'],['Novgrad','Novgrad'],['Novice','Novice'],['Belgrad','Belgrad']],
    celtic:[['Tregwynnewydd','Gwyn'],['Moranewydd','Mora'],['Rhydgwyn','Rhydgwyn'],['Trecadell','Trecadell'],['Llan Isaf','Llan']],
    iberian:[['Villanueva de Rosa','Rosa'],['Rosanueva','Rosa'],['Rosa de Arriba','Rosa'],['Alta Vega','Vega'],['Villa Rosa','Villa Rosa'],['Nuevovilla','Nuevovilla']]
  };
  assert.deepEqual(Object.keys(cases).sort(),[...TONGUES].sort());
  for(const [c,list] of Object.entries(cases))for(const [from,to] of list)assert.equal(rootOf(c,from),to,`${c}: ${from}`);
});

test('a daughter takes at most one affix and keeps her mother\'s root (rule: root plus one)',()=>{
  const MOTHERS={anglo:'Thornwick',german:'Rosburg',french:'Beauval',italian:'Pietra',norse:'Askby',slavic:'Zlatbrod',celtic:'Gwynfach',iberian:'Rosa'};
  for(const c of TONGUES){
    let rooted=0;
    for(let k=1;k<=60;k++){
      fresh(k);const m=mother(c,MOTHERS[c]);m.folk=[]; // no leader: the root and its affix only
      const n=name(m,daughter(c,1),k);
      assert.ok(marks(c,n)<=1,`${c}: ${n}`);
      assert.equal(rootOf(c,n),rootOf(c,MOTHERS[c]),`${c}: ${n}`);
      if(n!==rootOf(c,MOTHERS[c]))rooted++;
    }
    assert.ok(rooted>50,`${c}: affixed daughters`);
  }
});

test('a mother already wearing an affix passes on only her root, then one new affix',()=>{
  for(const [c,mn] of [['anglo','Upper Thornwick'],['french','Villeneuve-Beauval-le-Haut'],['german','Neurosburg'],['italian','Pietranuova'],['slavic','Horní Zlatbrod'],['celtic','Gwynfachnewydd']]){
    const m=mother(c,mn);m.folk=[];
    for(let k=0;k<30;k++){fresh(7+k);const n=name(m,daughter(c,1),k);assert.ok(marks(c,n)<=1,`${c}: ${mn} → ${n}`);assert.ok(rootOf(c,n)===rootOf(c,mn),`${c}: ${mn} → ${n}`);}
  }
});

test('a daughter of a daughter is named like any new place, and never from the mother',()=>{
  for(const c of TONGUES)for(let k=1;k<=30;k++){
    const m=mother(c,'Zyxwick',{gen:1});
    fresh(k);ctx.W.usedNames.add('Zyxwick');const a=name(m,daughter(c,2),k);
    fresh(k);ctx.W.usedNames.add('Zyxwick');const b=plain(c,k); // the very name an ordinary site would have drawn
    assert.equal(a,b,c);assert.equal(marks(c,a),0,`${c}: ${a}`);assert.ok(!a.toLowerCase().includes('yxwick'),`${c}: ${a} borrows her mother's name`);
  }
  fresh(5);assert.equal(marks('anglo',name(mother('anglo','Aldricton',{gen:2}),daughter('anglo',3),9)),0); // and so on down the line
});

test('names after the pioneers\' leader follow each tongue\'s own pattern for a place named for a man',()=>{
  const PATTERN={
    anglo:g=>new RegExp(`^${g}(?:ton|ley|by|'s End|'s Green|' End|' Green)$`),
    german:g=>new RegExp(`^${g}s?(?:dorf|hausen|reuth|berg|burg)$`),
    french:g=>new RegExp(`^(?:${g}ville|Ville-${g}|La Ferté-${g}|${g}court|Villers-${g})$`),
    italian:g=>new RegExp(`^(?:Villa|Borgo|Casale|Castel) ${g}$`),
    norse:g=>new RegExp(`^${g}s?(?:by|stad|torp|heim)$`),
    slavic:g=>new RegExp(`^${g.replace(/[aeiouyáéíóúůýě]$/i,'')}(?:ov|ovice|ice|ovo)$`),
    celtic:g=>new RegExp(`^(?:Tre|Bally|Caer)${g.toLowerCase()}$`),
    iberian:g=>new RegExp(`^(?:Villa${g.toLowerCase().replace(/^a/,'')}|Torre de ${g}|Casas de ${g})$`)
  };
  for(const c of TONGUES){
    const men=run(`[...new Set([...CULT.${c}.m,...(NAMEX.${c}?NAMEX.${c}.m:[])])]`);
    assert.ok(men.length>20,c);
    for(const g of men)for(let k=0;k<4;k++){
      ctx.g=g;ctx.r=stream(k+1);const n=run(`KIN.${c}.man(g,r)`);
      assert.match(n,PATTERN[c](g),`${c}: ${g} → ${n}`);assert.equal(marks(c,n),0,`${c}: ${n}`);
    }
    // through the founding itself: when the draw favours the leader, the daughter is named for a man of the mother village
    const men8=run(`CULT.${c}.m.slice(0,8)`),named=new Set();
    for(let k=1;k<=80;k++){fresh(k);const n=name(mother(c,'Ashford'),daughter(c,1),k);if(men8.some(g=>PATTERN[c](g).test(n)))named.add(n);}
    assert.ok(named.size>=15,`${c}: ${named.size} ancestor names`);
  }
});

test('a leader is taken only from households of men in their prime, and nothing is disturbed taking him',()=>{
  fresh(3);
  const prime={sx:'m',gn:'Aldric',b:TODAY-30*360,dead:false,sp:{dead:false,si:0},si:0};
  const old={sx:'m',gn:'Osric',b:TODAY-60*360,dead:false,sp:null,si:0},boy={sx:'m',gn:'Hamon',b:TODAY-10*360,dead:false,sp:null,si:0},woman={sx:'f',gn:'Edith',b:TODAY-30*360,dead:false,sp:null,si:0},dead={sx:'m',gn:'Hugh',b:TODAY-30*360,dead:true,sp:null,si:0};
  const son={sx:'m',gn:'Edmund',b:TODAY-22*360,dead:false,sp:null,si:0,ma:{dead:false,si:0},own:false,lb:-9999}; // an unmarried son living at home heads nothing
  const m={name:'Ashford',cult:'anglo',folk:[old,boy,woman,dead,son,prime]};
  const before=JSON.stringify(m);
  ctx.m=m;ctx.r=stream(1);
  for(let k=0;k<20;k++)assert.equal(run('pioneerLeader(m,r)').gn,'Aldric');
  assert.equal(JSON.stringify(m),before);
  m.folk=[old,boy,woman,dead,son];assert.equal(run('pioneerLeader(m,r)'),null);
});

test('no name is given twice: a mother\'s many daughters each get a name of their own',()=>{
  for(const c of TONGUES){
    fresh(21);const seen=new Set(),m=mother(c,'Ashford');
    for(let k=1;k<=24;k++){
      const before=new Set(ctx.W.usedNames),n=name(m,daughter(c,1),k);
      assert.ok(!before.has(n)&&!seen.has(n),`${c}: ${n} twice`);seen.add(n);assert.ok(ctx.W.usedNames.has(n),`${c}: ${n} unrecorded`);
    }
    assert.equal(seen.size,24);
  }
});

test('names are deterministic for a seed',()=>{
  for(const c of TONGUES){
    const once=()=>{fresh(77);const m=mother(c,'Ashford'),out=[];for(let k=1;k<=10;k++)out.push(name(m,daughter(c,1),k));return out;};
    assert.deepEqual(once(),once(),c);
  }
});

test('the founding names a village for her mother only through daughterName, and counts how deep the daughters go',()=>{
  assert.match(source,/const dau=fr&&!\(opt\.fort\|\|opt\.planned\);if\(dau\)s\.gen=\(fr\.gen\|0\)\+1;/);
  assert.match(source,/s\.name=dau\?daughterName\(s,fr,keys,r\):culturedName\(s\.cult,keys,r\);/);
  assert.doesNotMatch(source,/culturedName\([^)]*fr\.name/);
});
