# Context balloon design QA

final result: passed

## Visual truth and scope

Selected local references: `docs/context-balloon/ui-reference.png` (revised single balloon) and `docs/context-balloon/texture-reference.png` (texture option 3). This is an adaptation to the existing game, with the user's added full-screen/minimize behavior. Existing generated map geometry, sigils, typography and simulation remain the source of runtime content; the reference's invented settlement and additional landscape detail are not new game assets.

Reference pixels: 1586 × 992, normalized to 1440 × 900 for comparison. Implementation: 1440 × 900 CSS/pixels, density 1. Source ratio 1.599, runtime ratio 1.600; negligible normalization difference. Compact state: capital selected, ruling, paused, Population/Unrest and Orders/Details visible. Values and settlement names are real simulated content.

Full comparison: `docs/context-balloon/ui-comparison.png`. Focused comparison: `docs/context-balloon/card-comparison.png`; normalized source crop (390,154)–(744,405), implementation crop (342,174)–(692,430). Full texture direction comparison: `docs/context-balloon/texture-comparison.png`, source and implementation settlement close views. The exact fictional scene/camera cannot be reproduced from the raster; material direction, rather than scene identity, is compared.

Implementation evidence: compact/expanded desktop, compact/expanded mobile (390 × 844), expanded short screen (390 × 460), expanded tablet (834 × 1194), Annals and material views under `docs/context-balloon/`.

## Findings

No remaining actionable P0/P1/P2 findings in the transforming card workflow. Parchment, dark compact HUD, serif title, two-row summary, restrained actions and object pointer follow the selected direction. Explicit Expand/Minimize and text Close are intentional additions. Controls have visible focus; expanded content scrolls independently while Minimize/Close remain outside the scroll area.

The texture direction is implemented as filtered procedural grain in existing ground, plaster, limestone, tile and thatch materials with muted seasonal greens. The generated reference remains richer in lighting and foliage detail than this existing low-poly world. That difference is explicit: this change preserves the prior geometry and texture budgets.

## Comparison history

1. P2: Escape both minimized and closed the card. Added the defaultPrevented guard; browser verified Escape leaves the original compact subject visible.
2. P2: generic dialog decoration replaced a hidden Annals heading ID. Context dialog now has its own label/focus handling; Annals navigation verified afterward.
3. P2: stale inline pointer visibility appeared on detached Annals/legend. Detached/expanded visibility now overrides inline placement. Final Annals screenshot and legend browser probe show no false pointer.
4. P2: reading position carried between panel types and subjects. Reset on a panel/subject change; preserve expanded reading position only for returning to the same panel. Browser probes pass.
5. P2: ground grain was too faint for the selected material direction. Strengthened filtered multi-scale grain, recaptured material comparisons, and rechecked both WebGL shader paths and budgets.
6. Initial compact evidence contained a stale compositor frame. Recaptured after the displayed state and animation frames settled; final UI/card comparisons use the visible capital balloon.

## Interaction checks

Card body/title/Expand opens nearly full screen. Minimize/Escape returns to the same subject, camera and map position. Expanded reading position survives a minimize/expand cycle. Tab and Shift-Tab wrap within the expanded dialog; background controls are inert, restored when minimized/closed. Orders exposes existing commands. Annals, Crown, planner and map legend use the same panel. Choosing a drawing brush minimizes and restores map input. Existing Save dialog opens/closes. Menu and Help remain available.

`tools/context-card.test.mjs` exercises viewport clamping, pointer detachment behind/offscreen, stable pointer side during camera motion, and occluded anchors. Focused source/speed/ownership/storage/advisor checks: 73 passed. Browser UI evidence: `docs/context-balloon/ui-checks.json`; no observed console warnings/errors after final reload.

Renderer evidence: `docs/context-balloon/renderer-checks.json`. Seed/fate 1001, coast sea: final WebGL2 and WebGL1 compile, zero simulation errors; baseline/final have identical geometry triangles (1,756,159), draw calls (54), texture count (10), and texture dimensions in a matched capital view. Final 30-day history fingerprint matches baseline `19a4f06` exactly. Current-source SHA256 is in `docs/context-balloon/provenance.json`.

## Follow-up polish and limits

Physical phone interaction, GPU timing, long simulation soaks, and deployed behavior are unverified. Texture geometry/lighting/foliage differences from the generated reference remain an optional future art pass. No deployment, merge or push performed.
