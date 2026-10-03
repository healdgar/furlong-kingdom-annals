# History recording

Life ledgers now retain every recorded event, including prehistory and mercenaries.
Death and archival preserve the ledger. Person cards display the entire ledger.
The simulation still archives other working fields at death; this change does
not make those fields available in existing seed/command saves.

## Experimental snapshot/log archive

Append `&history=full` to a world URL to audit the recorder. The flag is read
before boot normalizes the URL. It is deliberately off by default: exhaustive
graph scans are too expensive for normal fast-forward.

The founding snapshot precedes prehistory. Ordered, reversible changes cover
simulation days, wrapped player commands, settings, deferred tracks/fences,
boot completion, input boundaries and frames that advance the simulation.
Life and annal events include prehistory. The archive contains:

- World fields, household accounts, ownership, inheritance, people and kinship.
- Land parcels, masks, flood state, tree records, spatial hashes and tracks.
- RNG states and town-planner contexts, including their private spatial maps.
- Stable object identity, cycles, Map/Set order, property descriptors and exact
  typed-array bytes. Binary changes use 4096-byte pages.
- Source identity, sequence numbers and both sides of each changed node.

Accessors are never invoked by capture: some allocate inventory when read.
Graphics handles and executable behavior become inert metadata on import.
Shader distance fields, meshes, labels and other reconstructible GPU state
are excluded. The authoritative land mask and construction records remain.

Storage is browser-local IndexedDB, with gzip-compressed chunks. A recording
failure pauses the simulation and blocks another day. Unwritten chunks remain
in memory and are included in export after a storage failure. Browser eviction,
an abrupt process exit or navigation before pending writes finish can still
lose an uncommitted tail. `pagehide` is a best effort, not a durability guarantee.

Local developer API:

```js
FURLONG_HISTORY.status()
const archive = await FURLONG_HISTORY.export() // waits for pending commits
await FURLONG_HISTORY.download()              // local .json.gz file
const reader = FURLONG_HISTORY.open(archive)
const founding = reader.seek(0)
const last = reader.seek(archive.steps.length - 1)
```

`seek` reconstructs archived data. It does not replace the running engine.
Old Save/Resume remains the seed/command format. The new archive deliberately
has `continuation: false`; loading executable closures or evaluating code from
a save file would be unsafe and insufficient to restore the engine correctly.

## Coverage and remaining work

This is a validated foundation, **not a claim of 100% complete engine replay**.

1. Replace full graph scans with mutation logging; retain the independent
   state comparison in tests as a coverage audit. Constructor/local-reference
   escape paths, typed-array writes, Map/Set operations, accessors and deletions
   must all be covered before removing the audit.
2. Record intra-day outcomes which disappear before a transaction finishes.
   A daily state delta alone cannot recover every intermediate decision.
3. Complete the mutation-boundary audit. Paused-frame effects and arbitrary
   direct writes outside wrapped operations may wait until the next capture.
4. Add versioned engine hydration for ownership views, accessors, planner
   closures and pending petition actions. Then verify fresh-browser resume and
   continued simulation against a control. RNG hydration alone is insufficient.
5. Add durable checkpoints, efficient seeking, browser-restart recovery,
   bounded archive export, storage-management UI and explicit timeline forks.

Fast-forward can postpone graphics construction, keeping only the latest dirty
version. Economic land area, legal ownership, crops, building layouts, collision
and routing inputs must remain current. `buildTracks`, `rebuildDetails` and
other mixed functions need their simulation effects separated from projection
work before they can be deferred safely.

## Validation

Tested `index.html` SHA256:
`2605816afdb024e49898c55917d7d93df0c419408e0217cffc90f8aa29277170`.

- 97 focused tests: ownership/inheritance, provisioning, routing, source,
  advisor, uncapped lives, exact graph reconstruction, byte-page changes,
  atomic capture failure, corruption/sequence checks and RNG restoration.
- Native Chrome/Metal M4 Max: sea seed 1001 and inland seed 2002, day-by-day
  archive reconstruction with an independent descriptor-based oracle, seeking
  both forward and backward, JSON import, nonzero render calls and no errors.
- Injected IndexedDB failure: pause, no further day, downloadable unwritten tail.
- Normal mode: two years per world compared with `b987c6c`; annual world hashes
  and next 16 draws of all three RNG streams match. The comparison deliberately
  excludes `ev` and the new private `historyCells` adapter; all other fields
  considered by the existing performance harness remain included.

An isolated 12-day timing run, excluding initial snapshot persistence, measured
162–192 ms per capture, normally twice per day; gzip 13–15 ms per flushed batch;
IndexedDB commits 3–4 ms per batch. Commit latency is a browser measurement,
not a physical drive benchmark. Capture dominates. Do not use the overlapping
verification runs to make throughput claims.

Local evidence: `.git/history/2026-10-03/`. These are short history tests and
two-year normal-mode comparisons, not long-run release clearance. The existing
global money-ledger reconciliation defect remains outside this change; focused
ownership and food/money tests pass.
