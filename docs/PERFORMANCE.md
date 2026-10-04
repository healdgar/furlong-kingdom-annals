# Simulation performance

Fresh maps, every daily tick, every named person and household, and existing ownership and
inheritance rules remain intact. No era presets, saved-world bank, actor culling or SQLite were added.
The app remains a single HTML file with no build step.

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

### Next architectural boundary

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
