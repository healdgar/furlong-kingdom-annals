# Handoff: state of work

Written 2026-10-07 when work moved from the user's Mac to a cloud agent. Whoever carries the work keeps this file current: what is true now, what is next, what waits on the user.

## Where things stand

- **`main` (08446b7)** is released: Pages, the container image and claude.ai artifact v86. It holds batches 1–4 (economy, army movement, mills, motion, advisor, day cost) and the map-badge fix.
- **Branch `determinism`** holds three commits on `main`:
  - f1d7dd9: the game's own fdlibm math (`DM`), the same in every engine;
  - 5e63efa: sorts no longer throw dice;
  - 9b79b9e: driver parity names the W keys that differ, and the dice guard knows every RNG helper.

  Its full suite passes (1187/1187). It changes every world's history once. It is not merged yet; see step 1.
- Nothing else is unpushed. The lordship and estates work has no code yet, only the notes below.

## Next, in order

### 1. Finish determinism (#45) → batch 5

- **Proven (run D8, days 360 and 720 on worlds 42 sea and 1001 sea):**
  - Node and the worker build have equal world graphs.
  - Node, the worker and the Chrome soak have equal RNG streams, population and treasury.
- **Open:** only the soak's world hash differs, in the W keys `_kids`, `_pm`, `armies`, `bldList`, `capital`, `caravans`, `households`, `land`, `notables`, `settlements`, `travellers`, and also `banditCamps` on 1001. The likely cause is fields that the foreground page's drawing or UI writes onto simulation objects.
- **Do:**
  1. On the branch, run `node tools/driver-parity.mjs --worlds 42:42:sea,1001:42:sea --days 360,720 --out <dir>` (needs Chrome).
  2. Dump one key (`W.capital`) at day 360 from the soak and from Node, and diff its fields.
  3. Move display fields off W (to `G` or `entityView`), or leave them out of the digest, giving a reason for each.
- **Then:**
  1. Gate batch 5 (determinism) and re-baseline the history-pinned tests.
  2. Merge and release.
  3. Note in the hand-back that the soak numbers from batches 1–4 were Chrome's history and won't carry over.
- **Diagnose on this build:**
  - the 42 sea crown runs dry around day 1530;
  - on 2002 land, famine reaches 18% at year 5.

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
- **Build:** run the farm on the determinism build.

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

- **Batch 4 soak at year 5 (a72ff6c):**

  | World | ms/day |
  |---|---|
  | 1001 sea | 46 |
  | 1001 land | 45 |
  | 2002 land | 64 |
  | 287970763 sea | 74 |
  | 42 sea | 56 |
  | 1001 sea, 15 km | 118 |

  - Parts of the day, largest first: `tickEconomy`, `tickPopulation`, `commoditySettleAll`, `tickMarket`.
  - Self time, largest first: `quantity`, `walk`, `entries`, `invalidateQuantity`.
  - Money audits were clean: residual 0, nothing minted, nothing paid to nobody.
- Famine is down to 0–3% at year 5 on 4 of 6 worlds. 2002 land is still at 18%.
- The capital's income gap can't close until #39, #37 and #35 exist. Don't fake a payer.

## Rules the user set that CLAUDE.md doesn't spell out

- Subagents run on Opus, never Sonnet or Haiku. A Fable agent may be asked for ideas when stuck, never for the coding.
- Never use the `mcp__furlong__*` tools. They drive the user's live game.
- Test in batches: no per-change soaks.
- The user values root causes over patches, and real mechanisms over stand-ins.

## Working in the cloud

- **No `~/dev/.furlong-work`.** The clones, the test runner's ledger and the hot list there live only on the user's Mac. Keep a fresh hot list at `tools/soak-results/hotlist.json` (git-ignored). The batch-4 numbers above are the baseline.
- **Chrome.** These need Chrome or Chromium (`--chrome <path>` or `CHROME=`):
  - `soak.mjs`, `driver-parity.mjs`;
  - `replay-check.mjs`, `performance-check.mjs`;
  - `simulation-worker-play-check.mjs`, `session-resume-check.mjs`.

  These run in Node alone: the suite and `tools/model-run.cjs`. Locally the user runs Node 25.2.1 and Chrome 154. Until determinism lands, Node and Chrome play different histories.
- **Branches.** Work on a short-lived branch and merge to `main` only after its batch passes the gate, because every push to `main` deploys Pages and the container.
- **Release.** The claude.ai artifact (https://claude.ai/artifact/3bfimVpbRRQ2Y3Jwzxd9r7) needs the Artifact tool. If you can't publish it, say so in the hand-back, and the user's machine will publish it.
- **Questions for the user.** Add them below and carry on with work that doesn't depend on the answer.

## Questions for the user

(none open)
