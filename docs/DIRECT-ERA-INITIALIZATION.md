# Direct era initialization: dependency and design record

**Implemented scope (2026-10-10).** New worlds default to a direct AD 1066 start; AD 850 remains an explicit founding-era option. Direct starts from AD 851 through 1500 initialize the requested year in `W.startAD`, generate settlement fabric and people for that date, and begin play at day zero without simulating intervening years. The AD 850 option retains the original sparse founding population and stock path. Later requested new-game starts use direct generation. Direct starts intentionally differ from a world founded in 850 and played forward. Determinism is required between speeds and replays of the same generated start. An initialized purse, store or holding is part of the opening state, not a post-start payment or invented income.

The implementation uses the existing random place-size draws at full scale for direct starts (`PS=1`; the AD 850 path remains `PS=0.35`), with opening food stocks still derived from each settlement's generated population. It keeps the existing terrain, site roles, land allocation, layout, people and ownership machinery; it does not synthesize centuries of people, lineage, court records or institutional income. Same-seed/fate/coast/year direct openings are intended to match across speeds. Verification results and any release evidence belong in the handoff, not this design record.

## Current generation order

`startSimulation()` and foreground `boot()` set `START_AD` before generation and initialization, then call `advancePrehistory()` only if the generated `W.startAD` precedes the requested date. Direct starts set `W.startAD=START_AD`, so they skip prehistory and begin at day zero; the AD 850 option sets `W.startAD=850` and retains the original simulation path. The default is AD 1066. `&y=` links still select any accepted year from 850 through 1500; the World tab offers 850, 1066, 1250, 1350 and 1400.

Within `generateWorld()`, terrain and sites are generated; settlements receive populations and opening stocks; roads and settlement layouts follow; then royal and great houses/nobles are created. The direct-era branch sets the world date before layout so its existing absolute-era rules apply to generated forms. `initializeSimulation()` creates land and resources, fences/tracks, and calls `simInit()`, which computes resource bases and routes before `seedFolk()` creates people and households from the generated population.

Keep `START_AD` equal to the selected year: it is the requested start, appears as “Annals begin,” and belongs in links/saves. At clock day zero, `year()` is 1; `AD()` and `dateStr()` report the selected year. The direct-era branch skips prehistory by setting `W.startAD` to that year. An 850 game can still be played forward through later years; choosing a later new-game start generates a separate contemporary opening.

## Opening quantities and existing mechanisms

The generator uses the same raw per-place draws for both paths: the capital draws 2,200–2,899, towns 420–1,179, and villages 70–289 with a 40-person floor. The 850 path multiplies these by its sparse-founding factor (`PS=.35`, villages scaled by `PS*1.3`); direct-era starts use `PS=1`, retaining the native 1.3 village multiplier. These raw ranges are a deliberate bounded baseline, not a claim of calibrated historical population. Opening grain remains `pop * .5`, coastal fish `pop * .3` (otherwise 8), plus the existing small fixed stocks. These are opening balances, not simulated receipts.

No elapsed-year multiplier or “centuries of growth” factor is used. Existing place-size draws and `pop` provide the direct-era baseline. Each site's role, terrain/resource classification and food stocks remain tied to its generated population. This directly seeds people, households, shelter and food rather than empty architectural shells. The raw ranges are not validated as a historical census; first-year calibration remains a separate question. Any later density revision should derive from a supported quantity such as housing capacity or reachable arable/soil yield, not encode elapsed years as population.

The land mechanism supplies a consistency check. `genLand()` allocates arable and ownership from each place and its population. Its per-head need reflects reachable arable area and population-weighted land need; `soilYield()` and `landYield()` set output from local farm resources and actual tilled area. A direct-era opening therefore retains the existing per-person land and food-yield relationships. Report land under plough and first-harvest potential against generated population when assessing calibration. The acreage formula adapts while land remains; it is not a warrant for arbitrary population growth. At land exhaustion, density cannot be made coherent by the ratio.

`layoutSettlement()` sizes initial housing and street fabric from `s.pop`. `simInit()` seeds family cohorts to the settlement's population; ages and schooling use the selected start date. Houses and notables are generated after layouts, with their ages and birth dates relative to day zero. This keeps opening ages valid at the selected date; it does not create centuries of lineage or succession. The direct-start ruler and houses are newly seeded incumbents, not the actual rulers an 850-forward history would have produced.

