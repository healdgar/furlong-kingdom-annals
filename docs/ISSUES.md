# Issues

The one list of known bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed; remove fixed items once their release is out (the commit history keeps them, including the retired simulation-debt register, `docs/SIM_DEBT.md`, removed October 2026).

The simulation's rule: things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.

Status: **open**, **investigating**, **in progress**, **queued** (waiting on another item).

## Seen by the player

| # | Issue | Status | Notes |
|---|---|---|---|
| 1 | Garden lots and fences break into long spokes across the fields after play | in progress | `settleParcels` changes `b.lot` but never republishes the building; the screen joins stale outlines. Boundary fix. |
| 2 | Animation is blocky at every speed since the worker move | investigating | The screen's clock only advances when a packet arrives. Fix after #1: continuous screen clock plus interpolation. |
| 3 | Streets built through houses | investigating | Either a road-building path ignores houses, or the worker demolishes them and the screen is never told. Rule: demolish (with compensation) or route around. |
| 4 | Loading pauses at "Raising timber and stone" | investigating | All settlement layouts run in one synchronous loop with no progress updates. Measuring which part is slow. |
| 5 | Refresh restarts the game at AD 850 | queued (after #1) | Boot rewrites the link without the save. Resume the session's save on reload; autosave on `pagehide`. |
| 6 | Resuming a save replays every day (minutes for late games) | queued (after #8) | Snapshots of worker state in IndexedDB; the journal save stays the permanent format. |
| 7 | Reel years: a self-pause (petition, campaign end, fault) never reaches the screen; date lags 17 days and jumps 30 | in progress | Boundary fix: publish immediately on pause; small per-day clock message. |
| 8 | Saved games replay differently (278 of 919 households differ by day 360, seed 688673834) | investigating | Only with the commodity ledger; legacy ledger replays identically. Blocks #6. |
| 9 | All trees one size; saplings appear full-grown | in progress | Projection drops primitive `s`. Boundary fix. |
| 10 | Walls drawn over cliffs, water and razed stretches; sieges invisible; hill castles, wards and close rings missing | in progress | `wallKind`, `siegeBy`, castle rings not projected. Boundary fix. |
| 11 | Mills founded after load have no waterwheel | in progress | `rebuildMillWheels` runs only at boot. Boundary fix. |
| 12 | Famine in most towns most years | open | Pre-existing (original build: 581 famine lines before AD 870 on seed 688673834). Calibration. |
| 13 | The famine annals line repeats every month | open | Hunger crosses the 0.15–0.4 band monthly. |
| 14 | Daughter villages stack names ("Nether New Villeneuve-Port-Neuf-la-Neuve") | open | Polish. |

## Performance

| # | Issue | Status | Notes |
|---|---|---|---|
| 15 | A game day costs ~50–150 ms late in a game; Reel reaches ~27 days/s, not 360 | open | After the boundary fix. Cost grows with the number of places (hamlets multiply: #22). |
| 16 | Fastest reaches 45% of its 30 days/s | in progress | Each daily packet carries 8–11 MB of mostly unchanged structure; siege arcs clone whole towns (24 MB). Boundary fix removes the clones; send structures only when changed after. |

## Simulation and calibration

| # | Issue | Status | Notes |
|---|---|---|---|
| 19 | Money made or lost without a named payer or recipient | open | Still open from the money sweep (M23–M30): bandit loot, metro pooling, toll houses. Also check the lord-gold initialisation and prepaid wages booked as minted. Verify with `tools/soak.mjs --audit`; a 1-year soak on 2026-10-06 reported residual 0. |
| 20 | Two population models (C12) | open, partly fixed | Prosperity now follows what families live by, but a town's population ceiling is still reckoned from land, trade and workshops, not from its households' own living, so the two can part. |
| 21 | Meadow on dry ground (C17) | open | Any strip may go to hay when hay pays: up to half the ploughland turns to meadow and ploughmen go short of bread. Meadow should come from wet bottomland. Likely feeds #12. |
| 22 | Hamlets multiply (C16) | open | Strips stay with holders and heirs, new households are landless and found hamlets: a 400-year history spreads ~1,300 souls over ~85 hamlets. Holdings should be let or shared first, pioneer parties gather over years. Also drives #15. |
| 23 | Calibration pass not yet done | open | The economic replacements changed many interlocking rates at once: growth pace, prosperity levels, castle and church tempo, rebellion frequency, prices, rents, wages and army sizes, to be checked across several worlds and centuries with `tools/soak.mjs`. |

Kept by design (not issues): historical era gates (stone keeps 1070, gothic 1190, bastions 1500, mills, siege engines), the logistic birth curve, army-supply and watch top-up hysteresis, courtyard-house gates, the house-tongue dice.

## Tooling

| # | Item | Status |
|---|---|---|
| 17 | Delete `tools/history-check.mjs` (fails on any ledger; tests the off-by-default full history recorder) | in progress; then review whether the recorder is dead code |
| 18 | Delete frozen baseline modules (`*-baseline.mjs`) and their old-versus-new comparison tests | in progress |
| 24 | `game-write-*` prototype (5 tests) and `long-run-check` (overlaps soak) | proposed for deletion |
