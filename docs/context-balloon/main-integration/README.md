# Main integration

Merged the complete `codex/context-balloon` workstream through `06c6fde` with main `8b715e2`, retaining the newer coastal land mask, settlement distance cache, army index and residential vacancy cache. The one ocean-material conflict combines the textured water material with main's `SEA_SURFACE` constant. The primary economic-ledger checkout's uncommitted work was not modified.

The source-review tripwires were renewed after inspecting their exact differences: the inspector adds one read of `s._owners`; the wheel stores a rendering reference in `wh.userData.building`. Storage writers and reconciliation thresholds are unchanged.

Tested `index.html` SHA-256: `0ff103ad6ab23ab8736f4ea20a71e86b87096618d02da23cc37ec5145cc91a8e`.

- All 672 source/unit tests pass; the prior main baseline passed 656.
- Hardware Chrome rendering passes for seed 1001 sea and 2002 land through 30 days: materials loaded, shaders linked, camera uniforms, live rebuilding and church variants. The existing render harness was adapted locally to serve its snapshots and copied assets over HTTP and await both image-load promises. The unadapted file snapshot failed because its assets were absent; it was not a game failure.
- Four one-year simulations pass: seeds 1001 and 2002, each sea and inland. Money residuals stay within the unchanged 0.01-coin gate; independent inventory matching, finite population, live realms, walls and journal completion pass. The earlier run with repeated yearly rendering samples was stopped after the separate HTTP rendering checks passed; the completed simulation run omits those redundant samples.
- The merged-source 30-day expanded-storage journal replay passes: 207,585 events, matching accepted/persisted digests, zero pending bytes and no journal fault. Semantic field replay is unsupported by this baseline; this is not a complete saved-game hydration claim.
- Browser smoke verifies parchment, loaded terrain/water materials, full details, expansion and minimization. No horizontal overflow or obscured header controls at the native 1280 × 720 viewport. Capture: [sheet.png](sheet.png).

Commands and outputs remain local in `/tmp/furlong-context-main-render-http`, `/tmp/furlong-context-main-sim` and `/tmp/furlong-context-main-replay`; compact results are saved here. These checks establish this bounded integration, not century-scale or physical-phone performance clearance.

Main preview: `http://127.0.0.1:8768/#s=1001&f=1001&c=sea`, served from this integration checkout. The earlier port 8766 preview still serves the original worktree. GitHub Pages publication uses the existing workflow on main.
