# Simulation worker roadmap

The target is one worker-owned authoritative `W`, RNG streams and outcome journals. The foreground thread owns input, UI and Three.js; it submits ordered commands and consumes bounded, disposable views. Do not copy the full world each day. Until the default cutover, the playable daily tick remains foreground work. Fixtures and boundary probes do not establish a worker-ready game.

## 1. Full-source worker host and protocol — implemented; UI cutover pending

- [x] Host the real game source in one worker; initialize the world, RNG and journal there.
- [x] Define versioned messages for initialization, commands, view publication, save/replay, faults and shutdown.
- [x] Keep exactly one authoritative `W`; retain ordered simulation phases and RNG draw order.
- [x] Publish bounded summaries every 30 simulated days, with one unacknowledged view and latest-day coalescing. Commands and requested views reply at the next completed daily boundary. Landscape buffers remain pending.
- [x] Isolate each realm in its own client/worker instance; reject duplicate/out-of-order requests and incorrect view acknowledgements. Sticky faults stop mutations; closed clients reject pending work. No automatic foreground recovery.

## 2. Command lane — pending

- [ ] Route every player mutation through a sequenced command queue, applied atomically between days. Preserve input order and same-day revisions.
- [ ] Keep commands usable while paused and at life pace; acknowledge accepted, rejected and completed commands with their sequence and revision.
- [ ] Remove direct UI writes to `W`; migrate all order, petition, planning, construction and save/import ingress.
- [ ] Define backpressure and failure behavior for queued commands without dropping accepted outcomes.

## 3. Read and inspection boundary — pending

- [ ] Move inspectors, queries, HUD summaries and advisor inputs onto published views or explicit worker queries.
- [ ] Keep query results read-only, versioned and bounded; return only the requested projection.
- [ ] Replace UI dependence on live `W` references, closures and mutable caches. Keep query caches disposable and outside authoritative history.
- [ ] Verify that opening, closing or polling UI has no canonical state or RNG writes.

## 4. Rendering bootstrap and dirty projection — pending

- [ ] Build the initial static rendering projection from bounded worker output after world initialization; keep Three.js objects on the foreground thread.
- [ ] Replace projection callbacks that inspect `W` with explicit dirty-region/data messages. Coalesce replaceable visual updates by world revision.
- [ ] Transfer only compact numeric geometry inputs or output buffers; avoid structured-cloning `W`, `Map`/`Set` graphs, caches or per-day full geometry.
- [ ] Keep historical outcomes and required state transitions lossless even when visual updates coalesce.
- [ ] Verify initial map parity and dirty rebuilds for terrain, settlements, land, roads, walls, buildings and actors.

## 5. Persistence, replay and failure semantics — pending

- [x] Run save capture, replay and journal settlement against the worker-owned authority; preserve existing formats. Native eight-day save plus eight-day continuation matches the foreground reference. Longer continuation/migration coverage remains pending.
- [x] Reuse native outcome-journal backpressure before starting each whole day; flush on save/shutdown. Rendering may skip obsolete views; journals may not.
- [ ] Define recovery for worker error, message decode failure, save failure and interrupted shutdown. A restart must restore one authority from a committed save/journal boundary.
- [ ] Verify save/reload and replay equivalence, journal completeness, RNG continuation and no duplicate command application.

## 6. Parity and responsiveness gates — pending

- [ ] Compare the same full source and seeds between foreground reference and worker runs: canonical `W`, all RNG streams, journal, layouts, save/replay and subsequent draws.
- [ ] Check money conservation and pantry, hunger and debt settlement at the same boundaries; retain existing failures as failures.
- [ ] Exercise commands while paused, at life pace and during fast-forward; test stale views, queue pressure and worker faults.
- [ ] Measure matched real drawn runs on the target browser/device, including frame stalls, input latency, worker CPU, projection time and persistence pressure. Include later-year cost growth.
- [ ] Require practical responsiveness improvement with no semantic drift before default cutover. Report undrawn tick throughput separately.

## 7. Reel throughput and GPU gate — in progress

