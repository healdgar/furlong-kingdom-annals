import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLegacySearches} from './legacy-search-audit.mjs';
import {unresolvedTransactionSearches} from './legacy-search-gate.mjs';
test('migration gate rejects a reintroduced lender-wide search',()=>{
 const report=auditLegacySearches('function borrow(s,h,q){for(const p of heads_(s,()=>true))if(p!==h&&p.w>q)return p;}');
 const findings=unresolvedTransactionSearches(report);assert.equal(findings.length,1);assert.equal(findings[0].function,'borrow');
});
test('migration gate rejects aliased street scans in each route lookup',()=>{
 const report=auditLegacySearches('function storageRoute(s,a,b){const all=s.streets;return all.map(st=>st.hidden).join();}');
 assert.equal(unresolvedTransactionSearches(report).length,1);
});
test('direct household or scoped inventory lookups do not trip the migration gate',()=>{
 const report=auditLegacySearches('function borrow(s,h,q){return s.households.get(h.id);} function commodityExposed(K){return K.entries({location:"yard"});}');
 assert.deepEqual(unresolvedTransactionSearches(report),[]);
});
test('necessary single-pass town updates remain visible without failing the transaction gate',()=>{
 const report=auditLegacySearches('function tickPopulation(s){for(const p of s.folk)p.grow();}');
 assert.equal(report.sites.length,1);assert.deepEqual(unresolvedTransactionSearches(report),[]);
});

import fs from 'node:fs';
import {auditLegacySearchHTML} from './legacy-search-audit.mjs';
test('game introduces no uninventoried broad searches or additional repetitions',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./legacy-search-inventory.json',import.meta.url),'utf8'));
 const report=auditLegacySearchHTML(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')),counts=new Map();
 for(const site of report.sites){const owner=(site.ownerFunction||site.function).replace(/anonymous@\d+/g,'<anonymous>'),key=owner+'|'+site.pattern;counts.set(key,(counts.get(key)||0)+1);}
 const introduced=[...counts].filter(([key,count])=>count>(baseline.counts[key]||0));
 assert.deepEqual(introduced,[],'Review new broad searches and migrate repeated transaction searches; the inventory is not permission to add work.');
});
