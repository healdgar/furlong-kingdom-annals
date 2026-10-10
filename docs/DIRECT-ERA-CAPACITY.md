# Direct-era opening capacity: dependency record

## Status and evidence

The direct-era opening is operable, and the native 1066, 1250, and 1350 chronology gates pass. Issue 61 remains open: the current opening can place more headed households than its generated residential fabric can house. This is a day-zero capacity discrepancy, not evidence that the selected year has an incorrect population.

Two reported audits found:

| Requested start | Seed / coast | Headed households | `capOf` places | Difference |
| --- | --- | ---: | ---: | ---: |
| AD 1066 | 1001 / sea | 2,628 | 2,412 | 216 |
| AD 1250 | 42 / sea | 2,676 | 1,169 | 1,507 |

These runs used different seeds, so their population, layout, and capacity differences cannot be attributed to era. Compare eras with matched seed and coast before drawing an era-effect conclusion. These figures are observations, not target densities or calibration thresholds.

## What currently determines the opening

`generateWorld()` in `index.html` (~1423; settlement draws ~1617) selects each place's raw `pop` and its starting stores. A direct-era world uses `PS=1`; the AD 850 founding uses `PS=0.35`. Direct-era population is therefore the existing per-place native draw, with no simulated centuries or elapsed-year multiplier. Stores such as grain (`pop * 0.5`) and coastal fish (`pop * 0.3`) are seeded against that same opening population.

`generateWorld()` lays out every settlement before `makeHousesAndCast()` (~1660 and ~5237). `layoutSettlement()` (~2336) calculates a *building-attempt target* from population (`round(pop/4)` for a capital; `round(pop/4.2)` otherwise, with caps). This target is not a residential-household capacity target: the layout also adds non-residential buildings, and not every intended lot succeeds. `fill()` only tries available street-frontage candidates; `buildLot()` can reject a lot for footprint fit or clear road access. Layout history can also clear houses for a citadel. Thus the target count does not imply a fixed number of surviving homes.

Later, `simInit()` (~12133) derives resource bases from the generated site's biomes and calls `seedFolk()`. `seedFolk()` (~3650) loops until the number of people reaches `round(s.pop)`, adding complete families; the final whole family can make the actor count exceed the nominal person target. The weighted canonical settlement population still starts at the raw draw; actor count and household slots are distinct quantities. `seedHousehold()` (~3636) supplies each family and seeds the head's starting purse from the existing needs/trade mechanism. That purse is part of the opening state, not a simulated payment or income history.

`capOf(b)` (~3739) is the authoritative residential capacity in households: storeys times frontage bays. `houseFolk()` (~4946) assigns household heads against that capacity. If every home is full, its final fallback still lodges households in already-full homes. This keeps people present but does not make the fabric sufficient. Use headed-household count and `sum(capOf(sound, non-removed residential buildings))` to report the gap; do not substitute `housing(s)` (~14433), which uses a separate five-person-per-roof estimate for another UI purpose.

The land pass `genLand()` (~11122) derives ploughland demand from the same `s.pop` and `landWt(s)`, then sets `W.land.perHead` from available reachable arable land and tills a corresponding amount. It adapts land allocation to the opening population; it is not an independent population ceiling. Food yield and land carrying-capacity calibration belong to #12/#23 and should stay separate from this housing issue.

The current starting stores, biome resource bases, housing, people, and land are distinct inputs. `makeHousesAndCast()` seeds implemented dynastic houses and the crown. Do not infer or fabricate abbeys, guilds, offices, technology adoption, rents, construction payments, or other institutions from the date. A church/friary building is not by itself a generated abbey institution. No post-start cash, stock, or transaction should be added to disguise an opening shortage.

## Bounded follow-on proposal

Preserve each direct-era site's raw population draw and make the *opening fabric* meet the exact household capacity it needs. Keep AD 850 on its existing path and unchanged. Do not multiply population by elapsed time, use a souls-per-slot conversion, shrink the native population to fit the current layout, or silently overbook capacity.

A coherent direct-era-only ordering is:

1. Generate settlements, their native raw `pop`, stores, resource classifications, and ordinary layout as today.
2. Initialize resource bases and seed the actual native population and households through the existing mechanisms. Count household heads with the same `householdHead()` semantics used by `houseFolk()`; do not estimate household count from persons.
3. Compare that exact count with the summed `capOf()` of sound, non-removed residential buildings. If short, use the settlement's existing layout context/closures (`_lay`, including legal frontage/fit/access checks) to complete additional residential fabric. These buildings are part of the opening world; they do not imply an unrecorded chain of pre-start payments or simulated events.
4. Stop with an explicit unsatisfied-capacity result if legal lots, roads, water, terrain, or settlement extent prevent completion. Never make `houseFolk()`'s overflow lodging count as success.
5. Run ordinary household placement and the existing land pass on the completed opening. Report land/food support separately; do not add fields or stocks as a housing fix.

The implementation must respect deterministic layout RNG and be idempotent across foreground/worker generation and save/load. A capacity completion must use real placed residential buildings and the existing capacity function, not an abstract slot count. If additional extent is needed, use the supported settlement growth path and legal geometry. Avoid inventing an arbitrary outer radius or retry count as a hidden population rule; expose a concrete failure when legal geometry is exhausted.

## Focused acceptance checks

For matched seed/coast pairs at AD 1066, 1250, and 1350, and a regression pair at AD 850:

- Record requested start year, actual `W.startAD`, day zero, and that no pre-start `simTick` or chronicle entries were produced.
- Record seed/coast and native `s.pop`, actual people, headed households, surviving residential buildings, and summed `capOf` by settlement and for the realm.
- For direct-era starts, assert each household head has a distinct available capacity slot at opening, or assert a surfaced legal-capacity failure; no hidden full-house lodging.
- Confirm added homes pass existing frontage, footprint, road-access, and water/terrain checks and are residential under the existing architecture rules.
- Confirm opening purses/stores still come from existing initialization, with no invented payments, income, institutions, or transactions.
- Confirm AD 850's layout, population, capacity, and chronology remain byte-for-byte/seed-for-seed unchanged by the direct-era branch.
- Keep arable acreage, yield, and food sufficiency observations as diagnostics for #12/#23, not as a rule that changes population or housing.
