# Handoff: state of work

Written 2026-10-07 when work moved from the user's Mac to a cloud agent. Whoever carries the work keeps this file current: what is true now, what is next, what waits on the user.

## Where things stand

- **`main` (1aa50a1)** is released to Pages and the container image. The claude.ai artifact is still v86 (08446b7): the cloud agent did not publish it (see Waiting on the user). `main` now carries:
  - **batch 5, determinism (#45):** the game's own math (`DM`), sorts that throw no dice, and the population memo (`_popValid`, `_popTotal`) left out of the world graph (`HISTORY_SCRATCH`). Driver parity (Node loop, soak page, worker build) is equal on 42 sea and 1001 sea at days 360 and 720. Every world's history changed once, so soak figures from batches 1–4 don't carry over.
  - **batch 6, the economy (#50, #51):** a seller's reserve is the average cost of what he has on sale, set on whoever holds the goods; the crafts buy their stuff for what the place wants of the ware, less what lies unsold.
- **Branches.** Work goes on `claude/friendly-bardeen-luem2o`, now level with `main`. The remote `determinism` branch is merged but could not be deleted from the cloud.
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

V8 startup snapshots restore a world exactly but can't chain (each build starts from Node's own snapshot), and building one runs about 2.6× slower. The late-world farm and shipped checkpoints both need a real serializer:

- **What it saves:** W, module state, RNG streams, ledgers and journals.
- **Closures** (`makeHash`, `s._lay.live`) are rebuilt by their makers.
- **Verified** when a save, a load and a continued run give the same digest as an uninterrupted run (`tools/model-run.cjs` digests).
- **Requirements:** loadable in a browser, independent of engine and Node version, versioned against the build, compact.

Then build the farm:

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
- **Research done (read-only, a planning agent, 2026-10-08):**
  - **State outside `W` to save:** the scalars in `HISTORY.roots()`, `ANNAL_META`, `HASH_STAMP`, the commodity ledger's private `DAILY` state (`orderRanks`, `nextOrderRank`, `ownerFacilities`, `volumes`; not in today's digest) and the outcome journal's `seq`/`chunk`/`committed`.
  - **Indexes to re-adopt:** `notableIndexRebuild`, `householdMemberIndexAdopt`, the storage claim ranks, and the commodity account views.
  - **Caches to drop:** `ROUTING`, `ARMY_ROUTES.memory`, `MARKET_TRADE_INDEXES`, `G._seaChart` and the like.
  - **Closures with makers:** the `HH_FIELDS` accessors (`bindHousehold`), `s.pop`, `s.stores[g]`, the account `held`/`sale` Proxies, `bindPropertyRights`' `own`/`wk`/`ownerId`, `makeHash` (on `W.rivHash`, `W.treeHash` and `s._lay`), the sfc32 streams.
  - **The hardest piece is `s._lay`:** it closes over 119 bindings of `layoutSettlement`, twelve of them written by its closures (all twelve already in `historyState`). `layoutSettlement` must be split so its closures can be built from a saved context without generating.
  - **Classes to restore:** `HouseholdPopulation` (fill it via `Map.prototype.set`), `OwnedMarket`, `CommodityBalanceLedger`.
  - **Proposed:**
    - a `HistoryGraph`-ordered node table with makers matched by exact source text;
    - a header holding the game script's SHA-256, `buildId()`, `worldHash()` and the classic save, falling back to replay when the hash differs;
    - save only between ticks, after `STORAGE_OUTCOMES.wait()`, `commoditySettleAll()` and a flush;
    - verify by save at day N, load in a fresh realm, then equal capture, equal digests after M ≥ 360 days, and a chained save.

### 3. Institutions, in the order of `docs/SYSTEMS.md`

1. **Groundwork:**
   - owner kinds `abbey` and `guild` in `acct`, `means`, `transfer` and the ledger;
   - offices on household heads;
   - an `'inst'` RNG stream;
   - lords' whereabouts `h.at = {si, until, why}`;
   - bounded per-place record lists;
   - a soak `inst` section.
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
- **Prices run away** where little is offered (#51): 26–28 place-goods above 10× base on 42 sea by year 3, 16 on 2002 land by year 5.
- **The 15 km world** is the one that got worse with batch 6 (famine 2 → 10%, capital hunger 0.12 → 0.28 at year 5). Its crown also bought a ward for nearly all of its chest (#52). Not yet diagnosed.
- **#27, still open:** `streetGraph` keeps its graph on the place (`s._sg`). The simulation reads that graph too, so a view that builds it early could change a later outcome if a change escapes its key.

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

1. **How should a market find its price (#51)?**
   - **Today:** `reprice` steps each price up to 28% a month toward the month's shortfall and the stock's cover, with no demand curve. Where a little is offered and buyers keep ordering, it climbs for months: grain at Bourport reached 924× its base, cloth hundreds of times. It comes down at most 22% a month when supply returns, so a town can't buy the grain that finally arrives.
   - **Options:**
     - **(a) Clear each month at the price that sells what is offered to what buyers' purses will pay.** Demand already scales with each purse, so this price is the purses' sum over the supply. This redesigns price formation, and every history changes.
     - **(b) Keep the step, but raise a price only for buyers turned away who could have paid it,** and let unsold stock bring it down as fast as scarcity drove it up. A mechanism fix inside today's design.
     - **(c) Leave it until the institutions are in,** as part of calibration.
   - **Recommendation:** (b). Until you answer, the agent works on the world serializer (step 2).
