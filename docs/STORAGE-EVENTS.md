# Independent storage event replay

`node tools/storage-event-check.mjs OUT SOURCE_HTML DAYS SEED sea|land` copies
and hashes the selected source, boots isolated hardware-GPU Chrome, and steps
whole days. Accepted storage events alone reconstruct all lots and locations
from empty ledgers. Each day compares every own data field against a separate
live-descriptor walk, including metadata and property presence. It never calls
`lotState`, `locationState` or `storageRecordState` for its actual-state oracle.
Owner/building references use stable identities; other values retain undefined,
nonfinite numbers, negative zero, array holes and additional array properties.
Reserved-looking metadata keys are escaped independently.

After daily checks, the harness flushes the journal and replays persisted
`STORAGE_OUTCOMES.records()` in batches of 1,000 records, again from empty
ledgers. It checks contiguous per-settlement sequences, unique live lot IDs
across settlements, and exact final state. Evidence includes source identity,
GPU metadata, accepted and persisted events, latest live state and result.
Boot timeout, simulation errors, malformed sequences or field differences fail.
A backpressure retry does not advance the day counter. This is correctness
instrumentation and makes no performance claim.

Ten fixtures cover metadata changes, missing/extra fields, location changes,
missing/reordered events, cross-settlement identity, unusual values and arrays.

Frozen integration source SHA256
`0e2054a57172acc644701c9f0781a93a834e584422b70dcbd33ca910cc5c394a`
passed sea seed/fate 1001 through day 60: 462,431 accepted storage outcomes and
462,432 persisted records reproduced 12 ledgers, 4,147 lots and 131 locations.
The additional persisted record is the journal begin marker. All daily own-field
comparisons passed. Local evidence is in the primary repository's
`.git/storage/2026-10-03/inventory/storage-events-final60`.

This establishes event completeness for lots and locations in this bounded
sequence. It does not establish world hydration, project-state replay,
long-duration behavior, economic conservation or semantic correctness of each
transaction. Independent inventory and money audits remain necessary.

The final batched-replay harness also passes the same frozen source through day
10: 53,212 accepted outcomes and 53,213 persisted records, 2,129 lots and 51
locations. Evidence is `storage-events-stream10` beside the 60-day evidence.

## Compact outcome chunks

New journals default to metadata version 2 (`compact-storage-v2`). Each physical
chunk starts fresh schema, string and snapshot dictionaries. Ordered own keys,
exact numbers and metadata remain in the encoding; lot/location snapshots and
unchanged primitive envelope fields use exact deltas. No storage outcome is
removed. Chunk checksums, predecessor links, sequence checks, fault retention and
day-boundary backpressure remain mandatory. Readers accept legacy version 1
chunks as well. `records()` returns the original canonical event or transaction
envelope; `storageRecords()` flattens transaction storage effects for independent
physical replay. The exported `stream()` remains tagged JSONL with expanded
records; `meta.encoding` describes stored chunks, not export lines.

Set `window.FURLONG_REPLAY_LEGACY_AUDIT=true` before boot to select the legacy
encoder and canonical engine captures. Otherwise engine snapshot handles own
ordered copied values synchronously. Their dictionaries/caches live outside
`W`, `G` and storage ledgers. Public `lotState()` and all readers return canonical
plain snapshots. Primitive-only captures are reusable only when every own key,
key order and resolved value matches; nested metadata always receives validation
and a fresh detached copy. Unsupported values/accessors remain errors.

Correctness harnesses install `window.FURLONG_STORAGE_AUDIT_OBSERVER(event)`
before boot when `FURLONG_STORAGE_AUDIT_SUPPORTED` is available. The dispatch
calls `storageObserveOutcome(event)` once before collecting a primitive. Its
callback receives a detached canonical event, independent of internal handles;
callback mutations cannot modify retained records. Ordinary production recording
performs no canonical expansion. Transaction collectors may retain handles
unchanged until append. They must never replace this observer with a primitive
hook that reads internal snapshot handles directly.

The codec's focused checks cover independent chunks, legacy reads, exact
property order/presence, tiny values, negative zero, nonfinite numbers, BigInt,
array holes/additional keys, nested storage-shaped metadata, rollback after an
invalid append, transient changes, writer failures and observer isolation.
These checks establish codec fidelity; native whole-game performance and replay
must be measured separately on the integrated source.
