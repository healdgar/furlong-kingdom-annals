# Remaining scan reductions

Baseline: `3067ee5`. All changes form one batch; run validation after integration.
No new authoritative fields, journal writes, travel rules or route restrictions.

- [x] Warehouse routing: reuse ordered candidates by source/good/ownership;
      filter active compatible capacity and retain exact distance decisions.
- [x] Household inventories: external owner-plus-good lot membership,
      preserving existing consumption and custody order.
- [x] Storage reconciliation: process changed owner/good groups incrementally,
      retaining original matching/coalescing behavior and callback safety.
- [x] Caravan destinations: conservative profitable-candidate index; retain
      distant and undeveloped routes and road-investment incentives.
- [x] Nearest trade source: reusable trade-specific settlement index with
      current annual-cache behavior and deterministic tie order.
- [x] Household display: keep withdrawn travel display absent; any retained
      inventory query shares the composite index. Do not restore travel state.
- [x] Validate complete batch: 638 tests pass; native one-year coastal replay
      matches journal, state and RNG. Performance regression measured below.
- [x] Prepare publication through main and the existing GitHub Pages workflow;
      user explicitly requested publication before regression repair.

## Validation evidence

The 360-day replay of source
`ba9ebf12491f3cc546dc4022d3b80afe075c3a8c2d52709f76aa0a1ab55d42a8`
matched baseline `3067ee5`. Both timing runs recorded 4,959,327 journal events,
including the initial event. No additional records were generated.

Baseline tick time: 35,542.9 ms. Candidate: 39,894.0 ms, about 12.2% slower.
Subsequent allocation removal and dense-selection fallback changes pass the
638-test suite but have not received another native timing run. The regression
remains unresolved; publication is authorized for interactive testing.

Incremental reconciliation retains active-claim bookkeeping for numerical parity.
Warehouse/caravan indexes preserve long routes and exact economic decisions.
Callbacks and unusual state retain conservative scan fallbacks. Indexes remain
external to saved game state and use existing authoritative event writers.

Local replay evidence is under `tools/soak-results/batch-index-verified-2026-10-04-sea360/`.
To retest the published source against the baseline:

```sh
node --test tools/*.test.mjs
node tools/replay-check.mjs --baseline 3067ee5 --source index.html --days 360 --cadence 30 --seed 1001 --coast sea --mode both --audit journal --out tools/soak-results/batch-index-retimed-sea360
```
