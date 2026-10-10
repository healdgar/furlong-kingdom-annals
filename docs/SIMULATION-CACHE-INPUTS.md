# Inputs for daily storage decisions

Recorded 2026-10-10 from `8980908` and the subsequent exact kernel patch, before
implementing a persistent proposal cache. This is a source-backed audit, not a
complete invalidation proof. Functions remain sections of `index.html`.

Storage investment now makes daily decisions. Its former monthly
settlement-index stagger had no contractual reason. Physical construction is
already daily: a grange needs 90 paid working days, a warehouse 150; funding,
materials and site access can stall a day. An active commission suppresses new
proposals. Those physical rules are preserved by the conversion below.

## Cheap current economics

`storageInvestment` groups exposed native stock by owner (unowned stock uses the
current lord), multiplying each good by its physical volume. Investors retain
that canonical amount/rank order. A merchant household proposes a warehouse;
others a grange. Eligibility reads actual means and type cost. Net return reads
current exposed amount, type capacity, grain price, handling and the site's cost.
Execution still checks the payer and posts the real commission.

`storageReport.exposed` is computed during local carriage, before
later stock writers. It cannot certify exposure at financial close. A daily
decision now reads current ledger exposure. Total exposure alone cannot certify
ownership: a transfer can
change the investor without changing the quantity.

## Expensive quote inputs

| Consumer | Inputs that determine the result |
|---|---|
| `storageSiteQuote` | Live layout's survey, candidate dimensions, first market place (else town position), active storage reservations within 18 metres, current tilled-field endpoints, `planLand`, timber/stone prices. The payer is retained in the quote, not tested for solvency by the survey. |
| Layout `storageSite` / `fits` | Nearby street segment hash, tracks, world-road paths, active placed footprints, places and directional radii, terrain/slope/water/rivers/lakes, walls/bastions, citadel, bailey/motte, ward, hill-castle and remnant rings. Survey does not construct or run the final `serviceAccess` branch. |
| `storageRoadPlan` | Candidate door and dimensions, eligible street segments and widths/flags, linked quays, street access, `armyObstacle` and `armySegmentClear` for buildings, forts, paid crossings and terrain. |
| `storageRoute` / `storageAccess` | Siege/quarantine, exact street point coordinates and flags, street graph, active fort/wall/gate shapes and damage, global road crossings, source/destination coordinates. |
| `planLand` / `landValue` | Field identity, kind/state/held/area; nearest nonremoved building positions in nearby settlements; current settlement population and position. These are live value inputs as well as geography. |

Candidate order is also an input: a grange tries the first twelve tilled furlongs,
each at eight ordered offsets; a warehouse tries eight offsets at the first
market/position. First equal-return quote wins. Reuse must preserve that order.

## Writer inventory and limits

| Mutable data | Source writer families reviewed |
|---|---|
| Streets and layout hashes | Layout `addStreet`, `place`, `unplace`; live growth/widening, `stopUp`, `planStreet`, `planOpen`, `planSquare`, `clear`, fire cleanup, citadel/lane pruning, house-lane opening and courtyard/infill work. Mutable footprint references can change outside hash insertion/removal. |
| World roads | Generation, player road command, completed ways, `stitchRoads` (rewrites paths). `onRoad` reads `open || path`, while `fits` reads `path`; both geometries matter. |
| Walls and forts | `newCircuit`, `setRectWall`, `fortPrepare`, live wall plans, repair/razing, wall damage, siege breaches and project completion. Include gates, damage and build progress wherever access helpers read them. |
| Buildings and occupied sites | Layout/rural/storage placement, growth/widening/refits, project removal, fire/war, rebuild/demolition. `planLand` reads position/removal; `fits` reads the full live footprint. |
| Fields and tracks | `setFurlong`, `shapeFurlong`, `claimFurlong`, land/tenure/inheritance transitions, tilled-list/domain edits; `settleTracks` rewrites `W.trackSet` when land paths become dirty. Anchor order and coordinates must survive same-count edits. |
| Places and reservations | Initial layout and `planSquare`; commission, cancel/death and completion of active storage projects. |
| Value and accounts | Population setters after meals/moves; real transfers, inheritance, head/trade changes, price updates, ownership handover and all native stock/custody writes. |

Terrain arrays and initial river/lake/track-graph geometry have generation
writers; no ordinary runtime terrain writer was found. Treating them as immutable
still needs a command/load-path check. No general layout epoch covers the other
writers. `updateBuildingInstance` is a presentation hook and must not invalidate
authoritative simulation caches.

The existing `_storageRouteSignature` includes street flags and point counts,
but omits same-count coordinate edits. It cannot validate persistent quote
reuse. Synchronous `STORAGE_ROUTE_BATCHES` also supplies no cross-day guarantee.

## Implementation sequence

1. Separate current eligibility/economics from ordered site/route candidates;
   read exposure from current custody and preserve paid working-day progress.
2. Give reusable geometry a complete input certificate. A private fingerprint
   is possible, but must include actual coordinates/flags, live footprint and
   fort shapes, tracks, road open/path geometry and project reservations. Keep
   population/land value and prices live. A broad geometry count is insufficient.
   Closure-local hashes and mutable references need cold-layout/load coverage.
3. Clear/rebuild stale route graphs when that certificate changes. Recompute
   current return and payer eligibility each day, even when sites are reused.
4. Test single-input changes, same-count edits, unchanged negative proposals,
   owner transfer at constant stock, first eligible day, cancellation and
   90/150 paid-day completion/stalls. Then measure the daily conversion against
   its frozen model and prove identical history across speeds.

## Bounded daily conversion selected after the audit

The first conversion uses no cross-day proposal cache. The audit found no cheap,
complete certificate for the private hashes, terrain and access inputs. Instead,
each daily close reads current exposure and means. Under native read-only quote
helpers, the greatest possible avoided loss must exceed labour and materials
amortized over five years before any site is surveyed. Land and handling add
nonnegative costs, so omitting them gives a safe profitability upper bound. This
also avoids recording daily negative proposals that cannot pay back even on free
ground beside the market; it does not impose a calendar throttle.

Ordered proposals are shared by building type only within that synchronous pass.
Their land values and material prices are recomputed on the next day. A first
survey clears both street graph caches so same-count point, road, water and fort
edits are observed; this is deliberately broader than the old signatures. Native
survey functions are registered privately when a layout is made or restored.
Before a full quote, the private street hash must contain an eligible segment
within 32 metres of the door, with a connector clear of the proposed footprint.
These are necessary conditions from `storageRoadPlan`, checked without the
terrain, building or access survey. No segment membership is retained across days.
Changed quote/economic/route helpers, event callbacks or audit observers retain
per-owner evaluation without the bound or proposal sharing. A chosen commission
still re-quotes, posts the existing outcome and starts work tomorrow.

This bounded implementation changes old histories intentionally: decisions are
daily, exposure is current, negative-record policy follows the profitability
bound, and eligible investment surveys use fresh graphs. It does not claim a
persistent geometry certificate or fix graph invalidation for other callers.
Cross-day proposal reuse remains a later optimization, contingent on a complete
certificate and measurements showing that it is worth maintaining.
