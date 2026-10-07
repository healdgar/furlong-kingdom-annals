import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
// Embedded README/docs text (the advisor's rules, refreshed by stamp.sh) is documentation, not game source.
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/(<script type="text\/plain" id="adv(?:rules|bridge)">)[\s\S]*?(<\/script>)/g,'$1$2');
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
 // Positive rows and existing owner registration ranks now narrow native queries.
 // Lazy allocation preflight and phase-local warehouse/spoilage reuse add no
 // commodity membership index or journal event. Exact b264e07 core and settlement
 // comparisons plus sparse seller/routing fixtures renew this review.
 // UI integration adds a read-only animal-sale tally and a herd-birth visual
 // callback; the exact native balance writer body and other claim sites match main.
 // Fortified endpoint attachments now reject closed castle curtains; the route
 // cache follows the clipped street graph. Quantity, title and journal writers
 // are unchanged; fort-streets and frozen routing fixtures cover this change.
 // 48c2b35 changes only storage site surveys and prevents repeat construction
 // labour charges after the work is done; storage-placement/project fixtures cover
 // those reviewed changes. The worker host does not modify this region.
 // Exact balance addresses, membership-only updates and unchanged facility
 // refresh bypasses preserve arithmetic, preflight and journal order. Frozen
 // 450d2b6 differential fixtures and two native years renew this bounded review.
 // commoditySettleAll alone changed since: a settlement before the day's end (a save, a flush) is now journaled
 // ({k:'settle'}) and replayed at the same point; the daily settlement passes daily=true. Settle calls, their order and
 // every quantity/title writer are unchanged; save-session.test.mjs covers the journaling.
 // Tick-cost: the ledger fast paths (fixed-depth nested maps, slot quantity cache, exposedOnly rows) keep writers, events and order; commodity-ledger-equivalence covers them.
 // Money routing (issue #19): carriage and construction wages now pass their payer to buildWorks/payAmong
 // instead of debiting it and booking the wage as coined from nobody, and a robbed cargo is owned by the
 // outlaw household that took it (the thief argument, default 'out') instead of a dealer abroad. No lot,
 // title, claim or journal writer changes; money-routes.test.mjs and the storage fixtures cover these lines.
 // Money routing (#19) in this region: carriage and storage works paid by their payer through buildWorks, a robbed cargo owned by
 // the household that took it (thief); and the storage walk's remembered blocking step (#15), a pure read kept outside the world.
 // No lot, title, claim or journal writer changes.
 assert.equal(digest(source.slice(a,b)),"cda74961ad283871a980f3fd0c9a034e577f3803a889dd1075eecacc330a2b83");
 // This explicit worker inspector copies existing balances. Pin the entire line
 // before excluding it so a future mutation cannot hide behind the read exemption.
 const inspectorLine=source.split('\n').find(l=>l.trim().startsWith("if(kind==='household'){const h=W.households.get(payload.id);"));
 assert.equal(digest(inspectorLine),"277f2b74eb272b2cf60044723871d434e72e0bfa7add685246696265b292ddfc");
 const outside=(source.slice(0,a)+source.slice(b)).split('\n')
   .filter(l=>l!==inspectorLine).filter(l=>/_owners|storageClaimTables|\.held(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)|\.sale(?:\[[^\]]+\])?\s*(?:=|[+*/-]=)/.test(l)&&!l.includes('const inc=tradeIncome(s,hh.tr,counts),herd=s._owners?.get('))
   .map(l=>l.trim().replace(/(?:G\.land&&G\.land\.lordTex|W\.land&&G\.landView\?\.lordTex)/g,'LAND_VIEW_GUARD')).sort().join('\n');
 // The herd reader now accumulates four species in one owner pass, preserving
 // each species owner order; no external ownership writer changed.
 // Sort to tolerate declaration moves; exclude the added read-only herd inspector,
 // and normalize the land-uniform guard. Canonical claim and balance writes match HEAD.
 // Re-pinned with the embedded docs excluded: the corpus is identical at 9c66076, cd2eab8, e472d30 and HEAD; only stamped doc lines had varied.
 // Tick-cost: the smith/weaver owner scan is skipped when no owner holds ore and charcoal (or wool); one copy of _owners, no writer changed.
 assert.equal(digest(outside),"89119c20e2944f1085e7e07a05ccc5ff44a14d6c57912ee013e27ff0054a7e04");
 assert.equal((source.match(/storageTitleDirty\(/g)||[]).length,3);
});
