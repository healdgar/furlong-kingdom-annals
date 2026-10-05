# Context balloon worktree

Branch: `codex/context-balloon`, based on `19a4f06`; first implementation commit `2fd9998`.

Preview: http://127.0.0.1:8766/#s=1001&f=1001&c=sea

Restart from this checkout: `python3 -m http.server 8766 --bind 127.0.0.1`.

Select a town/person/building. Click its card or Expand for nearly full-screen details. Minimize or Escape returns to its map anchor; Close dismisses it. Menu contains existing realm, Annals, planning, overlays and save/help flows.

Runtime comprises `index.html` and the two images under `assets/materials/`; serve both together. The prior procedural-only texture pass was incomplete. The correction adds generated raster materials, parcel-wall orientation, physical path coordinates for paving/water, narrow gravel margins, terrain-height coastal blending and parcel-aligned decorative soil plots. It preserves simulation rules and seasonal coloration. Garden decoration does not alter yields or crop ownership.

Current evidence: root `design-qa.md` and `texture-correction/`. Earlier UI evidence remains under this folder; older texture screenshots and renderer numbers describe `2fd9998`, not the corrected source. Image generation prompts and sources: `material-atlas.md`, `water-ripples.md`.

Local testing only. No push, merge or deployment.
