import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditLegacySearchHTML,auditLegacySearches} from './legacy-search-audit.mjs';
import {inlineGameScript} from './simulation-boundary.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const actual=auditLegacySearchHTML(html);
const fn=(name,report=actual)=>report.functions.find(row=>row.function===name);

test('actual script report preserves findings with absolute HTML lines',()=>{
  const source=inlineGameScript(html),local=auditLegacySearches(source);
  const offset=html.slice(0,html.indexOf(source)).split('\n').length-1;
  assert.ok(actual.sites.length);
  assert.deepEqual(actual.sites,local.sites.map(site=>({...site,line:site.line+offset})));
  assert.deepEqual(actual.functions,local.functions.map(row=>({...row,line:row.line+offset,broadSites:row.broadSites.map(site=>({...site,line:site.line+offset}))})));
});

test('synthetic aliases, nested scans, unscoped entries and call graph are reported',()=>{
  const source=`
    function headsOf(s) { return s.folk.filter(p => !p.dead); }
    function heads_(s,pred) { return headsOf(s).filter(pred); }
    function borrow(s,h) { for (const q of heads_(s,x => x !== h)) lend(q,h); }
    function workers_(s,pred) { return headsOf(s).filter(pred); }
    function buildWorks(s) { return workers_(s,x => x.tr === 'mason'); }
    function tradeCounts(s) { for (const h of headsOf(s)) count(h); }
    function craftWork(s) { return tradeCounts(s); }
    function clearMarket(s,orders) { orders.forEach(([h]) => borrow(s,h)); }
    function provision(s,orders) { clearMarket(s,orders); }
    function scan(s) {
      const people = s.folk;
      const aliases = people;
      for (const p of aliases) {
        for (const o of s._owners || []) p.work(o);
      }
      s.buildings.filter(b => b.live);
      s.streets.forEach(st => st.draw());
      s.storage.entries();
    }
    function caller(s) { scan(s); }
    function safe(s,id) { return s._owners.get(id); }
  `;
  const report=auditLegacySearches(source),scan=fn('scan',report),caller=fn('caller',report),safe=fn('safe',report);
  assert.ok(fn('borrow',report).broadSites.some(s=>s.pattern==='helper:heads_'));
  assert.ok(fn('buildWorks',report).broadSites.some(s=>s.pattern==='helper:workers_'));
  assert.ok(fn('craftWork',report).transitiveBroadCalls.includes('tradeCounts'));
  assert.ok(fn('provision',report).transitiveBroadCalls.includes('borrow'));
  assert.ok(fn('clearMarket',report).directCallees.some(name=>name.startsWith('anonymous@')));
  assert.ok(scan.broadSites.some(s=>s.pattern==='collection:folk'&&s.loopNesting===1));
  assert.ok(scan.broadSites.some(s=>s.pattern==='collection:_owners'&&s.loopNesting===2));
  assert.ok(scan.broadSites.some(s=>s.pattern==='collection:buildings'));
  assert.ok(scan.broadSites.some(s=>s.pattern==='collection:streets'));
  assert.ok(scan.broadSites.some(s=>s.pattern==='unscoped-entries'));
  assert.ok(scan.broadSites.every(s=>s.ownerFunction==='scan'));
  assert.ok(caller.transitiveBroadCalls.includes('scan'));
  assert.equal(safe,undefined,'a direct keyed lookup is not a broad scan');
});

test('bounded/single-pass scans are listed as evidence, not failed as defects',()=>{
  const report=auditLegacySearches('function onePass(s){for(const p of s.folk) use(p)}');
  assert.equal(report.sites.length,1);
  assert.match(report.limits.join(' '),/One-pass scans are reported as candidates/);
  assert.match(report.limits.join(' '),/runtime frequency/);
});
