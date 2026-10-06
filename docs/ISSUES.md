# Issues

The one list of known bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed; remove fixed items once their release is out (the commit history keeps them, including the retired simulation-debt register, `docs/SIM_DEBT.md`, removed October 2026).

The simulation's rule: things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.

Status: **open**, **investigating**, **in progress**, **queued** (waiting on another item).

## Seen by the player

| # | Issue | Status | Notes |
|---|---|---|---|
| 2 | Animation is blocky at every speed since the worker move | investigating | The screen's clock only advanced when a packet arrived. A per-day clock message from the worker now exists (`G.workerClock`); next: a continuous screen clock and interpolation of moving things. |
| 3 | Streets built through houses | queued | Verified simulation bug: back lanes (`branch` → `walk`) never test standing houses, so lane mouths cut through frontage houses; 10–19 overlaps per world at start, 34–45 by year 2 as reserved lanes open. Display is fine. Tested fix rejects blocked lanes (overlaps → 0, ~10% fewer houses at start); try moving blocked mouths to frontage gaps first to keep density. Changes generated towns for every seed. |
| 4 | Loading pauses at "Raising timber and stone" | investigating | All settlement layouts run in one synchronous loop with no progress updates. Measuring which part is slow. |
| 5 | Refresh restarts the game at AD 850 | queued | Boot rewrites the link without the save. Resume the session's save on reload; autosave on `pagehide`. |
| 6 | Resuming a save replays every day (minutes for late games) | queued (after #5) | Snapshots of worker state in IndexedDB; the journal save stays the permanent format. Saves were verified to replay identically (720 days, worker and reference), so snapshots can be checked against an uninterrupted run. |
| 12 | Famine in most towns most years | open | Pre-existing (original build: 581 famine lines before AD 870 on seed 688673834). Calibration. |
| 13 | The famine annals line repeats every month | open | Hunger crosses the 0.15–0.4 band monthly. |
| 14 | Daughter villages stack names ("Nether New Villeneuve-Port-Neuf-la-Neuve") | open | Polish. |
| 25 | Saving right after a goods command reloads with different ledger revision counters | queued (with #5) | Economy unaffected. A save or the 1 s flush settles the day's goods early, which a replay can't reproduce. Fix: journal the off-day settlement (tested on a scratch copy). |
| 26 | The rebel command confirms with two clicks within 5 s of wall-clock time | queued (with #5) | Stored in `W.player.confirmUntil`; a replay applies the clicks back to back and could start a war the player never started. Confirm in the UI or count game days, journal only the confirmed command. |
| 27 | Inspecting things may change the simulation | open | The worker play check sometimes fails with "Inspection target is no longer recorded": with inspections, person p1 drops out near day 114; a replay of the same commands keeps p1 to day 132. Same on the previous build. |
| 28 | Some back-garden lots reach far from their house | open | 126 of the worker's own lots extend over 60 m from the house: real simulation geometry, not the display. |

## Performance

| # | Issue | Status | Notes |
|---|---|---|---|
| 15 | A game day costs ~50–150 ms late in a game; Reel reaches ~27 days/s, not 360 | open | After the boundary fix. Cost grows with the number of places (hamlets multiply: #22). |
| 16 | Fastest reaches 45% of its 30 days/s | open | Siege-arc clones (24 MB) are gone; daily packets average ~1 MB. Re-measure with `tools/speed-check.mjs`, then send structures only when they change. |

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
| 17 | The full history recorder (`history=full`) is off by default and lost its harness; is it dead code? | open: review |
| 24 | `game-write-*` prototype (5 tests) and `long-run-check` (overlaps soak) | proposed for deletion |
