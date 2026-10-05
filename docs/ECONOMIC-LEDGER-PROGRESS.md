# Economic ledger migration

Authority: [ECONOMIC-LEDGER-SIMPLIFICATION.md](ECONOMIC-LEDGER-SIMPLIFICATION.md).
Baseline: `42024fc`. Follow the phases in order. No carrier-second budgets,
collection events, or additional lot-split machinery.

## Checklist

- [x] Phase 1: confirm the abandoned micro-haulage experiment is absent from runtime.
- [x] Phase 2: validate external distance, army-location, and vacant-residence indexes.
- [x] Phase 3: replace bulk physical lots and independent held/sale claims together.
- [x] Phase 4: journal daily owner/facility deltas; explicit save/export flushes can amend the same day.
- [ ] Phase 5: exact demographic equivalence remains unproven; the user authorized publishing the tested checkpoint with the disclosed outcome differences.

The phase-2 caches belong outside saved world state and emit no journal events.
Current `moveIn` already discovers vacancies once per call; any retained index
must eliminate discovery across calls without changing the initial candidate order.

## Phase 3 conversion boundary

All these paths must use the same authoritative commodity balances:

| Boundary | Required change |
| --- | --- |
| `stockOf`, `pantry`, `OwnedMarket` | Held/sale views read and write owner/facility balances; retire separate quantity claims. Reserves remain prices. |
| `purchase`, `clearMarket` | Transfer seller balance to buyer once. Remove subsequent purchase `addHeld` credits and pending-purchase fulfillment. Keep cash, borrowing, reserves, and retained grain semantics. |
| `shareOutput`, `offer`, `offerLand`, herd output | Allocate produced stock to owners without creating stock again. |
| `consumeOwned`, `consumeOwnStock` | Debit the same owner/facility quantity that town totals read. Keep per-household hunger calculations. |
| `giveFood`, relief, construction, army provisions, exports | Transfer or consume the purchased balance once; retain recipient identity. |
| `storageTick`, spoilage, destruction | Move/debit balances by real custody and facility protection/capacity. No split/coalesce events. |
| Cargo dispatch, arrival, robbery | Preserve caravan identity and transit custody; count stock once across origin, cargo, and destination. |
| Household migration, `moveStock` | Move owner balances once; preserve existing held/sale location semantics and animal handling. |
| `transferOwnership`, marriage, `inherit` | Divide balances among creditors/heirs once while retaining customary shares, debts, purses, property and animals. |

Charcoal currently claims timber custody. Its conversion must preserve that
relationship explicitly; treating it as an additional independent stock creates goods.
Unique entities and livestock retain their existing identity models.

## Phase 4 replay boundary

Town flow totals alone cannot replay household inventories. Daily envelopes must
retain net changes keyed by settlement, facility, owner, good and availability.
An ownership transfer can have zero town delta and still change two pantries.
Record initial balances once, validate contiguous settled days, and flush pending
deltas at save/export boundaries. Preserve household hunger and debt state through
the existing household history machinery. Never suppress legacy mutation records
while the lot/claim engine remains authoritative.

The roadmap's 1.5x throughput and 80% encoded-volume thresholds are acceptance
targets for the completed transition, not measured results of the lookup phase.

## Phase 2 checkpoint

All 652 tests pass. A 30-day replay matches all 205,286 storage records, hashes,
and byte counts. The two-year comparison matches both annual world states and
final RNG fingerprints, with zero simulation errors. Pantry, hunger, debt, and
inheritance remain unchanged. Timing is neutral (1.002x over 30 days; 0.988x
over two years); no speedup or journal reduction is claimed for this phase.

Evidence: `tools/soak-results/economic-roadmap-lookups30-final-2026-10-04` and
`tools/soak-results/economic-roadmap-lookups2y-final-2026-10-04`.

## Native balance checkpoint

