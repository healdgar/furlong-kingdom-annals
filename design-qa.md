# Context balloon and texture QA

final result: passed

The earlier texture-fidelity pass claim is withdrawn. Procedural grain and partial coverage did not implement selected option 3. This correction was compared directly with the original image, including its actual bridge settlement.

## Current comparison

`docs/context-balloon/texture-correction/reference-comparison.png` places the selected raster and final runtime in one image. Source 1586×992 is normalized to 1440×900; runtime 1440×900, density 1, seed/fate 1001, sea coast, paused at day 0. The settlement geometry is recognizably the same. Camera framing is closely matched; source and runtime are labeled.

The reference specifies mossy grass and small flowers, chalky plaster, golden straw bundles, tile/slate roofing, cobble roads over the bridge, cultivated plots, tactile parcel walls and narrow wet/gravel margins around calm directional water. Each now has an actual runtime material consumer. The runtime remains more regular in bank silhouette and quieter in water highlights than the image; it is not represented as pixel-identical.

## Findings and corrections

1. P1 — missing material coverage: added generated compact raster assets for ground, plaster, stone, wood, roofs and foliage. Soil plots are decorative and follow actual parcel axes; simulation yields are untouched.
2. P1 — directional textures ignored geometry: river/road strips now carry physical cross-path and continuous along-path coordinates plus local tangents. Instance walls and fences inherit rotation; merged bridge sections preserve local UVs. Verified on the curved river and bridge.
3. P1 — noisy water and stretched quay stripes: rejected diagonal foam atlas cell and removed exaggerated foam, world-axis road joints and contour ashlar bands. Replaced with quiet flow-aligned ripples, isotropic gravel and narrow feathered margins.
4. P2 — overly bright stippled grass, dirty plaster and busy roofs: enlarged grass repeat, subdued greens, attenuated plaster/straw contrast and recaptured the comparison.
5. P1 — sharp coast and square river mouth: survey rendered heights, fade sea against the terrain triangles, retain channel segments to the actual coast and blend the mouth into the sea.
6. P1 — WebGL1 rejected dynamic uniform-array indexing: replaced it with constant loop indices; all tested fallback programs now link.

## Five-surface review

| Surface | Evidence / disposition |
| --- | --- |
| Layout | Transforming card layout retained. Desktop expansion is 1392×807 within 1440×900; prior mobile/tablet/short-screen evidence remains valid for unchanged UI source. |
| Typography | Existing serif/card hierarchy retained; no type changes in correction. |
| Assets | Direct combined reference comparison, nine rendered views, generated source images and exact runtime hashes retained locally. |
| Color | Muted grass, cream plaster, golden straw, grey paving and blue-teal water compared together; seasonal tint remains active. |
| Copy | Existing names, values and commands are real game content; no reference-image labels or fabricated values inserted. |

## Interaction and validation

Current source: Expand opens a modal with persistent Minimize/Close. Minimize and Escape keep Rougecastel selected and visible. Earlier UI checks cover focus trapping, inert background, scroll restoration, Orders, Annals, planner and save/help. Source UI is unchanged by this texture correction.

72 focused source, context-card, construction, track-index and ownership tests pass. Nine WebGL2 and seven WebGL1 views link with zero simulation errors. Channel geometry/UV direction probe passes. Current 30-day history exactly matches prior local implementation `2fd9998`. Matched capital: 54 calls, texture count 10→12, geometry 1,756,159→1,756,487 (+0.019%; river-mouth correction). Assets remain 512px; no extra building/foliage polygons.

Details, hashes, captures and limitations: `docs/context-balloon/texture-correction/`. Earlier texture comparisons and equal-budget claims are superseded. No remaining actionable P0/P1/P2 defect was found in the final compared views and tested panel workflow. Water-highlight intensity and finer natural bank variation are P3 polish relative to the reference. Final aesthetic acceptance belongs to the user reviewing the displayed comparison and preview. No push, merge or deployment.

## Waterwheel and mill placement follow-up

The earlier general pass did not establish wheel or hydraulic fidelity. The former cylinder had world-fixed grain and the coarse-cell siting left mills inland. The corrected wheel has open timber spokes, rims, buckets and local rotating grain; fresh worlds site it in actual river or pond water while keeping the building footprint dry. Evidence, source hash, two rotation phases and limitations: `docs/context-balloon/mill-correction/`. 77 focused tests, both renderer paths and a 30-day inland smoke test pass. Generated layouts change intentionally; the prior equal-history result applies only to the preceding texture commit `3a6b973`. Saved chronicles are not relocated. No merge, push or deployment.
