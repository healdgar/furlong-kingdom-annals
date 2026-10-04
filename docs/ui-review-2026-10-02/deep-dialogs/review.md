# Nested dialog audit — 2026-10-02

Audited the existing game through actual UI interactions, including paths three to six actions deep. Fixed confirmed defects in the application.

1. **Monarch → Family tree → relative → card.** Family links were 14–16.5px high; tree text was 12px. Links now have 44px targets; tree text is 14px, 16px with Larger text. Person-card spouse/child links receive the same targets. Relative navigation remains functional. Evidence: 01-family-before.jpg, 02-relative-before.jpg, 07-house-before.jpg, 13-family-after.jpg.
2. **Menu → Save → Share/import.** Close appeared only after a long list of autosaves and import controls. Save, Share, Help, advisor configuration, and verdict dialogs now receive a sticky heading and 44px Close button through the shared dialog handler. Verified scrolling, Escape/focus recovery, invalid-code errors, and viewport containment. Evidence: 05-save-share-before.jpg, 14-save-share-after.jpg, 26-help-scroll-final.jpg.
3. **Panels → Realm → Parchment map.** Previously had no visible exit or instructions and lacked modal focus handling. Added a named dialog, Close button, travel instructions, bounded square map, focus containment, background inertness and focus restoration. Canvas taps still close the map and travel; Escape and Close reopen cleanly. Evidence: 06-map-before.jpg, 20-map-final.jpg, 21-ipad-map-after.jpg.
4. **Menu → Plan → Street → drawn draft.** An old, more specific CSS rule reduced instructions to 11.5px despite earlier responsive styling. Corrected hints and ongoing works to 14px; touch instructions say tap. Landscape clipped the draft actions; Commission/Discard now remain visible at the panel bottom while details scroll. Evidence: 03-planner-before.jpg, 04-plan-draft-before.jpg, 16-planner-after.jpg, 17-landscape-plan-after.jpg, 19-landscape-plan-final.jpg.
5. **Petition → town → Orders → levy → split → Orders → join.** Town and army commands remain within the existing scrolling inspector, with visible Close/Back and fixed Visit/Follow controls. Real levy, split and join operations completed in a disposable local game. Enlarged petition context links and changed army instructions to tap on phones. Evidence: 09-petition-before.jpg, 10-petition-town-orders-before.jpg, 11-army-orders-before.jpg, 22-petition-after.jpg, 23-army-split-after.jpg.
6. **Menu → Help → Camera controls; endgame verdict.** Expanded sections and long headings wrap without horizontal overflow. The shared persistent exit works on short screens. Evidence: 18-landscape-help-after.jpg, help-1440x900-after.jpg, 24-small-verdict-after.jpg, 26-help-scroll-final.jpg.

## Verification

- Rendered at 390×844 portrait, 844×390 landscape, 320×568 small phone, 390×460 reduced height, 1024×768 iPad width and 1440×900 desktop width.
- Help geometry had no horizontal overflow at every measured viewport; Close targets measured 44px. Tree links measured 44px and 14px text. The reduced-height Help dialog retained Close at y=25 after scrolling 268.5px.
- Exact Site HTML served locally; rare famine/verdict states used isolated fixture buttons calling real game functions. Fixture controls are excluded from the published archive.
- JavaScript syntax checks passed for both versions; all 11 existing advisor/API/OpenRouter tests passed. No console errors in the rare-state test tab.
- These are browser viewport checks, not physical iOS Safari or ChatGPT-app keyboard tests. Reduced height approximates available space; it does not validate a real mobile keyboard.