The version-3 engine uses numeric facility/good/owner/availability balances as
its authority. Town stocks and household held/sale views read these same numbers.
All conversion boundaries above use this authority, including purchases,
consumption, production, relief, inheritance, migration, cargo and facility refits.
Livestock and unique entities retain their existing models. Charcoal uses its own
balance bucket within timber's physical total; it is not counted twice.

Daily envelopes retain owner and facility deltas, including transfers whose town
net is zero. Save/export boundaries settle pending changes; contiguous revisions
permit same-day amendments. An independent reducer validates every captured day
against direct live numeric balances and accepted-versus-saved history hashes.
There are no new walking budgets, bulk lot IDs or bulk split/coalesce events.
Analytical household reach remains pending; this checkpoint retains existing access
behavior rather than introducing another travel model.

Validation on source SHA256
`42c1eb5f80be3dabcb20cc4721797621983e3eba97cc45c6667987b82d5a8fd9`:

- All 731 tools tests pass.
- Four worlds (seeds 1001/2002, sea/land) pass two years of daily inventory and
  annual money checks. Each annual money residual is zero. No 20- or 200-year
  clearance is claimed.
- Independent thirty-day replay passes all 31 boundaries and accepted-versus-saved
  history verification. The final serial sample measures 26.61 versus 15.73
  days/second (1.692x); 373 versus 205,286 journal records; and 5,639,358 versus
  39,048,709 encoded bytes (85.56% reduction). Both numerical roadmap gates pass.
  The harness's separate fastest-player 2x gate is not claimed: these are tick runs.
- The earlier 1.62x sample covered the first thirty days. The earlier 3.10x
  comparison covered second-year tick time (46.26 versus 143.47 ms). These are
  different intervals and precede the final ordering fixes. Final multiworld
  captures overlapped instrumentation; their timing is not a controlled speedup.

The final batch fixes four authority boundaries exposed by broader checks:
raid salvage is credited once; empty-recipient relief preserves existing stock;
ward pooling moves pending production counters with physical stock, while physical
loss reduces pending unassigned output; and market cleanup transfers every exact
residual cell rather than leaving a microscopic clearing pool. Real shortages
still fault. Transfer roundoff is bounded by operand magnitude and selected rows;
no material excess or quantity fabrication is admitted.

A derived WeakMap index now preserves first-positive balance-cell priority across
facilities, goods and owners. It changes only when cells become occupied/empty,
never for ordinary positive quantity updates, and adds no journal fields or events.
This removes the accidental priority introduced by nested Map traversal. An
aggregate cell still combines later inflows: exact sublot age/FIFO is intentionally
not retained by the fungible model. Household pantries, hunger calculations,
purses, debt creditors, inheritance and herds remain individually tracked.

Identical shoreline geometry, day-720 comparisons:

| World | Population change | Household weighted hunger, old -> new |
| --- | --- | --- |
| 1001 sea | +1.70% | 6.27% -> 5.00% |
| 1001 land | -0.42% | 7.14% -> 7.37% |
| 2002 sea | +4.04% | 5.42% -> 5.08% |
| 2002 land | +0.17% | 5.21% -> 9.46% |

Financial/stock totals also diverge: household debt ranges from about -30% to
+20% and held food from +2% to +54%. Those changes are not deleted household
tracking, but conservation does not establish statistical equivalence. Full death
rate distributions have not been compared. The roadmap's demographic acceptance
criterion remains unproven. After these differences were disclosed, the user
explicitly authorized merging the checkpoint into the upgraded main and publishing
it for testing. Individual tracking remains intact; identical trajectories are
not claimed.

Evidence beneath local ignored `tools/soak-results/`:
`commodity-settlement-candidate30-final-2026-10-04`,
`commodity-settlement-baseline30-final-2026-10-04`,
`commodity-settlement-audit2y-2026-10-04`,
`commodity-settlement-worlds2y-2026-10-04`,
`shore-legacy2y-2026-10-04`, and `shore-legacy-other2y-2026-10-04`.
The roadmap's original five-million split-event estimate is not independently
verified; measurements above count all storage records.

