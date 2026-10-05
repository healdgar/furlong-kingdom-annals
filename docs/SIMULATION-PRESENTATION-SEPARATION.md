# Simulation–presentation separation checkpoint

Parent: `61ba24d`. Branch: `codex/ruler-controls`.

Goal: daily simulation determines gameplay independently of display cadence.
Presentation reads current state and reconstructs graphics at a bounded cadence.
This checkpoint is partial; the whole engine is not worker-ready.

## Completed

- `advanceSimulation` owns the existing daily tick budget and backlog. It does
  not call camera, animation or DOM functions directly. Its called subsystems
  still contain presentation hooks; extraction does not make them pure.
- Presentation interpolation lives in `G.clockFrac`, through `displayFrac` and
  `displayDay`. Frames no longer overwrite `W.clock.day`, `W.clock.frac` or
  `W.visT`. Queued whole days cannot become a walker's fractional hour.
- `tickEnvoys` expires model records during daily simulation. Rendering only
  disposes expired envoy meshes and markers.
- Cart positions derive from consignment dates, including siege-shifted dates;
  requested speed no longer advances a separate cart distance accumulator.
  Consignment state owns arrival. Proxy geometry and material are both disposed.
- Citizens advance their disposable walking projection using elapsed calendar
  time; windmill phase is display state in `G.sailAngle`, not building data.
- `projectWorld` refreshes animation at most every 100 ms at speed 5. It retains
  accumulated visual dt, refreshes immediately on speed changes, and runs each
  frame at other speeds or with `defer=off`. Camera/input and canvas drawing
  remain per frame. Daily ticks are retained.

Errand departures now use simulation day plus the existing seeded random offset.
Previously they also used the last frame's fractional clock, potentially even
whole queued days. Errand timing and subsequent demographic choices may therefore
differ from old runs. Household pantry, hunger and debt rules are unchanged.
Rendering no longer doubles interpolation for ships and travellers or makes
Sunday/wedding checks see a fractional authoritative day.

## Validation

- All 922 source tests pass; executable inline scripts parse; diff checks pass.
- `tools/simulation-display.test.mjs` covers integer clock ownership, actual
  errand independence, envoy expiry, siege-held traffic, projection scheduling,
  pause/new-world transitions and simulation advancement through display errors.
- Native Chrome/Metal HTTP snapshots pass sea 1001 and inland 2002 through
  30 days: shaders, camera uniforms, live rebuilds and church variants. Those
  snapshots precede the behavior-preserving extraction of `advanceSimulation`.
- `tools/render-check.mjs --reel-smoke` passes for sea 1001, exercising the real RAF driver, projection
  rate and immediate pause refresh. Evidence remains local under
  `/tmp/furlong-separation-reel-checkpoint-20261005/`.

No matched throughput gain, arbitrary-frame state equality or century-scale
clearance is claimed. No maintained simulation index or journal event was added.

## Next boundary: parcels and churchyards

`rebuildDetails` still computes `b.lot` and calls `finishYards`. These are gameplay
changes, not cosmetic metadata. `tickInfill` reads parcel area; churchyard layout
clips against parcels. `featLots` calls `markLot`, which writes the land exclusion
mask used by simulation. `finishYards` may relocate graveyards, add paths, change
land area and cut trees. Do not merely defer or throttle this mixed function.

1. Extract existing parcel math unchanged, separating semantic parcel/mask
   settlement from fence/yard mesh and shader projection.
2. Move churchyard/path/land settlement to structural commits. Keep post-survey
   settlement in `buildFields`; rendering must only read its results.
3. Reuse `syncLive(s)` and existing layout `placed`/`segH` hashes. Also cover
   live growth, `tickSettlers` batches, direct rural insertion, footprint widening
   and removal. Update affected neighbors once per structural batch. Avoid a
   new daily whole-map pass or one whole-world solve per inserted building.
4. Check cross-town and rural parcel neighbors before narrowing the current
   global solver. Preserve weighted bisectors, edge order and clipping.

Other seams remain: `spawnCarts` in `tickEconomy`, a dead `c.proxy` disposal path,
`emit` calling DOM/director/effects, graphics handles and derived caches on world
objects, and simulation-side building/terrain GPU writes. Classify semantic
mutation before moving each hook. The routing worker is not a simulation worker.

## Review constraints

- Preserve every household's pantry, hunger, purse, debt, assets and inheritance.
- No per-person walking budgets, bulk lot splitting, new journal records or
  overlapping maintained indexes. Reuse authoritative membership and existing
  layout indexes. Do not add cleanup scans to every tick.
- Commit bounded work with source hash, scope, checks and limitations. Measure
  the native path before claiming speedup. A worker alone does not reduce CPU
  work. Test the combined source after integration.

Checkpoint `index.html` SHA256:
`f1cf4296f2ec74aa528cd6a1e6401306f54d187494acf059403a2888231d0708`.
