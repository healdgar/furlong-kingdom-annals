# Simulation performance

Fresh maps, every daily tick, every named person and household, and existing ownership and
inheritance rules remain intact. No era presets, saved-world bank, actor culling or SQLite were added.
The app remains a single HTML file with no build step.

## Exact fast forward (current priority, 2026-10-10)

The user’s target is hundreds of simulated years per real minute, with exactly the
same history at every speed for the same seed and commands on the same simulation
days. Source-file splitting offers no demonstrated speed
advantage here; keep the sectioned file and the authoritative simulation worker.

Reel already runs daily transactions continuously through the worker’s unpaced
pump. Its nominal `SPEEDS[5]` value of 360 is not a throughput ceiling. Display
acknowledgements limit landscape publication, while simulation can continue.
Raising the speed number or removing frames cannot eliminate daily model cost.

With 360-day years, the complete simulation and persistence budget is:

| Years per minute | Simulated days per second | Milliseconds per day |
|---|---:|---:|
| 100 | 600 | 1.667 |
| 200 | 1,200 | 0.833 |
| 300 | 1,800 | 0.556 |

Recent audited year-three profiles on this host put core `simTick` at 83.076 ms/day
for 42:42 sea and 66.532 for 1001:1001 sea, at loads 0.06→0.96 and 0.96→1.26.
They include profiler/audit effects; they are diagnostic profiles, not shipping
throughput measurements. Daily household feeding, economy and commodity queries
dominate. Most Proxy key enumeration in those profiles comes from the independent
inventory audit, outside simulation; optimizing it would mainly speed the test.

Two unprofiled native 1001:42 sea comparisons cover ticks 41–360 (320 measured
days each), using the worker’s raw capture/binary journal with an in-memory
acknowledgement sink. Compression and IndexedDB are excluded. Baseline/candidate
CPU is 94.73/85.49 ms/day (loads 0.3→0.6 / 0.2→0.5), then 91.51/86.64
(0.3→0.6 / 0.3→0.6): 9.8% and 5.3% less CPU. Median cost is 93.12→86.065 ms/day,
a 7.6% reduction, with identical year-end censuses. The shorter portable-journal
windows varied more; these modes and windows are not pooled into one speed claim.
The rejected missing-stock/combined candidates offer no demonstrated advantage
over the smaller retained-slot change.
These measurements precede the daily-order model changes described below.

Slots are private derived caches; each write still clears all twelve scopes, and
stock arithmetic, rank order, callbacks, writers and records remain unchanged.
Cold save/load rebuilds them; estate retirement drops the owner’s cache. Keeping
arrays increases retained cache memory per queried owner/good pair; native goods
are bounded, but late-world memory has not been measured. No memory improvement
is claimed.

This early-world measurement still exceeds the 100-years/minute budget by roughly
52× before durable browser storage. It is not a century-scale clearance or a
Safari/browser throughput claim. The Mac’s late farm snapshots remain unavailable.
Validation and artifact hashes follow in HANDOFF.md. Local evidence is in
`tools/soak-results/fast-forward-20261009/`.

To measure the current raw capture path without profiles:

```sh
node tools/model-run.cjs --seed 1001 --fate 42 --coast sea --journal raw --days 360 --measure 40:360 --prof 0 --phases 1 --hotlist 0 --out tools/soak-results/fast-forward-raw.json
```

`--journal portable` remains the tool’s historical default. Both sinks acknowledge
records in memory, so neither measures archive compression or IndexedDB writes.

### Daily-order refactor, 10 October 2026

The dependency record covers 42 original phases at `39d929e`, now separated into
52 source boundaries with 168 checked prerequisites. This first batch follows
the recorded serial order, makes trade/title choices and quarry output daily,
and deliberately changes histories. It is a foundation for subsequent input
reuse and daily eligibility work, not a speed optimization by itself.

