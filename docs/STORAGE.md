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
| Grange | 800 | grain, hay, wool | 360 crowns | 24 / 0 | 90 |
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

### Semantic metadata correction

Lot, location and project projections now retain every own plain data field,
including explicit undefined, special numbers, bigint and array holes. Actor and
building references use stable IDs; executable values, accessors, cycles and
non-plain objects reject before mutation. Metadata annotations cannot alter indexed
core fields; those require explicit custody/title/quantity operations. Removal is
an explicit annotation argument, distinct from assigning undefined.

An independent raw-field oracle validates these projections and property presence;
it does not call the projection under test. Source
`923fc95a69b26052307f35f869f75e6ee9c34abe99962a5be75e625097a7f2d6`
passes all 136 focused tests and source checks. No new GPU result is claimed.

Floating-point cancellation is checked against a per-good arithmetic error budget. Physical additions, merges, splits and removals, and legal claim writes record their observed operand magnitudes; each contributes twice machine epsilon times the sum of operand magnitudes. Claim matching also allows its summation error. Matching checks this budget across all unmatched claims, records accepted roundoff with input provenance, then propagates the accumulated bound to later boundaries: matching or an exact-looking balance does not erase uncertainty incurred by earlier arithmetic. Numerical matching never deletes tiny physical lots or legal balances, nor creates stock to conceal discrepancies; a deficit exceeding the arithmetic budget faults. This diagnostic budget is derived numerical uncertainty, not stock or ownership.

At the daily storage collection boundary, completed non-transit hay with a positive quantity at or below 0.001 units is instead subject to explicit `vermin-remnant-loss`: worms and rats consume an uncollectable remnant. Compatible fragments combine before applying the threshold; valuable combined stock remains. The recorded physical removal also debits matching held/sale title, frees custody capacity and preserves all prior history. This is a modeled material loss, not numerical rounding. Pending purchases wait for ownership completion; fresh unoffered hay remains in `_made.hay` until the monthly `shareOutput` assigns producer title and clears that buffer. Daily food-only sharing preserves the hay buffer. Repeated checks of retained production/purchases emit no new loss events, and tiny retained hay incurs no local carriage payment. In-transit manifests are excluded.


Unfinished construction installs available timber and stone incrementally. Each paid material receipt consumes existing stock once and records installed quantity on the project; later ordinary consumption cannot reclaim these inputs. Labour and protected capacity open only after both material requirements are fulfilled. Cancellation leaves spent material as sunk work, with the unfinished project history retained.

Base granges require 24 timber, 360 crowns of labour and 90 working days, with no stone: the game treats their footing as earth and their structure as timber. This calibration makes early-era storage feasible before the existing quarry-opening year 950; granaries and warehouses retain their stone requirements. Unfinished stone requirements enter the existing monthly quarry demand and stone-price/transport calculations. These are explicit game rules, not historical cost estimates.

Purchased relief is an explicit completed title transaction. Church-door gifts, charitable household purchases and commanded relief pass the actual purchasing account into food distribution; pending purchase lots transfer to recipient households at their existing physical locations before held claims are credited. Pending protection is released only for the transferred units. Distribution assigns the last recipient the exact remaining quantity, retaining positive fractional balances.

Purchase completion selects the purchasing account's canonical pending lot IDs. Crediting a held claim clears pending protection for precisely those units; cargo clears it at dispatch. Army provisions and foreign exports consume the explicit buyer's purchase, avoiding the generic setter's pooled pending order. Intertown purchased relief retains lot IDs and origin/destination events before recipient title distribution. These boundaries preserve neighbours' completed claims even when another purchase occurs before the next matching pass.

A foreign ship cancelling a purchased load below its one-unit departure minimum retains the exact paid goods in the foreign buyer's local held inventory, completing purchase custody. Loads that sail retain their exact positive quantity in the ship manifest; displayed rounding never changes the recorded shipment.

When no eligible household head can buy necessities, provision may use the lord's purse for an orphan household. The payer and recipient remain explicit: the lord's completed pending purchase transfers title to the recipient before its pantry is credited, while custody stays at the seller's location. A settlement with no household recipient retains the institutional account as recipient. This applies to every provisioned good, including timber, cloth and tools.

Paid pending custody is excluded from ordinary held/sale matching and from physical surplus available for reconciliation to offer again. Only explicit completion, gift, purchased consumption or purchased cargo dispatch releases protection for the affected units. Daily food top-ups transfer the fallback lord purchaser's pending lots to the final household before crediting its pantry. Native merchant dispatch selects newly purchased pending lots, preserving previously held stock; the generic cargo helper retains its existing behavior. Reconciliation sums non-transit pending quantities by physical good, adding one traversal of that good's lot index per call.
# Road access and completed construction

Storage commissioning now requires a short, dry connector from the building
door to an accessible street. The survey uses the existing street-segment hash,
checks the proposed footprint and obstacles, and limits the connector to 32 map
units. It creates no building, road, inventory index, or journal record. Live
placement repeats that bounded survey and installs its access lane once.

Completed projects awaiting placement no longer pay more labor, increment their
working days, or emit repeated progress records. A failed placement can retry
when its site becomes accessible without town-wide detour searches. Daily
unfinished-site checks retain the inexpensive footprint check.

At seed/fate 1001, sea, 12 settlements, two native Chrome years, year-two elapsed
processing changed from 210,726 ms to 14,917 ms (585.35 to 41.44 ms/day).
`tickProjects` changed from 185,123 ms to 55 ms. Both runs had zero simulation
errors and balanced money totals. Histories differ because siting and payment
behavior were corrected; this is a matched initial workload, not state parity
or a general performance guarantee. Source snapshots and profiles are in
`/tmp/legacy-search-baseline-patched` and `/tmp/storage-frontage-native`.

Validation: 87 focused tests passed, including the legacy-search regression
guard, construction/material conservation, failed-completion retries, road
surveys, and route batching. Native rendering at seed 287970763 passed mill,
quay, grange access, and paid-crossing checks in
`/tmp/storage-frontage-render/checks.json`.
