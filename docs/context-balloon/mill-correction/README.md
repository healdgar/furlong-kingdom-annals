# Mill correction

The cylinder was replaced with two timber rims, eight spokes per side, sixteen buckets, a hub and an axle. Local surface coordinates travel with the rotating geometry; spokes have radial grain, buckets have grain along their width. One shared 560-triangle geometry and material, one mesh per wheel, no new image assets. The axle reaches the mill wall.

New worlds place mills against actual river strips or pond polygons, with the wheel center 1.25–1.6 m inside the bank. Building corners, edge midpoints and center must be dry; wheel-center depth must exceed 1.1 m. The 4 m wheel sits 3.05 m above the water: its lower 0.95 m is immersed. Existing street, building and wall exclusions remain. No hydraulic candidate consumes simulation RNG, but changed mill sites intentionally change generated settlement layouts and subsequent history. Seed 1001 now has ten mills rather than twelve: two cramped village sites fail placement. Inland seed 2002 has thirteen, including the Hlinpole pond mill.

`wheel-before.png` shows the previous cylinder. `wheel-phase-0.png` and `wheel-phase-0.8.png` show the corrected river mill at two phases; `pond-mill.png` shows a pond site; `webgl1-wheel.png` records fallback rendering. Captures are 1280×720, density 1, day 0. The before camera follows the original mill, so framing is comparable but positions/layouts differ.

`renderer-checks.json` establishes wet wheel centers, dry corners, depth and exact local-axis contact for all 23 mills across the two seeds; unchanged local UVs while world positions rotate; ruin hiding/restoration; deterministic sea-seed placement across WebGL2 and WebGL1 generation; linked shaders and zero errors. A 30-day inland smoke test completes without errors. `test-results.txt` records 77 passing focused tests, including river headings, pond siting, shallow-water/cliff rejection and deterministic siting. No long soak or device performance claim.

Saved chronicles retain their building positions. Their new wheel faces and rotating grain apply, but old inland mill sites are not relocated or supplied by a new millrace. The placement correction requires a newly generated world. This limitation is explicit; the previous blanket aesthetic-pass claim does not establish hydraulic or pond-edge fidelity.

Source hash is in `provenance.json`. Local worktree only; no merge, push or deployment.