## Submerged coastal ground

Published separately as `8b715e2`, with the validated lookup caches. The integrated
legacy-engine source passed all 656 tests. The numeric checkpoint now integrates
with the later UI/material release described below.

The visible sea is at SEA + 0.5 m, while the old land mask admitted coastal
heights between SEA and that surface. The existing mask now excludes this wet
band from arable/vine area and uses its previously unused alpha channel to clip
territorial ink on terrain and parchment. Rivers and lakes use the same wet mask.
A partially wet parcel can still produce from its surveyed dry area.

Four focused tests and every integrated rendering gate pass, including shader
compilation, camera/live rebuild, history, geometry, draw calls and texture budgets.
Evidence: `coast-integrated-render-2026-10-04` in the integration worktree. Main,
origin/main and live Pages matched commit `8b715e2` exactly at publication (index SHA256
`0fbdcd3d976ff3c5e2996b3fb045a7c33cb4dc3c55a73f3dc7000e3a87b2e7b8`).

A concurrent graphics/UI integration subsequently advanced main to `a931337`,
retaining the shoreline fix and the legacy engine. Pages was reverified against
that main exactly. The numeric checkpoint was merged with `a931337` without
source conflicts, preserving its context card, detail sheets, material textures,
waterwheels, parchment and shoreline corrections. Two test tripwires were
reconciled after source review; neither required a gameplay rollback.

## Combined release validation

Source SHA256: `f1bb306ad948de1e5e41335c6a454db170c50ff613c593d6a209771fbc19ed12`.
Build: `2026-10-05 06:27 UTC · daily commodity balances`.

- All 747 source/unit tests pass.
- Hardware Chrome desktop rendering passes for 1001 sea and 2002 land through
  thirty days: loaded material images, linked shaders, camera uniforms, live
  rebuilding and church variants. A 390×844 touch/WebGL1 coastal run passes the
  same checks. These are host viewport checks, not physical-device measurements.
- The context card, expanded settlement table, household register and pantry sheet
  work against the numeric ledger. At a 527px viewport, the household sheet has
  no horizontal document overflow; the parchment surface loads.

Rendering evidence: local ignored
`tools/soak-results/commodity-main-render-2026-10-04` (including `mobile`).
The rendering harness used the same local HTTP/asset adaptation as the UI release.
The simulation source is unchanged by that harness adaptation.


- Four worlds (1001/2002, sea/land) pass two years of daily inventory and annual
  money checks on this combined source. No simulation errors, inventory mismatch,
  nonfinite money or journal fault occurred; every annual money residual is zero.
  Instrumented timings overlap rendering and are not comparative performance evidence.
- Independent thirty-day replay passes all 31 boundaries; all 372 accepted storage
  envelopes match persisted replay and hashes. This proves the v3 balance history,
  not full saved-game hydration or exact v2/v3 household equivalence.
- A subsequent serial 30-day sample compares with the current UI release
  `a931337`: 28.64 versus 16.58 days/second (1.728x); 373 versus 207,586 total
  journal records; 5,680,974 versus 39,421,890 encoded bytes (85.59% reduction).
  The 1.5x throughput and 80% volume roadmap gates pass. The tick driver does not
  establish a fastest-player 2x gate. The candidate-only CLI summary has null
  comparative ratios; `roadmap-gates.json` computes them from both completed runs.

Further local evidence: `commodity-main-audit2y-2026-10-04`,
`commodity-main-baseline30-2026-10-04`, and
`commodity-main-candidate30-2026-10-04` under `tools/soak-results/`.

Known limitations remain: analytical household reach and full demographic
comparison are unfinished. Two-year conservation is not century-scale clearance.
Year-two hunger with food in the same town still occurs; aggregate stock does not
prove that a hungry household owns or can afford it. This integration publishes
the approved checkpoint without claiming those broader questions are resolved.


