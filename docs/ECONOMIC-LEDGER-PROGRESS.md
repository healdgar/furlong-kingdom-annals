# Economic ledger migration

Authority: [ECONOMIC-LEDGER-SIMPLIFICATION.md](ECONOMIC-LEDGER-SIMPLIFICATION.md).
Baseline: `42024fc`. Follow the phases in order. No carrier-second budgets,
collection events, or additional lot-split machinery.

## Checklist

- [x] Phase 1: confirm the abandoned micro-haulage experiment is absent from runtime.
- [x] Phase 2: validate external distance, army-location, and vacant-residence indexes.
- [ ] Phase 3: replace bulk physical lots and independent held/sale claims together.
- [ ] Phase 4: journal daily owner/facility deltas, with one settlement envelope per day.
- [ ] Phase 5: replay, conservation, household soak, and matched performance gates.

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
