# UI integration and service access

Integration starts from deployed main `e61ed0a`, retaining its economy,
fortification, church access and bandit-person changes.

- [x] Texture filtering (`65f5587`).
- [x] Fixed garden bearings (`96bc17f`).
- [x] Selective surface reflections (`01eaab9`).
- [x] Continuous street joins (`bcf6dc9`).
- [x] HUD About, timeline and town/kingdom accounts (`207c414`).
- [x] Seasonal ground, calendar-following fast-forward and winter branch crowns.
- [x] Distinct animal models, birth-cohort growth and independent flock movement.
- [x] Local event explanations without camera movement or inspection takeover.
- [x] Mill, storage-building and quay access through the existing street graph.
- [x] Exact road/footprint collision checks, including building extensions.

The uncommitted UI snapshot reviewed for selection has SHA-256
`c41ec6392c820ea5a5acff51e542e73420dae2bc8774962c5bfc43129f860fb6`.
Its channel clipping, water levels, bank meshes, mill hydraulics, sluice slots,
river-volume tests and water-motion changes are excluded. Seasonal bank *colour*
changes are independent of that unfinished geometry and are included. The UI
worktree and its river work remain untouched.

Service links are created at layout/construction, never in the daily economy.
Mills connect at their inland door; storage buildings at their entrance; quays
connect to eligible public streets. An unreachable site is rejected. Existing
segment and building hashes and street graphs are reused. Access alleys do not
become extra housing frontage or disappear as unsupported residential lanes.
The street-graph version also tracks hidden and removed streets.

A native coastal probe exposed a later longhouse crossing a mill lane. The old
placement check sampled building corners; a street could pass through its
middle. One exact rotated-footprint check against the existing segment hash
replaces those repeated corner checks. Extensions also obey it.

Validation remains in local harness outputs. The integrated desktop Metal runs
use coastal 1001 and inland 2002, with real founding/prehistory, paused UI,
seasonal shader probes, tree/animal probes, public quay graph connectivity,
mill access/idempotence and a newly constructed grange's market route. UI probes
check focus restoration, fitted accounts, unique DOM IDs, local event details,
and unchanged household money/debt and town goods. Native fortification checks
use isolated AD 1000 fixture copies, not centuries-long clearance. WebGL1/touch
viewport checks are host emulation, not physical-phone measurements.

This batch makes no simulation speedup claim. Animal age cohorts and event
explanations are transient graphics/UI state; household pantry, hunger, debt
and commodity authority remain canonical.