One serial unprofiled 1001:42 sea comparison, ticks 41–360, uses the same raw
capture/binary journal and in-memory sink as above. Baseline/current CPU is
**94.58→99.74 ms/day**, loads **1.1→1.1 / 1.1→1.1**: 5.5% more CPU in this pair.
Phase wall time for trade is 3.983→10.573 ms/day after replacing the alternating
every-fourth-day origin visits with daily visits. This identifies a cost to
reduce; a single pair does not establish a precise regression or a speed gain.
Final population is 2,497→2,499, buildings 705→701 and cached routes 0→41.
The histories differ intentionally, so this is a cost comparison rather than
an equivalent-work optimization proof. Compression and IndexedDB are excluded.
At 99.74 ms/day the early-world CPU cost is about 60 times the 100-years/minute
budget, before durable storage.

The native 150-day fixed/changing-speed proof matches the full logical history,
RNG, commands, annals and every completed outcome event. It omits only playback
preferences and compares event contents independently of asynchronous chunk
packing. Two serial one-year worlds pass money/goods/fault checks. A browser
worker/reference comparison passes 180 days plus 180 after save/replay, with
matching tested views that leave the world/RNG unchanged. It also exposed an
existing bounded-advance bug when a petition restores speed: completion now
pauses at its target, covered separately by host tests and the final browser
gate. Exact source hashes, test results, the initial failed comparisons and
their diagnoses are recorded in `HANDOFF.md`. Local evidence:
`tools/soak-results/daily-order-20261010/`. Late-world, hardware drawing, Safari
and centuries-per-minute throughput remain unverified.

### Daily kernels, 10 October 2026

The next exact batch keeps the daily order and model. Trade shares lazy, ordered
dealer/driver candidates within its synchronous pass, rereading purses and
absence for each load. A singleton commodity location avoids general withdrawal
list allocation, while reading live custody and spoilage. Multiple locations,
overridden entries and guarded trade callbacks retain their general paths.
Neither optimization freezes a household's budget or food for the day.

Two serial unprofiled CPU pairs compare frozen `8980908` against the combined
patch: 1001:42 sea, AD 850, ticks 41–360, native raw binary journal acknowledged
in memory. The second pair ran candidate before baseline.

| Pair | Baseline CPU ms/day (load) | Candidate CPU ms/day (load) |
|---|---:|---:|
| 1 | 99.43 (0.5→0.6) | 96.90 (0.6→1.1) |
| 2 | 98.04 (0.3→0.7) | 95.07 (1.0→1.0) |

Median CPU is **98.735→95.985 ms/day, 2.8% less** for this early world. Phase wall
diagnostics also fall: trade 10.147→8.596, economy 11.186→9.839 and population
31.177→30.099 ms/day. Those are whole-batch diagnostics, not separate CPU gains
assigned to each optimization. Year-end censuses match. Compression, IndexedDB,
late-world scaling and hardware/Safari throughput are outside these measurements.
The remaining CPU gap to 100 years/minute is about 58×, before durable writes.

Evidence is in `tools/soak-results/daily-kernels-20261010/`; validation and exact
source hashes are recorded in HANDOFF.md. The 19 new focused cases compare the
current dealer/driver selectors against frozen `8980908` and singleton planning
against the unchanged general path, including live intervening mutations,
ranked custody, missed loads, RNG, spoilage, crumbs, transit and callback fallbacks.

### Work in order

The user has since authorized changes to the model/history while retaining exact
history across speeds. The recorded dependency survey and new daily source order
are in [SIMULATION-ORDER.md](SIMULATION-ORDER.md), with a machine-checked contract
in `SIMULATION-ORDER.json`. Calendar intervals need simulation reasons; arbitrary
CPU decision throttles are to be replaced by daily eligibility and input-revision
checks. The first refactor separates arrivals, production, protection/loss,
construction, departures and financial close. It deliberately changes histories;
its throughput is to be remeasured, not inferred from the ordering.

1. **Refactor from the recorded daily dependencies, then make each day cheaper.**
   Keep the canonical writers and new serial schedule identical across speeds.
   Separate mixed decision/rate/contract functions before changing their cadence.
   Make daily trade eligibility cheap using current driver/merchant means and
   stock/price/inbound/route changes; preserve live balances at execution.
   The first validated exact optimization retained commodity quantity-cache slots
   across writes. The next batch adds singleton withdrawal planning and trade-pass
   actor candidates; privately ranked live-cell handles remain a candidate.
   Storage-investment quote inputs/writers are recorded in
   [SIMULATION-CACHE-INPUTS.md](SIMULATION-CACHE-INPUTS.md) before that daily
   conversion. Cache geography separately from current population/security
   inputs before enabling daily building choices. Reads must see each intervening
   purchase and consumption; a whole-day food snapshot becomes stale.

