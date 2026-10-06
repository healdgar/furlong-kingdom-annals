# Simulation worker and GPU boundaries

The default game now has one worker-owned simulation: `W`, household accounts, pantry, hunger, debt, RNG streams, commands and outcome journals. The foreground owns input, dialogs, camera and Three.js. Its `W` is a disposable display projection, containing no household, ownership-account or storage-ledger graphs. `#foreground=1` retains the diagnostic reference driver.

## Completed boundaries

- [x] Full-source worker boot, generation and prehistory; progress messages keep loading UI independent.
- [x] Ordered command lane for all six journal classes: clicks, ruler selection, petitions, settings, placements and plans. Validate before recording; apply each accepted command once between complete days. Map picking and brush previews remain UI state.
- [x] Inspectors, accounts, ruler panels, petitions, narrative links and advisor reads query the worker. Stable entity IDs replace live model references. Visible panels request their own bounded results.
- [x] Economic overlays query worker calculations; foreground overlays draw returned values.
- [x] Rendering bootstrap transfers copied terrain buffers and public geometry. Later packets contain existing dirty fields/buildings and structural changes, rather than daily copies of the economy or complete geometry.
- [x] Citizens and livestock use numeric worker plans. Renderer objects and walking interpolation remain disposable; simulation RNG does not drive display animation.
- [x] Stable display identities preserve camera following, army markers, roads, dragons and saplings. Accessor-backed population and title IDs have explicit scalar projections.
- [x] Annals and reign headings, ruler transitions, campaign-end dialogs and local achievement/best-score persistence cross explicit presentation boundaries.
- [x] Worker-owned save capture, existing save format, replay and continuation. Browser camera/preferences and save shelf remain local UI data.
- [x] Journal backpressure precedes each daily transaction. Save/close await settlement. Page hiding requests a worker flush.
- [x] Faults pause mutation and retain read/save access where possible. Client transport failures reject pending work; recovery explicitly reloads a committed save, without creating a second authority.
- [x] Uncapped Reel driver; actual landscape publications every 30 days, immediate refresh on pause/orders, one unacknowledged publication with coalescing. Pushed and requested display packets install in transport order, preserving every dirty delta. Camera/input do not execute simulation ticks.
- [x] Awaitable complete-day barrier in the worker driver, prehistory and replay. Future asynchronous GPU phases must finish inside that barrier before commands, saves or subsequent days run.

Read helpers can warm the existing derived `s._sg` street graph. Valuation reads use a disposable memo for the current request and cannot prime the annual simulation-owned `s._lvf` grid. Early UI priming previously changed later rents and demographics, breaking save replay. Queries reuse an already valid model valuation but leave model valuation admission to simulation. No additional maintained economic index or journal record is introduced.

## Remaining GPU/performance work

GPU optimization is deferred at the user's request. The next CPU batch removes redundant ledger lookups and no-op writes; see [its checklist and native comparison](LEDGER-REDUNDANT-WORK.md).

These are acceleration experiments, not unfinished ownership boundaries:

- Adopt a production GPU kernel only after matched whole-year timing includes upload, readback and CPU finishing costs. No production GPU economy kernel is enabled by this cutover.
- Keep ordered daily pantry, hunger, debt and economic outcomes exact. Do not skip daily settlement or add indexes/copies merely to exercise the GPU.
- Measure later-year cost growth and a complete 850-to-1066 run on the drawn game. Worker ownership improves responsiveness; it does not itself reduce tick CPU work or prove practical century throughput.

The existing annual land-value WebGPU probe uses real Apple Metal hardware. Seed 1001 measured warm CPU/GPU medians of 6.3/1.7 ms, with 141 ms cold setup. Player seed 287970763 measured 8.1/2.0 ms. These save only about 5–6 ms per annual calculation and are diagnostic, never installed in authoritative `W`; they do not establish a whole-game speedup.

## Validation

Validation records are frozen local source snapshots, with SHA-256 identities. The repository harnesses are reusable:

- `tools/simulation-worker-host.test.mjs`: FIFO ordering, asynchronous daily barriers, pacing, publication acknowledgements, queue limits, journal backpressure, save and fault behavior.
- `tools/simulation-worker-boundaries.test.mjs`: private-graph exclusion, packet-owned transfer buffers, deterministic actor planning, dirty projections, population/title accessors, ruler UI, army flags, campaign-end/profile delivery and foreground tick rejection.
- `tools/simulation-worker-check.mjs --days 8 --views true`: full native source, worker/reference canonical graph and RNG parity, eight-day save/replay plus eight-day continuation, inspectors/accounts/actors/economic overlay output parity.
- `tools/simulation-worker-play-check.mjs`: owned Chrome profile and local frozen source; drawn boot, ruler/tax controls, inspectors, nine overlays, Reel/pause/normal/life transitions, delayed publication acknowledgement, save/reload/camera/continuation, campaign end and local profile persistence. Console errors and worker faults fail the check.

Validated production HTML SHA-256: `9b8cc31045e0be212430d9f06e71df0695d1a2612b96f08dbb56540ef2125f93`. Local evidence remains under `/tmp`, outside the deployed repository.

- Broad regression suite: 1,013/1,013, including display-delivery ordering and valuation-cache isolation; the separately run full-source simulation boundary test also passed.
- Native seed 1001: full graph/RNG/save/replay/continuation and view-output parity passed (`/tmp/furlong-worker-final-native-20261005-query`). This predecessor snapshot differed only in transport error notification. Eight-day worker/reference timings were 362/366 ms; maximum worker-page heartbeat interval was 19 ms.
- Native player seed 287970763/fate 370450810: final-source full graph/RNG/save/replay/continuation and view-output parity passed (`/tmp/furlong-worker-final-player-native-20261005`). Eight-day worker/reference timings were 512/508 ms; worker-page heartbeat maximum was 18 ms.
- Drawn Chrome: `/tmp/furlong-worker-play-1791269827192/results.json`, production baseline matching the SHA above. The instrumented snapshot has a separate hash because it adds test-only audit hooks. Nine overlays, ruler tax controls, 103-day Reel advance, zero ticks after pause, day-126 exact save replay, day-129 continuation, campaign end and local profile persistence passed without runtime/console errors or worker faults.
- Independent 128-day no-UI versus UI-read comparison matched RNG, population, people and buildings after fixing valuation cache admission.

Worker ownership establishes independent execution and ordering. Native timings show no tick CPU reduction; drawn frame timing under concurrent test load is not a performance measure. Century throughput and production GPU kernels remain to be validated.
