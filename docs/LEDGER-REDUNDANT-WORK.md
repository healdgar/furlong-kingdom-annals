# Ledger redundant-work batch

Three Luna 6 audits identified repeated balance selection, unchanged facility refreshes and household array construction. GPU acceleration is deferred at the user's request. This batch adds no maintained index, economic record or journal event.

## Completed

- [x] Read an addressed balance directly without allocating a key array.
- [x] Update existing owner/facility membership only when cell membership changes.
- [x] Plan fully addressed consumption/transfers without selecting and sorting rows; retain selector snapshot semantics, shortage tolerance and atomic preflight.
- [x] Skip unchanged managed facility refreshes, occupancy recounts and metadata writes. Changed metadata, refits and custom volumes retain original validation.
- [x] Reuse exposed row keys for the carriage report, reading their current balances. Exposed destinations retain the complete post-transfer selection.
- [x] Remove the second spoilage snapshot and duplicate location lookup.
- [x] Build household producer and reconciliation lists in one ordered pass.
- [x] Select a lender directly from existing households without intermediate head arrays; retain richest-first tie order and eligibility.
- [x] Sum all four herd species in one owner pass, retaining each species' addition order.

Deferred: generic multi-row planning needs stronger arithmetic/order proof; hoisting the realm farm mean is unsafe because daughter settlements can appear during the pass; deleting journal outcomes needs a separate replay-preserving design.

## Native comparison

Baseline `450d2b6`, HTML SHA-256 `9b8cc31045e0be212430d9f06e71df0695d1a2612b96f08dbb56540ef2125f93`.
CPU candidate before the urgent database-connection fix: `dd8e09f787c6a2b41ac0f5d3e611ce61076389b6841180f8205d0827d5f1e81e`.

Isolated Chrome on Apple M4 Max, seed `287970763`, fate `370450810`, two complete 360-day years, baseline and candidate run serially without concurrent test load. Timing includes worker day processing, journal backpressure and monthly yields; excludes checkpoint fingerprints and explicit year-end flushes.

| Snapshot | Year 1 | Year 2 | Total |
| --- | ---: | ---: | ---: |
| Baseline | 16,086.6 ms | 18,532.1 ms | 34,618.7 ms |
| CPU candidate | 15,020.9 ms | 17,080.4 ms | 32,101.3 ms |

Elapsed time fell **7.27%**. Initial and both year-end authoritative graph fingerprints, RNG, population, household counts and journal sequence match exactly. The journal retains 5,416 records at day 360 and 11,357 at day 720. This removes redundant processing and writes; it does not reduce journal record count or establish century throughput.

Evidence: `/tmp/furlong-ledger-work-baseline-b`, `/tmp/furlong-ledger-work-candidate-final`, source-pinned harness `/tmp/furlong-ledger-work-check.mjs` and probe `/tmp/furlong-ledger-work-probe.mjs`. The harness uses its existing diagnostic probe channel; this probe executes CPU simulation, with no GPU economy kernel.

## Urgent database connection recovery

The reported Safari error occurs when a cached IndexedDB connection rejects transaction creation because it is closing. Both journal writers and live exports now reopen once at that boundary, before any write starts. Completed/aborted transactions are never blindly replayed. The retained chunk, sequence and atomic chunk/metadata commit remain unchanged. Close/version-change events invalidate cached connections; recovery refuses to silently recreate a removed history database.

Focused validation: 61 history/journal checks and 128 commodity/household/worker-boundary checks pass. Worker and foreground failure fixtures verify one reopen, exact records and hashes, and preservation of an aborted transaction's pending tail. Native eight-day worker/reference comparison passes graph/RNG/save/replay/continuation and view parity. Physical iOS reproduction remains unverified.
