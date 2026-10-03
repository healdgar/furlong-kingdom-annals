# Rendering realism: completed changes

Local branch `codex/rendering-realism`, based on `36648d5f11208838f77e5cc27a66610f6046d0a5`. Changes remain in this worktree; the concurrent checkout is untouched.

## Implemented

- Restored camera-relative ground detail. Three.js r128 omits `cameraPosition` uploads for these Lambert materials, leaving the terrain's distance test centred on the map origin. A shared explicit camera uniform now drives detail and territory-border width.
- Fixed a river-mouth width assignment swallowed by a line comment. Existing water meshes now have subtle animated normal ripples, fading with distance and pixel footprint.
- Joined road surfaces and junctions with common metre-scale grain, filtered paving joints, and feathered verges. Corrected country-road widths in the terrain feature field; retained the original road topology.
- Reused the wall atlas on gable ends and stone church/tower parts. Roof courses use physical dimensions; thatch has directional fibres. Roof pitch follows span, with chimneys and roof ornaments adjusted accordingly.
- Mapped cylindrical masonry around the circumference in whole bays, closing the texture seam. Bridge piers reuse the ashlar atlas; bridge decks share the road's paving pattern and grain.
- Smoothed and slightly distorted existing twenty-face broadleaf crowns; duplicate vertices share tint. Deterministic width/depth variation persists through hiding, restoration and sapling growth. No random-number consumption or additional faces.
- Tightened close shadow coverage, reduced contact bias, and snapped shadow focus to texels. The shadow map remains 2048².
- Filtered fine ground lines, softened tenant-strip contrast, and made garden rows straight within each plot.
- Removed discontinuous woodland-edge shading and narrow, high-contrast contour rings; blended canopy litter, bracken, mud, reeds and coastal sand over the existing feature-field precision.

## Verification

Run from the worktree with Node 22+ and Chrome (`CHROME` can override its executable):

```sh
node tools/render-check.mjs --baseline 36648d5f11208838f77e5cc27a66610f6046d0a5 --seeds 1001:sea,2002:land --days 720 --out /tmp/furlong-render-desktop
node tools/render-check.mjs --baseline 36648d5f11208838f77e5cc27a66610f6046d0a5 --seeds 1001:sea --days 90 --webgl1 --touch --width 390 --height 844 --out /tmp/furlong-render-phone
```

All checks passed in both WebGL versions: shader linking, actual GPU camera uniform, buffer growth, ruin/restoration, road/detail rebuilds, tree restoration including feature occupancy, and forced Romanesque/Gothic church variants. Coastal and inland 720-day histories matched the baseline fingerprints; the WebGL 1 run matched after 90 days. Inline JavaScript parsing and `git diff --check` passed.

Matched day-zero scenes retain identical geometry totals (1,756,159 coastal; 1,804,745 inland), draw-call counts, texture counts and texture dimensions. Wall and roof assets remain 256×192 and 64×64. These totals cover the harness's principal scene meshes, including bridges; rendered triangle counts also include shadow passes. Added instanced attributes cost memory but add no polygons. Screenshots here are documentation, not runtime assets.

Local GPU timer samples ranged 1.04–4.10 ms for the candidate versus 0.91–5.40 ms for the baseline. Added detail increases fragment work; timings varied between runs. These short, sequential runs are neither a speedup claim nor physical-phone FPS evidence. CPU submission time is recorded separately. The phone check emulates viewport/touch in desktop Chrome.

Exact source hashes, checks and measurements: [desktop checks](desktop-checks.json), [desktop results](desktop-results.json), [desktop provenance](desktop-run.json), [WebGL 1 checks](webgl1-phone-checks.json), [WebGL 1 results](webgl1-phone-results.json), [WebGL 1 provenance](webgl1-phone-run.json).

## Matched views

Seed 1001, coastal, paused at day zero; identical camera coordinates.

| View | Before | After |
| --- | --- | --- |
| Street | [Original](street-before.png) | [Roof/gable mapping, road detail and contact shadows](street-after.png) |
| Woodland | [Original](woodland-before.png) | [Crown shading and restored ground detail](woodland-after.png) |
| River | [Original](river-before.png) | [Banks and water shading](river-after.png) |
| Bridge | [Original](bridge-before.png) | [Continuous paving and masonry](bridge-after.png) |

[WebGL 1 phone viewport](street-webgl1-phone.png). [Round apse: wrapped masonry](apse-after.png) is a forced post-simulation variant, not a matched day-zero comparison.

## Verification limits

Implementation and local regression checks are complete. Physical-phone performance is unmeasured. The original coarse terrain/feature grids and stylized silhouettes remain visible at close range; their resolutions and polygon budgets are preserved. Combined UI/provisioning changes require integration checks. No push or deployment is included.
