# Simulation debt

Arbitrary thresholds, step gates and dice rolls standing in for economic decisions, found by a sweep of the
simulation ticks (October 2026). The aim is an emergent, economically grounded simulation: things happen
because a quantity (surplus, rent against cost, threat against value, opportunity) makes them worth doing,
not because a number crossed a hand-picked line.

Status (after the first repair pass, October 2026): items 1–31 and 33–35 replaced; 32, 36, 37 kept. Statuses: **open**, **fixed** (replaced by the mechanism in the right-hand column), **kept** (defensible).
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
| 16 | desertion | only below pop<room×0.5 | houses empty in proportion to the vacancy (more houses than households). Repaired again (Oct 2026): the yearly check read a year-old occupancy, never reset a house's empty years, and ruined every failing house the same day, silently; restored ruins were given no household. Now households take empty houses before anyone builds, the check counts who lives where that day, lets go ceil(E²/H) houses (least worth keeping first), says so in the annals, and they fall in through the year | fixed |
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
| 31 | tools only in towns; free cloth and wine for the capital | crafts where workshops are | fixed |
| 32 | watch top-up hysteresis, call-to-arms radii | reasonable hysteresis | kept |
| 33 | ships ≤8, random arrivals | mesh-limited; arrivals random | fixed |
| 34 | trade closed at 15% infected | cliff | fixed |
| 35 | street-cutting limits | benefit should be time saved × wages | fixed |
| 36 | courtyard houses gates | mostly economic | kept |
| 37 | house tongue switch on dice | cosmetic | kept |

## Kept (defensible)

Historical era gates (stone keeps 1070, gothic 1190, round towers, barbicans, bastions 1500, `tierCap`,
`siegeEngines`, mills); the logistic birth curve; wharf and quarry (already demand-driven); army supply
hysteresis (18/35).

## Ownership and money (second sweep, October 2026)

