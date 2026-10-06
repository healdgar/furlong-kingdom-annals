# Fastest-speed visual deferral

Only Reel years (speed 5, 360 days/second nominal) coalesces graphics. Slower speeds, map generation and
later-era prehistory retain existing behavior. Every simulation day and life event remains.
`&defer=off` disables this feature; captured before boot normalizes the link.

## Boundaries

Track routing, bridge crossing records, parcel polygon caching, market price caching, ownership,
crops and economic land masks remain synchronous at their original call boundaries. Track/bridge
mesh construction, fences and walls project current state through three latest-only callbacks.
One projection runs per second while reeling; obsolete projections cannot accumulate. Terrain
shader distances refresh at most once/second; their semantic source masks remain current.

Pause or slower speed drains projections across yielded callbacks and drains shader tiles in
batches of at most four or about 8 ms. A single tile or mesh can exceed the budget. Catch-up waits
for any existing normal RAF detail refresh, then refreshes fences/fields from its latest masks.
It neither forces nor retimes the mixed `rebuildDetails` function. Resuming reeling returns to
bounded refreshes. New-world identity discards obsolete callbacks. Projection errors pause and
retain dirty work; `FURLONG_VISUAL.retry()` retries explicitly. `status()` exposes pending work,
including semantic detail tails; developer `finish()` rejects after 30 seconds if RAF cannot finish.

Projection reads uncached parcel polygons/prices through pure kernels. It cannot populate those
caches, clear authoritative fence dirtiness or draw simulation RNG. Existing spatial query `__hs`
marks are deduplication scratch and excluded from semantic comparisons. Road builders, agents,
labels, particles, lots, layouts and detailed maps retain their existing implementation.

## Validation

Parent: `75ac15d76cdc1766368a96d0d783d424dd599993`.
Source and measurements are recorded with each local run under `.git/deferral/2026-10-03/`.

```sh
node --test tools/source.test.mjs tools/life-history.test.mjs tools/history.test.mjs \
  tools/provision.test.mjs tools/ownership.test.mjs tools/advisor-api.test.mjs \
  tools/routing.test.mjs tools/deferral.test.mjs
```

The one-off parent/candidate harness for this validation (`tools/deferral-check.mjs`) is removed
(see git history); it retained authoritative geographic records as well as world/household/land,
full life and annal history, ownership and account state. It compares every annual graph hash,
final state and next 16 draws from each RNG stream at matched daily/mixed-builder boundaries.
Only existing derived caches/graphics and spatial scratch stamps are omitted. Pause geometry
attribute/instance buffers and shader fields match parent; post-RAF settled projections also
match a fresh pure rebuild. Player tax changes, repeated requests, slow/pause, phone rendering,
world replacement and retained/retried faults are exercised.

Retained lot/detail updates still use the original RAF/time-based cadence. Matched-boundary
comparisons establish that schedule; they do not establish renderer-independent determinism
across arbitrary frame schedules. Six-second hardware Metal Chrome samples exercise the real
animate loop at speed 5, but are short performance samples. Graph fingerprint/CDP time is
excluded from throughput claims; function timings are inclusive and must not be summed twice.
Forced month-end builders are boundary stress/attribution, not the production invocation schedule.

The full history recorder remains experimental/off. No long-run conservation clearance is claimed:
one-year matched sea/inland soaks retain the parent's whole-realm money-audit defect. Household
ownership/inheritance and food/payment conservation focused tests remain required.

## Measured result, 3 October 2026

Tested `index.html` SHA256:
`ee91e9451c5b16fe1773b0fabb81e4b25ea55fbaf46bd5b024cb84c85c0ac2b2`.
109 focused tests pass. Two-year sea 1001/inland 2002 histories and AD855 starts match parent
state/RNG and settled geometry/fields. Both actual fastest-speed views settle correctly, including
normal paused lot refreshes, with catch-up tails of 0.679/0.668 seconds in the final two-year run.
Phone views show the map at 390×844 with linked shaders, no overflow and zero game/console errors.

Two-year forced monthly-boundary attribution (candidate CPU milliseconds):

| Work | Sea | Inland |
| --- | ---: | ---: |
| 720 complete simulation ticks | 3316.8 | 4481.8 |
| tickEconomy, included in ticks | 1006.8 | 1427.8 |
| tickHouseholds, included in ticks | 173.4 | 277.7 |
| tickLand, included in ticks | 37.3 | 58.8 |
| 24 retained mixed detail/lot rebuilds | 791.3 | 960.4 |
| 25 authoritative track builders, bridge prep included | 547.0 | 567.2 |
| 25 fence preparations | 2.2 | 2.8 |
| Coalesced track projection | 16.7 | 11.4 |
| Coalesced fence projection | 9.3 | 17.3 |

The matched parent's track builders cost 696.2/741.0 ms, fences 137.3/164.3 ms and walls
21.7/32.4 ms. Candidate defers the reconstructible fraction; path/bridge/map work remains.
These inclusive timings and forced invocation counts explain the saved graphics cost; they do
not imply equal percentage savings in production. Full-history elapsed time includes hashing/CDP.

A final six-second Metal Chrome sample advances 130.19/103.00 days per second with deferral.
Same-source disabled samples advance 125.19/100.96: about 4%/2% more throughput. Earlier isolated
samples showed only 1–2%; these short runs establish a modest benefit, not a stable benchmark or
solution to the dominant simulation cost. Reaching a later era receives no deferral speedup.

Matched one-year four-world soaks preserve food/population summaries and the existing money
audit failure: residuals -658.201, -946.031, +665.830 and -739.911 (1001 sea/inland, 2002 sea/inland).
No tolerance is relaxed. Longer soaks and complete frame-schedule independence remain unproven.

The deferral harness initializes the canvas size before its emulated phone resize to avoid
Chrome mobile viewport autoscaling around a stale wide canvas while RAF is suppressed. This
checks the settled emulated view, not production desktop-to-mobile resize behavior. Fresh
390×844 touch/WebGL1 boots are checked separately with `render-check.mjs`.
