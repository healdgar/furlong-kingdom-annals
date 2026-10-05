# Journal duplication investigation

Source: published `19a4f06`, HTML SHA256
`c32cd616ca0420a4f93192d911c48c8dcd6ea16f934b013ef68981db511da31a`.
Fresh isolated hardware Chrome run: seed/fate 1001, sea, year 850,
days 0–30, including founding records. Production source was not changed.

## Findings

205,286 records in 86 durable native-v3 chunks: 39,019,375 raw bytes,
6,681,655 compressed browser-storage bytes. Chunks were copied locally and their
SHA256, framing and sequence bounds checked before offline analysis.

- Strings, ordered key vectors, shared snapshots and packet references already
  deduplicate within each native chunk. Gzip further compresses the stored chunks.
- After ignoring local event sequence, only one entire payload repeated within
  a day. That does not imply an erroneous duplicate: intervening mutations can
  produce the same later outcome.
- 196,857 events carried a lot snapshot. Six top-level event values mirrored
  snapshot fields 1,181,142 times. Removing them requires lossless reader support.
- 42,920 of 44,343 before snapshots equalled the previously observed lot state;
  38,480 already shared the same decoded packet object. The rest includes chunk
  boundary resets and separately captured equivalent snapshots.
- 5,800 metadata events only introduced a default `claimGood` equal to physical
  good. They cannot simply be omitted: own-property shape affects `coalesce`,
  which compares metadata keys; timber/charcoal distinction also requires repair.

## Experiments on the same captured chunks

Each prototype reconstructs the exact tagged event values, property order and
record sequence. Every one of the 205,286 records matched. Neither prototype is
loaded by the game. These are offline encoder measurements, not sim tick timing.

| Prototype | Raw bytes | Paired gzip bytes | Encoder time ratio |
|---|---:|---:|---:|
| Existing native v3 | 39,019,375 | 6,731,004 | 1.00 |
| Sparse packet value deltas | 31,633,415 | 7,097,217 | 2.20 |
| Implicit consecutive row sequences | 37,172,575 | 6,124,042 | 0.99 |

Both gzip columns use the same Node compressor; browser CompressionStream output
has a slightly different size. Encoding measurements warm both implementations,
alternate their order, and repeat each chunk three times in the same process.
Treat small timing differences as noise.

Reject sparse packet deltas: 19% raw reduction, but 5.4% larger compressed output
and 2.2× encoding cost. They retain dictionary state and compare packet fields.

The useful candidate is implicit consecutive journal row sequences. The current
encoder already rejects row gaps. Store the first sequence once in the chunk,
then reconstruct subsequent row sequence as `first + index`. This removes one
nine-byte Float64 write per row after the first: 4.7% fewer raw bytes and 9.0%
fewer compressed bytes in this sample, with essentially unchanged encoding cost.
It needs no model scans, new game writes, value hashing, or cross-chunk state.

## Shipping requirements

This experiment changes the binary framing. Give the new format a version;
retain native-v3 and v1/v2 readers. Validate header/count against chunk bounds,
keep hash chains/atomic writes/fault-tail retention, and test exports, mixed old
archives, malformed packets and accepted-to-durable equality. Run a native
matched replay and timing comparison before making a game performance claim.
The published build and production journal remain unchanged.

## Local reproduction

All files below are local, ignored by Git:

```sh
node tools/soak-results/journal-duplication-2026-10-05/analyze.mjs
node tools/soak-results/journal-duplication-2026-10-05/delta-prototype.mjs
node tools/soak-results/journal-duplication-2026-10-05/sequence-prototype.mjs
```

`capture.mjs` freezes source and launches an isolated Chrome profile. It can be
rerun only after choosing a fresh output directory to preserve these captured
chunks. It never opens or mutates the user's existing game/session.
