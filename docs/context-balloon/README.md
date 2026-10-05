# Context balloon worktree

Branch: `codex/context-balloon`, based on `19a4f06` of `claude/annals-kingdom-sim-oop6ub`.

Preview: http://127.0.0.1:8766/#s=1001&f=1001&c=sea

Restart from this checkout: `python3 -m http.server 8766 --bind 127.0.0.1`.

Click a town/person/building to select it. Click the card or Expand for full details. Minimize or Escape returns to its map anchor; Close dismisses it. Menu provides Crown, Annals, realm settings, overlays, planning and existing save/help flows. When an overlay has a legend, Map legend appears in Menu. Orders requires ruling the appropriate house/crown.

Changes: `index.html` only for runtime UI/materials; `tools/context-card.test.mjs` for placement behavior. Reuses existing command DOM and shared focus/inert handling. UI state is separate from simulation state. Material grain remains procedural, with no added high-resolution textures or polygons.

Validation: see root `design-qa.md`, `test-results.txt`, `ui-checks.json`, `renderer-checks.json`, `provenance.json`, and screenshots in this folder. No push/merge/deploy. Physical devices, performance timing and long soaks remain unverified.
