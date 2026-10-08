# Handoff: state of work

Written 2026-10-07 when work moved from the user's Mac to a cloud agent. Whoever carries the work keeps this file current: what is true now, what is next, what waits on the user.

## Where things stand

- **`main`** is released to Pages and the container image (batch 8, see the latest release stamp). The claude.ai artifact is still v86 (08446b7); see Waiting on the user. `main` carries:
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
- **Batch 9 in progress** on `claude/friendly-bardeen-luem2o` (meat, with #36): three agents in worktrees, one each for meat (the good, the Martinmas slaughter, butchers, three foods, pannage), the manor (mill and oven farms, suit of mill, commutation, entry fines, merchet, liveries, the crown's book, the customs rows) and the roads (pontage and pavage, upkeep from tolls, toll houses, assarts). The customs table (`CUSTOMS`, `customOf`) is in the tree. Then the gate: the full suite, a six-world soak and the economy probes, with the farm paused.
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
2. **#36** (lords' customary income), **#37** (courts, as `tickJustice`), **#39** (estates), **#35** (Cistercian abbeys), **#38** (credit), then **#41, #40, #43, #42**. Also **#46** (the Church) and **#47** (crusades).

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

- **Publish the claude.ai artifact** from `main` (1aa50a1): `index.html`, with `assets/` and `LICENSE` as files. The cloud agent left it to your machine; it is still v86.
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
