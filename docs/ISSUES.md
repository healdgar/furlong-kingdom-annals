# Issues

The one list of known bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed; remove fixed items once their release is out (the commit history keeps them, including the retired simulation-debt register, `docs/SIM_DEBT.md`, removed October 2026).

The simulation's rule: things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.

Status: **open**, **investigating**, **in progress**, **queued** (waiting on another item).

## Seen by the player

| # | Issue | Status | Notes |
|---|---|---|---|
| 2 | Animation is blocky at every speed since the worker move | in progress | Measured: the screen clock held still between messages (~6 Hz), so carts sat still 90% of frames and jumped 37 m (Normal) / 136 m (Fast); citizens snapped without interpolation; the clock blipped backwards after commands; folk vanished at midnight. Fix: per-frame presentation clock anchored to the worker's messages (prototype restores reference smoothness), citizen interpolation, herd fixes. |
| 3 | Streets built through houses | in progress | Verified simulation bug: back lanes (`branch` → `walk`) never test standing houses, so lane mouths cut through frontage houses; 10–19 overlaps per world at start, 34–45 by year 2 as reserved lanes open. Display is fine. Tested fix rejects blocked lanes (overlaps → 0, ~10% fewer houses at start); try moving blocked mouths to frontage gaps first to keep density. Changes generated towns for every seed: accepted, new baseline. |
| 4 | Loading pauses at "Raising timber and stone" (42–48 s on seed 287970763) | in progress | 85% is failing route searches giving far-bank quays, mills and churches a road (`armyDetour`): rivers are uncrossable without a paid road, so each door floods the same bank 36 times. Exact fix (flood reachability once, skip unreachable targets): 46 s → 5 s, worlds identical. Adds per-settlement progress; the main-thread "Opening the annals" build (6–20 s on large maps) still to check. |
| 5 | Refresh restarts the game at AD 850 | in progress | Boot rewrites the link without the save. Resume the session's save on reload; autosave on `pagehide`. |
| 6 | Resuming a save replays every day (minutes for late games) | queued (after #5) | Snapshots of worker state in IndexedDB; the journal save stays the permanent format. Saves were verified to replay identically (720 days, worker and reference), so snapshots can be checked against an uninterrupted run. |
| 12 | Famine in most towns most years | open | Pre-existing (original build: 581 famine lines before AD 870 on seed 688673834). Calibration. |
| 13 | The famine annals line repeats every month | open | Hunger crosses the 0.15–0.4 band monthly. |
| 14 | Daughter villages stack names ("Nether New Villeneuve-Port-Neuf-la-Neuve") | in progress | Rule: name from the mother's root with her new/upper/nether-type affixes removed and at most one added, or after the founding ancestor; from the second generation on, an ordinary site name. |
| 25 | Saving right after a goods command reloads with different ledger revision counters | in progress (with #5) | Economy unaffected. A save or the 1 s flush settles the day's goods early, which a replay can't reproduce. Fix: journal the off-day settlement (tested on a scratch copy). |
| 26 | The rebel command confirms with two clicks within 5 s of wall-clock time | in progress (with #5) | Stored in `W.player.confirmUntil`; a replay applies the clicks back to back and could start a war the player never started. Confirm in the UI or count game days, journal only the confirmed command. |
| 27 | Inspecting things may change the simulation | open | The worker play check sometimes fails with "Inspection target is no longer recorded": with inspections, person p1 drops out near day 114; a replay of the same commands keeps p1 to day 132. Same on the previous build. |
| 29 | Quays and mills sited on river banks no street can reach | queued (after #4) | Stop siting them there (decided 2026-10-06; changes generated worlds). Reuse #4's reachability flood. |
| 30 | Mill wheels are the wrong size and don't reliably touch the water | queued (with #29) | Possibly from the renderer's river-level changes that improved river looks; the axle also sits 0.25 m into the mill wall (fixed 9 m footprint, 6.8 m offset). |
| 28 | Some back-garden lots reach far from their house | open | 126 of the worker's own lots extend over 60 m from the house: real simulation geometry, not the display. |

## Performance

| # | Issue | Status | Notes |
|---|---|---|---|
| 15 | A game day costs ~50–150 ms late in a game; Reel reaches ~27 days/s, not 360 | in progress | After the boundary fix. Cost grows with the number of places (hamlets multiply: #22). |
| 16 | Fastest reaches 45% of its 30 days/s | in progress | Siege-arc clones (24 MB) are gone; daily packets average ~1 MB. Re-measure with `tools/speed-check.mjs`, then send structures only when they change. |

## Simulation and calibration

| # | Issue | Status | Notes |
|---|---|---|---|
| 19 | Money made or lost without a named payer or recipient | in progress | Still open from the money sweep (M23–M30): bandit loot, metro pooling, toll houses. Also check the lord-gold initialisation and prepaid wages booked as minted. Verify with `tools/soak.mjs --audit`; a 1-year soak on 2026-10-06 reported residual 0. |
| 20 | Two population models (C12) | open, partly fixed | Prosperity now follows what families live by, but a town's population ceiling is still reckoned from land, trade and workshops, not from its households' own living, so the two can part. |
| 21 | Meadow on dry ground (C17) | open | Any strip may go to hay when hay pays: up to half the ploughland turns to meadow and ploughmen go short of bread. Meadow should come from wet bottomland. Likely feeds #12. |
| 22 | Hamlets multiply (C16) | open | Strips stay with holders and heirs, new households are landless and found hamlets: a 400-year history spreads ~1,300 souls over ~85 hamlets. Holdings should be let or shared first, pioneer parties gather over years. Also drives #15. |
| 23 | Calibration pass not yet done | open | The economic replacements changed many interlocking rates at once: growth pace, prosperity levels, castle and church tempo, rebellion frequency, prices, rents, wages and army sizes, to be checked across several worlds and centuries with `tools/soak.mjs`. |

Kept by design (not issues): historical era gates (stone keeps 1070, gothic 1190, bastions 1500, mills, siege engines), the logistic birth curve, army-supply and watch top-up hysteresis, courtyard-house gates, the house-tongue dice.

## Tooling

| # | Item | Status |
|---|---|---|
| 17 | The full history recorder (`history=full`) is off by default and lost its harness; is it dead code? | open: review |