## Reel inventory crash repair

The Shershire save (`s=806769900&f=104344028`, day 360) exposed two
floating-point discrepancies between compatibility counters and numeric balances:

- A proportional purchase from many sellers returned its theoretical target,
  slightly exceeding the buyer's credited held stock. Caravan dispatch then
  rejected that unbacked quantity. `purchase.got` now reports the actual held
  balance delta for native commodities; legacy and livestock paths retain their
  previous arithmetic.
- Production calculated from large town-total differences could put `_made`
  slightly above the small unassigned balance. Town migration then rejected
  pending timber. `made` now limits its existing pending-output assignment to
  actual unassigned stock within town-total arithmetic roundoff, and rejects
  material excess. Core transfer and migration shortage checks remain strict.

Neither repair adds inventory mutations, per-person budgets, lot events, or
journal emission calls. Household pantry, hunger, debt and owner identities
remain authoritative. These repairs make no new throughput claim.

Validated simulation source SHA256:
`51ee722408296b5f12f0200e5f48790f742d360143f918a685b3f7ce4a403b0b`.

- All 752 source/unit tests pass, including purchase, pending-production,
  inventory conservation and material-shortage regressions. The precise
  purchase/migration failures reproduce against published `ab15897`.
- Actual animation-driven Reel speed reaches day 1086 from a fresh Shershire
  world and day 1083 from the supplied day-360 save. Both have zero simulation,
  journal or model errors. All 58/43 polled inventory checks pass; these are
  sampled checks during animation, not daily or century-scale clearance.
- Independent thirty-day v3 replay matches all 31 boundaries and accepted versus
  persisted history hashes; no pending journal bytes or faults remain.

Local ignored evidence: `tools/soak-results/reel-inventory-crash-2026-10-04/`
(`repeat1` original cargo failure, `pending-trace` production drift,
`hotfix-final-fresh` and `hotfix-final-resume`), and
`tools/soak-results/commodity-cargo-fix-final-replay30-2026-10-05/`.


## Native scan removal and parish graveyards

Completed against published `b264e07`:

- [x] Crop allocation only recounts the town when the requested quantity exceeds
  its available unassigned stock and needs a roundoff check.
- [x] A purchase wholly supplied by the buyer's own stock skips seller enumeration.
- [x] Native bulk offers reuse positive owner membership and existing registration
  ranks; empty accounts are excluded and livestock retains its existing path.
- [x] Warehouse candidates are reused by source and good, with private facilities
  scoped to their owner. Hauling stops when the daily capacity is exhausted.
- [x] Daily spoilage shares the facility setup from the storage phase; standalone
  spoilage still refreshes facilities.
- [x] Native row queries and totals reuse the existing positive-row membership,
  excluding empty historical cargo. A scalar ordinal on each canonical facility
  preserves the original floating-point summation order.

No additional maintained commodity membership index or journal emission call was
introduced. Market clearing also reuses its existing pooled rows with an advancing
cursor, retaining the exact shortage arithmetic near exhaustion. Household pantry,
hunger, debt and daily settlement tracking remain authoritative.

Parish church plots now reserve dry churchyards in the existing placement hash.
Local deaths retain the existing person object in the town's burial register and
increment the parish count once; emigrants are excluded. Rendering uses at most
24 grave markers per church, and the church inspector exposes recent linked
burials. Church rebuilding reuses the existing yard footprint. Reserving this
land intentionally changes generated town layouts.

Validation: all 762 source/unit checks pass. Frozen-core and market comparisons
retain exact quantities and daily settlement output. Counters verify zero routine
allocation recounts, zero seller scans for fully self-supplied purchases, exclusion
of 1,000 empty owners and cargo locations, and one shared spoilage setup. A Chrome
boot/death/render check finds 16 churchyards, zero wet plots, one recorded burial
and no simulation or journal fault. No multi-year performance benchmark was run
for this batch; these results demonstrate removed work, not a measured speedup.