2. **Bound cost by the living world.** Profile later eras and distinguish active
   actors/stock from expired routes, empty accounts and historical records. Use
   derived active/due indexes only where all invalidation paths and canonical visit
   order can be proved. Keep every named actor and household in the model.
3. **Budget presentation by real time during Reel.** Measure the daily clock
   messages, thirty-day landscape packets and annual autosave barriers. The
   nominal target cadences imply 600–1,800 daily clock messages, 20–60 landscape
   publications and 1.67–5 annual saves per second; acknowledgements and autosave
   coalescing reduce actual delivery, while urgent updates add exceptions.
   Coalesce display publication while preserving
   pending events, geometry dirtiness, wire order and urgent pause/endgame updates.
   Display cadence must not determine simulation outcomes.
4. **Separate exact history from eager audit materialization.** Current three-year
   archives record roughly 201–235 kB binary and 55–63 kB compressed per day.
   Extrapolating this early-world rate to 100 years/minute requires 121–141 MB/s of
   binary processing and 33–38 MB/s of durable compressed writes. Measure journal
   worker CPU and IndexedDB waits separately. Lossless encoding can change without
   dropping canonical events. A later reconstructable archive could retain exact
   engine identity, seed, ordered commands/settles and day-boundary checkpoints,
   then regenerate an older requested economic segment in an isolated replay
   worker. That changes the current always-on audit-retention contract and needs
   an explicit design and continuation/export proof; checkpoints alone do not
   accelerate future days. Preserve annals, biographies and genealogy.
5. **Prove each gain.** Freeze a baseline; compare every world node, closure,
   recorder, RNG stream, command, annal and storage outcome over at least 150 days.
   Include cold-cache save/load, worker/reference/replay and money/goods checks.
   Measure repeated CPU windows with load recorded and validate late-world scaling
   before claiming the target is met.

### Why an arbitrary calendar jump cannot preserve this model

Institutions, folk, land and livestock already run on monthly, quarterly or annual
schedules. Their dispatch can be cheaper, but skipping their guard calls does not
remove the daily critical path. Food output, purchases, consumption, births/deaths,
prosperity, unrest, SIR epidemics, travelling loads and military actions affect the
following day. Politics and threats consume shared RNG streams in daily order.
Multiplying a rate by a month, using a closed-form population update or sampling a
next-event date would change rounding, thresholds, transaction order or RNG draws.
An event skip is admissible only where its entire interval is proved equivalent to
executing the original days. Approximate fast-forward is outside the user’s request.

## Earlier exact optimizations (historical notes)

This batch removes repeated work without additional simulation indexes or events:

- Daily feeding prepares ownership and food reconciliation once; independent
  food top-up calls still prepare their own inputs.
- Monthly wage payments retain only the first five sorted poor candidates,
  enough for four recipients after excluding the payer. Payment order and ties
  remain unchanged.
- A household's migration roots are evaluated once for its destination search,
  rather than scanning its fields for each destination.
- Hidden Crown and realm panels skip their periodic reconstruction. Opening a
  panel refreshes its data immediately. Crown reference linking otherwise
  searches living and historical people even when the drawer is hidden.

All 916 source tests pass. Focused tests cover household food, hunger, debt and money equivalence, wage
recipient ordering, migration-root values and panel visibility. They establish
removed work, not a measured whole-game speedup or century-scale clearance.

Architecture planned at that time (worker separation is now implemented):

1. Eliminate remaining household-by-population and owner-history scans using
   authoritative household membership and existing active balance membership.
   Preserve ordering where it affects RNG, inheritance or money.
2. Separate display projection from daily state changes. `animateWorld` currently
   mutates traffic, envoy and actor state; throttling it wholesale is unsafe.
   Keep authoritative changes in simulation, then refresh visible geometry and
   animation at a bounded cadence during reeling.
