# Handoff: state of work

Written 2026-10-07 when work moved from the user's Mac to a cloud agent. Whoever carries the work keeps this file current: what is true now, what is next, what waits on the user.

## Where things stand

- **Paused by the user until Tuesday (2026-10-13).** Next: #37, courts and royal justice (`docs/SYSTEMS.md` § 4), the next step of "Next, in order". The farm (`tools/soak-results/farm-42-b10`, batch 10b's frozen build) was left running; a container restart stops it, and it resumes with `--from` its latest save.
- **`main`** is released to Pages and the container image (batch 10b, see the latest release stamp). The claude.ai artifact is still v86 (08446b7); see Waiting on the user. `main` carries:
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
- **Branches.** Work goes on `claude/friendly-bardeen-luem2o`, level with `main` after each release. The remote `determinism` branch is merged but could not be deleted from the cloud.
- Nothing else is unpushed.

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
  - `tools/world-save.test.mjs`: 42 sea and 1001 sea saved on day 37 load into fresh realms that capture equal, save again to the same bytes and play 23 more days equal.
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
2. **#36** (lords' customary income: built, batch 9), then **#37** (courts, as `tickJustice`: next; it collects #36's arrears from the pleas roll and presents unmended roads), **#39** (estates), **#35** (Cistercian abbeys), **#38** (credit), then **#41, #40, #43, #42**. Also **#46** (the Church) and **#47** (crusades).

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
  - `tickJustice` runs manor and hundred courts on `dueOn(si,90,salt)`;
  - the sheriff and justices are notables (`mkNotable`);
  - pleas, amercements, and a pardon order;
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
- **Branches.** Work on a short-lived branch and merge to `main` only after its batch passes the gate, because every push to `main` deploys Pages and the container. The proxy here refuses branch deletion.
- **Release.** The claude.ai artifact (https://claude.ai/artifact/3bfimVpbRRQ2Y3Jwzxd9r7) needs the Artifact tool. If you can't publish it, say so in the hand-back, and the user's machine will publish it.
- **Questions for the user.** Add them below and carry on with work that doesn't depend on the answer.

## Waiting on the user

- **Publish the claude.ai artifact** from `main` (ae3931b, batch 10b): `index.html`, with `assets/` and `LICENSE` as files. The cloud agent left it to your machine; it is still v86.
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
