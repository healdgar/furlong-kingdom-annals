# Parchment surface verification

Built-in image_gen created the material using [the saved prompt](../parchment-prompt.txt). Runtime asset: `assets/ui/parchment.webp`, RGB, 512 × 512, 27,452 bytes. CSS repeats it at native size beneath a 28% ivory wash and shares the surface across the speech card, pointer, full sheets and their paper controls.

Generated original remains at `/Users/alexwall/.codex/generated_images/01a10985-90a6-77e3-80f2-58c96aaf9604/exec-e32f2cca-5a3c-4e73-908a-a709274c1671.png`.

Source SHA-256: `a14782f3b4e09d775c4755dd519f117795368389a353174a030fffb9ebd79bbe`.
Runtime texture SHA-256: `f716ab4e4159921b0dc07899955662518983215dca5cfc31277196f36ccf271e`.

Seed/fate 1001, sea, day 0 paused. Captures: compact and expanded at the native 627 × 930 viewport; scrolling Stores; phone at 390 × 844. Visually checked grain, repetition and text readability. Browser decoded the 512px image; card, pointer and sticky navigation use it. Phone probe shows no horizontal overflow, visible Minimize/Close, minimum annotation/control size 16px, and zero app errors. Viewport override reset after checking.

`node --test tools/source.test.mjs tools/context-card.test.mjs`: five passing tests. `git diff --check` clean. Simulation code unchanged. No push, merge or deployment.
