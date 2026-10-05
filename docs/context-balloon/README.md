# Context balloon worktree

Branch: `codex/context-balloon`, based on `19a4f06`; first implementation commit `2fd9998`.

Preview: http://127.0.0.1:8766/#s=1001&f=1001&c=sea

Restart from this checkout: `python3 -m http.server 8766 --bind 127.0.0.1`.

Select a town/person/building. Click its card or Expand for nearly full-screen details. Minimize or Escape returns to its map anchor; Close dismisses it. Menu contains existing realm, Annals, planning, overlays and save/help flows.

Runtime comprises `index.html`, the images under `assets/materials/`, and `assets/ui/parchment.webp`; serve these together. The prior procedural-only texture pass was incomplete. The correction adds generated raster materials, parcel-wall orientation, physical path coordinates for paving/water, narrow gravel margins, terrain-height coastal blending and parcel-aligned decorative soil plots. It preserves simulation rules and seasonal coloration. Garden decoration does not alter yields or crop ownership.

Current evidence: root `design-qa.md` and `texture-correction/`. Earlier UI evidence remains under this folder; older texture screenshots and renderer numbers describe `2fd9998`, not the corrected source. Image generation prompts and sources: `material-atlas.md`, `water-ripples.md`.

Local testing only. No push, merge or deployment.

## Waterwheel follow-up

Open timber spokes, rims and buckets replace the cylinder; local wood grain rotates with the wheel. Newly generated mills use actual river/pond edges, placing their wheel in water and body on dry ground. Saved chronicles retain their earlier mill locations. Checks, two rotation phases and pond evidence: [mill-correction](mill-correction/README.md). Generated settlement layouts intentionally differ from the texture-only commit. Local preview remains on port 8766; nothing deployed.

## Full detail sheets and type

Expanded sheets use 18px body text and at least 16px annotations/controls. The brief card remains minimal; expansion exposes complete stock, building, household, family, property and muster registers plus full recorded histories and court explanations. Shortcuts remain visible while scrolling, wide ledgers stack on phones, and records link back to their settlement. Validation and captures: [ui-detail-correction](ui-detail-correction/README.md). 64 focused tests pass; a 30-day history matches `43fd815`. Local worktree only.

## Paper parchment

A shared 27 KB raster adds warm fibers and gentle mottling to the card, pointer, full sheets and their paper navigation surfaces. A light wash preserves legibility. Generation prompt: [parchment-prompt.txt](parchment-prompt.txt). Captures and checks: [parchment](parchment/README.md). Five source/card tests pass; the 390px layout has no horizontal overflow or obscured header controls. Local preview only.

## Main integration

The complete workstream is now integrated with main’s newer coastal and simulation fixes. [Combined checks and preview](main-integration/README.md). Earlier local-only statements above describe the worktree review stage.
