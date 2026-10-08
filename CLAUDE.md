# Furlong: Kingdom Annals — working rules

State of work, what's next and what waits on the user: `docs/HANDOFF.md`. Read it first.

## Repository and release
- One branch: `main`. No long-lived branches; an experimental build may get a short-lived one, deleted after. Parallel agents work in their own clones (on the user's Mac under `~/dev/.furlong-work/<name>`, remote removed; never under `/tmp`, which a reboot wipes) and hand back patches; only one agent edits the main checkout's `index.html` at a time.
- One build, three targets. Every push to `main` deploys GitHub Pages and the container image `ghcr.io/healdgar/furlong-kingdom-annals` (`.github/workflows/pages.yml`); the claude.ai artifact is published from the same build.
- Release: `node tools/embed-advisor.mjs` → `node --test --test-concurrency=8 tools/*.test.mjs` → `./tools/stamp.sh` (embeds again and stamps the build) → commit → `git push origin main` → publish `index.html` to the artifact with `assets/` and `LICENSE` as files.
- The advisor carries copies of `README.md`, `docs/UI-GUIDE.md` and its bridge inside `index.html`; after editing any of them run `node tools/embed-advisor.mjs`, or `tools/advisor-context.test.mjs` fails.
- `docs/ISSUES.md` is the one list of bugs, simulation debt and planned work. Update it when an issue is found, assigned or fixed.

## The game
- Everything runs from `index.html` (about 2.2 MB, very long lines) plus three textures in `assets/`. No build step, no dependencies; Three.js r128 from cdnjs.
- The simulation runs in a Web Worker that owns the world `W`. The screen's `W` is a disposable projection installed by `installPresentation` from packets built by `workerPresentation`. Anything the renderer reads must be projected; `tools/simulation-projection-drift.test.mjs` guards this. `#foreground=1` runs the same simulation on the main thread (the reference driver the Chrome harnesses use).
- Speeds: `SPEEDS=[0,0.5,2,8,30,360,1/1800]`; 1 Normal, 4 Fastest (30 days/s), 5 Reel years (360 days/s nominal), 6 Life.

## Rules for simulation changes
- Things happen because a quantity (surplus, rent against cost, threat against value) makes them worth doing, not because a number crossed a hand-picked line.
- Nothing fake: no invented payments, make-work, placeholder incomes or stand-in payers. Every coin, job and decision needs a real actor with a reason that exists in the state; where a real income or employer is missing because an institution isn't modelled yet (abbeys, courts, credit…), build that institution from `docs/ISSUES.md` rather than faking it.
- No price fixing as a remedy: don't clamp, floor, cap or pin a price, rate or purse to get a better outcome. Where such pins exist, remove them and fix the mechanism that makes the bad outcome, so the value follows from a quantity (cost, supply, demand, yield, what a buyer can pay). Exceptions, each named in a comment: a starting value the market then moves; a price fixed in the world itself (a decree, an assize, a custom the player or a lord sets); and, rarely, a last resort where no mechanism works, with the reason and the issue number.
- Every coin moves from a named payer to a named recipient through `flow`/`transfer`/`acct`; `tools/soak.mjs --audit` finds the exceptions.
- A save is the seed plus a journal of commands, replayed day by day. Nothing the simulation decides may depend on wall-clock time, frame timing, event-loop yields, rendering or UI reads; keep `Math.random`, `Date.now` and `performance.now` out of simulation state.
- Performance and display changes must leave the simulation byte-identical: prove the world graph and every RNG stream are equal to the previous build over at least 150 days (seed 1001, fate 42, sea). Changes that alter generated worlds or history are allowed when intended; say so and re-baseline the affected tests.

## Agents and machine load
- Subagents run on Opus, never Sonnet or Haiku. Never use the `mcp__furlong__*` tools: they drive the user's live game.
- At most five agents run at once (they may start their own subagents for reading and exploration). Too many heavy test runs at the same time have crashed this machine.
- One agent, the test runner, runs everything heavy: the full suite, Chrome, soaks, long simulation runs, identity proofs and measurements. It runs one job at a time, checks the load first, and keeps at most one Chrome open. Other agents send it requests and act on its results.
- Other agents may run only light checks themselves: `node --check`, and a single focused test file with `--test-concurrency=1`.
- Test in batches. Each agent commits its change with light checks and reports it ready; the coordinator bundles ready changes (exact changes first, behaviour changes after) and the test runner gates the batch once: the full suite, one identity proof covering every exact change, and one short multi-world soak that tracks money, faults, CPU and the economy at once. Bisect only when a batch fails. No per-change soaks or identity proofs; diagnosis runs that find causes are the exception, and are kept few and wide.
- Report timings as CPU time or instruction counts, with the load average beside them.

## Tools
- Tests: `node --test --test-concurrency=8 tools/*.test.mjs`.
- Multi-world soak (money, famine, population, per-tick cost): `tools/soak.mjs`. Graphics-free model runs (windows, digests, instruction counts): `tools/model-run.cjs`. Both score CPU by function and part of the day by default (`tools/cpu-score.mjs`; `--profile 0` turns it off) and record into a hot list; pass `--hotlist <path>` so every run ranks in one list (on the user's Mac `/Users/alexwall/dev/.furlong-work/hotlist.json`; elsewhere `tools/soak-results/hotlist.json`). Performance work takes the top of that list first. A soak carries on past a fault in one part of the day (`SIM_FAULTS.carry`) and names each world's first fault, after which the world is no baseline. Game speeds in the real worker build: `tools/speed-check.mjs`. Goods conservation: `tools/storage-check.mjs`. A world save at a day's end, loaded into a fresh realm (`worldSave`/`worldLoad`, `docs/WORLD-SAVE.md`); the late-world farm, segment by segment from saves with a census at each: `tools/farm.mjs`. The economy read from outside the simulation (the crown's flows by reason, a place month by month, stock held above its market, runaway prices): `tools/economy-probe.mjs`. Worker/reference parity and save/replay: `tools/simulation-worker-check.mjs`. Drawn play: `tools/simulation-worker-play-check.mjs`. Replay and timing: `tools/replay-check.mjs`.
- Measurement output goes to `tools/soak-results/` (ignored) or a temporary directory, never the tracked tree.
- Read `index.html` with python3 or `rg -n` with bounded output; plain `grep` (ugrep here) fails on its long lines.

## Style
Terse JavaScript matching the surrounding code; comments in plain English in the game's voice. Docs say what is true now; record evidence briefly, and drop runnable commands for tools that no longer exist.
