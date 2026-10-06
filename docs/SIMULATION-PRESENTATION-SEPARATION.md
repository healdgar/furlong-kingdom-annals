# Simulation–presentation separation

Implementation checkpoint, 2026-10-05. Final integration evidence is pinned to HTML SHA `42b9a2b3edecf4a7b3e40d768661127dd148809721f9d609264737dff0ba84e4`.

## Ownership boundary

- `W` is authoritative for semantic land, parcels, buildings, household/economic records and simulation state. HISTORY roots `W`; playback state is recorded separately.
- Renderer indexes (`G.citList`, `herdPos`, `herdOwner`, `citIdx`, `travIdx`) and query/computed-view caches (`HASH_STAMP`, `__hs`, `G.entityViews`) are disposable, not additional semantic roots.
- Model-side code handles land-market/founding, land tick, livestock, trees, tracks/layout, parcel settlement and structural growth. Renderer construction consumes model state. Shared prehistory invokes the real simulation tick for both headless and browser starts.
- `tools/simulation-boundary.mjs` runs the real game source in a VM without DOM or Three.js; its boundary tests cover actual ticks, journal, save/replay and canonical state. Inspection/query helpers are checked for observational reads.
- An earlier `game-write-*` analysis prototype (source-pinning W and playback ownership, classifying known projections/scratch) has been removed. It was never a worker or save-history runtime; unsupported aliases, accessors, native calls and facade hydration were unresolved blockers.

## Waterfront road layout

Quays are surveyed on dry banks at construction time. Unsafe smoothing falls back to the surveyed bend; channel crossings split the survey instead of creating a bridge. Access paths reserve river clearance for the lane width and can join segment interiors. Both walking graphs and rendering preserve those bends through shared pure resampling. This adds no maintained index, daily repair pass, or ledger event.

HTML SHA `cf2cf52353a65068006eeb07a89ccf25039eee6bd579fb1a97df5fd99f1b32a0`: native seed 287970763/fate 370450810 validated 13 connected, dry quays and 14 connected mills (`/tmp/quay-final-render/results.json`). Eight-day model-only/continuous cadence matched all canonical roots, with zero projection writes (`/tmp/quay-final-boundary/meta.json`). New regressions cover concave banks, channel splitting, coast/pond width, turn preservation and bank detours. These checks establish routing correctness, not a simulation speedup.

## Verification and limits

- Full-source headless checks completed: seed 1001/fate 42/sea at AD 850 plus 360 real days reached day 360; AD 851 ran real shared prehistory to ready day 360. Their source snapshots differ, so they do not establish parity.
- The strict 8-day headless save/replay check passed with W, RNG, settlements/households, MOD, storage sequence and annals matching at the save boundary.
- Final four-mode cadence at the exact source SHA above matched canonical roots, RNG streams and layouts at day 0 and day 30. Animation made zero canonical writes; expanded settlement/person/household/river/fort/beast inspectors produced no errors. Evidence: `/tmp/furlong-cadence-final-source/meta.json`. The check includes the deterministic visual-only bird change in `buildAgents`, UI memo relocation to `G.entityViews`, pure population/beast-price reads and recorded migration-row reads.
- The final fast source suite passed 950/950 in 5.8 s (`/tmp/furlong-final-integrated-suite.log`), excluding the separately passed strict 8-day full-source save/replay. The public-order fixture extracts the actual `detailPopulation` helper. The since-removed `game-write` configuration tests passed 8/8 and `git diff --check` is clean.
- Native Metal baseline/candidate two-year runs passed (`/tmp/furlong-cpu-final/results.json`). Baseline `e0cd7e5` with only a null-target `siegeArc` fix (snapshot `7eeeb50b…57ce5`) recorded year 1 tick/projection 18.359/1.919 s and year 2 28.544/1.766 s. Candidate `6f16d983…274605` recorded 16.989/2.596 s and 27.562/2.217 s. The candidate-only 720-day run passed without errors at the pinned source: year 1 tick/projection/total 16.906/2.634/19.539 s; year 2 27.457/2.222/29.679 s. Candidate population, household and building counts repeat the earlier candidate snapshot. Since generated founding histories differ, these raw totals do not isolate a speedup; none is claimed.
- Native render validation passed for seed 1001/sea and 2002/land through day 30, including graphics compile/material/camera/live-rebuild/church/world/reel checks. It is graphics validation, not throughput evidence.

Current gates pass. Evidence covers model execution through 720 days and cadence/rendering through 30 days; it does not establish 200-year behavior, worker execution, archive/export or complete history hydration. Do not describe the prototype as worker-ready or infer accelerated-time safety.

Historical 2026-10-04 checkpoint: parent `61ba24d`, branch `codex/ruler-controls`, source SHA `f1cf4296f2ec74aa528cd6a1e6401306f54d187494acf059403a2888231d0708`. Its earlier tests and open checklist are superseded by the evidence above.