Property not tied to a person or institution, and money created from nothing or destroyed. Goal: every asset has
an owner (a household, a lord's house, the crown, a church, the town), every income has a payer, every cost a
recipient. Status (after the repair pass, October 2026): all fixed but M19 and part of M23–M30. Not yet recalibrated.

| # | Where | Debt | Replacement | Status |
|---|---|---|---|---|
| M1 | household necessaries | 55% of what families spend on bread, fuel and cloth vanishes; no grower or fisher is paid | pay the holders of the stores (tillers, the lord's demesne, fishers); only the crafts' margin goes to the craft pool | fixed |
| M2 | harvest (tickTenure) | crops paid as cash from nothing; the lord's share (`lordTake`: demesne crop, villein and lease rents, sharecrop cut) summed and never paid | grain is goods until sold into the stores; `lordTake` paid to the lord (or crown) as rents in kind | fixed |
| M3 | lords' `rentOf` | dues from `pop×0.06` created monthly, paid by no one; duplicates M2 | replace with the real flows: rents in kind, town rents, dues from household purses | fixed |
| M4 | town stores | goods appear, are converted and eaten with no owner | a market: stores held by households and the lord; producers paid when goods are drawn | fixed |
| M5 | caravans, barges, cogs | goods taken without payment, delivered free; profit, tolls, taxes notional; no carter or merchant earns | a merchant household buys at the origin price and sells at the destination; tolls from his margin; carter paid a wage | fixed |
| M6 | craft incomes | pool never drawn down; tier/skill multipliers pay more or less than the pool; "odd jobs" and no-trade income from nothing | split the actual pool among its households by tier and skill; odd jobs are wages with an employer | fixed |
| M7 | town buildings | no owner; occupants pay rent of which half vanishes; shops, mills, inns, warehouses, wharves, quarries earn nothing for anyone; compensation paid to occupants as if owners | every building has an owner (household, lord, church, town); tenant pays the owner; business income to the household that works it | fixed |
| M8 | soldiers' pay | crown and lords' hosts, garrisons, castellans paid into nothing | paid to the levied men's households, the castellan's house, mercenaries (who carry it out of the realm) | fixed |
| M9 | building and works costs | castle, church, road, plan, wall, repair, works costs vanish; stone taken unpaid | wages to mason, carpenter and carter households; stone paid to its holder | fixed |
| M10 | death and marriage | purses and herds lost at death; a wife's purse hidden | purse and herd pass to the heir or spouse; purses merge at marriage | fixed |
| M11 | crown production tax | created from nothing | taken from household purses, or as an aid from lords' rents | fixed |
| M12 | murage | created from town worth; spent into nothing | levied from burgher purses and market tolls; paid to builders | fixed |
| M13 | church fabric | offerings created; surplus clipped away | a tithe on the harvest; surplus as alms to the poorest | fixed |
| M14 | far-port ships | imports free; exports paid to no one; customs created | merchants pay and are paid; customs out of their margin | fixed |
| M15 | tolls and lords' works | market toll created; mill and granary earn nothing | the mill takes its multure (to the lord or a miller who leases it); tolls from the merchant | fixed |
| M16 | land sale with no buyer | seller paid from nothing; land ownerless | the lord buys, or there is no sale | fixed |
| M17 | herds | drives, raids, requisitions charged to families unpaid; beast cash double-counts produce; hay never charged | drives from the lord's herd first or paid; cash only from selling produce; hay paid | fixed |
| M18 | crown furlongs | rent from nothing | paid by the household working the land | fixed |
| M19 | debt floors and write-offs | purses floored at −30, lords at −5000 with write-offs, treasury at −500 | debts owed to a lender; settled by forced sales | fixed: no one pays out what he has not got (rent and dues unpaid are arrears); bread on the slate is lent by a named lender (the best-off neighbour, else the parish, else the lord) from his own purse, repaid from what is left after the month's bread, the oldest debt first, and passed with the purse at death; a debtor sells beasts, then land |
| M20 | court spending | vanishes | paid to the capital's crafts | fixed |
| M21 | clearance compensation | paid to no one; occupants get nothing | paid to the owners and occupants | fixed |
| M22 | luxuries | wine and cloth taken from stores unpaid | the vintner, weaver or merchant paid | fixed |
| M23–M30 | infill, trade changes, farmsteads, free new houses and rebuilds, bandit loot, new-house treasuries, player decrees, metro pooling, roads and toll houses | small leaks and sources (see the sweep) | route each to a named payer and recipient | partly: infill, trade changes, farmsteads, new houses and rebuilds, decrees now paid to named recipients; bandit loot, metro pooling and toll houses still open |

## Circulation (third sweep, October 2026)

Money that was conserved but did not circulate, and signals that misled choices. Found by tracing each account's
inflows and outflows year by year from AD 850.

| # | Where | Debt | Replacement | Status |
|---|---|---|---|---|
| C1 | lords' halls | spent 3% of the coffer a month whatever came in: rents piled up in the coffers, purses below emptied, towns starved with full barns | the hall lives on the month's surplus and draws down what lies beyond a quarter's revenue (rents came at the quarter days) | fixed |
| C2 | the court | spent only what lay beyond a war chest, at 0.08% a day | as a hall: the month's surplus, and what lies beyond a war chest and a quarter's revenue | fixed |
| C3 | the hall's purchases | bought a budget's worth of bread at any price (a glut swept whole barns into the larder); unbought wine and silk left the silver unspent | the hall buys what its people eat and wear; what the market cannot sell it goes on hands and crafts | fixed |
| C4 | households' food | bought a month's bread every month over what was still in the crock: demand double-counted, prices spiralled | top up to a month's need | fixed |
| C5 | trade | one load every two days for the whole realm; a route with no one to serve it blocked every other | every place looks over its spare goods every few days and sends the best load a dealer and carter of either market will take | fixed |
| C6 | the want of merchants | every failed candidate noted at a tenth of the load's value, every market day: merchants seemed wanted at a thousand years' bread, and everyone became one | the best missed load only, at the profit it would have made, each unit of unsold surplus once a year | fixed |
| C7 | trades at the founding | taken from the buildings (a smithy, a smith): towns full of smiths and brewers with no custom | families take the opening that keeps a household best | fixed |
| C8 | country custom | a want with no craftsman in the village was done at home: country money never reached the town's workshops | bought at the nearest market town that has the trade, the more of it the nearer | fixed |
| C9 | grazing | a hay meadow counted as 1.4 beasts of summer grass: flocks bred meadows bred flocks (25,000 sheep for 1,500 souls) | its hay is the winter's keep; in summer a mown meadow gives its aftermath | fixed |
| C10 | freight, castellans' fees | fixed coin while prices moved: carters took 37 years' bread a year after a deflation | at the day's prices | fixed |
| C14 | household credit | bread bought on credit paid the seller in coin while the buyer's purse went below nothing (money from nothing), and the credit grew with the price of bread: inflation fed itself (a millionfold by AD 885) | a lender advances it from his own purse (M19) | fixed |
| C15 | founding | a new hamlet got at least 30 souls (a fort 60, a planned town 220) while its mother lost fewer or none | the settlers leave the mother place | fixed |
| C13 | debt with no lender | a coffer paying from a debt (the reeve buying beasts and land, recruits, forts, new towns) created the silver it paid; a treasury in debt raised a negative host, which added millions to the capital | every outlay within the purse; a host is never fewer than none | fixed |
| C11 | the place's own increase | households set up to fill the count brought 2–4 years' bread in silver from nowhere, priced at the day's level: more people, more money, dearer bread, richer newcomers | they come with their hands | fixed |
| C12 | two population models | the count follows a capacity reckoned from building slots and trade tallies; the named households live by what they earn; the two part (towns empty with prosperity at 100, or swell past their folk) | measure capacity from the households' own living | partly: prosperity is now the margin families live by (whether they buy their bread, what they have put by); the count's ceiling is still reckoned from land, trade and workshops |
| C16 | assarting pace | strips stay with their holders and heirs; new households are landless and found hamlets with a chance each quarter: a 400-year history spreads ~1,300 souls over ~85 hamlets | holdings let or shared before the young leave; a pioneer party gathers over years | open (calibration) |
| C17 | meadow on dry ground | any strip may go to hay when hay pays: half the ploughland can turn to meadow, and the ploughmen go short of bread | meadow on wet bottomland; dry ground mown for little | open (calibration) |
