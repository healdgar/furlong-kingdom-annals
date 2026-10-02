# Simulation debt

Arbitrary thresholds, step gates and dice rolls standing in for economic decisions, found by a sweep of the
simulation ticks (October 2026). The aim is an emergent, economically grounded simulation: things happen
because a quantity (surplus, rent against cost, threat against value, opportunity) makes them worth doing,
not because a number crossed a hand-picked line.

Status (after the first repair pass, October 2026): items 1–30 replaced; 31, 33–35 open. Statuses: **open**, **fixed** (replaced by the mechanism in the right-hand column), **kept** (defensible).
Line numbers are as of the sweep and will drift.

Recalibration note: these fixes change many interlocking rates at once. Expect a calibration pass after
the whole list is done (growth pace, prosperity levels, castle/church tempo, rebellion frequency).

## High impact

| # | Where | Debt | Replacement | Status |
|---|---|---|---|---|
| 1 | `tickPopulation` prosperity step | +0.06/day whenever not hungry: every town ratchets to 100 in peace, so ~30 `prosperity>N` gates are always on, and shocks make cliffs | prosperity relaxes toward a measured surplus per head (livelihood margin, trade, household means, rent burden) | fixed |
| 2 | `carryingCap` | `max(fed+market, pop*1.35)` while any land is free, flipping with `landShort` | continuous: food from tilled land + reachable waste land at clearing cost | fixed |
| 3 | `carryingCap` market term; town charter | market by kind (1200 / 450 / 0), hinterland cliff at 1600 m; charter on pop>420, prosperity>50, roads≥2, dice | market from trade passing (road traffic, caravan arrivals) and craft jobs, hinterland decays with distance; charter when market trade warrants it | fixed |
| 4 | ruin rebuild | timer + prosperity>40 + 30% dice, free; burned ruins never refilled by growth | rebuild when the plot's rent over years beats the cost and the town has the people | fixed |
| 5 | `tickGrowth` new houses | pop > housing×1.1 and prosperity>35, free, 1 or 3 per 6 days | build while unhoused people exist and the best plot's rent covers the building cost; pace from the shortfall | fixed |
| 6 | lanes / extension | lanes only when <15 free plots, 2/4 at a time, one civic event a year; extend every 2 years | open lanes when the town's housing shortfall outruns its free plots, outside the civic-event lottery; extension on demand | fixed |
| 7 | burgher walls | first wall pop>850 & prosperity>48 & dice; stone pop>600 & prosperity>55 & dice; new circuit by fixed ratios; free | a wall when threat × property protected exceeds the cost, paid from the town's purse (a murage) | fixed |
| 8 | wall repairs | lord's purse ≥1.5× cost or nothing; breach permanent | murage: the town pays toward repairs by property protected and threat; partial repair each year | fixed |
| 9 | `tickSettlers` | settlers made from nothing (+4 per plot) | planned streets add cheap room; migration brings the families | fixed |
| 10 | `opportunity` inputs | inherits 2, 3, 6; ignores rent | livelihood and room per head (now honest), minus rent burden from land value | fixed |
| 11 | daughter villages | landShort>360 d, prosperity>45, pop>90, dice, day 195, hard cap, 45 people | found when waste land within reach could feed more than the parent's crowding allows; pioneers in proportion to the shortfall; cap only the render buffer | fixed |
| 12 | land claims | only the nearest place may claim a furlong | places bid: need for land against distance; a needier place farther off can take it | fixed |
| 13 | rebellion | loyalty<30 & 0.45%/day dice; random slights; join at loyalty<32 & 40% | rise when grievance × chance of winning (its might and allies against the crown's) beats the cost; slights only from real events | fixed |

## Medium impact

| # | Where | Debt | Replacement | Status |
|---|---|---|---|---|
| 14 | siege | raid if strength < 2× defence; garrison>20 cliff for siege vs quick fall | raid vs siege by expected prize against expected loss; siege length continuous in garrison, walls, stores | fixed |
| 15 | material upgrade | prosperity>62 & dice on random buildings | upgrade when the rise in property value beats the cost | fixed |
| 16 | desertion | only below pop<room×0.5 | houses empty in proportion to the vacancy (more houses than households) | fixed |
| 17 | castle works | dice + purse multiples, ambition by kind, 25-year retry lock | invest when threat × value protected beats the cost against the lord's income | fixed |
| 18 | church gifts | lord gold >3000 / crown >15000 cliffs; parish pop>900 & dice | gifts in proportion to surplus; parish when the churches cannot seat the people | fixed |
| 19 | lord investments | gold ≥2500 / 12000; projects by pop thresholds | rank by return (rents/tolls gained) against cost and purse | fixed |
| 20 | fief sales | price pop×1.6+300; crown buys/grants at 40% | price = rents capitalised; crown keeps what it can administer | fixed |
| 21 | distant fiefs | rent halves beyond 1500 m | continuous decay with distance | fixed |
| 22 | new towns / forts | dice, fixed costs, caps | expected traffic/rent at the site against the cost | fixed |
| 23 | tenure | demesne sale from AD 1349; fixed freehold price | demesne leased/sold when labour is dear (people per arable area); price by land value | fixed |
| 24 | caravans | fixed stock thresholds, 30 cap, random ambient trade, flat prosperity bumps | trade when margin beats carriage; prosperity effect via the surplus measure (value carried) | fixed |
| 25 | render buffer | growth stops when the building instance buffer is full | buffer grows on demand | fixed |
| 26 | infill | villages / pop<300 / before 1100 excluded; demand ≥0.92 | rent against garden value decides everywhere | fixed |
| 27 | migration constants | 0.12 gap, 2%/month, <25 pop never leaves, immigrants from nothing anywhere | moving cost by distance; outside immigration through ports and border roads | fixed |
| 28 | town revolt | only crown towns, unrest>90 & dice | any town, by unrest against its garrison's hold | fixed |
| 29 | war/army | war drawn at 1400 days; disband below 40/10; fit at 0.45×target | wars end by exhaustion (purse, losses, war-weariness); disband when unpaid | fixed |

## Low impact

| # | Where | Debt | Status |
|---|---|---|---|
| 30 | treasury >15000 drained 0.12%/day | court spends in proportion to income | fixed |
| 31 | tools only in towns; free cloth and wine for the capital | crafts where workshops are | open |
| 32 | watch top-up hysteresis, call-to-arms radii | reasonable hysteresis | kept |
| 33 | ships ≤8, random arrivals | mesh-limited; arrivals random | open |
| 34 | trade closed at 15% infected | cliff | open |
| 35 | street-cutting limits | benefit should be time saved × wages | open |
| 36 | courtyard houses gates | mostly economic | kept |
| 37 | house tongue switch on dice | cosmetic | kept |

## Kept (defensible)

Historical era gates (stone keeps 1070, gothic 1190, round towers, barbicans, bastions 1500, `tierCap`,
`siegeEngines`, mills); the logistic birth curve; wharf and quarry (already demand-driven); army supply
hysteresis (18/35).
