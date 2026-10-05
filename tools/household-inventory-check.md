# Household inventory consumption checkpoint

Baseline: deployed `139dd52`. Source remains in `index.html`; there is no game build step.

## Removed repeated work

`eatHouseholds` already consumes household claims through `consumeOwned` and the physical
`byOwner` lot index. Its legacy `stores[good]` guard nevertheless recalculated the entire
town's stock after each physical removal invalidated the town-total cache.

A native household-owned, held, non-transit lot large enough for the request now proves
physical backing without reading unrelated town inventories. A single lot proves the
bound without reassociating floating-point sums. Requests spanning smaller lots, empty
pantries, nonnumeric values, nonpositive/nonfinite bounds and overridden readers retain
the original town-total path.

The original quantity calculation, title synchronization, lot-removal order, accounting
roundoff, fault guards and journal events remain intact. A deferred cache warm restores
the original full total when no physical mutation occurs; the existing physical dirty
boundary cancels it otherwise. These admission/cache records are external WeakMaps,
not authoritative inventory or serialized state.

`storage-inventory-consumption.test.mjs` compares against the frozen deployed consumption
operation, including exact event fields, special numbers, index order and cache state.
A fixture with 1,000 unrelated lots checks that an ordinary bite reads fewer than 20 lots.
The ownership architecture hash was renewed after reviewing the unchanged physical/legal
writers and the new bounded reader; outside claim-writer references remain pinned.

## Validation and measured result

All 590 Node tests pass. Native Chrome/Metal runs use fresh profiles, serial browser
instances, separate timing/correctness passes and deployed `139dd52` as baseline.

| Run | Baseline elapsed | Candidate elapsed | Reduction |
| --- | ---: | ---: | ---: |
| Coastal 270 days, initial trial | 26.019 s | 22.484 s | 13.6% |
| Inland 90 days, final source | 8.615 s | 7.452 s | 13.5% |
| Coastal 90 days, final source, candidate first | 6.778 s | 5.682 s | 16.2% |

Every accepted expanded storage event equals baseline and its durable replay.
Monthly exact raw storage state, broad world/land/annal graph fingerprints and all
three RNG streams match. Final-source runs cover 783,063 coastal and 1,013,748 inland
storage events; the initial 270-day trial covers 3,036,411. The final admission guard
also rejects total overrides installed before binding, covered by a frozen fixture.
No full-game reconstruction/hydration or semantic-field coverage is claimed.

Elapsed intervals include synchronous tick-driver simulation plus journal waits and
final flush, excluding boot. These are not OS CPU, FPS or actual RAF speed measurements;
worst-tick latency did not improve consistently. The historic 49% checkpoint is not
another claimed gain here. Event volume is unchanged; compact chunk boundaries vary
with timing, so encoded byte counts need not match. The replay harness's unrelated
70% encoding/2x RAF gates are not met and are not claimed for this optimization.

Local evidence: `tools/soak-results/household-inventory-2026-10-04/` (ignored).
Reproduce a final-source comparison:

```sh
node --test tools/*.test.mjs
node tools/replay-check.mjs --baseline 139dd52 --source index.html --days 90 --cadence 30 --seed 2002 --coast land --driver tick --mode both --out /tmp/furlong-inventory-land-new
node tools/replay-check.mjs --baseline 139dd52 --source index.html --days 90 --cadence 30 --seed 1001 --coast sea --variants candidate,baseline --driver tick --mode both --out /tmp/furlong-inventory-sea-new
```

## Subsequent scope decision

Travel enforcement changes simulation outcomes and adds custody/time state and journal
records. Its unshipped prototype exceeded the processing budget and was withdrawn.
Continue with outcome-preserving scan/index changes; additional authoritative writes
are outside this optimization's scope. See `economic-offer-index-check.md`.
