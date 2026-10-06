# Issues

The working list of known bugs and planned work. Update it when an issue is found, assigned or fixed; remove fixed items once their release is out (the commit history keeps them). Calibration and simulation-design debt stays in [SIM_DEBT.md](SIM_DEBT.md).

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
| 15 | A game day costs ~50–150 ms late in a game; Reel reaches ~27 days/s, not 360 | open | After the boundary fix. Cost grows with the number of places (hamlets multiply: SIM_DEBT C16). |
| 16 | Fastest reaches 45% of its 30 days/s | in progress | Each daily packet carries 8–11 MB of mostly unchanged structure; siege arcs clone whole towns (24 MB). Boundary fix removes the clones; send structures only when changed after. |

## Tooling decisions pending

| # | Item | Proposal |
|---|---|---|
| 17 | `tools/history-check.mjs` fails on any ledger; it tests the off-by-default full history recorder | Delete; review whether the recorder is dead code. |
| 18 | Frozen baseline modules (`*-baseline.mjs`) and their equivalence tests; `game-write-*` prototype (5 tests); `long-run-check` (overlaps soak) | Delete. |
| 19 | Money: unrecorded flows (lord gold initialised without a flow; prepaid wages booked as minted) | Verify with `tools/soak.mjs --audit` on the current ledger; a 1-year soak on 2026-10-06 reported residual 0. |
