# Furlong: Kingdom Annals — working rules

## Repository and release
- One branch: `main`. No long-lived branches; an experimental build may get a short-lived one, deleted after. Parallel agents work in their own scratch clones (remote removed) and hand back patches; only one agent edits the main checkout's `index.html` at a time.
- One build, three targets. Every push to `main` deploys GitHub Pages and the container image `ghcr.io/healdgar/furlong-kingdom-annals` (`.github/workflows/pages.yml`); the claude.ai artifact is published from the same build.
- Release: `node --test --test-concurrency=8 tools/*.test.mjs` → `./tools/stamp.sh` (embeds the advisor bridge and the docs, stamps the build) → commit → `git push origin main` → publish `index.html` to the artifact with `assets/` and `LICENSE` as files.
- `docs/ISSUES.md` is the one list of bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed.

## The game
- Everything runs from `index.html` (about 2.2 MB, very long lines) plus three textures in `assets/`. No build step, no dependencies; Three.js r128 from cdnjs.
- The simulation runs in a Web Worker that owns the world `W`. The screen's `W` is a disposable projection installed by `installPresentation` from packets built by `workerPresentation`. Anything the renderer reads must be projected; `tools/simulation-projection-drift.test.mjs` guards this. `#foreground=1` runs the same simulation on the main thread (the reference driver the Chrome harnesses use).
- Speeds: `SPEEDS=[0,0.5,2,8,30,360,1/1800]`; 1 Normal, 4 Fastest (30 days/s), 5 Reel years (360 days/s nominal), 6 Life.

## Rules for simulation changes
- Things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.
- Every coin moves from a named payer to a named recipient through `flow`/`transfer`/`acct`; `tools/soak.mjs --audit` finds the exceptions.
- A save is the seed plus a journal of commands, replayed day by day. Nothing the simulation decides may depend on wall-clock time, frame timing, event-loop yields, rendering or UI reads; keep `Math.random`, `Date.now` and `performance.now` out of simulation state.
- Performance and display changes must leave the simulation byte-identical: prove the world graph and every RNG stream are equal to the previous build over at least 150 days (seed 1001, fate 42, sea). Changes that alter generated worlds or history are allowed when intended; say so and re-baseline the affected tests.

## Tools
- Tests: `node --test --test-concurrency=8 tools/*.test.mjs`.
- Multi-world soak (money, famine, population, per-tick cost, profiles): `tools/soak.mjs`. Game speeds in the real worker build: `tools/speed-check.mjs`. Goods conservation: `tools/storage-check.mjs`. Worker/reference parity and save/replay: `tools/simulation-worker-check.mjs`. Drawn play: `tools/simulation-worker-play-check.mjs`. Replay and timing: `tools/replay-check.mjs`.
- Measurement output goes to `tools/soak-results/` (ignored) or a temporary directory, never the tracked tree.
- Read `index.html` with python3 or `rg -n` with bounded output; plain `grep` (ugrep here) fails on its long lines.

## Style
Terse JavaScript matching the surrounding code; comments in plain English in the game's voice. Docs say what is true now; record evidence briefly, and drop runnable commands for tools that no longer exist.