Do not synthesize unimplemented institutions or their payers. Current opening setup may use mechanisms already present in `layoutSettlement`, including its churches, mills, roads, walls and castle layouts; `initializeSimulation()` supplies terrain-linked fields and infrastructure. The live rules already gate some changes by date, e.g. general eyre at 1166 and mills/water uses by their implemented dates. Give no direct-era start a court tier, abbey/guild, office, or revenue stream unless that institution and its funding/ownership already exist in the simulation. An empty institution list is preferable to invented activity.

## Era/layout chronology hazards

`layoutSettlement()` captures absolute `era=AD()` and uses it for its `early` layout branch, number of generated historical epochs, epoch fractions and tiers. Castle form and site choice also use date-dependent rules. The shared `constructionCapability()` calendar fallback keeps timber/motte forms before AD 1070; at AD 1066 the town uses the later `early=false` branch while its castles remain motte-age. These conditions are not a single consistent “early/high” switch; preserve and assess them separately.

Castle progression uses absolute `AD()`: first foundations are timber before 1070 and stone from 1070; `tickCastles()` can consider a qualifying first foundation from day one while existing upgrades keep their annual cadence. Timber/motte conversions use the same 1070 calendar fallback. A direct 1066 opening therefore uses timber-era castle assets and cannot upgrade them to stone before 1070. Later dates permit later forms, but do not imply that a generated asset must exist. `casOf()` and layout also have their own era rules. Compare generated layout against live state and report contradictions rather than “fixing” all gates in the initializer.

Generated place histories are synthetic before-play layout records: `hist()` stores entries by epoch count and spacing. Direct-era layout therefore retains a place story, but it is not a full chronicle. `beginChronicle()` starts the annals after world setup; the full `HISTORY` recorder is separately opt-in. Direct-era initial state should not claim parish books or royal succession records for years that were never simulated.

## Implemented scope and remaining verification

The implementation keeps AD 850 as the original sparse start, makes AD 1066 the default, and routes later accepted `y=` years through direct generation with no earlier ticks. The checks below remain the evidence boundary for release and calibration; this document does not claim those checks passed.

1. Assert at boot: `START_AD === W.startAD === requested year`; day is zero; first displayed date/annals year is the requested year; no prehistory was ticked; population matches seeded residents; every household/person/building/field owner resolves; opening stock and purse balances are finite and represented as opening state; first-day cash/goods audits remain clean.
2. For 1066, 1250 and 1350, inspect settlement sizes, live occupied housing, household count, arable support, opening food/reserves, named holders, and implemented institutions. Check asset chronology explicitly: timber/motte forms at 1066, no stone upgrade before 1070, and no bastions before 1500; verify other structures against existing date gates. Exercise the first 360 days so seasonal production, first rents, holdings, growth and court eligibility do not presume pre-start obligations.
3. For each same seed/fate/coast/year, compare fresh direct starts and replay/save-load continuations, then compare days at Normal and Reel with graph and RNG equality. Do not compare direct-era output to an 850-forward output: those are intentionally different worlds.

This scope establishes a direct calendar opening, not a claim that the opening state reproduces any historical 850–1066 trajectory. The direct-era start changes the opening world model; history after that opening must remain deterministic across speeds and replays.

## Technology integration boundary (user clarification)

The implementation adds a pure model-side construction-capability query and
routes generated castle forms, first-foundation specifications, existing
timber/motte conversions and stone demand through it. The technology tree is
still only a proposal: there is no saved realm knowledge, local adoption or
learning state. The query consumes no RNG and performs no payments or world
writes; it does not depend on rendering.

Capability answers whether a building method is available. Geological stone,
timber/stone custody, sellers, site rights, patron authority, payoff and purse
remain separate prerequisites; knowing masonry does not create material. Later
cranes/wheelbarrows can affect quoted work quantities through the same model
boundary when those techniques actually exist. Do not grant their efficiency
effects merely because a later start was selected.

The runtime calendar fallback for a stone keep remains AD 1070, while the
proposal table gives the stone keep a historical year of 1080. This preserves
existing behavior until #44 implements actual discovery/adoption and the date is
reconciled. The hook does not implement the tree's discovery, lag, adoption,
patronage or missing institutions. Migrating other dated structures and
institutions remains part of #44.

The modern opening can still exceed native residential household capacity (#61).
[DIRECT-ERA-CAPACITY.md](DIRECT-ERA-CAPACITY.md) records the measured shortfall,
initializer dependencies and a proposed legal fabric-completion phase. Clean
chronology, cash and inventory gates do not establish economic calibration.
