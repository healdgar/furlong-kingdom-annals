# Direct era initialization: dependency and design record

**Scope.** Start a new world directly in a selected year, defaulting to AD 1066, while retaining AD 850 as an option. This intentionally creates a different initial world from an 850 world played forward. Determinism is required between speeds and replays of the same generated start. No centuries of `simTick()` and no full life-history/archive recording are required before play. An initialized purse, store or holding is part of the opening state; it is not a post-start payment or invented income.

## Current generation order

`startSimulation()` (`index.html:19351-55`, worker/model path) sets fate, coast and `START_AD`, then calls `generateWorld`, `initializeSimulation`, `advancePrehistory`, and `beginChronicle`. Foreground `boot()` (`:19391-94`, `:19406-11`) uses the same generation and initialization functions, then conditionally advances prehistory before opening the chronicle. `advancePrehistory()` (`:19357-64`) executes every daily `simTick()` from `W.startAD` up to `START_AD` when the target is later.

Within `generateWorld()` (`:1414+`), `W.startAD` is currently fixed to `FOUNDING_AD` (850, `:905`, `:1417`). Terrain and sites are generated; settlements are seeded with founding populations and stocks (`:1600-37`); roads are built; each site is laid out (`:1651-56`); and only then are the royal and great houses/nobles created (`:1658-60`, `makeHousesAndCast()` at `:5227+`). `initializeSimulation()` (`:11602-07`) creates land and resources, fences/tracks, and calls `simInit()`. `simInit()` computes resource bases and routes, then `seedFolk()` (`:12123-54`, `:3640-42`) creates people and households from each settlement's population.

The smallest date-path change is to initialize `W.startAD` to `START_AD` for direct-era starts, before settlement layout. Keep `START_AD` equal to the selected year: it is the requested start, is shown as “Annals begin,” and belongs in links/saves. At clock day zero, `year()` is 1; `AD()` and `dateStr()` then report the selected year. Both existing startup paths already skip prehistory when `W.startAD >= START_AD`. This date-path change alone is insufficient: it would skip the lived growth that currently makes an 850-founded world into a later one.

## Opening quantities and existing mechanisms

The current settlement generator has useful native bases, but marks them as intentionally thin founding quantities. At `:1607-10`, `PS=.35`; the capital draws a raw population from 2,200–2,899 before that factor, towns from 420–1,179, and villages from 70–289 scaled by `PS*1.3`, with a 40-person floor. These are per-place size mechanisms, not calibrated 1066 populations. At `:1631-37`, opening grain is `pop * .5`, coastal fish is `pop * .3` (otherwise 8), with small fixed timber, ore, tools, cloth and wine stocks. They are opening balances, not simulated receipts.

Do not multiply population by elapsed years, nor choose an arbitrary “centuries of growth” factor. Reuse the existing raw place-size draws and `pop` input as an explicit direct-era settlement archetype, without the founding thinness factor, as the first bounded baseline to assess. Keep each site's existing role, terrain/resource classification, and food stocks tied to its own starting `pop`. This yields directly seeded people, households, shelter and food rather than empty architectural shells. Treat this as a deliberately new baseline needing first-year calibration; the raw ranges were not validated as later-era densities. If those ranges are too small, choose a defensible direct-era demographic rule from an existing supported quantity (housing capacity and reachable arable/soil yield), document that rule, and derive the target from it. Do not silently encode elapsed years as density.

The land mechanism supplies a consistency check. `genLand()` (`:11112+`) allocates arable and ownership from each place and its population. Its `perHead` is based on reachable arable area and population-weighted land need (`:11145-50`); `soilYield()`/`landYield()` (`:11661-62`) set output from local farm resources and actual tilled area. A direct-era opening can therefore retain the existing per-person land and food-yield relationships, then report land under plough and first-harvest potential against the generated population. The formula adapts acreage to population while land is available; it is not a warrant for arbitrary population growth. At land exhaustion, density cannot be made coherent by the ratio.

`layoutSettlement()` sizes initial housing and street fabric from the supplied `s.pop` (`:2331-33`). `simInit()` seeds a family cohort until resident count reaches `s.pop`; ages are relative to day zero and schooling reads `AD()` (`:3582-606`, `:3626-42`). Houses and notables are generated after layouts. Noble/family ages and birth dates are also initialized relative to day zero by `mkNotable()` (`:3470-78`) and the calls in `makeHousesAndCast()` (`:5227-91`). This keeps the opening ages valid at the selected date; it does not create centuries of lineage or succession. Name the limitation plainly: the direct-start ruler and houses are newly seeded incumbents, not the actual rulers an 850-forward history would have produced.

