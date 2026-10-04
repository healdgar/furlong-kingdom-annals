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
