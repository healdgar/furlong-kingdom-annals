# Lossless title-matching optimization

`storageTitles` retains the same claim order, lot order, physical quantities, stable IDs and
outcome records. It does not discard small positive balances or suppress mutations.

An external WeakMap remembers owner/good groups that previously needed no mutation: every lot
was kept whole, no pending-purchase field needed removal, and all claim remainders were exactly
zero. Reuse requires the same ordered claim kinds/goods and bit-exact quantities. Matching skips
only this certified no-op pass; allocation, roundoff checks and coalescing remain in their original
order. The parent still emits every genuine split, title transfer, metadata change and merge.

Every lot outcome invalidates the current, prior and split/merge source owner for that good.
Location outcomes invalidate all certificates. Generic metadata changes participate automatically.
The cache is absent from authoritative ledgers and history snapshots; rebuilding it means starting
without certificates and using the original pass. Canonical mutations must use the recorded ledger
boundaries, as required for complete history. Claim deletion/replacement and chartered timber/char
claims retain the original fallback.

The immutable claim sum is computed once per pass. Tolerance work is skipped only when unmet need
and previously accepted roundoff are both exactly zero. Any positive residual retains the original
checking and recording. No purchase, charity, material-completion or other caller boundary changes.

## Verification

Parent: `40492fc6c0233522c6b8a15dd5cfe71674c12446`.
Tested index.html SHA256:
`d5c03ce093996c0f0c68228f9adf69b9fa0244400a4114369c6778f633db106b`.

```sh
node --test tools/*.test.mjs
node tools/storage-title-check.mjs --baseline 40492fc --seeds 1001:sea,2002:land \
  --days 270 --out /tmp/furlong-title270
```

The native Metal Chrome harness commissions a grange on a fresh map and retains the real compressed
IndexedDB journal. It uses identical explicit 15-day yields, 30-day flushes and 1,024-record chunks
in both sources, replacing the automatic flush timer only in test snapshots. It compares every
chunk's SHA256, all 30-day world/land/geography/history graph hashes, final state and subsequent RNG
draws. Storage quantity/occupancy caches are derived and excluded from graphs; their canonical
ordered lots and all outcome records remain compared. Other existing derived-cache exclusions
follow the performance harness. This establishes the stated schedule, not arbitrary-frame history.

233 Node tests pass, including exact parent event/state fixtures for tiny residuals, pending fields,
future metadata, custody changes, destruction, claim deletion/replacement, purchase and charity.
A 50-owner fixture skips 50 annotations that are all parent no-ops, with identical event streams.
No previously emitted event is omitted. Browser results and limitations are recorded locally under
`.git/storage/2026-10-03/`.

## Costs and remaining work

The day270 sea regression retains all 3,007,505 records, byte-exact chunk hashes and all stable lot
IDs. Inclusive title-matching CPU falls from 8.892 to 6.897 seconds (~22%); complete tick CPU from
36.971 to 35.300 seconds (~4.5%). Sources ran serially on Metal, but other validation processes were
concurrent; these are attribution/sample results, not an isolated throughput guarantee. Timings
include instrumentation, and nested counters must not be summed twice.

An earlier frozen-source audit found day270 alone emitted 378,214 records, largely provisioning,
charitable gifts and reconciliation split/transfer/metadata/merge records. Tagged text and full lot
snapshots produce a large synchronous tail; day-boundary admission does not bound a single day.
This optimization preserves that genuine event stream, so it does not solve the journal-memory
burst. Remaining lossless options are compact schema/dictionary encoding, ordered composite indexes
that preserve each caller's iteration order, and a reviewed resumable simulation/recording boundary.
Skipping positive quantities or suppressing recorded mutations is not an optimization option.

The inland2002 run also passes every check through day270 with all 3,885,726 tagged records.
Title-matching CPU10.239→8.103 seconds (~21% less); complete ticks36.541→34.308 seconds (~6% less),
with the same concurrency/instrumentation limitations. Both worlds retain exact final state and
next16 draws from each of the three RNG streams. No long-run economic-defect clearance is claimed.
