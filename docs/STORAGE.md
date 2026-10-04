# Physical storage — engine version 2

Non-livestock quantities occupy canonical custody lots. `s.stores` is an ordered,
cached sum over lots outside transit; held/sale tables remain legal claims.
Claims cannot create physical goods. Matching an unsupported claim raises a
fault rather than manufacturing goods, clamping stocks, or silently forgiving
an inconsistency. Roundoff tolerance scales with machine epsilon, magnitude,
and summand count; positive quantities are never deleted by an epsilon rule.
Livestock remain on the separate explicit herd transaction boundary.

Each lot has a stable realm-qualified ID, physical good, exact quantity, owner,
availability and location. Ownership changes retain its location. Charcoal
claims use actual timber custody. Shipment quantity derives from its transit
lots; arrival moves the same lot records between ledgers. Robbery retains the
recovered share and records the lost share. Household migration and settlement
pooling also move existing records. Legal and physical losses are paired.

`StorageLedger` maintains rebuildable membership by good, location, owner and
availability. Cached totals never become a third quantity ledger. Every claim
set/delete/defineProperty/table replacement invalidates its physical good through
local Proxy views. Their raw backing tables remain in `storageClaimTables` for
snapshot inspection. Balanced consumption acknowledges its own revision so the
next household need not scan all claims again. Compatible lots coalesce with an
explicit old-ID/new-ID outcome; every additional semantic own field participates
in compatibility, and unfamiliar object metadata prevents coalescing.

## Buildings and sites

Sound completed map buildings provide shared finite load-volume. Grain uses one
volume per game unit; hay three, timber/wool/stone two, ore 1.5, tools 0.5, and
other registered goods one. These are game calibrations, not historical tonnages.

| Building | Base volume | Intake | Base labour | Timber / stone | Paid days |
| --- | ---: | --- | ---: | ---: | ---: |
| Grange | 800 | grain, hay, wool | 360 crowns | 24 / 8 | 90 |
| Granary | 600 | grain, hay | 500 crowns | 20 / 20 | 120 |
| Warehouse | 1,000 | all non-livestock goods | 700 crowns | 30 / 30 | 150 |

Each tier adds half the base capacity. Deposits and direct protected-location
creation share capacity admission; rejected goods remain at their original
location. Ruin/removal exposes surviving contents without erasing them. Repairs
restore capacity, but do not teleport exposed goods back indoors.

Works lets the player choose a building and click its site on the map. A survey checks terrain, street, collision,
reserved-project, field-route and market-route checks. It shows ground compensation,
material prices, working days, capacity and handling cost before commission.
The preview remains outside world state. The committed command carries settlement,
building type, exact coordinates and payer, so replay needs neither an open panel
nor a pending survey. Ownership and site suitability are checked again at execution.
Projects buy materials, compensate ground through the existing land-payment path,
and pay daily wages. Unfunded, obstructed or unavailable-material projects stall;
capacity activates at completion. Authority loss cancels an institutional project.
Daily payment/progress, stalls and terminal state carry a stable project ID.

Households and institutional owners compare exposed goods and estimated avoided
loss with five-year capital recovery and carriage before commissioning. Merchant
households prefer warehouses; other investors prefer granges. They may decline.
Private granges admit their owner's goods; communal and merchant facilities accept
shared intake. The legacy settlement-wide granary flag grants no extra protection
under the new engine and its migration is recorded explicitly.

## Collection, carriage and losses

Bulk production remains a town aggregate. Grain/hay enter an honestly labelled
aggregate collection location at the area-weighted cultivated-land centroid;
it is not a claim that the first field produced the whole harvest. Other goods
enter the settlement yard. Parcel-by-parcel harvest custody is future work.

Local collection follows open street routes plus traversable access connectors.
Water, lakes, steep access, walls without street access, disconnected streets,
stopped-up streets, quarantine and siege can block carriage. Throughput is a
shared daily volume-distance budget; handling costs 0.00002 crowns per unit per
route metre, paid to the existing carriage-work recipients. Facilities nearer
production therefore collect more cheaply and sooner. Surveyed market distance
also informs investment and the player's choice.

Exposed stock is retained without a numerical stock cap and spoils at four times
base. Sound granges/granaries/warehouses use 0.45/0.4/0.65 of base spoilage.
Every actual loss names the lot, owner, location, good, quantity and cause.
Existing stock migrates uncovered without truncation. These rules intentionally
change future economics and require a new baseline.

## History and verification

Storage outcomes carry settlement identity, stable actor/location/lot/project
IDs, exact quantity changes, complete changed lot/location/project projections,
and both-ledger departure/arrival records. The root integration supplies the
browser-local durable `storageOutcome` sink, fault assertion and day-boundary
backpressure. The isolated implementation uses an in-memory outcome collector
only when that sink is absent; it is suitable for focused tests and the short
smoke, not an unbounded production run. Existing chronicles and life logs remain.

The independent Node reducer reconstructs lots/locations from the outcome stream,
including splitting, title and metadata changes, empty/occupied destruction and
cross-town cargo. This does not establish complete game-history reconstruction,
executable hydration, resumable archives, or old-engine replay equivalence.

Run `node --test tools/*.test.mjs`. Native GPU smoke:

```sh
node tools/render-check.mjs --seeds 1001:sea --days 30 --out /tmp/storage-smoke
```

Tested `index.html` SHA256:
`856740681809f2def9820a57c800914904325a01c48654e7d8b7e507addeaebf`.
All 132 focused tests pass. Exact-source native Chrome/Metal sea seed 1001 passes
30 simulated days and shader/camera/live-rebuild/church checks. Earlier smoke
failures exposed the purchased-timber/charcoal alias bug and are retained locally;
the final run validates its correction. Evidence:
`.git/storage/2026-10-03/storage/standalone-smoke-3/` and `focused-final.txt`.

This is a short standalone check. No mature storage soak, measured speedup,
combined-source validation, release, deployment or publication is claimed.
The root integration adds map picking and explicit saved command arguments, with
fresh-realm command replay and survey-state separation regressions. The inventory
alias repair, durable journal and corrected UI require combined browser and mature
soak validation before a production handoff.

### Cargo reference correction

Read-only integration review reproduced a multi-seller shipment bug: coalescing
retired a lot ID while the caravan retained that lot object, so a ten-unit load
could report fifteen and resurrect the retired record on arrival. Cargo quantity,
arrival and robbery now resolve current canonical location membership and stable
IDs. Two regressions cover coalescing followed by arrival and robbery.

The follow-up source hash is
`a006bfeb4ef8b87fd177662fcd97901de9496d3a06132fb1dc7caf8a7d5ff058`.
All 134 focused tests pass; `git diff --check` passes. This follow-up has no new
GPU smoke: the earlier native GPU result applies to the preceding source only.
Combined-source browser validation remains the integrator's responsibility.
