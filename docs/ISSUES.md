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
| 15 | A game day grows from ~50 ms to ~400 ms over 20 years; late Reel plays ~2.5 days/s | in progress (top priority) | Seed 1001 sea, audited soak: 52 ms/day in year 1, 127 in year 10, 395 in year 20, while population fell 2,531 → 1,530 and places rose 12 → 46: cost follows places and time, not people, and makes every soak slow. Released: exact speed-ups (ledger paths, settleTracks, storage routes) and remembered army routes (an army no longer searches the same blocked route each day): 21% less CPU over the first 150 days of seed 1001, and a war-time day after year 3 costs a tenth (seed 287970763, days 1000–1200: 6,979 → 691 M instructions/day, `tickMilitary` 330 → 7.9 ms/day; 1,471 remembered routes each checked against a fresh search); identity-proven (PERFORMANCE.md). Batch 1 (released): a remembered blocking step for storage walks, lot settlement skipping far layouts, a finer army route memory: −17% instructions in war years on 287970763, −9.5% on a 15 km world. A day-cost agent takes the hot list's top next. Caveat: these figures come from a stagnant economy (#23: on 1001 sea towns stay 5 for 20 years, 180 buildings deserted, population −40%), so a healthy world will cost more; rank fixes by how they scale with places, buildings and households, and re-baseline after the economy fix. Linked: #22, #23, #33. |
| 33 | Once armies take the field, every day slows | investigating | `tickMilitary` was 45–58% of a year-3 day (seeds 2002, 287970763) and 83–286 ms/day in years 14–20 (1001 sea) before the route memory (now 7.9 ms/day on 287970763 at days 1000–1200). A blocked host still asks for its campaign route daily, now cheaply. An army-AI review measures what remains per army and state, and looks for choices that cost and make no sense (objectives chosen without asking if they can be reached, daily re-planning, months before a wall or river). Behaviour changes go to the user. Two plain bugs found, being fixed for batch 2: the water test reaches 0.4 m past a river's edge while the bridge test looks at the river itself, so on rivers wider than 16 m road bridges read as water (at boot 9 of 10 wide-river bridges on 287970763, 7 of 7 on 1001 sea; town-to-town road routes passing on 287970763: 9 of 30, 23 when consistent, with detour searches 185 → 21); and `landingOf()` lands a host in the middle of a sea cell, so no host can take ship. Also a latent bug, fixed: a levied outlaw who dies while serving (a camp burned, its king hanged) stayed on his host's roll with his skills archived, so `musterSync` threw every day from then on; armies now strike the dead off their rolls (identity-proven; the money fixes' 1001-land world runs clean to day 1800). |
| 34 | An error in one part of the day silently skips the rest of that day | fixed for test runs | `simTick` has no guard: the muster error above threw inside `tickMilitary` and every later part (economy, growth, land, history) was skipped every day for years, visible only as `errN` in a soak. Decided (user): a fault-hunting run carries on, so later faults in the timeline still show, and says where determinism broke. Each part now runs through `simPart`; played, a fault throws as before; with `SIM_FAULTS.carry` (the soak sets it) the part is recorded, the day goes on, and the summary names each world's first fault as the end of its baseline. |
| 16 | Fastest reaches 45% of its 30 days/s | partly fixed | Settlement records now go only when they change: Fastest 13.9 → 25.9 days/s (worker build, seed 1001, load ~5). Reel years stays at ~26–28 days/s of a nominal 360; that is the cost of a simulated day (#15), not the packets. |

## Simulation and calibration

| # | Issue | Status | Notes |
|---|---|---|---|
| 20 | Two population models (C12) | open, partly fixed | Prosperity now follows what families live by, but a town's population ceiling is still reckoned from land, trade and workshops, not from its households' own living, so the two can part. |
| 21 | Meadow on dry ground (C17) | open | Any strip may go to hay when hay pays: up to half the ploughland turns to meadow and ploughmen go short of bread. Meadow should come from wet bottomland. Likely feeds #12. |
| 22 | Hamlets multiply (C16) | open | Strips stay with holders and heirs, new households are landless and found hamlets: a 400-year history spreads ~1,300 souls over ~85 hamlets. Holdings should be let or shared first, pioneer parties gather over years. Also drives #15. |
| 23 | Calibration pass not yet done | investigating | Player report (2026-10-06, Reel years): depending on the map, the houses' and the crown's gold reaches zero within 2–5 years, and every house then hovers there; expenses fall when people starve out, income recovers a little, and the cycle repeats. Soak (1001 sea, 20 y): houses 2,319 → 51 gold and crown 1,683 → ~50 while households hold 12–20 k; famine 31–58% of people in years 3–5 (grain under 1 per head); later 8–9 grain per head yet hunger stays ~0.17. An economy agent is root-causing the three strands; plain bugs get fixed, calibration choices come to the user. Food is made and not eaten: 476 k fish produced against 37 k eaten, and 9,361 place-days hungry with a day's food in store. Growth stalls (towns 5 for 20 years). Early leads (to confirm): lords and crown spend each month's surplus but absorb each month's loss, a ratchet toward zero; before each place's first tenure day every tilled strip counts as demesne, so ~90% of the first harvest goes to lords and crown; the crown pays its hosts ~6× a lord's rate per man; `reprice` and its inputs survived the ledger refactor, but fish starts at 4× its base in importing towns while grain sits at a third, and fish rots at 4.8%/day in open yards. First suspect (user): supply-and-demand pricing (21b7243: prices move with unmet demand and unsold stock) may have lost its inputs in the ledger refactor (71bb603, b264e07, 9c66076), so scarcity no longer raises prices and producers no longer profit. — The economic replacements changed many interlocking rates at once: growth pace, prosperity levels, castle and church tempo, rebellion frequency, prices, rents, wages and army sizes, to be checked across several worlds and centuries with `tools/soak.mjs`. |

Kept by design (not issues): historical era gates (stone keeps 1070, gothic 1190, bastions 1500, mills, siege engines), the logistic birth curve, army-supply and watch top-up hysteresis, courtyard-house gates, the house-tongue dice.

## Missing systems (planned)

Medieval institutions the world lacks (scan of building types, trades and terms, 2026-10-06). Each must be worth doing by a quantity, pay and earn through named flows, and fit the per-day budget (see the design note under #35).

| # | System | Status | Notes |
|---|---|---|---|
| 35 | Monasteries, abbeys and nunneries | planned | No monks, nuns or abbots. Great landholders and wool producers (granges, wool sold forward), hospitality, charity, schools, appropriated parish tithes: a third owner beside lords and crown. |
| 36 | Lords' customary income | planned (first) | Mill, oven and press monopolies (suit of mill, multure); dovecotes, fishponds, warrens, deer parks; forest law and hunting; labour services (week work, boon work); heriot and merchet. Where real lords' money came from; bears on #23. |
| 37 | Courts and royal justice | planned | Manor and hundred or shire courts, sheriffs, itinerant justices; fines and amercements as income for lords and crown. A court building exists without a court. |
| 38 | Credit and coin | planned | Lenders at interest (Italian bankers, crown-protected Jewish lenders taxed by tallage); mints, recoinage and debasement. Today only bread on the slate and arrears. |
| 39 | Estates and self-government | planned | Parliament and taxation by consent; sworn town communes. Charters and councils exist. |
| 40 | Learning | planned | Universities and cathedral schools. |
| 41 | The knightly world | planned | Tournaments, orders of chivalry, mercenary companies, crusades, scutage. |
| 42 | Bondage and freedom | planned | Villeins exist; manumission, flight to a town (a year and a day), free and unfree status. |
| 43 | The craft ladder | planned | Apprentice, journeyman, master; guild entry. Apprenticeship exists. |
| 44 | Technology | proposed | Inventions of the period pegged to their historical years: on their own a realm gets them about a generation late; patronage of learning, contact and wealth bring them on time; never before history. Proposal: `docs/TECH-TREE.md`. |

## Tooling

| # | Item | Status |
|---|---|---|
| 17 | The full history recorder (`history=full`) is off by default and lost its harness; is it dead code? | open: review |
