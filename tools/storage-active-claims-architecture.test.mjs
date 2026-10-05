import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
// Pin the reviewed ownership/balance adapter region and the unchanged external
// legacy owner-table writers. This is a source-change tripwire, not an alias proof.
test('managed claim and commodity balance architecture remains reviewed',()=>{
 const a=source.indexOf('function oldHouseholdHead('),b=source.indexOf('function houseFolk(s)');
 // Combined review covers household membership, inherited arithmetic frontiers
 // hay loss debit, safe metadata, successful-pass title caching and explicit
 // pending purchase completion and canonical-order lot indexes. Writers, captures,
 // purchase filtering and arithmetic provenance remain intact; focused tests and
 // native comparisons against f2e4b93 renew this contract.
 // Consumption now proves small requests through an owned, non-transit lot;
 // legal/physical writers and arithmetic remain unchanged. Native total/getter
 // admission and deferred warming preserve cache and override semantics. Frozen
 // 139dd52 fixtures and native replay comparisons renew this bounded-read review.
 // Sale iteration uses derived offer membership; its native Map cursor preserves
 // live fallback. No legal/physical writer or journal event changes. Sparse and
 // opaque mutation fixtures plus exact 34846e4 native replay renew this review.
 // The annual household trade-cache hook shares a line with existing _owners reads;
 // those outside claim references retain identical ownership operations.
 // Composite owner/good membership, incremental certified-group selection and
 // phase-local facility candidates preserve managed writer and event order.
 // Native admission retains full scans for observer callbacks and overrides.
 // Frozen 3067ee5 comparisons and journal-append replay validate this batch.
 // The numeric-balance core/runtime now resides in this reviewed region.
 // Main adds a read-only household inspector; UI/material additions introduce no
 // quantity writes. The combined source is reviewed with both test suites.
 // This defaults to numeric balances while explicit false opts into the legacy lot
 // ledger. The outside legacy owner-table mutation corpus below remains pinned.
 assert.equal(digest(source.slice(a,b)),"5c43cd79f1383a91f5dbd1715cec30c523918ac6361ccaa1d6c8e2d39cffb125");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n').filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)).join('\n');
 assert.equal(digest(outside),"3e47927aacdd0447aceabf03c905b6fb20038bbf5437e69e9aacf2b92e3887f0");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
