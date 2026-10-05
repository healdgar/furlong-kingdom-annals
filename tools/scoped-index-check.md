# Track and exposed-storage index checkpoint

Baseline: deployed `e3636c6`. Preserve the warehouse, household and market indexes.
No travel, freight, accounting or economic rule changes.

`buildTracks` uses local spatial indexes for towns and rural yards, plus a field
index by domain. Scratch wrappers keep spatial stamps off authoritative objects.
Candidate selection retains exact geometry tests, insertion order and fallback
for unsupported coordinates/radii. Exposed-lot queries reuse the external facility
index, avoiding archived cargo locations. Facility membership changes use ordered
insertion/removal instead of rebuilding and sorting the whole list.

No additional authoritative fields, ledger events or persistent writes. These
derived indexes are excluded from saves. Player saves already contain seeds and
dated commands; this change does not claim smaller saves or journal volume.

## Validation

612 Node tests pass. Fresh serial Chrome/Metal replay comparisons match monthly
world/storage state, all RNG streams and exact accepted/durable storage events:
783,063 coastal (seed 1001), 1,013,748 inland (seed 2002). Zero model, browser or
persistence faults; pending writes drain to zero.

| Native measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Coastal 90 days, baseline first | 6.040 s | 6.106 s |
| Inland 90 days, candidate first | 7.867 s | 7.860 s |
| Coastal repeat, candidate first | 6.065 s | 6.056 s |
| Track rebuild, warmed median of three | 19.7 ms | 13.3 ms |

Daily tick timing is effectively neutral: the initial 1.1% slower sample did not
repeat. Track rebuilding takes 32.5% less elapsed time in this isolated sample.
The seeded native world had 6,002 graph nodes and produced the same ordered 698
tracks on every run. Projection was deferred during the rebuild measurement.
These are elapsed measurements, not OS CPU counters or FPS guarantees.

A sparse exposure probe with 10,000 cargo locations and one exposed yard took
33–55 ms scanning versus 2.2–2.4 ms indexed for 1,000 unchanged queries. This
isolates query work; it is not a whole-game speed claim.

Ignored local evidence: `tools/soak-results/scoped-index-2026-10-04-{sea90,land90,sea90-reverse}/`
and `tools/soak-results/track-spatial-native-2026-10-04/`.
Measured source SHA256:
`6bb0d99f377c8f52ad5647267215e8f577f586851afb43602613c55c4ee98cd7`.
The publication stamp changes only the loading label.

```sh
node --test tools/*.test.mjs
node tools/replay-check.mjs --baseline e3636c6 --source index.html --days 90 --cadence 30 --seed 1001 --coast sea --variants baseline,candidate --mode both --out /tmp/furlong-scoped-sea-new
node tools/replay-check.mjs --baseline e3636c6 --source index.html --days 90 --cadence 30 --seed 2002 --coast land --variants candidate,baseline --mode both --out /tmp/furlong-scoped-land-new
```

## Remaining audit findings

Four Luna 6 audits covered paths, storage, economy and state persistence.

- Confirmed bug: `planOpen` unhides a street without invalidating `s._sg`.
  `streetGraph` keys only on street/point counts, so opening an existing planned
  street can reuse a graph omitting it. An actual-source VM probe returned five
  cached nodes versus ten rebuilt nodes. Fix separately with route-output review.
- Household migration recomputes the same source household's land/roots for each
  destination. Hoist lazily or index ownership; this is annual work.
- `OwnedMarket.clear` scans all owners. Skipping absent entries also skips
  arithmetic provenance updates, so a seller-only loop is not behavior-preserving.
- No confirmed persistence defect. External indexes are already omitted from
  player saves; optional history archives are not full-engine resume snapshots.

These findings remain unimplemented. The facility sorting and track scans found
by the audits are addressed in this checkpoint.
