# Issues

The one list of known bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed; remove fixed items once their release is out (the commit history keeps them, including the retired simulation-debt register, `docs/SIM_DEBT.md`, removed October 2026).

The simulation's rule: things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.

Status: **open**, **investigating**, **in progress**, **queued** (waiting on another item).

## Seen by the player

| # | Issue | Status | Notes |
|---|---|---|---|
| 6 | Resuming a save replays every day (minutes for late games) | open (#5 is out) | Snapshots of worker state in IndexedDB; the journal save stays the permanent format. Saves were verified to replay identically (720 days, worker and reference), so snapshots can be checked against an uninterrupted run. |
| 12 | Famine in most towns most years | open | Pre-existing (original build: 581 famine lines before AD 870 on seed 688673834). Calibration. |
| 13 | The famine annals line repeats every month | open | Hunger crosses the 0.15–0.4 band monthly. |
| 27 | Inspecting things may change the simulation | open | The worker play check sometimes fails with "Inspection target is no longer recorded": with inspections, person p1 drops out near day 114; a replay of the same commands keeps p1 to day 132. Same on the previous build. Lead: the advisor work found two reads that wrote the world — reading a town stored its prices (`price()`) and took the year's trade tally (`tradeCounts`, which moves the market index); removed from the advisor's reads (awaiting merge). Both cache on first read (`s.px[g]`; `s._tc` for the year plus the market-index record), so any reader that calls them before the day's own use fixes the value early. Card builders don't call them directly; `storageSiteQuote` (the storage quote panel) calls `price()` four times — check it and any helper a card reaches. Also: `simulation-worker-check --views true` shows the first `actors` view (the townsfolk the screen draws) changing the world graph, not RNG, on a fresh 8-day run, on main as well (likely a cache made on the world by `townsfolkFor`/`streetGraph`). |
| 29 | Quays and mills sited on river banks no street can reach | in progress | Stop siting them there (decided 2026-10-06; changes generated worlds). Reuse the reachability flood (`armyReach`) added for loading. |
| 30 | Mill wheels are the wrong size and don't reliably touch the water | in progress (with #29) | Possibly from the renderer's river-level changes that improved river looks; the axle also sits 0.25 m into the mill wall (fixed 9 m footprint, 6.8 m offset). |
| 32 | Advisor can't reach every control or read every panel | mostly fixed | Released: every control is found (closed drawer, menu, dialogs, card orders, panel frame) under stable names (`crown:h-honour:3`) with cost, reason and risk; presses await the game's reply; `game:place` passes the target and clears its mode; `game:plan`, `game:panel`, `game:inspect {code, full}`, filtered `game:chronicle`; rules by paragraph from README and `docs/UI-GUIDE.md` only (81 KB, was 271 KB); live check 17/17 (`tools/advisor-live-check.mjs`), 0/17 before. Left: links inside cards (`a.nm`, `a.pp`) are not controls (inspect takes their codes); caravans, envoys, bandit camps and overlay values are read only through inspect, not `game:state`. Knowledge partition not built; choke points `ADV.call`, `ADV.view`, harvest/press, the brief and rules. |
| 28 | Some back-garden lots reach far from their house | open | 126 of the worker's own lots extend over 60 m from the house: real simulation geometry, not the display. |

## Performance

| # | Issue | Status | Notes |
|---|---|---|---|
| 15 | A game day costs ~50–150 ms late in a game; Reel reaches ~27 days/s, not 360 | in progress | Exact speed-ups recovered after the crash (ledger paths, settleTracks, storage routes); untested. Biggest late cost: armies retry impossible campaign routes daily (`tickMilitary` 45–58% of a year-3 day). Fix under way: an exact route cache, "no route" included, cleared when roads, bridges, walls, access, buildings or endpoints change. Cost also grows with the number of places (hamlets multiply: #22). |
| 16 | Fastest reaches 45% of its 30 days/s | partly fixed | Settlement records now go only when they change: Fastest 13.9 → 25.9 days/s (worker build, seed 1001, load ~5). Reel years stays at ~26–28 days/s of a nominal 360; that is the cost of a simulated day (#15), not the packets. |

## Simulation and calibration

| # | Issue | Status | Notes |
|---|---|---|---|
| 19 | Money made or lost without a named payer or recipient | in progress | Still open from the money sweep (M23–M30): bandit loot, metro pooling, toll houses. Also check the lord-gold initialisation and prepaid wages booked as minted. Verify with `tools/soak.mjs --audit`; a 1-year soak on 2026-10-06 reported residual 0. Fixes recovered after the crash (new `tools/money-routes.test.mjs`); untested, one merge conflict with tick-cost's ledger paths; a −10.9 residual at year 19 (seed 1001 sea, day 6715, in `tickPolitics`) was reproduced but not yet fixed. |
| 20 | Two population models (C12) | open, partly fixed | Prosperity now follows what families live by, but a town's population ceiling is still reckoned from land, trade and workshops, not from its households' own living, so the two can part. |
| 21 | Meadow on dry ground (C17) | open | Any strip may go to hay when hay pays: up to half the ploughland turns to meadow and ploughmen go short of bread. Meadow should come from wet bottomland. Likely feeds #12. |
| 22 | Hamlets multiply (C16) | open | Strips stay with holders and heirs, new households are landless and found hamlets: a 400-year history spreads ~1,300 souls over ~85 hamlets. Holdings should be let or shared first, pioneer parties gather over years. Also drives #15. |
| 23 | Calibration pass not yet done | open | The economic replacements changed many interlocking rates at once: growth pace, prosperity levels, castle and church tempo, rebellion frequency, prices, rents, wages and army sizes, to be checked across several worlds and centuries with `tools/soak.mjs`. |

Kept by design (not issues): historical era gates (stone keeps 1070, gothic 1190, bastions 1500, mills, siege engines), the logistic birth curve, army-supply and watch top-up hysteresis, courtyard-house gates, the house-tongue dice.

## Tooling

| # | Item | Status |
|---|---|---|
| 17 | The full history recorder (`history=full`) is off by default and lost its harness; is it dead code? | open: review |
