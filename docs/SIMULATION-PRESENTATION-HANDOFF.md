# Simulation–presentation separation: integration status

The refactor moves simulation-owned land, parcels, buildings and growth into `W` and its model paths, while rendering remains a projection. Final checks passed at exact source SHA `42b9a2b3edecf4a7b3e40d768661127dd148809721f9d609264737dff0ba84e4`: four-mode day 0/day 30 canonical state matched, animation made zero canonical writes, expanded inspectors completed without errors, and the fast suite passed 950/950. The strict full-source 8-day save/replay check also passed separately.

## Current boundary

- `W` owns generated land, parcels, buildings, household/economic records and simulation state. HISTORY roots it directly; playback controls remain a distinct recorded root.
- `G.citList`, `herdPos`, `herdOwner`, `citIdx` and `travIdx` are disposable projections. `HASH_STAMP`, `__hs` and `G.entityViews` are query/computed-view caches, not semantic roots. The source-pinned history/config prototype remains explicitly incomplete; it does not implement worker export or complete accessor/facade hydration.
- Model-side paths cover land-market/founding, land ticking, livestock, trees, tracks/layout, parcel settlement and structural growth. Shared prehistory advances the same real simulation tick from headless and browser initialization.
- `startSimulation` runs the real generator and initializer in a VM without `document` or `THREE`. `tools/simulation-boundary.mjs` exercises actual `simTick`, the outcome journal, save and replay. Its diagnostics must remain observational.
- `packSave`/`unpackSave` use `globalThis` compression APIs with the J1 fallback retained.

## Evidence

- Full-source headless runs completed without model errors: seed 1001/fate 42/sea at AD 850 plus 360 actual daily ticks reached day 360; AD 851 ran actual shared prehistory to ready day 360. These runs used successive source snapshots, so their population/building counts are not a parity comparison.
- Strict 8-day no-DOM/no-Three.js save/replay passed. At the save boundary, W, RNG, settlement/household state, MOD, storage sequence and annals matched.
- Final four-mode 30-day parity at the exact source SHA above matched all canonical roots at day 0 and day 30; RNG streams and layouts matched, animation made zero canonical writes, and expanded settlement/person/household/river/fort/beast inspectors produced no errors. Evidence: `/tmp/furlong-cadence-final-source/meta.json`. This includes the visual-only bird RNG fix in `buildAgents`, `G.entityViews` UI memo relocation, pure population/beast-price reads and recorded migration-row reads.
- Final fast full source suite passed 950/950 in 5.8 s (`/tmp/furlong-final-integrated-suite.log`), excluding the separately passed strict 8-day full-source save/replay test. The public-order fixture extracts the actual `detailPopulation` helper. Configuration tests passed 8/8 after HISTORY/config migration. `git diff --check` is clean. The general history/config audit remains incomplete by design; retain its unsupported alias, accessor, native-call and facade hydration blockers.
- A native Metal baseline/candidate two-year pair passed at `/tmp/furlong-cpu-final/results.json`. Baseline `e0cd7e5` plus only the null-target `siegeArc` fix (snapshot SHA `7eeeb50b…57ce5`) measured year 1 tick/projection 18.359/1.919 s, year 2 28.544/1.766 s. Candidate `6f16d983…274605` measured 16.989/2.596 s and 27.562/2.217 s. The candidate-only 720-day recheck also passed without errors at exact source SHA `42b9a2b3edecf4a7b3e40d768661127dd148809721f9d609264737dff0ba84e4`: year 1 tick/projection/total 16.906/2.634/19.539 s; year 2 27.457/2.222/29.679 s. Its populations, households and buildings repeat the earlier candidate snapshot. Baseline and candidate founding histories differ; the raw totals are about 3.6% and 2.1% lower, but this single comparison is not an isolated speedup proof. No speedup claim is made.
- Native Metal render checks at `/tmp/furlong-render-final/run.json` covered 1001/sea and 2002/land through 30 days, including compile, materials, camera, live rebuilds, church/world visuals and reel smoke. This is graphics validation only and predates final read-only guards.

## Status and limits

All current integration gates pass. Validation covers full-source runs up to 720 days, four-mode cadence through 30 days, the strict 8-day save/replay path, final fixtures and bounded native timing/render checks. It does not establish 200-year behavior, worker execution, archive/export or complete history hydration. Native timing remains raw, near-neutral evidence across different founding histories; no isolated speedup is claimed.
