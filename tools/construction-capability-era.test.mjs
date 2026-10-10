import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const helper=source.match(/const CONSTRUCTION_METHODS=Object\.freeze\(\{stoneKeep:[^\n]+\}\);\nfunction constructionCapability\(s,method,ad=AD\(\)\)\{[\s\S]*?\n\}/)?.[0];
const foundationSpec=source.match(/function castleFoundationSpec\(s\)\{[\s\S]*?\n\}/)?.[0];

test('stone keep construction hook is a pure historical fallback pending #44',()=>{
  assert.ok(helper,'shared construction capability helper is present');
  const c={AD:()=>1400};vm.createContext(c);vm.runInContext(helper,c);
  const query=vm.runInContext('constructionCapability',c),place={id:1};
  assert.equal(query(place,'stoneKeep',1069).available,false);
  assert.equal(query(place,'stoneKeep',1070).available,true);
  assert.equal(query(place,'stoneKeep',1070).historicalYear,1070);
  assert.equal(query(place,'stoneKeep',1070).proposalYear,1080);
  assert.equal(query(place,'stoneKeep',1070).source,'calendar-fallback-pending-tech-tree');
  assert.equal(query(place,'unknown',1500).available,false);
  assert.doesNotMatch(helper,/rand\(|chance\(|Math\.random|(?:^|[^\w])W\.|(?:^|[^\w])s\./);
});

test('first foundation uses the capability result for its actual timber/stone quantities',()=>{
  assert.ok(foundationSpec,'first-foundation specification is present');
  const c={AD:()=>1066,ARCH:{keep:[0,0,18]},stoneFor:()=>150};vm.createContext(c);vm.runInContext(helper,c);vm.runInContext(foundationSpec,c);
  vm.runInContext("constructionCapability=(s,method,ad)=>({available:false})",c);
  const timber=vm.runInContext('castleFoundationSpec({})',c);
  assert.equal(timber.timber,true);assert.equal(timber.tier,0);assert.equal(timber.stone,0);
  vm.runInContext("constructionCapability=(s,method,ad)=>({available:true})",c);
  const stone=vm.runInContext('castleFoundationSpec({})',c);
  assert.equal(stone.timber,false);assert.equal(stone.tier,2);assert.equal(stone.stone,150);
});

test('generated and existing keep paths, including stone planning, pass their settlement to the hook',()=>{
  assert.match(source,/motteAge=saved\?saved\.motteAge:!constructionCapability\(s,'stoneKeep',era\)\.available/);
  assert.match(source,/stoneTimberKeep\(\)\{[^\n]*!constructionCapability\(s,'stoneKeep'\)\.available/);
  assert.match(source,/rebuildKeep\(\)\{[^\n]*!constructionCapability\(s,'stoneKeep'\)\.available/);
  assert.equal((source.match(/constructionCapability\(s,'stoneKeep',ad\)\.available/g)||[]).length,3); // casNext twice, tickStone once
});

test('new realms default to direct AD 1066 generation while AD 850 remains explicit',()=>{
  assert.match(source,/const FOUNDING_AD=850;[\s\S]{0,100}const DEFAULT_START_AD=1066/);
  assert.match(source,/\[\[850,[^\]]*\],\[1066,[^\]]*\],\[1250,[^\]]*\],\[1350,/);
  assert.match(source,/const directEra=START_AD>FOUNDING_AD/);
  assert.match(source,/W=\{startAD:directEra\?START_AD:FOUNDING_AD/);
  assert.match(source,/const PS=directEra\?1:0\.35/);
  assert.equal((source.match(/options\.startAD\?\?DEFAULT_START_AD/g)||[]).length,2); // worker URL and startSimulation fallback
  assert.match(source,/em\?\(em\[1\]==='high'\?1250:850\):DEFAULT_START_AD/);
  assert.match(source,/async function advancePrehistory\(progress\)\{\n  if\(START_AD<=W\.startAD\)return;/);
});