3. Move the serial daily engine behind the existing worker boundary, with one
   authoritative world, ordered player commands and bounded display deltas.
   A worker improves responsiveness; it does not make the same CPU work cheaper.
4. Measure matched drawn and undrawn runs on the resulting source, including
   later-year cost growth and persistence backpressure. Faster short fixtures
   cannot establish practical fast-forward throughput.

Daily pantry, hunger and debt settlement remains required. Monthly and annual
decisions should run only when due; no coarser approximation is enabled here.

## Failed army retreat retries, 5 October 2026

A 32.9-second main-thread profile of the running `48c2b35` release, seed
287970763 / fate 370450810, found `tickMilitary` at 62.9% inclusive CPU and
`armyDetour` at 62.4%. Two hungry armies repeatedly tried an impassable retreat.
These nested percentages overlap. Journal-worker CPU was outside this profile.

Failed automatic retreats now reuse `holdUntil` to retry after 30 days, retaining
any longer hold. Explicit orders remain immediate. Failed moves preserve the
field position and do not announce successful foraging. Roads and paid sea
crossings remain available from a field position; the army joins the nearest
origin-side land segment through a physically checked connector. If the road
route fails or is absent, passable cross-country travel remains possible at
`FIELD_MPD`. Both routes retain river, building, wall and slope checks. No new
maintained index or event was added. Automatic retries see changed obstacles
on the next retry; a new explicit order can retry immediately.

Nine focused regression tests cover cooldown, longer holds, queued orders,
changed passability, field position, terrain fallback and charged sea crossings.
A matched synthetic Node/V8 kernel fixture over 60 days reduced failed orders
from 60 to 2, detour calls from 180 to 12 and segment checks from 1,500 to 100.
It uses the actual terrain-search kernel with a synthetic impassable cliff;
these are fixture results, not whole-game timing or long-run clearance.

The final game source (SHA256
`b666e678300c24f59a68830a7450d08b1d269811ae0359fa0a6d08cc3c4c6c77`)
also passed a three-year native Chrome run with the same map/fate seeds:
2,160 independent inventory checks, zero simulation errors, zero annual money
residuals, and complete journal settlement. This does not reproduce the live
year-five army state or establish later-year throughput. All 39 focused army,
campaign, routing and old-search guard tests pass.

## Remembered army routes, 6 October 2026

On seed 2002 (land), days 1000–1200, `tickMilitary` took 45–58% of the daily tick before this change. A host
whose campaign route is impassable asks for it again every day: the 30-day `holdUntil` guards only the hungry
fall-back, not the campaign objective or a queued `nextOrder`. Each failed `armyLandPath` searched up to three
detour boxes of up to 30,000 lattice points.

`armyLandPath` now remembers, for each host, every answer whose search needed a detour box
(`armyRouteRecall`). With the answer it keeps an exact copy of everything that search could read
(`armyRouteRead`): the host's fording depth, road-only crossing and raft (with whether it is ready that day);
the terrain and domain cells under each span it tested and each box it searched, with two cells (at least
54 m) to spare; the river lines and road bounds and lines there; and, for every place whose domain those cells
lie in, its lake, buildings, walls (with breaches, building progress and kinds), gates, motte and ring ditch,
and whether its gates stand open to this host. The answer is given again only while that copy equals the
world value for value. Any difference searches afresh, so a bridge built, a breach, a peace or a finished raft
is seen the same day. A search stores the bounds of the roads it looks at (`onRoad`, up to `onRoad.reach`);
a recall stores them on the same roads. Walkers (`a.settlement` or a shared `_em`) are not remembered.

The memory is derived state in the module (`ARMY_ROUTES`, a WeakMap keyed by host), outside `W`. It is never
saved, sent to the screen or captured by the history graph, and an empty memory (a loaded game) finds the
same answers. `ARMY_ROUTES.verify` searches afresh at every recall and throws if the path, the search, what
it read or the roads' bounds differ. `tools/army-route-memory.test.mjs` runs the game's own search and memory
against fresh searches, through random changes and through one targeted change of each kind the search reads.
It also pins the source of every function the copy mirrors, so changing one of them fails until
`armyRouteRead` is reviewed. Deliberately weakened copies (one input left out at a time) fail that file,
except a narrower margin, which only the long verify runs exercise.

