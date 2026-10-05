import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
// Explicit managed mutation contract: raw same-size Map reordering or raw backing-table
// writes require public storageTitleDirty. They are not reflectively detected.
// Pin the existing ownership implementation and its outside owner/table references:
// changing a writer requires renewing this contract and its baseline comparison tests.
// This is a source-change tripwire, not a whole-program alias proof.
test('managed claim writer architecture remains reviewed',()=>{
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
 // Exposure queries reuse the admitted external facility index; membership
 // maintenance preserves live order without full-array sorting. Canonical ledger
 // writers, claim arithmetic, and outcome records remain unchanged.
 // The expanded inspector adds one read of s._owners for its household register.
 // The outside-reference diff contains no new ownership mutation.
 assert.equal(digest(source.slice(a,b)),"53af077c3d68fda54215af8342daeb541c33b10c380d8fb803e85a5a1b08767f");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n').filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)).join('\n');
 assert.equal(digest(outside),"3e47927aacdd0447aceabf03c905b6fb20038bbf5437e69e9aacf2b92e3887f0");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