- [x] Worker Reel (index 5) runs at sustainable throughput without a days-per-second cap. Normal speeds and life pace retain their clock rates.
- [x] Yield via posted tasks between complete daily transactions, avoiding the nested-timer clamp; accept pause/orders without breaking a daily transaction.
- [ ] Wire this driver into the playable game after its command/read/projection boundary is complete. The current playable Reel remains the foreground driver.
- [ ] Publish actual landscape deltas every 30 simulated days during Reel; summary cadence alone is not landscape integration. Keep camera/input independent and refresh immediately on pause/inspection/orders.
- [x] Measure a real WebGPU compute candidate, including upload, readback and CPU finish work; exclude software adapters and report startup separately.
- [ ] Adopt GPU kernels only when matched whole-year timing benefits. Keep ordered pantry/hunger/debt settlement exact on the worker CPU. Do not add per-day copies/indexes or approximate all daily transactions to claim GPU use.
- [ ] Measure 850-to-1066 elapsed time and later-year growth on the final drawn game. No practical-century runtime has been demonstrated by this checkpoint.

## 8. Default cutover — pending

- [ ] Make the worker path the default only after all preceding gates pass on the integrated source.
- [ ] Retain an explicit diagnostic foreground/reference mode and worker-disabled comparison until the cutover is established.
- [ ] Confirm fresh generation, shared prehistory, normal play, accelerated play, commands, inspection, rendering, save/replay and fault recovery on the default path.
- [ ] Update status and evidence to the tested source hash. Until then, the playable daily tick runs on the foreground thread and the worker is not ready for default use.

## Checkpoint evidence

Source `index.html` SHA-256: `48cb6a8a93ef1a2b61e9604211d04e7f06b7d63e334a757f6197e1d84c197237`.

- `node --test tools/simulation-worker-host.test.mjs`: 21 protocol/pacing/backpressure/fault tests pass, including uncapped Reel, pause and no backlog after leaving Reel.
- `node tools/simulation-worker-check.mjs --days 8 --out /tmp/furlong-worker-uncapped-native` (before transport-counter rename; final-source evidence below): native Chrome, separate temporary browser/profile; generated world at seed 1001/fate 42, sea, AD 850. Worker and reference match the diagnostic W graph, RNG, households, population, commands, annals, settings and storage sequence after eight days and after save/replay plus eight more days. This is a short boundary test, not century or integrated-render validation.
- Initial eight days: worker 360 ms, foreground 356 ms. Headless-page maximum UI heartbeat gap: worker 17 ms, foreground 357 ms. Resume eight days: 229/224 ms; heartbeat 18/224 ms. Responsiveness improved; tick throughput was essentially unchanged. These are undrawn fixtures, not live game FPS.
- `node tools/simulation-worker-check.mjs --gpu-only true --out /tmp/furlong-gpu-land-values-probe`: Apple Metal hardware, 12 settlements / 13,395 cells. Complete warm annual field calculation: CPU median 6.3 ms, GPU median 1.7 ms; cold adapter/pipeline setup 141 ms. Maximum absolute field differences: res 0.000004053, biz 0.000001669. GPU output is diagnostic only and is never installed in W. The 3.7x kernel gain saves about 4.6 ms per annual rebuild in this fixture; it does not establish a whole-year speedup.

`tools/gpu-land-value-probe.mjs` is a test-side candidate, not a production GPU path. The existing playable boot/animate path has not switched to the simulation worker. Command ingress, inspectors, rendering bootstrap/deltas and recovery must be completed before default cutover.

- Fresh player-seed GPU probe (`/tmp/furlong-gpu-land-values-player-seed`, seed 287970763/fate 370450810; newly generated AD 850, not the running player's later state): 15 settlements / 17,455 cells, warm CPU median 8.1 ms versus GPU 2.0 ms, 4.05x annual-kernel gain. Adapter/pipeline setup 3 ms with system GPU caches warm; do not substitute that for cold setup. Maximum errors: res 0.000003695, biz 0.000002503. About 6.1 ms saved per annual rebuild, still no whole-year speed claim.
- Full suite initially: 996/998 pass. The new transport counter hit a generic entity-ID tripwire and was renamed. The storage architecture tripwire predated the deployed 48c2b35 site/payment fixes; its complete diff was reviewed and the pin renewed. Its new read-only worker pantry view is independently source-pinned. The 91 affected protocol/notable/storage/route checks now pass; no quantity/history writer was changed by the worker foundation.

- Final-source native check (`/tmp/furlong-worker-final-parity`, source hash above): eight days 359 ms worker / 358 ms foreground, heartbeat 18/358 ms; save/replay continuation eight days 227/224 ms, heartbeat 17/224 ms. Both boundary comparisons pass and all four outcome journals settle without pending bytes/chunks or faults. No simulation throughput gain is claimed.