Evidence (model-only runner, instructions retired per simulated day over days 1000–1200; one-minute load
beside each, mostly from work outside Furlong):

| World | Memory off | Memory on | `tickMilitary` CPU ms/day |
|---|---|---|---|
| seed 2002, land | 1,087 M (load 54–63) | 574 M (load 20–24), −47% | 26.1 → 1.1 |
| seed 287970763 / fate 370450810, sea | 1,915 M (load 8–9) | 901 M (load 58–101), −53% | 65.9 → 14.4 |

The world graph, world-only graph, RNG streams and the full capture are equal with the memory off, on and in
verify mode at days 1000, 1100 and 1200 on both worlds. They also equal main at days 360 and 720 (seeds 1001
sea and 2002 land) and over the 150-day proof. The verify runs made 332 and 837 recalls without a difference.
The largest copy held 18,937 values. On seed 287970763 after day 1000, 19 of 411 fresh searches needed a
detour box (6.5 ms a day); 4 remembered answers were searched afresh because roads were added, and stayed
blocked.

Buildings are weighed by the points the search tested (6 October 2026). A growing town inside a search box
changed the copy every few days, and its hosts searched afresh for the same answer. The copy now keeps a place's
buildings apart (`ROUTE_BLD`), and each detour box notes the nodes it expanded. A building raised, taken down, moved
or turned in the copied cells spoils the copy only if its footprint (armyObstacle's rectangle and 0.6 m) could cover
a tested point: on a straight stretch, or within 3√2 m of an expanded node. Otherwise every test the search made
comes out as before. On seed 1001 sea at km 15, days 31–150 (8 hosts, model only, instructions by
`proc_pid_rusage`, load 5–11): 20 of 46 such re-searches are spared (boxed-key hits 90% → 95%); `tickMilitary`
663 → 512 M instructions a day, the whole day 1,895 → 1,752 M. The other 26 are new buildings on ground the search
tested; an exact edge-by-edge test of the probe points spares none of them either. In the batch gate, verify mode found no
difference over 1,486 recalls (287970763 to day 1200) and 486 (km 15 to day 150), every digest equal to main's;
287970763 days 1000–1200 went from 664 to 549 M instructions a day.

## Algorithms

- Settlement population totals are computed lazily from the household ledger. Ledger set/delete/clear
  and household recomposition invalidate the total. Summation retains the original household order;
  incremental arithmetic would introduce different rounding.
- The person index and household census are reused until membership changes. Birth, death, household
  registration, parish removal, migration and military return invalidate the index. The census retains
  the existing same-day invalidation rules.
- Caravan quotes compute distance and freight once per town pair, and destination price once per good.
- Routing computes one shortest-path tree per origin and road revision, rather than searching again
  for every destination. Queue order, strict comparison on ties, road condition, paving, crossings,
  polylines and travel times follow the previous search. Unreachable pairs are cached until revision.

## Worker boundary

One background worker precomputes route trees from immutable numeric road graphs. Its code is made
from the same `routingTree` function used for synchronous misses; there is no second routing engine.
Results use transferable numeric buffers. The main thread accepts results only for the current
route-cache identity and revision. One graph is in flight and at most the latest replacement is queued.
Construction, posting or execution failures fall back to the synchronous kernel.

`&worker=off` disables the routing worker for comparison. The setting is captured before boot
normalizes the world link. Worker activity/failures are available in `ROUTING.stats`.

This boundary separates routing computation. **The main thread still owns the simulation, RNG,
rendering and input.** Moving the entire simulation into a worker remains further work: town-planner
closures, account projections, Three.js mutations, petitions and commands need explicit boundaries
and a bounded view-update protocol. A routing worker alone does not remove every long simulation tick.

Era startup now yields by elapsed time, roughly every 40 ms, rather than blocking for three simulated
years. It still advances every day. A single expensive tick can exceed that budget.

## Verification

```sh
node --test tools/source.test.mjs tools/provision.test.mjs tools/ownership.test.mjs \
  tools/advisor-api.test.mjs tools/routing.test.mjs
node tools/performance-check.mjs --baseline 8c35b973 --seeds 1001:sea,2002:land \
  --years 20 --variants baseline,candidate,off --out /tmp/furlong-performance
node tools/render-check.mjs --baseline 8c35b973 --seeds 1001:sea,2002:land \
  --days 720 --out /tmp/furlong-render
node tools/ownership-replay.mjs /tmp/furlong-replay
node tools/performance-check.mjs --baseline 8c35b973 --seeds 1001:sea \
  --era 860 --years 0 --boot-timeout 600 --out /tmp/furlong-era
```

The performance comparison runs worlds serially in native Chrome with the hardware GPU. Each source
is snapshotted and hashed. Annual graph fingerprints retain numeric precision, reference identity,
Map/Set/array order, household accounts, goods, genealogy, terrain, land, annals and modifiers; derived
caches and graphics objects are excluded. Subsequent draws from all three RNG streams are compared.
The worker-disabled run must prove it stayed disabled. DOM/UI intervals and rendering are suppressed
equally; deferred monthly land work and annual autosaves are flushed.

Reported daily CPU time excludes fingerprinting and the first warm-up year. It is an undrawn history
measurement, separate from frame rate and actual later-era boot time. Use `tools/soak.mjs` for food,
money, long histories and drawn scenarios; its [limits](SOAK.md) still apply. The existing whole-realm
money-audit failures must remain failures even when a candidate exactly matches baseline.

`--era` additionally compares actual boot from a freshly generated map through every prehistory day.
With `--years 0`, it checks the completed boot state and subsequent RNG draws without claiming daily
timings. Increase `--boot-timeout` for expensive eras. Controlled comparisons suppress the periodic
house-panel refresh; live UI timing and very long histories require separate validation.

An inventory index based on proxies was measured and removed: proxy access and iterator overhead
made it slower. Any further optimization must demonstrate both behavior equality and measured benefit.

Capturing market offers was also rejected. A twenty-year comparison first diverged on day 6,067:
two inventories can project the same household head, and settling an earlier offer changes a later
quantity. Market availability and settlement retain their live scans. A regression test freezes the
baseline behavior; correcting the underlying inventory alias requires separate ownership validation.

## Storage lot index migration, 4 October 2026

The remaining filtered full-lot scans now use the existing good, owner, location and availability
indexes. Multi-field queries inspect the smallest bucket. Purchases, physical outflow, spoilage,
inheritance, cargo dispatch, exposed hauling, investment aggregation, building reports and destruction
retain canonical lot insertion order, including after index reinsertion and intertown arrivals.
An external WeakMap tracks that order without adding fields to authoritative state or saves.
Only its first nonempty query walks all lot keys to initialize the order; subsequent mutations maintain it.
Existing indexed operations retain their original index order and accounting rules.

`node --test tools/*.test.mjs` passes 274 tests. Seven new regressions compare the former scans,
exact events, rounding, index order, incoming cargo and bounded index reads. Native Chrome/Metal
comparisons against `405fed3` match full state, subsequent RNG draws and every storage journal chunk
through days 30, 60 and 90 in sea seed 1001 and inland seed 2002, including commissioned storage.
Daily simulation CPU totals improve only 0.5% and 0.8% respectively in this short sample; this is
within timing variation and does not establish a material end-to-end speedup.

The baseline one-year sea profile attributes 67.3% of tick time to economy, 17.8% to population
and 12.6% to markets. Repeated accessible street-node searches and terrain checks remain costly.
The always-on storage journal records 5,026,615 outcomes in that year: 3,019,556,825 encoded bytes
and 174,044,598 compressed bytes. Record projection and serialization remain substantial CPU costs.
The exhaustive whole-world history recorder is opt-in and was disabled for these measurements.
The indexed source also passes the same one-year sea soak with zero simulation errors, zero
money residual and a fully committed journal. Its 264.79 ms/day versus baseline 262.87 ms/day
(including profiling, persistence and deferred work) confirms no material overall improvement.
Validated game source SHA256: `3126749421fa06a34dc368d2dcd91c541888898a390d6207cd1aa9e87d3277df`.
Local evidence is retained under ignored `tools/soak-results/index-migration-2026-10-04/`.

## Repeated storage routes and journal projection

Storage surveys and daily carriage now share accessible endpoint and street-path searches within
one synchronous calculation. Nested site quotes reuse the investment survey's cache. Each endpoint
and path cache admits at most 4,096 entries, then computes misses normally. A graph replacement clears
both caches; all cache state is released on return or exception. Subsequent calculations recheck current
terrain, water, walls, quarantine and sieges. Distances retain the original summation order and ties.

Journal projections copy ordinary own data fields using direct assignment, retaining the explicit
definition needed for `__proto__`. Descriptor inspection still rejects accessors and executable or
non-plain metadata. Undefined presence, special numbers, bigint, array holes, property order and every
transient outcome remain intact. Journal encoding and exported archive format remain unchanged.
Serializer alternatives that slowed representative encoding were discarded.

The local comparison harness now accepts `--baseline-source` to compare an exact uncommitted local
snapshot and measures route access, routing and record projection as well as daily CPU. Full-state,
RNG and journal-byte equality remain mandatory.

All 280 tests pass. Final-source native Chrome/Metal sea seed 1001 and inland seed 2002 match
the preceding indexed source at days 30, 60 and 90: full state, subsequent RNG draws and every
journal chunk are identical. Synchronous tick execution totals fall 13,634.8→6,933.2 ms (sea, 49%) and
14,451.3→8,336.8 ms (inland, 42%). Route execution time falls 90% and 85%; record projection falls 47%
in both. Tagged JSON encoding itself and journal volume are unchanged. These are serial, undrawn,
instrumented short histories on this host, not mature-world, startup or frame-rate guarantees.
Final game source SHA256: `9400f2d42344162cb174dfdcb4023b3f2e314c6227c73942900fe7ff59881699`.
Exact local snapshots, harness, fingerprints and measurements remain under ignored
`tools/soak-results/routing-journal-2026-10-04/`.

The timer measures elapsed `performance.now()` time inside each synchronous `simTick()` call,
including nested work and calls rejected by journal backpressure. Both variants make 134 calls
in the coastal run and 163 in the inland run. Asynchronous persistence waits and rendering are
outside that timer; this is not an OS CPU counter or a frame-rate measurement. The measured source
above is the performance checkpoint before journal deduplication or the proposed worker refactor.

### Architectural proposal at the checkpoint

The current `simTick()` already runs daily phases synchronously on the main thread. A daily barrier
alone will not parallelize that work. A future simulation worker should own the world and RNG,
process dependent daily phases in order, settle the accounts, then publish a small immutable view
with its day/revision. UI and rendering consume completed views and submit commands for an atomic
transaction between days; they do not mutate the authoritative world. Commands must remain usable
while paused and at life pace, where a simulated day lasts 30 minutes. A command can therefore publish
a new revision on the same day. Asynchronous calculations return versioned proposals,
accepted before commit only when their inputs still match. Full-world daily copies should be avoided.
Journal projection, encoding and persistence can be batched separately with bounded backpressure;
coalescing a rendered view must never discard required historical outcomes. This worker/day-boundary
refactor is a proposal, not part of the changes above.

## Integration with the current public release, 4 October 2026

Checkpoint `1c8bb84` is integrated onto public release `f2e4b93`. Its canonical-order lot
indexes and bounded coordinate/path reuse preserve the release's capture-fault guards,
native journal worker, immutable captures, active facility/claim indexes, hay remnant
losses, pending purchase protection and arithmetic provenance. Explicit route-batch
callers retain their existing API. Recursive plain-data projection uses direct assignment
with the own-property protection for `__proto__`; record projection already had that optimization.

All 578 tests pass. A stamped-source drawn one-day coastal smoke passes shader compilation,
camera uniforms, live rebuilds and church variants without browser or simulation errors.
Serial native Chrome/Metal comparisons against `f2e4b93` pass through
90 days in sea seed 1001 and inland seed 2002. Full world/land/annal fingerprints and RNG
states match at days 0/30/60/90, every accepted expanded storage event matches, persisted
replay matches accepted records, and both journals fully commit. The optional semantic field
oracle is unsupported in these sources; complete game-history reconstruction is not claimed.
Timing and correctness use separate fresh browser sessions. End-to-end undrawn timing is
6,739.4→6,666.2 ms coastal and 8,846.6→8,909.8 ms inland: approximately +1.1% and -0.7%
throughput, respectively, within variation. The current public release already includes
other optimizations; the historical 49%/42% checkpoint result is not an additional gain
against this newer baseline. Neither sample meets the harness's separate 70% encoded-history
reduction or 2x RAF-throughput gates; neither target is claimed for this integration.

Compared simulation source SHA256: `664b831fd98a0370aee2befc8d588ba6c406d3b37f259ba113882c7884265ac4`.
Release source SHA256: `f261626ad9f07648c82ac4b64069ae0886223db766de6075b527cb3be84f1d09`; only the visible build stamp differs from the compared source.
Full snapshots, accepted/persisted fingerprints and measurements remain local under ignored
`tools/soak-results/performance-deploy-2026-10-04/`.

## Validated source, 3 October 2026

`index.html` SHA256: `0a3808bf2f1c3c4a7df7cfdba6890c59e7cf043239778eb722bb4052a01526ec`.
Baseline: main commit `8c35b973c21dcbdb73aeb8b04d6b725e227674d4`.

- All 85 focused tests pass, including ownership, inheritance, food/payment conservation and routing.
- Seeds 1001 sea and 2002 inland match baseline for twenty years: every annual full-state fingerprint
  and subsequent RNG draw, with the routing worker both enabled and disabled.
- Desktop rendering after 720 days, touch/WebGL1 at 390×844 after 90 days, and the 360-day household
  save/replay pass. Shaders, camera uniforms, geometry, draw calls and texture budgets match baseline.
- Four worlds (1001/2002 × sea/inland) complete ten-year GPU-backed soaks and sixteen drawn smoke
  scenarios without simulation errors. Finite population/money, living realms and sane walls pass.
  Whole-realm money reconciliation fails in all four, as on baseline; no tolerance was relaxed.

On this Mac's M4 Max, the isolated 1001-sea history averaged 39.22 ms/day on baseline and 29.88 ms/day
on the candidate over years 2–20: 31% more daily throughput. Worker-disabled candidate averaged
28.85 ms/day. This establishes algorithm gains; it does not establish an additional worker speedup.
Inland timings overlapped other validation and are excluded from performance claims. These are
undrawn history timings, not frame-rate or later-century guarantees. Mature simulation still runs
on the main thread. Raw snapshots, diagnostics and coordination records remain local under `.git`.

Actual fresh-map AD860 startup also matches full state and RNG draws in both worlds, with the worker
on and off. Enabled startup took 34.57→33.47 seconds (sea) and 47.75→45.88 seconds (inland): only
3–4% less waiting. The longest 20-ms startup heartbeat interval fell from 12.42→0.79 seconds and
18.59→0.85 seconds; p95 intervals fell from about 84 ms to 58–63 ms. This improves responsiveness,
but does not make later-era starts immediate. Very long eras and full simulation-worker migration
remain unvalidated and unfinished respectively.

### Zero-demand owned consumption

`consumeOwned` retains pantry resolution, physical ordered-sum reads, title
synchronization, claim assignment and title-matching bookkeeping when effective
demand is exactly zero. It omits only the owner-lot iteration and its no-op
removal. The explicit journal assertion retains fail-closed behavior. NaN still
uses the original iteration; tiny positive demands never enter this shortcut.
The resolved owner is reused within a nonzero synchronous removal loop after
pantry and title synchronization. No physical sum or arithmetic order changes.

`tools/consume-owned.test.mjs` compares the complete relevant event, lot, claim,
household, index, counter and RNG projections against frozen `405fed3`, including
zero/negative-zero/NaN/tiny demand, char-to-timber mapping, live household
formation and household splitting. Local microbenchmarks demonstrate scan cost;
whole-game gains require separate native measurements.
