# Handoff: state of work

Updated 2026-10-09 in the cloud checkout after continuing #37 and correcting the reported river surface (#58). Whoever carries the work keeps this file current: what is true now, what is next, what waits on the user.

## Where things stand

- **2026-10-09, court presentments (#37, batch 11c):** grazing trespass and the bread/ale assize are implemented and tested locally. The existing monthly livestock reckoning presents overstocked holders; actual bakery/brewery payments fund the customary licence at each place’s twice-yearly great court. Fines preserve the next month’s bread and rent, never recover invented principal or force a beast sale, and retire when amerced or pardoned. Mergers follow the surviving family; extinct estates leave no personal presentment for an heir or institutional chest.
- **2026-10-09, land and customary entries (#37, batch 11d):** the next phase adds a separate twelve-entry register of existing admissions, inheritance, marriage, assarts, surrenders, sales and letting; entry-fine payments and their original shortfalls; actual household merchet payments; and one real heriot beast in kind. It adds no charge, sitting, household debt or transaction scan. Verification and conservation evidence follow below.
- **2026-10-09, criminal presentments (#37, batch 11e):** native riots present up to three resident adult household heads under the named three-days-of-family-bread custom. Robbed caravans and actual outlaw recruitment add bounded evidence to a separate royal roll; royal hearings, forfeiture and charges remain pending. No settlement camp raids are invented.
- **2026-10-09, river surface (#58):** the drawing had sampled each terrain bump directly, allowing the water to rise downstream. Draw-only profiles now pool across bed bumps; junction backwater extends upstream. Canal levels and simulation geometry remain unchanged. The 150-day whole-world/RNG proof and final drawn check pass; evidence follows below.
- **Local state:** batches 11c, 11d and 11e plus the river correction are the work beyond `origin/main` at `5c5b121`; no release has been pushed from this checkout. Verification and economy comparisons are in the continuation below. Next: real royal hearings for robbery and felony, neglected-road presentments, then the royal court tiers. #37 remains in progress and #39 has not begun. The Mac’s late-world farm snapshots are absent here, so that farm has not been resumed.

- **2026-10-09, fort development and annual accounts (#56, #57):** roads, town-wall siting, building enlargement and parcel clipping respect the elongated bailey's contour instead of its maximum-radius circle. Mound, ditch and curtain clearances remain. Deliberate layout/history change; existing buildings are not relocated.
- Town, domain and crown records show calendar-year income, expenses, surplus/deficit and causes; treasury statements reconcile opening and closing coin. Town public funds and each owner's local receipts/costs are separate; local costs already belong to the owner's total. Loans and asset sales are cash flows, not trading profit. Two bounded annual aggregate books per institutional chest, no household ledger or new transaction/journal rows; reports never scan history. Self-transfers and refunded relief holds are excluded. Older net books cannot reconstruct prior gross flows; resumed records label partial years.
- Gate: 1,382/1,382 tests, including ownership/inheritance, food/money, rendering and fresh-realm world-save continuation. A native 150-day run (1001/fate42/sea) with annual aggregation enabled versus disabled preserves the whole graph after removing only those new totals, all RNG streams and journal effects. Hardware Chrome checks kingdom/town/domain account views, read-only reports, Reel, pause and exact save/replay. Four one-year worlds (1001,2002 × sea,land): money reconciles, daily inventory matches, no simulation faults. Initial 2002-sea Chrome disconnect; isolated retry passes.
- Tested HTML SHA256 `77a5bf5b91fcd1c5a42e2e6b2746c1093d8f92c2ebf1fc5b59ee1d5543128537`; game-script SHA256 `9630161dc1a406c0df60488b80cedc0bfd533eacd53c7e9f8ec9880110459c4f`. Stamped release HTML SHA256 `22508646b7431ddec8687f9edb887843029e1f39a7c6586deb7e5e7c1de87da5`; game script unchanged, 22 post-stamp checks and final drawn play pass (Apple M4 Max / ANGLE Metal). The 2002-sea baseline also passes: disconnect not reproduced. Local evidence: `tools/soak-results/fort-finances-20261009/`. No speedup claim: native accounting on/off tick CPU was 144.1/148.9 ms/day, respectively, under differing load (4.57/5.56); one pair cannot resolve small overhead. Existing famine and #27 inspector defects remain.

- **Resumed by the user (2026-10-08).** #37 is in progress: manor courts first (`docs/SYSTEMS.md` § 4), the next step of "Next, in order". The farm (`tools/soak-results/farm-42-b10`, batch 10b's frozen build) was left running; a container restart stops it, and it resumes with `--from` its latest save.
- **`main`** carries the tested #37 manor-court phases (batches 11a, 11b and the local 11c/11d/11e), after batch 10b; the release push deploys Pages and the container image (see the latest release stamp). The claude.ai artifact is still v86 (08446b7); see Waiting on the user. `main` carries:
  - **batch 5, determinism (#45):** the game's own math (`DM`), sorts that throw no dice, and the population memo left out of the world graph. Node, the soak page and the worker build play one history.
  - **batch 6, the economy:** a seller's reserve is the average cost of his stock on sale; the crafts buy their stuff for what the place wants of the ware (#51).
  - **batch 8, prices answered by supply (#51, #52):**
    - Trade answers a price: carts, barges and cogs choose loads by margin net of freight, dealers send load after load while one pays, and goods already on the way count. Only the drawing is capped (`trafficDrawn`).
    - Households buy need × (price / worth)^(−ε). Worth is the cost of bringing a month's need, or of making the good. Food is inelastic; ε is 0.3 for timber, 0.6 for tools, 1.2 for cloth, 1.5 for wine and 2 for spice and silk.
    - A short purse buys bread first, keeps back its rent and the next month's bread, then buys fuel, tools, cloth and luxuries.
    - The reeve buys families' beasts only out of what lies beyond the chest's reserve.
    - Gate, at year 5 against batch 7:
      - runaway place-goods: 39 → 9 on 42 sea and 30 → 8 on 2002 land;
      - famine: 0–1% on all six worlds;
      - population: higher on four;
      - money: clean.
  - **batch 7, exact apart from the ward rule:**
    - the world save, phase A (#48, `docs/WORLD-SAVE.md`), and the farm (`tools/farm.mjs`);
    - the institutions' groundwork (step 3.1);
    - street graphs and road bounds as scratch, so drawing the townsfolk leaves the world as it was (#27);
    - wards bought only out of what lies beyond the buyer's reserve (#52).
- **Batch 9, released** (meat, with #36's customary income; built by three agents and merged):
  - **Meat** (the user's decision): a third food inside the inelastic need. Pigs' litters are killed at Martinmas and the sows kept; cattle and sheep are wintered while their yield pays for their hay and as far as the hay goes. Families salt their own pork and eat the fresh first; the lord's larder salts his; town butchers buy beasts when the carcass pays and sell fresh. Households buy the cheapest food by the month (`foodDays`), the better-off buy meat for their table, and they eat fish first, then fresh meat, then bread and salt meat in proportion. The shambles no longer turns beasts into grain, nor `herdProduce` bacon. Pannage: one pig in ten (its worth), to the wood's lord.
  - **The manor:** mill and oven farms let to the best bid over what the lord keeps in hand, paid at the quarter days; suit of mill and oven; villein services commuted where the lord's rent grain brought him less than the money rent and the villein can pay (or by order), arrears to the pleas roll, two years behind returns the holding; heirs' entry fines and vacant holdings to the best bid; merchet; liveries in food that would spoil unsold; the crown's labelled book (`W.crownBook`); customs and services orders on the governance panel.
  - **The roads:** pontage and pavage at toll houses on the way, reckoned in the dealer's margin; toll houses set up where they pay and given up where not; roads mended by the toll houses' owners from the tolls first, else by the lords at either end as a customary duty, each only beyond his reserve; assart fines grounded in the wood's pannage.
  - **First gate (c70b904): not released.** Suite 1276/1276, money audits clean, no faults. The economy failed:
    - 42 sea improved sharply (famine 0 in every year, hunger 0.01–0.05); elsewhere famine was level or worse early (2002 land 33% in year 2 against 25%), and population ended lower on four of six worlds.
    - A coin drain: the new second food pass bought a household's whole month's shortfall in the cheapest other food, at the capital the crown's fish, which rots before it is eaten (by day 90 on 1001 sea, 10% coinless against 0%).
    - Meat's price ran away (1001 sea 11 → 380, people-weighted): the table's meat was bought at any price, and butchers could buy only beasts beyond the place's want.
    - Cattle fell by two thirds in five years (cows undervalued: #53's valuation half).
    - Runaway place-goods above 10× base rose (42 sea 9 → 15, 2002 land 8 → 22, mostly cloth, sheep, cattle).
    - **Second gate (3ca8b6a), not released:** suite 1282/1282, money clean, no faults; famine over six worlds × 5 years down 19% against batch 8, population −1.4% (42 sea +443; 1001 sea −462 in a history with a war and a plague); lords' coin up on most worlds; by year 5, 30–49% of villein holdings commuted, 6–9 of 9–14 mills let, tolls mending their roads. CPU on one host, 1001 sea: 83.0 s → 95.6 s for 720 days (+15%, load 1.5–1.8); year 2 107 → 121 ms/day, in the commodity settlement and the journal's encoding (meat's lots) and tickEconomy. Meat still ran away in villages (42 sea: 5 of 16 runaway place-goods at year 5, against 10 runaways and no meat on batch 8): a family's Martinmas meat went to its pantry and was never offered, so village markets saw only crumbs. Back with the meat agent: a family's meat offered as its grain is, the famine slaughter (a hungry family eats its beasts), and the Martinmas hay buying spread.
    - **Third gate (bbc79b0): passed.** Suite 1288/1288; money accounted, no faults on all six worlds. Famine over six worlds × 5 years 1.33 → 1.03 (−23%) against batch 8; 287970763 sea and the 15 km world near none. Meat ran away nowhere after year 1 (a family's meat offered as its grain is; the famine slaughter). Runaway place-goods at year 5: 42 sea 13 (batch 8: 9), 2002 land 8 (8), cloth and sheep (#51). Population ended 6% lower in total, but by history, not by mechanism: 287970763 sea had a plague in its first year that batch 8's history did not (2,824 → 2,298 in half a year, prosperity higher than batch 8's throughout), and the 15 km world lost 430 in year 4 with no famine after growing past batch 8's; the second gate's run of the same worlds ended −1.4%. CPU +15% on one host (above).
    - Back with the meat agent: foods that rot are not laid in for the month; the table's meat gives way to its price as wine does; butchers buy up to the herds' yearly increase wherever the carcass pays; cattle and sheep valued by their real yields; butchers as many as the meat trade keeps; pannage at the year's price.
  - Agents' single-world runs (42 sea, 720 days): lords' and the crown's coin up, village hunger level or lower, no roads worn, two of nine mills let, meat level with bread at about 4× base by year 2. Open from it: #53 (dairy counted as grain; a cow's yield undervalued) and #54 (meat reaches the market slowly: families sell beasts only to the reeve, and the lords' halls buy no meat, a calibration of flesh and fast days left for later).
- **Branch.** Work stays on `main`, as `CLAUDE.md` now requires. The remote `determinism` branch was already merged; its deletion remains an inherited task.
- Batches 11c, 11d and 11e and the river correction are local only; no release has been pushed from this checkout.

## Next, in order

### 1. Determinism and the step-1 diagnoses: done

- **Why the soak's hash differed:** only the population memo, which the soak's census filled by reading `s.pop` (`tools/engine-math.test.mjs` guards it).
- **Why 42 sea's crown fell and 2002 land's capital starved:** sellers' reserves ratcheted (#50).
  - On 42 sea the crown's grain at the capital stood behind an 8.4 reserve from day ~1140, while the price was 4–7. The reserve came from a dead dealer's load whose tolls the crown had paid.
  - The crown's grain sales there fell from 1.5–2.3k a year to nothing, and the court's monthly spending (`tickEconomy`, the capital's pool) fell with them.
  - By year 5 half the grain on sale realm-wide stood above its market, most of it in hungry places.
  - Batch 6 fixes this. The crafts' input buying (#51) emptied the crown's chest once the reserves no longer did, and batch 6 fixes that too.
- **Still open:**
  - runaway prices (#51), which need the user's decision (see Questions);
  - wards bought on the purse alone (#52);
  - the capital's remaining gap, which waits for #39, #37 and #35.
- **Probes:** `tools/economy-probe.mjs` (Node only, reads from outside the simulation):
  - `--probe crown`: every change to the crown's chest by reason, by year;
  - `--probe capital`: a place's month (people, hunger, purses, the crown's stock and reserve, prices);
  - `--probe locked`: stock that reserves hold above its market;
  - `--probe prices`: runaway prices.

### 2. World serializer (#48, #49)

V8 startup snapshots restore a world exactly but can't chain (each build starts from Node's own snapshot), and building one runs about 2.6× slower. The late-world farm and shipped checkpoints both need a real serializer. Requirements (user): loadable in a browser, independent of engine and Node version, versioned against the build, compact.

- **Phase A, done and released (batch 7):** `worldSave()`/`worldLoad()` save and load a world at a day's end, in Node (`docs/WORLD-SAVE.md`).
  - W and the module state are kept as data; closures are made again by their makers: `layoutSettlement(s,saved)` and the named binders the living code also calls, every closure's source text unchanged.
  - `tools/world-save.test.mjs`: 42 sea and 1001 sea saved on day 37 load into fresh realms that capture equal, save again to the same bytes and play 55 more days equal, crossing a court quarter day. The fixture includes rent, entry-fine, retired-farm and loan pleas plus trespass and assize presentments, with references to their live balances, household accounts and loan dates/rulings.
  - The document for 42 sea on day 37: 15.6 MB, 7.7 MB gzipped.
- **The farm keeps one build.** A save loads only into the build that made it, so pass `--src` with a frozen copy of the release.
  - The first run reached AD 870 on batch 7 (1,670 buildings, 426 ms CPU/day in the 860s at load 1).
  - That run cannot go on under batch 8; restart on the batch-8 release.
- **The farm tool is built:** `tools/farm.mjs` plays a world in segments.
  - Each segment runs in a fresh realm loaded from the last save. Its first `--check` days must match the days the saving realm played on.
  - It writes the save (`<world>-AD<year>.fws.gz`, about 8 MB gzipped) and a census line per save.
  - Tried: 42 sea to AD 852 in one-year segments. This host plays about 160 ms of CPU a day in year 1.
- **Phase B, next:**
  - run the farm to 1066 on one world, then the others. Long chains are the real test: a closure that first appears late fails a save loudly.
  - the browser worker's resume (`RawOutcomeJournal`, the IndexedDB archive's continuation), which is #6.
  - the census items not yet in `tools/farm.mjs`: lots far from their house (#28), foundings per decade, castles by kind, and a hot-list profile per era.

The farm, as planned:

- **Segments:** 10-year segments, each well under 15 CPU-minutes.
- **Milestones:** AD 850, 900, 950, 1000, 1066, 1250, 1450. They line up with the era starts of #49.
- **Census at each milestone:**
  - places by kind and size; walls; castles; churches and abbeys;
  - buildings per hectare; street nodes and edges; lots far from their house (#28);
  - households, folk, hamlets and foundings per decade;
  - list sizes;
  - ms and instructions per day, with a hot-list entry `<world>-AD`.
- **Studies:** short runs resumed from a milestone.
- **Cost estimate:** 1–3 CPU-hours per world to 1066.
- **Build:** run the farm on the determinism build (now `main`).

### 3. Institutions, in the order of `docs/SYSTEMS.md`

1. **Groundwork: done (batch 7), inert until a system uses it.**
   - **Abbeys and guilds:** `corpFound(kind,o)` makes a record in `W.abbeys` or `W.guilds`, lists that appear with the first record. Each record has a chest, a book and `storageOwnerId:'abbey:N'`. `corpOf('abbey:3')` finds one; `acct`, `means`, `transfer`, `book`, `isHouse` and `ownerAcct` know them.
   - **Offices:** `p.office` (one of `OFFICES`) and `p.officeFor`; `officeHeld`, `officeTitle`.
   - **The `'inst'` dice:** made by `seedStreams`. They join `RS` (its digests and saves) only at their first throw.
   - **Whereabouts:** `h.at={si,until,why}` on the house, and `lordAt(hi)`, which falls back to `lordSeat(hi)`.
   - **Rolls:** `rollOf`, `rollAdd` (keeps the last `ROLL_N`=12, or n) and `rollTake`.
   - **The soak's `inst` section,** and abbeys and guilds in its money census.
   - **Left to the systems:**
     - The crown keeps no labelled book: adding `W.houses[0].led` changes history, so it goes with #36 or #39, whichever owns the revenue labels.
     - #35 must make the abbey the title owner of its grange, because a string `ownerId` routes no goods.
2. **#36** (lords' customary income: built, batch 9), then **#37** (courts, as `tickJustice`: in progress; manor debts and presentments are built, with remaining roll entries and royal tiers still to come), **#39** (estates), **#35** (Cistercian abbeys), **#38** (credit), then **#41, #40, #43, #42**. Also **#46** (the Church) and **#47** (crusades).

- The user's decisions are in `docs/SYSTEMS.md` § Decisions.
- Each system lands as a behaviour change in its own batch.
- Don't calibrate until all the systems are in (user). Calibration choices go to the user.
- One agent should own both `h.at` and the crown's revenue-book labels, because #36 and #39 both use them.

Line numbers drift, so find code by name.

- **#36 hooks:**
  - `tickTenure`: mill, oven and press farms;
  - `shareOutput`: multure to the farmer;
  - `craftWork`: suit of mill;
  - `ladeIn`: pontage and pavage per route, with `tickWays` upkeep paid from the tolls;
  - labour services and commutation (`f.svc`, `f.qrent`), decided by the lord's own reckoning plus a journaled player order;
  - entry fines, heriot and merchet at `inherit` and `marryHouseholds`;
  - pannage and assarts (`tickLivestock`, `tickLand`);
  - liveries.
  - Money moves through `acct`, `flow` and `transfer`. Also touched: `ownerOf`, `ownerAcct`, `LORD_ARCH`, `simPart`/`simTick`, `runCmd`, `lordPanelHTML`, `crownPanelHTML`, `workerPresentation`, `visualSettlement`.
  - Test: `tools/customary-dues.test.mjs`, built on the `tools/ownership-fixture.mjs` pattern.
- **#37 hooks:**
  - `tickJustice` runs manor courts on `dueOn(si,90,37)`; the assize waits for `dueOn(si,180,37)`;
  - bounded pleas and rulings, shared spare-purse budgets, and a journaled customary cap;
  - future: hundred/shire courts, sheriff and justices (`mkNotable`), eyre and capital bench;
  - `tickCourts` is the existing neighbour;
  - test: `tools/justice.test.mjs`.
- **#39 hooks:**
  - **Attendance:** `tickDomains`'s hall block runs monthly at `day%30===20` with `T=seatS`. Spend the month's share at court with `T=W.capital`.
  - **Lord parties:** a `W.lordParties` record per journey along `route()`, projected and drawn the way envoys are (`tickEnvoys`, the envoy meshes), setting `h.at` on arrival. The traveller code (`journey`, `tickTravel`, `renderTravellers`) is the other precedent.
  - **Who lords are:** notables. `h.head` is a notable id and `h.seat` a settlement index.
  - **Parliament:** the summons in the crown's monthly reckoning (`tickEconomy`), assessment in `tickTenure`, collectors. Then communes and the fee-farm.

## Open findings

- **Late-world growth (the farm, 42 sea on the batch-8 build, saves AD 860 → 890; people 2,592 → 3,007).** CPU per day 0.2 → 1.2 s on the farm (profiled from the saves at low load: 291 → 943 ms). It follows dead records, not the living world:
  - spent cargo locations in the commodity ledger: 32,030 → 185,867 facilities, 185,663 of them `cargo:` transit locations, 85 holding anything (a location per load, never retired);
  - ended households: 2,794 of 4,554 have no living member, kept for their `successors`, with 17,395 owner records in places, 58 holding anything;
  - living households' goods scattered over places: 416 households hold goods in 11+ places (6 at AD 860), grain on sale away from home 8,560 times (families that moved left it behind).
  - The ledger's settlement, spoilage, journal encoding and the garbage collector carry the growth (settle 38 → 166 ms/day, encode 32 → 146, spoil 22 → 104, GC 26 → 149).
  - **Batch 10, released (exact):** spent cargo locations are retired with the next written settlement (journaled as removals), and ended households' empty owner records monthly. Identity: 1001:42:sea 150 days and 42:42:sea 3,600 days identical (world graph with the retired records left out of both, every RNG stream, annals, treasury, population, journal outcomes); suite 1291/1291; a two-world soak equal to batch 9's. By AD 860, cargo locations 16,339 → 109, ended households' records 922 → 21; at AD 890 (the same pruning by hand on the farm's save) about −12% CPU.
  - **What still grows: crumbs in the ledger.** Spoilage and proportional sales shrink a holding by a share and never empty it: rows 12.1k → 49.6k from AD 860 to 890, 26k of them below 0.001; deltas spoiled, journaled and encoded each day 11k → 48.5k; 7.6 stock records per living household, scattered over places it traded in or left. Proposed to the user (behaviour): crumbs below a soul's day of food (0.01) are lost as spoiled; a family that moves sells or carries its goods; and if growth still outruns the living world, spoilage inferred in closed form when a row is touched instead of reckoned for every row every day.
  - **Batch 10b, released (behaviour; the user's decisions):** crumbs lost as spoiled, a family's goods follow it home, spoilage reckoned in closed form when a store is touched.
    - The first gate failed: famine over six worlds × 5 years 1.03 → 1.48. Bisected on three worlds: the crumb line at a soul's day of food threw away families' last crusts and the leavings of their own grain on sale. The line is now a mouthful (a hundredth of a soul's day, or its worth), and a moving family carries a month of its own food.
    - Second gate: suite 1308/1308; six worlds clean (money, inventory matched daily, no faults); famine 1.16 against 1.03, but level or lower wherever the two histories keep comparable people (1001 sea 0.19 against 0.22, 1001 land 0.24 against 0.30, 2002 land 0.41 against 0.45); the rest is batch 10's plague histories, and 1001 land's lower population is a private war with four battles in its second year, not hunger (food filled 0.98 against 0.88 at the end).
    - Cost (Node, one host): 1001 land, year 5, 162 → 137 ms/day; 42 sea at AD 870 (the agent's run), 863 → 289 ms/day, ledger rows 42.8k → 10.8k, rows touched a day 32.9k → 3.8k, cost per living household 0.16 → 0.21 ms over the decade (0.25 → 0.53 before).
    - The farm runs again on the frozen release build (`tools/soak-results/farm-build-ae3931b.html`, out `tools/soak-results/farm-42-b10`, 42 sea to AD 1066); the batch-8 farm (AD 860–890 saves in `farm-42-b8`) stays as the record of the leak.
    - Left: living households' empty records in places they left (cheap, changes owner order), dealers' remnants decaying for years, the waif the same day as the offer.
  - Plan (before #37): retire spent cargo locations and ended households' empty records (exact, an agent is on it); then a family that leaves a place sells or carries its goods (behaviour); then measure cost per living person over a long run, and bring the user a sampling or inference design for whatever living part still explodes.
- **Batch 6 soak at year 5 (1aa50a1, in the cloud).** Measured on Node 22 and headless Chromium with SwiftShader, two worlds at a time on 4 cores (load about 2–3), so not comparable with the Mac's batch-4 numbers:

  | World | ms/day | Famine at year 5 | Capital hunger | Crown at year 5 |
  |---|---|---|---|---|
  | 1001 sea | 111 | 0% | 0.00 | 1,451 |
  | 1001 land | 101 | 4% | 0.04 | 1,274 |
  | 2002 land | 122 | 0% | 0.05 | 990 |
  | 287970763 sea | 155 | 0% | 0.02 | 581 |
  | 42 sea | 117 | 4% | 0.05 | 1,312 |
  | 1001 sea, 15 km | 226 | 10% | 0.28 | 6,005 |

  - Parts of the day, largest first: `tickPopulation`, `tickEconomy`, `commoditySettleAll`, `tickMarket`.
  - Self time, largest first: `quantity`, the garbage collector, `walk`, `entries`, `nestedSet3`.
  - Money audits were clean: residual 0, nothing minted, nothing paid to nobody, no faults.
  - The year-4 drop in population on 2002 land is a plague (summer AD 853).
- **Batch 7 soak (cloud, after the host changed):** the histories equal batch 6's on all six worlds, so the ward rule never fired. Money stayed clean and the `inst` section is all zero.
  - The container restarted on a slower host (kernel fc-v77 → fc-v80), so the soak's ms/day rose 50–100% with no code cause.
  - On one host, the old and new builds take the same CPU: 114.9 s against 114.6 s for 720 days of 42 sea.
  - Compare timings only within one host.
- **Prices run away** where little is offered (#51): 26–28 place-goods above 10× base on 42 sea by year 3, 16 on 2002 land by year 5.
- **The 15 km world** got worse with batch 6 (famine 2 → 10%, capital hunger 0.12 → 0.28 at year 5).
  - Its capital starves on supply and on dealers holding dear loads (#23 in ISSUES), as it did on batch 5.
  - In batch 6's first history its crown emptied its chest on beasts its reeve bought (#52, the reeve's part is next).
- **#27:** `simulation-worker-check --views true` passes in full now. Still open: the play check's inspections, and `price()` filling `s.px[g]` on a first read.

## Rules the user set that CLAUDE.md doesn't spell out

- **The simulation must not grind to a halt as the world grows** (2026-10-08). Find what grows; retire what is dead; and where the living economy itself explodes, sample or infer that part realistically instead of calculating it in full.
- **The historical answer is the right one** (2026-10-08), except where the detail would unbalance the game. Decide design questions that way and record the choice; ask only where history gives no answer or the detail would weigh on play.
- Subagents run on Opus, never Sonnet or Haiku. A Fable agent may be asked for ideas when stuck, never for the coding.
- Never use the `mcp__furlong__*` tools. They drive the user's live game.
- Test in batches: no per-change soaks.
- The user values root causes over patches, and real mechanisms over stand-ins.

## Working in the cloud

- **No `~/dev/.furlong-work`.** The clones, the test runner's ledger and the hot list there live only on the user's Mac. Keep a fresh hot list at `tools/soak-results/hotlist.json` (git-ignored). The batch-6 numbers above are the cloud baseline.
- **The clone is shallow.** Run `git fetch --unshallow origin` first: several tests read older builds with `git show <sha>:index.html`.
- **Node 22** (the user runs 25.2.1) cancels a subtest that its parent outlives, so tests await their subtests.
- **Chromium** is at `/opt/pw-browsers/chromium`. As root it needs `--no-sandbox`, and with no GPU it needs `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL. Pass the tools a wrapper script, e.g. `exec /opt/pw-browsers/chromium --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader "$@"`, as `--chrome`.
  - The soak refuses a software rasterizer only when it measures drawing (`--render`).
  - These need Chrome: `soak.mjs`, `driver-parity.mjs`, `replay-check.mjs`, `performance-check.mjs`, `simulation-worker-play-check.mjs`, `session-resume-check.mjs`.
  - The suite and `tools/model-run.cjs` run in Node alone. Node and Chrome now play the same history.
- **Branch and release.** Work stays on `main` under `CLAUDE.md`. Every push deploys Pages and the container; the local court batches and river correction have not been pushed.
- **Release.** The claude.ai artifact (https://claude.ai/artifact/3bfimVpbRRQ2Y3Jwzxd9r7) needs the Artifact tool. If you can't publish it, say so in the hand-back, and the user's machine will publish it.
- **Questions for the user.** Add them below and carry on with work that doesn't depend on the answer.

## Waiting on the user

- **Publish the claude.ai artifact** from the latest tested build: `index.html`, with `assets/` and `LICENSE` as files. No Artifact publishing tool is available in this session; it remains v86.
- **Delete the merged `determinism` branch** on GitHub; the proxy here refuses branch deletion.

## Questions for the user

(none open)

## Decided by the user (2026-10-08)

- **Prices (#51):** prices come from supply and demand only; `reprice` stays as it is. A price that stays high means supply is not answering fast enough.
  - **Trade must answer quickly:** carts, river barges, coastal cogs and sea trade. Manufacturing may be slow, as it is in life.
  - **Demand is elastic by how critical a good is.** A household buys need × (price / worth)^(−ε). Worth is the cost of making or bringing the good. Food is inelastic (ε 0; the user, after batch 8's first soak showed 0.1 starving families with coin wherever trade left a gap): bread is bought to need as far as the purse goes. ε is 0.3 for fuel and building timber, 0.6 for tools, 1.2 for cloth, 1.5 for wine, and 2 for spice and silk.
  - **A household short of money pays for food first, then shelter** (the rent it owes), then fuel, tools, cloth, and luxuries last.
- **Meat (batch 9, with #36):** meat is a third food, inside the inelastic food need, so it helps with food prices and famine.
  - It is made by slaughtering the herds' increase in the autumn, by butchers in towns; the swine's litter for the pot becomes real meat.
  - Households fill the need with the cheapest of bread, fish and meat by price, as they choose between grain and fish now; the better-off eat more meat.
  - Salted meat keeps for months; fresh meat spoils in days.
  - It ties to #36 through pannage and liveries, and lands with #36 as batch 9.
- **History decides design questions** (2026-10-08), except where the detail would unbalance the game. Applied in batch 9:
  - A road with no toll house is mended by the lords at either end as a customary duty (the landholders' duty to the king's highway), whether or not it pays them, but only out of what their chests hold beyond their reserve.
  - Toll houses may stand from AD 850, as Carolingian bridge and road tolls did.
  - A mill's farm is paid at the quarter days out of the takings, not a year in advance; a farmer in arrears is not let the mill again, and his arrear goes to the pleas roll for #37.
- **Growth of the late world (2026-10-08):** retiring dead records is a bug fix, done first (batch 10). Then, agreed:
  1. a crumb of stock below a soul's day of food (0.01 units, or the same worth of another good) is lost as spoiled;
  2. a family that moves sells or carries the goods it held where it lived;
  3. spoilage inferred in closed form when a store is touched, instead of reckoned for every store every day ("seems reasonable").

## Continuation, 2026-10-08: #37 manor courts

- Synced the clean local main from bb94ec8 to 0315e8e; the remote handoff superseded the old determinism work. The user explicitly resumed the paused institution roadmap.
- First court phase: `tickJustice` on each place’s quarter day after tenure. Existing #36 obligations use `courtPlead`, pointing to the actual rent or farm balance; repeated default updates one case. A voluntary payment, cleared debt or surrendered holding cannot be charged again. Entry fines retain their unpaid balance in the plea. Pending 64, recent rulings twelve, overflow counted by kind.
- The court waits unless recoverable dues and amercements cover its two officials’ customary fees (each a day’s household bread). It chooses lettered household heads at the lord’s seat by law/letters, assigns steward and clerk, and reuses them. No new actor index. The only new household selection is quarterly and only when an office needs filling; inventoried with that scope and guarded by a no-repeat-search test. A temporary budget stops several pleas promising the same debtor’s coin.
- Recovery and amercements spare the next month’s bread and roof rent. The amercement custom is a twentieth of harm and no more than a tenth of the spare purse by default. The journaled ruler cap applies to all his places. An amercement is assessed once per case; no additional personal walking budgets, commodity lots or household debt entries. All coin passes between the named debtor, creditor, lord and officers.
- UI: settlement Court link, `court:si` inspection, read-only roll with links, Governance cap controls. Court state remains worker-owned; cards ask the worker, without projecting obligations or accounts. Soak reads sessions, adjournments, recovered dues, amercements and fees outside the simulation.
- Intentionally changes histories. This is institution work, not an optimization or calibration result. Gate: 1,321/1,321 tests, including thirteen focused justice tests, command replay, worker projection and save/load continuation with court references. Final soak `tools/soak-results/courts-20261008-final`: seeds 42/1001, each its own fate, sea, three years serially; every year’s money residual zero, no faults or inventory failures, both overall checks pass. Eight sessions recovered 47.394 in existing dues, collected 1.045 in amercements and paid 1.518 to real officials. Load at the soak’s start: 6.90 / 6.85 / 5.79; no speedup claim. First two-year candidate soak is superseded by this final source: nonresident tenants now reserve bread for every living family member and rent at their home. Release order: embed, gate, stamp, commit, push main; Artifact tool unavailable, so that target remains pending.
- Next after batch 11a within #37: old ordinary loans and beast distraint (completed in batch 11b below), then trespass and assize, remaining land and marriage entries, riot/robbery/felony and neglected-road presentments; then sheriff/hundred, eyre, capital bench and credit/hardship effects. Do not mark #37 complete or start #39 before those phases. The other planned systems remain in docs/ISSUES.md and docs/SYSTEMS.md.


## Continuation, 2026-10-08: #37 loans and distraint (batch 11b)

- Ordinary loans carry their origination day in the existing tuple, `[creditor, principal, day, heard]`; only consecutive advances from the same lender on the same day coalesce. The existing repayment pass considers one oldest year-old unpaid loan per household, when expected recovery covers the customary recording/hearing fee and the creditor's lost day. No new daily census, person walking budget, commodity lot event or persistent index.
- A loan plea references that actual tuple and its household account. Voluntary repayment retires the reference, including the existing penny write-off. Marriage follows the merged account, departure divides principal while preserving date and prior ruling, and an estate retires settled obligations so survivors inherit no personal debt. Dead lenders' late repayments follow the actual estate shares; returned principal and liquidated chattels are excluded from earnings.
- Judgement first uses cash beyond a month's family bread and rent. Surplus beasts may be bought by the home's real reeve at his existing four-fifths bid, only beyond the buyer's reserve; breeders, a carter's horses and the family's working team survive. Animal ownership falls in the family's native row and the same physical herd passes to the reeve's existing pens. No bulk commodity/title/journal writer changes. No invented buyer or payment.
- A sitting forecasts each purse and herd once into temporary budgets, so claims cannot promise the same cash or beasts twice. Acquired chattels may make it worth sitting, but only actual coin pays officers. The monthly repayment pass shares its buyer's reserve calculation; a household without surplus animals never invokes the crown's reserve census. No persistent cache or actor index was added.
- Creditor fees come from recovered coin and are charged once per loan; a lord pays no fee to himself. The bounded roll links the creditor (including a parish's church), lists beasts sold and shows loan recoveries and fees. The external soak records these separately from rent recovery and officials' wages.
- Gate passed: 1,339/1,339 tests, including 31 justice cases, the legacy-search guard, command replay, worker projection, and native loan references/dates/rulings saved on day 37 and loaded into a fresh realm that continues 55 days equal. Final serial soak: `tools/soak-results/courts-loans-20261008-final`, seeds 42/1001, each its own fate, sea, three years. Both worlds passed all checks: every year’s money residual zero, no faults or inventory failures, 2,160 inventory checks per world and clean committed journals. Eight sessions recovered 19.357 in debts and dues (0.663 of it ordinary loans), took 0.112 in creditor fees and 0.029 in amercements, paid 1.430 to officials and sold five surplus beasts. Year-3 tickJustice sampled at 0.013 and 0.008 CPU ms/day; loan pleading remains within the existing repayment/economy pass. Load at the soak’s start: 6.49 / 6.88 / 7.19. Intended institution/history change; no speedup claim. Source-review pins renewed only for preserving loan metadata at a split and the scoped real livestock sale.
- Next within #37: trespass and assize; remaining land/merchet/heriot entries; riot, robbery, felony and neglected-road presentments; then sheriff/hundred, eyre, capital bench and recovery effects on credit/hardship. #37 remains in progress; #39 has not begun. Artifact publishing is still unavailable on this host.

## Continuation, 2026-10-08: wool and tools supply fixes (#51)

- User authorised fixing the confirmed bugs without measuring. Implemented in the working tree: smiths buy only missing ore/charcoal as an affordable, available pair; supply is quoted once for the month's smiths, only when needed. Existing recipe and production remain.
- Household beast decisions and winter retention share current-price `beastYield`. Fixed base yields and beast/purchase count limits are removed; purchases preserve a year's bread, rent and the added beasts' keep. Family-herd scratch totals follow each purchase/sale.
- Established markets allocate spare grazing by net cattle/sheep yield, preserving working teams and riding horses. Freeholders may put spare corn land to grass for unmet wool demand only when their real flock can supply lambs, their purse can winter them and the remaining grain covers the town's need. No encroachment on tenant land, meadow, vines or demesne. Monthly land assignment preserves profitable grazing; grass valuation shares each household's actual sheep across all family-owned pasture, with one breeding allowance and winter purse.
- Quotes and budgets are phase-local. No saved index, new record type, journal event or invented coin/beast; no change to `reprice`. Intended history change. The 28 focused input, production, flock and land checks pass, including co-owners in one household. Recovered correctness gate: 1,362 suite checks passed; five projection checks timed out under external machine load, then passed individually on both the unchanged baseline and candidate. All 1,367 checks are now verified, including worker boundaries and save/load continuation. The projection test accepts the existing `FURLONG_TEST_SOURCE` convention for frozen-source diagnosis; assertions are unchanged. No profiling, identity comparison or long soak, per the user.
- #37 remains unfinished; its next court phases are unchanged. The specific six-year player world has not been measured. Artifact publishing remains unavailable.


## Continuation, 2026-10-09: #37 trespass and bread/ale assize (batch 11c, tested locally)

- The next manor-court phase is implemented in the cloud checkout, based on clean `main` at `5c5b121`. Grazing presentments run only when the existing monthly livestock reckoning finds pressure above capacity. Grazing shares follow the real worked holdings (resident mouths where there are none); the month's shortage is apportioned among excess beasts and valued as winter-equivalent hay. The lord's and drovers' contribution is not charged to the families. No additional household census or per-family land search.
- The bread/ale assize is the customary licence described in `docs/SYSTEMS.md`, not an invented short-weight offence. Actual named bakery/brewery payments in `payCrafts` accumulate one bounded pending plea per account and lord. Sundry craft payments and estimated earnings are excluded. Each place's great court hears it on `dueOn(si,180,37)`; ordinary quarter days leave it pending while hearing other business.
- These are fine-only presentments: the existing custom and cap apply to cash beyond the next month's family bread and rent. They do not recover fictitious principal, sell beasts, or become unpaid household debt; a paid or pardoned ruling retires the presentment once. The existing sitting budgets share the purse with every other case. Merged accounts follow their surviving head; an extinct estate leaves no personal presentment for its heirs. The roll distinguishes receipts/grazing harm from money owing, shows the next great court, and keeps two aggregate per-kind counters outside household accounts.
- Correctness: 1,396 checks verified, including 45 court cases and both new native plea references saved on day 37 into a fresh realm that continues 55 days equal. The standard eight-way suite passed 1,395 checks; one unchanged save/replay boundary check exceeded its 30-second save-packing limit under concurrent load, then passed unchanged in isolation on both the candidate and frozen baseline. No test or time limit was relaxed. Browser evidence (`worker-complete`) covers 180 days plus 180 after save/resume: complete world graph, every RNG stream, commands, annals, settings and storage sequence match the reference; all nine view outputs match and leave world/RNG stable. Journals settle and the worker keeps the UI heartbeat responsive. Chromium uses software WebGL here; no hardware or drawn-play claim.
- Final serial soak (`soak`): seeds 42/1001, each its own fate, sea, three years; both worlds pass every check, all annual money residuals are zero, with no faults or inventory mismatch, 2,160 independent inventory checks per world and no pending journal bytes/chunks after the final flush. There were 88 sittings, 721 assize and 142 grazing rulings (218/32 pardoned), 143.928 in total amercements, 25.571 in real dues recovered and 19.918 paid to named officials. Year-3 sampled tickJustice total CPU: 0.041/0.051 ms per day; courtGrazing: 0.021/0.003. Soak-start load: 0.71 / 1.08 / 0.67.
- Matched `5c5b121` baseline (`baseline-soak`) also passes. End populations: 2,360 → 2,418 (42) and 2,152 → 2,460 (1001). Population-weighted famine over three years: 4.21% → 4.83% and 8.18% → 5.21%; hunger: 0.0751 → 0.0882 and 0.1127 → 0.1057. Histories intentionally differ; these observations establish no calibration or speedup claim. Evidence: `tools/soak-results/courts-presentments-20261009/`. HTTP snapshot URLs are now optional in the worker/soak harnesses because this host’s Chromium policy blocks file URLs; served snapshots were hash-checked against the frozen files. No release has been pushed.
- Tested HTML SHA256 `bae856463af8b7111fef06588a16f15100b0df779546a98fcacdc822a61ff487`; stamped local HTML SHA256 `072a1fddd39517be83a2d9c8c309bb4858aa08a4a8814096c8658fc1d454e68e`. Game-script SHA256 `846de6f87524c592faa510d62267daf936980c3eded6b0926d710395aa31669d` is unchanged by stamping; all seven post-stamp source/advisor checks pass. The build is prepared locally; Pages/container and the claude.ai artifact have not been updated from this checkout.
- Next within #37: land/merchet/heriot roll entries; riot, robbery, felony and neglected-road presentments; then sheriff/hundred, eyre, capital bench and effects on credit/hardship. #37 remains in progress and #39 has not begun. The Mac's late-world farm has not been resumed here; its snapshots are not present.


## Continuation, 2026-10-10: #37 land and customary entries (batch 11d)

- Based on local `3ef59ef` (batch 11c). The manor's existing transaction hooks now enrol native ownership and occupation changes: initial admissions to newly worked land, annual admissions, inheritance and dower, household marriage, assarts, rent-default surrenders, freehold/demesne sales and sharecrop letting. Existing transfers, rights setters, random choices and their order are unchanged. A merger captures its former working head before the emptied account is replaced in the native title.
- `s.enrolments` is separate from pending pleas and court judgements: twelve recent entries, with earlier counts for four fixed kinds (land, entry, merchet, heriot). Each is a scalar snapshot of names, IDs, rights and real quantities at the transaction; it retains no actor, holding or extinct account. No new sitting, charge, officer fee, household debt, annual ledger or world/person census. Admission records make no payment unless one already happened.
- Entry fines record real receipts, the assessed custom and the original unpaid amount; the existing plea remains the live obligation. Merchet names the bride, spouse, payer household and actual holding's lord, and records only the payment already made. A short merchet creates no new debt. A heriot records the one best beast actually offered to the lord, in kind, with no invented coin receipt. Freeholders, disabled customs and estates without a whole beast create no heriot entry.
- The court inspector shows the register, including historical names and links to people, lords and global field IDs. Its settlement-card link is available before any sitting. Both reports only read state; the register stays in the worker, where the inspector query runs. The guide and embedded advisor describe the entries. The soak's yearly institution report counts all four kinds without adding simulation state.
- Identity proof: frozen `3ef59ef` versus this batch, seed 1001 / fate 42 / sea, 150 native days. Whole world and recorder graphs, closure sources, population, purses, settings and journal effects match at days 0, 37, 90 and 150 after temporarily omitting only `s.enrolments` from both fresh captures. Every day's RNG, commands, annals and storage sequence also match. The candidate recorded 269 land entries, two merchets and one entry fine. Evidence: `tools/soak-results/courts-enrolments-20261009/identity.json`; that directory is named for when work started.
- Correctness gates: the final eight-way suite passes all 1,408 checks, including the settled widow/minor rights, cold court reads, and both native saves on day 37 that continue 55 days equal in fresh realms. Suite CPU: 717.26 seconds across parent/children, with start load 0.99 / 1.30 / 1.81. Initial failures were the expected worker-only field declaration and reviewed ownership-region pin, plus an existing HUD test's real-clock race under load. The declarations were reviewed and updated, and that test now controls elapsed time while retaining frame-paint, interval-paint and stale-clock assertions. No time limit or runtime assertion was weakened.
- Browser (`worker-final`): 180 days plus 180 after save/resume, full W graph, every RNG stream, commands, annals, settings and storage sequence match worker/reference; all ten view outputs match and the worker stays responsive. The added court view exposed a pre-existing day-zero read that populated `W._folkIndex`; the final display-only fix uses existing indexes or saved names without writing W. Final-source browser check (`worker-read-final`, eight days plus eight after replay) passes worker/reference and resume parity, all ten view outputs, full W/RNG read stability and responsiveness; all four journals settle. The final court view shows both day-zero and saved transaction entries without populating the person index. Chromium uses software WebGL; no drawn or hardware-performance claim.
- Serial three-year soak (`soak`): seeds 42/1001, each its own fate, sea, both worlds pass all checks. All annual money residuals are zero, no simulation fault or inventory mismatch, 2,160 before/after inventory checks per world, and journals finish without pending bytes/chunks or faults. Totals: 934 land entries, 25 entry fines, 14 merchets and three real heriots. Population, famine, hunger and money summaries equal batch 11c's matched soak (end populations 2,418 / 2,460). Start load: 0.96 / 1.75 / 2.19. No calibration or speedup claim.
- The soak's frozen HTML SHA256 is `60e27e4de5c0edae6565ebd5591bcb7fdf60be88a5f87df13caab8f5a96f22b9`, before the court's display-only index fix. It is byte-identical to final source outside `courtCard` (normalized SHA256 `5ff5a9a51a358a682ee804bc43ac86bd0a5fbb33d4b5742e177a67b6f0206ee1`). Final-source 150-day identity also passes (`704bd00da9b3f797654d7857e87cdfe31a39af2805680fbdc443f6770ee21fea`); every transaction/simulation function in the soak is unchanged. Served browser snapshots were hash-checked against the checkout. The first browser attempt was stopped after a missing directory slash in its launch URL returned 404; it never loaded the game.
- Prepared locally: tested HTML SHA256 `704bd00da9b3f797654d7857e87cdfe31a39af2805680fbdc443f6770ee21fea`, stamped HTML SHA256 `24870aea9a6b85bffe9c56394f2b36ba1cb5aae9642c0749358be92209797ca4`; game-script SHA256 `7efab4f86f3cbc232c6ebcd87912acc91d802d5bcd6b13fcc281325966e2fe10` unchanged by stamping. All seven post-stamp source/advisor checks pass. Evidence: `tools/soak-results/courts-enrolments-20261009/`.
- Next within #37: riot, robbery, felony and neglected-road presentments; then sheriff/hundred, eyre, capital bench and effects on credit/hardship. #37 remains in progress; #39 estates and then #35 Cistercian abbeys remain next in the recorded institution order. No release has been pushed and the absent Mac farm has not been resumed.

## Continuation, 2026-10-09: #37 criminal presentments (batch 11e)

- Based on local `93968ab`. Actual riot breakouts present at most three resident adult household heads, ranked by hunger, boldness and sense of law, with ID ties and no extra dice. The named customary amercement is three days of bread per living family member, fine-only and subject to the existing shared purse cap, subsistence reserve and court fees. Repeated incidents coalesce; amercement or pardon retires the plea once.
- A native caravan ambush records the nearest vill to the actual ambush, its carrier and real load value once. Successful outlaw recruitment records the recruit's fraction of the living household, coin, held/offered goods and beasts at joining. The separate royal roll keeps 64 recent cases plus earlier counts; no charge, stock transfer, impoundment or new ownership record occurs before the royal hearing. Camp raids on settlements are not implemented. Court views show this distinction explicitly.
- The source inventory reviews only the riot-time `headsOf` call. The existing ownership adapter is unchanged; the outside-claim corpus changes only for the read of native goods and beasts in `courtFelony`. Justice (58), bandit lifecycle (6), inventory (5) and architecture (1) focused checks pass. The first eight-way gate verified 1,416/1,417 checks: the existing boundary test timed out while packing a save under load. Its unchanged candidate and frozen `93968ab` both pass separately without relaxed time limits. Candidate/baseline CPU: 69.7/69.8 s; initial load 3.45/3.62/2.33 and 2.01/3.17/2.26. Fresh-realm native world-save continuations for seeds 42/1001 also pass.
- Native 150-day observational proof, 1001/fate42/sea: royal evidence is omitted from both fresh captures and the intended riot behaviour is disabled in the candidate. Every remaining W node, closure, recorder, RNG stream, command, annal and storage sequence matches at days 0, 37, 90 and 150. A forced day-37 probe exercises both royal evidence hooks; natural incidents did not arise in this short world. CPU baseline/candidate 75.8/76.8 s; starting load 0.78/2.45/2.09 and 1.18/2.22/2.04. This is an observational proof, not a claim that riot law leaves histories unchanged.
- Browser worker/reference: 180 days plus 180 after save/resume; full-world parity, resume parity, all ten view outputs, full W/RNG read stability and responsiveness pass. All four journals settle cleanly. This run precedes the display-only river correction, whose exact native proof is separate. Chromium uses software WebGL; no hardware performance claim. Evidence: `tools/soak-results/courts-crime-20261010/`.
- Final-source serial three-year conservation soak, seeds 42/1001 with their own fates, sea: both worlds pass all eight checks. Every annual money residual is zero, no simulation fault or inventory mismatch, 2,160 before/after inventory matches per world, and no coin paid to nobody. Natural riots on seed 42 yield six heard and four pardoned presentments; real amercements total 0.3652. Seed 1001 holds thirteen native felony cases at year three; no robbery occurs in this short sample, so robbery coverage comes from the focused native ambush and held-roll tests. Soak snapshot matches final tested HTML `8f41c32613f20ca0df76d12759fc564d2d79db448da2177a412dc557f37c0169`. Start load 1.59/1.59/1.47. No calibration or speedup claim.
- #37 remains in progress: actual royal hearings, robbery charges and felony forfeiture, neglected roads, sheriff/hundred/shire, the eyre and capital bench, then effects on credit and hardship. #39 and #35 remain next in the institution order. The absent Mac farm has not resumed. No release has been pushed.

## Continuation, 2026-10-09: #58 river water follows terrain bumps

- Player screenshot on Pages shows repeated humps on a straight river. `riverDrawLevel` supplied the raw bed + 0.35 at each point; the draw-only mesh therefore rose downstream over the terrain grid. `riverDrawProfile` pools adjacent rising samples at their mean level, keeping genuine downhill drops and surveyed canal levels. Confluences use those same profiles; their raised junction pools extend upstream through `levelRiverRuns`. Mill fitting reads the built mesh or the same profile before it is built. Saved heights, strips, widths, routes, siting and native simulation functions are unchanged.
- Thirty-two focused river/mill checks pass, covering terrain clipping, coastal outlets, junctions, pool formation, unmodified downhill/canal levels, upstream backwater and wheel contact. Native 150-day proof on 1001/fate42/sea compares the entire graph, closures, recorder, every RNG stream, commands, annals and storage with no normalization. All days 0/37/90/150 and daily RNG/journal digests match. Baseline/candidate HTML hashes: `aaea8732021c772f04758b49299dde8953ed5749a7ee13077f6194258b122980` / `8f41c32613f20ca0df76d12759fc564d2d79db448da2177a412dc557f37c0169`. CPU 76.9/79.5 s; initial load 2.09/1.41/1.41 and 1.40/1.35/1.39. No speedup claim. Evidence: `tools/soak-results/river-level-20261010/`.
- Texture delivery: the HTML alone requires its separate `assets/` folder. The user chose the hosted Pages URL after identifying that missing folder; no standalone package was requested or created. Both image assets load and shader compilation succeeds in the local browser probe, and atlas-on/off rendered closeups show the actual surface difference. Software Chrome is not a physical Safari test. The river correction remains local until a release is pushed.
- Final matched-camera software-Chrome check, seed 1001/fate42/sea: all 169 drawn river runs have zero uphill cross-section steps (previously 4,943, up to 6.55 m). Texture loading and shader compilation pass without browser errors; matched before/final screenshots show the leveled reach and a mill wheel still meeting its water. Canal flags are preserved in the draw records. Screenshot day and camera match; animation timing is not a pixel-identity test. No physical-Safari or hardware-performance claim.
- Combined final gate after the river correction: 1,420/1,420 checks pass with eight-way concurrency, including the native boundary/save-replay test that timed out in the earlier court-only gate. CPU 755.8 s at initial load 1.11/1.41/1.43. The final embed preserves tested HTML `8f41c32613f20ca0df76d12759fc564d2d79db448da2177a412dc557f37c0169`; the release stamp yields `c7bedd77a37b12b5abaf6ecc7d44b95cde4a103ae825f13416d36d23486faa64`. Game-script SHA256 `3d97257154294b1ecf49cc9c594619cd1cd3fcb72cd499163ba500e7ac1a6ec9` is unchanged by stamping. All seven post-stamp source/advisor checks pass. Prepared and committed locally; no release push.
