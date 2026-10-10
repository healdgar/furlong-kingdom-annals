# Inputs and rates for daily growth

Recorded 2026-10-10 after two read-only Luna audits of `tickGrowth`, `lvField`
and `townWorth`, based on `8d92a4f` plus the daily storage conversion. Growth is
partially converted in the bounded implementation recorded below; funded housing/fabric progress remains next. The original audit is retained as the pre-implementation record.

## Cadence defect in the audited source and separate operations

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

## First bounded implementation selected after the audit

The next batch removes annual cache authority from `lvField` and `townWorth`.
A private WeakMap retains base Float32 arrays under an exact, length-delimited
ordered scalar certificate, compared with `Object.is`. It covers grid bounds,
raw ordered work/home/market/nuisance points and active street geometry/weights.
The native base algorithm retains its original bin/sum/write order. A separate
fear/radial-wall certificate controls final recomposition; population scale stays
live. Native helper identities and residential membership guard reuse. Queries
may read a certified existing base, but misses write only their request-local Map.
Field-taking valuation helpers avoid repeated certificates in pure town-worth
and property reads. `townWorth` sums the current sound noninstitutional buildings
without retaining an annual total; mutable use, tier and footprint remain live.

In the existing serial growth slot, each settlement first reconciles occupancy
and processes due falls daily, then retains six-day housing work, independently
runs widening and vacancy assessment on its exact annual stagger, and retains
six-day fabric work. This fixes previously unreachable annual dates without
multiplying instant construction. A household moving in on the due day saves the
roof. The remaining housing/fabric throttle is explicitly unfinished: its paid
physical-rate/progress design follows in a later batch. This step deliberately
changes old values/history and newly reachable annual assessments; determinism
across speeds, real payments and the render boundary remain required.

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

## Operation-local valuation consolidation (recorded before implementation)

The first combined candidate measures 132.17 CPU ms/day against 96.89 on the
published state over ticks 41–360, at loads 1.4→1.3 and 0.7→1.1. This includes
deliberate model/layout changes, but exposes avoidable certificate repetition.
`tickTenure` grows from 0.234 to 10.737 wall ms/day and growth from 2.863 to
9.538. A further read-only dependency survey identifies these bounded scopes:

- `ownerOf` tests the same building against many possible landlords. Reuse its
  value while native helpers are intact; ownership and wealth do not enter the
  field certificate. Preserve lazy first use and overridden-helper calls.
- `houseFolk` and `moveIn` rank roofs while changing only occupancy. Share one
  lazy field for that operation, retaining live means, work, safety and ties.
- Each `addBuildingLive` attempt ranks its lots and then scores them for one
  household without a geometry write. Share a lazy field within that attempt
  only; a failed build or lane check starts a new attempt, and extension precedes
  the next field lookup. Do not reuse through construction or road changes.
- `houseBuyer`'s rent reduce, the housing fallback ranking and fabric candidate
  ranking each share one lazy field before any construction/tier mutation.
  Preserve the existing daily buyer rent snapshot and every random draw.
- Widening, refitting and street-cut compensation retain fresh ordinary calls:
  their earlier writes can change geometry, uses or nuisances.

Bypasses require captured native public/field/helper identities and otherwise
use the original per-call path. Scope-local fields remain disposable and the
ordinary `lvField` owns all certified-cache updates. No daily snapshot survives
these scopes. Storage commissioning uses scalar `landValue`, not this property
grid; the measured `tickStorage` increase is not attributed to quote kernels.


## Validation of the bounded implementation

The frozen final HTML is `7257f3fa0a45f309bbf7657f0ecedbf88cc1eea8d7254358c53d5bb5f9dc0396`.
Live-field tests compare actual Float32 kernels with a frozen uncached oracle,
including same-count edits, ordered streets/points, fear/walls/population,
query purity and helper overrides. Daily-boundary tests exercise all stagger
indexes and arrival-before-fall rescue. Functional consolidation tests compare
roof/rent and landlord results against frozen per-call algorithms, including
public/work/RNG override fallbacks. Native 150-day pre/post-consolidation and
all-speed comparisons match complete logical graphs, daily RNG/commands/annals
and every accepted storage outcome. Both one-year browser worlds conserve money
and inventory and have no simulation faults. The broad gate verifies 1,517
checks; its only parallel VM capture timeout passes unchanged in isolation.
Final browser/save/release evidence and source hashes are recorded in HANDOFF.md.
These checks cover the bounded implementation; daily paid housing/fabric
progress and first-castle foundations remain further work.
