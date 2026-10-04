# Mobile placement submenu correction

Reproduced the army Orders → Order a march flow on a 390×844 viewport. The placement prompt inherited bottom:40px while the responsive rule also set top below the HUD. With no height constraint or explicit width, it stretched into a 195px-wide, 688.5px-tall central obstruction.

The shared placement prompt now has explicit width, automatic height, and mutually exclusive vertical anchors. On phones it docks above the collapsed Annals bar; wider screens use a compact strip below the HUD at the left edge. A wrapping status message and styled 44px Cancel button retain access to the map. Army instructions are shorter and use tap wording on phones. Hover updates only the message instead of replacing the Cancel button. Escape-to-stop hints also lose their keyboard-only suffix.

Rendered checks:
- Army Details → Orders → Order a march: 390×844 prompt now 374×62 at x=8,y=718; Cancel 44px high; inspector hidden, no horizontal overflow.
- Landscape phone 844×390: prompt at y=264, 62px high, bottom=326; no horizontal overflow.
- iPad 820×1180: 560×62 below HUD, at x=8,y=103.
- Desktop 1440×900: 560×62 below HUD, at x=8,y=61. Actual mouse hover changed the message to March on Dunallt while retaining Cancel; Cancel then exited placement.
- Actual map click completed a march-on-Dunallt order, removed the prompt, and produced its chronicle entry.
- Road start → road destination updated the prompt with From Dunallt; Escape cancelled the second stage.
- Village charter, buy land, seize land, district clearing and paving prompts all measured 62px high with 44px Cancel controls and no horizontal overflow. Each cancelled correctly.
- Both primary and Site inline JavaScript pass syntax checks; git diff --check passes. Existing advisor tests still pass.

Browser fixture: a local-only Test army button created/opened a crown host to make the army flow repeatable. It called the game's real army/inspector functions; subsequent Orders, march, hover, map selection and cancellation used the actual interface. No fixture or test controls enter the published source/archive.

Before/after screenshots: phone-march-before.jpg and phone-march-after.jpg.
