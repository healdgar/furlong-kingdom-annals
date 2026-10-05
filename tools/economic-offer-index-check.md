# Market offer index checkpoint

Baseline: deployed `34846e4`. The travel/custody/time prototype was withdrawn before
publication. No travel, freight, warehouse, household-accounting or price rule changes
remain in this checkpoint.

Sale markets reuse ordered offer membership beside the existing active-claim index.
They read inventories only for owners offering the requested good, retaining zero and
NaN entries, native owner order, live appends/deletions and charcoal alias fallback.
The original Map cursor preserves continuation when opaque changes trigger the existing
public-dirty fallback. Raw owner/table edits require `storageTitleDirty` notification.

Membership is an external WeakMap-derived cache. There are no additional authoritative
fields, journal events, lot transfers, saves or persistent writes. Player saves already
exclude these caches; this change does not claim smaller save files or journal volume.

## Validation

All 600 Node tests pass, including ten offer/order/fallback cases. Fresh serial native
Chrome/Metal comparisons against `34846e4` separate timing and correctness runs.

| 90-day run, seed 1001 | Baseline elapsed | Candidate elapsed | Reduction |
| --- | ---: | ---: | ---: |
| Coastal, candidate first | 5.893 s | 5.626 s | 4.5% |
| Inland, baseline first | 6.350 s | 6.326 s | 0.4% |

Exact expanded accepted/durable storage events, monthly raw storage/world graph and
all RNG streams match: 783,063 coastal and 766,159 inland events. No journal faults or
pending writes remain. Elapsed intervals include tick simulation, journal waits and
final flush; they are not OS CPU or FPS measurements. Worst-tick latency did not
consistently improve. Small timing differences can be noise; these results do not
promise a universal 4% gain. The earlier 4% measured several indexes under the rejected
travel policy and cannot be carried over unchanged.

A sparse-market probe (2,000 empty owners, 20 sellers, 1,000 queries, unchanged sum)
took 84–87 ms with inventory scans and 23–27 ms with the index. This isolates query
work, not whole-game speed. The native owner cursor still traverses owner keys to
preserve live fallback; it avoids unrelated inventory reads.

Local ignored evidence: `tools/soak-results/offer-index-cursor-2026-10-04-{sea,land}90/`.
The measured source SHA256 is `bcb23f2a993014bb62a8fcc42db373ea15b5cb39123dc22d22df7b9cf4d6e0b4`;
the publication stamp changes only the loading-screen label.

```sh
node --test tools/*.test.mjs
node tools/replay-check.mjs --baseline 34846e4 --source index.html --days 90 --cadence 30 --seed 1001 --coast sea --variants candidate,baseline --mode both --out /tmp/furlong-offer-sea-new
node tools/replay-check.mjs --baseline 34846e4 --source index.html --days 90 --cadence 30 --seed 1001 --coast land --variants baseline,candidate --mode both --out /tmp/furlong-offer-land-new
```
