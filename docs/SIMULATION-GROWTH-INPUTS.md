# Inputs and rates for daily growth

Recorded 2026-10-10 after two read-only Luna audits of `tickGrowth`, `lvField`
and `townWorth`, based on `8d92a4f` plus the daily storage conversion. Growth is
not converted yet. This records the next bounded refactor before implementation.

## Cadence defect and separate operations

`tickGrowth` returns unless `day()%6===0`. Its two annual blocks require
`day()%360===(settlementIndex*29)%360`. Because 360 is divisible by six and 29
is coprime to six, only settlement indexes divisible by six can enter those
annual blocks. Other settlements never receive the scheduled frontage-widening
or vacancy/refit/maintenance assessment. Removing the outer guard alone would
also multiply housing and rebuilding opportunities; split the quantities first.

| Operation | Current inputs and effects | Daily conversion |
|---|---|---|
| Occupancy and dated falls | `moveIn`, household/home links, `tickFalling` and `_fallAt` | Reconcile current occupancy; process a fall on its due day. A new occupant can save a scheduled roof. |
| Housing | Current crowding, carpenter/mason/thatcher heads, timber, siege, funded `houseBuyer`, layout plots/crofts | Daily funded decisions with explicit work progress and current materials. Commit the roof/room when the work completes. |
| Frontage widening | Up to 20 core houses per annual visit; current owner, live clearance, rent gain ×12 versus cost | Daily marginal proposals and real effort, preserving candidate order and actual payer. |
| Vacancy/refit/maintenance | Empty homes, richest eligible craftsman, `_vac` years, maintenance cost, discounted rent hope | Separate use decisions from elapsed vacancy and genuine maintenance obligations. Refitting moves the actual household and pays its bill. |
| Ruin scheduling | Lowest-return empty homes; annual quota `ceil(empty²/homes)`, dated falls spread through 330 days | Define a daily physical deterioration model or retain an explicitly dated assessment, rather than multiply the annual quota. |
| Better building fabric | A 25% chance per six-day visit, sampled candidates, 25-year rent gain, tier/material limits, owner bill | Separate daily economic eligibility from physical effort/hazard. A probability per invocation is not an annual probability. |

Housing capacity is currently `min(shortfall,(1+builderHeads)*.25*timberFactor)`
per six-day visit, then stochastically rounded. Its implied mean is one roof per
24 days per counted hand, including an unexplained base hand. There is no stored
work progress. That rate is evidence for choosing a model, not an existing paid
construction duration. The base capacity needs actual self-build/general labour
or removal; no stand-in worker or payer is permitted.

`houseBuyer` first tries a funded unhoused household; otherwise the forecast rent
must repay cost and a funded investor/lord must exist. `buildWorks` distributes
the real bill to named builders/local hands. `buyBuildingMaterial` buys actual
local stock. Keep those transfers and execution-time solvency. Existing upgrades
and new roofs currently finish instantly; splitting a bill over workdays is a
deliberate model change, with explicit saveable progress and completion rules.

## Property-value inputs

`lvField` currently accepts a year-only cache. Its expensive 16-metre grid bins
work/home points, markets and nuisances, then resamples street frontage. The
geometry reads building order, position, arch/tier/cathedral/state/removal;
market-place order/positions; street order/points/kind/market/width/hidden/gone;
town position/bounds; and `inWalls` (position and radial wall geometry).
Nuisance points include nonremoved tanneries/dyers even when not sound.

Live population sets the scale `max(20,pop)^.3`. Fear reads the current raid
expiry, siege and realm war. Fear changes the safe premium inside the walls;
it is added before the floor and Float32 rounding, so applying a multiplier to
the old rounded values would be incorrect. A reusable base kernel must retain
enough intermediate values to recompute the same final cell arithmetic.

The year key misses same-year population/security changes, added/removed/refitted
buildings, same-count geometry edits, streets, markets and walls. Its saved
building count is not an invalidation certificate. `townWorth` separately caches
25 times the sum of sound, non-institutional property rents for a year. Fixing
`lvField` alone would leave that sum stale. Purses, owners and market prices are
not inputs to the mathematical grid; they remain live decision/payment inputs.

The next kernel design must certify the actual ordered scalar/array inputs,
including same-count edits, rather than use the drawing hook or a census count.
Geometry can be retained only with that complete certificate; population, fear,
building-specific rent factors and account limits must stay current. Query
memoization must remain read-only, and generated/restored layouts need coverage.

A bounded cross-day base certificate is feasible here: unlike storage access,
the grid reads explicit public lists. Retain the costly Float32 `job/hh/mk/ft/nu`
arrays and their maxima. Compare a length-delimited ordered scalar snapshot of
the grid tuple, derived `lvJobs`/home/market/nuisance points and active streets
(kind/market/width and every point coordinate). Preserve bin insertion and sum
order. Native helper identities and `RESID` membership must also be guarded.
Recompose final `res/biz` only when base geometry, wall position/radial samples
or the fear scalar changes, using the original arithmetic and Float32 writes;
population scale is cheap and live. Wall damage/gates are not `inWalls` inputs,
though wall radius sets grid bounds. Every final-field consumer, including
`lotRentAt`, overlays and `propValue`, needs that current field. View misses may
populate the request-local query Map, never install new canonical caches.
`townWorth` needs its own current-value policy. This is a design to implement
and verify, not an implemented cache or a demonstrated speed improvement.

## Order, writers and verification

Keep growth after meals/households/projects in the recorded daily order:
occupancy/due falls → funded housing work → widening/reuse decisions → fabric
improvement. Geometry commits stay serial before streets/churches/castles,
courtyard/infill/settlers, repairs, ways and remaining stone demand.

`addBuildingLive` may extend the town (with the lord's real bill and a 90-day
extension date), reopen lanes, claim a plot/croft, reduce a field and stitch
roads. Widening changes footprints and parcels. Other writers include fire,
war, repair/rebuild, demolition, refits, markets, walls and direct point edits.
Household moves, deaths and inheritance change occupancy, buyers and owners.
`updateBuildingInstance` remains presentation plumbing, not cache authority.

Verify unreachable old annual dates, due-day falls, real funding/material stalls,
paid work and one completion, occupancy/ownership changes, same-count kernel
input edits, live fear/population, cold world-load continuation, money/goods and
same history across speeds. Old RNG streams and histories may change deliberately;
speed/frame/yield-dependent decisions remain forbidden. No performance gain or
complete invalidation proof is claimed by this preparatory audit.