Do not synthesize unimplemented institutions or their payers. Current opening setup may use mechanisms already present in `layoutSettlement`, including its churches, mills, roads, walls and castle layouts; `initializeSimulation()` supplies terrain-linked fields and infrastructure. The live rules already gate some changes by date, e.g. general eyre at 1166 and mills/water uses by their implemented dates. Give no direct-era start a court tier, abbey/guild, office, or revenue stream unless that institution and its funding/ownership already exist in the simulation. An empty institution list is preferable to invented activity.

## Era/layout chronology hazards

`layoutSettlement()` captures absolute `era=AD()` (`:2341`) and uses it to choose `early`, `motteAge`, number of generated historical epochs `E`, and `FRAC` (`:2341-44`). `tierFor()` uses absolute `era` thresholds 1000 and 1200 (`:2839-41`). Castle form uses `motteAge = era < 1070` (`:2341`) and castle siting branches around `:2590-2660`. At AD 1066, therefore, the generated town is in the later `early=false` layout branch with more epochs, while castles remain motte-age. These conditions are not a single consistent “early/high” switch; preserve and test them deliberately.

Current castle progression also uses absolute `AD()`: a fresh foundation is timber before 1070 and stone from 1070 (`:6989-91` in current worktree); `tickCastles()` can act from day one on an authorized settlement and processes annual upgrades (`:10839-54`); `rebuildKeep()` and timber-to-stone operations reject before 1070 (`:3186-92`). A direct 1066 opening should have timber-era castle assets and must not be upgraded to stone before 1070. At 1250/1350, absolute gates allow later forms; that does not mean a generated asset must exist. `casOf()` defaults round towers at 1200 (`:6971-74`), while layout uses its own era gates. Compare generated layout against live state and report contradictions rather than “fixing” all gates in this initializer.

Generated place histories are synthetic before-play layout records: `hist()` stores `ago` using epoch count and spacing (`:2344-45`). Direct-era layout will therefore retain a place story, but it is not a full chronicle. `beginChronicle()` starts the annals after world setup (`:18588-96`); the full `HISTORY` recorder is separately opt-in. Direct-era initial state should not claim parish books or royal succession records for years that were never simulated.

## Bounded implementation and smoke coverage

1. Keep the 850 path and its current starting populations/stocks unchanged. Set 1066 as the new default selection, retain 850, and use the direct-era branch only when requested. Keep arbitrary accepted `y=` starts (including 1250 and 1350) on the same direct branch.
2. Select target-era opening population from explicit existing per-place baselines; derive opening stores from the existing per-person formulas. Generate settlement layouts at target `AD()`, then create houses/nobles and run land/resources/folk initialization in the existing order. No simulation ticks occur before day zero.
3. Assert at boot: `START_AD === W.startAD === requested year`; day is zero; first displayed date/annals year is the requested year; no prehistory was ticked; population matches seeded residents; every household/person/building/field owner resolves; generated stock and purse balances are finite and represented as opening state; first-day cash/goods audits remain clean.
4. For 1066, 1250 and 1350, inspect settlement sizes, live occupied housing, household count, arable support, opening food/reserves, named holders, and implemented institutions. Check asset chronology explicitly: motte/timber keep at 1066, no early stone upgrade, and no bastions before 1500; verify other expected structures against their existing date gates. Exercise first 360 days for each era so seasonal production, first rents, holdings, growth and court eligibility do not presume pre-start obligations.
5. For each same seed/fate/coast/era, compare fresh direct starts and replay/save-load continuations, then compare 150 days at Normal and Reel with graph and RNG equality. Do not compare direct-era output to an 850-forward output: those are intentionally different worlds.

This scope establishes a coherent direct opening, not a claim that the opening state reproduces any historical 850–1066 trajectory. The first meaningful gate is a stable, populated, economically supported year one at AD 1066 while preserving the unchanged AD 850 option.

## Technology integration boundary (user clarification)

Read `TECH-TREE.md` and `SYSTEMS.md` before implementing this phase. The tree is
still a proposal: realm discovery, local adoption and learning institutions are
not runtime state yet. Add a pure model-side construction-capability query and
route generated castle forms, first-foundation specifications and existing
timber/motte conversions through it. Preserve current calendar behavior until
saved realm knowledge and place adoption supply its answer. It must consume no
RNG, perform no payments or world writes, and never depend on rendering.

Capability answers whether a building method is available. Geological stone,
timber/stone custody, sellers, site rights, patron authority, payoff and purse
remain separate prerequisites; knowing masonry does not create material. Later
cranes/wheelbarrows can affect quoted work quantities through the same model
boundary when those techniques actually exist. Do not grant their efficiency
effects merely because a later start was selected.

The legacy stone-keep gate is AD 1070; the proposed technology table says 1080.
Keep 1070 as an explicitly documented compatibility fallback for this phase,
and reconcile the date when #44 is implemented. The hook does not implement the
tree's discovery, lag, adoption, patronage or missing institutions. Migrating
the other dated structures and institutions remains part of #44.
