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

Capture, audit-observer and append-encoding failures are sticky recording faults.
They pause through the journal fault callback and reject every subsequent append;
day admission remains closed. Accepted rows retain their exact pending tail and
can still finish persistence unless the writer itself has failed. A writer
failure retains all unacknowledged chunks. `journal.rejected` retains the first
rejected attempt's sequence, phase and context for diagnosis; unsupported input
cannot be promised a durable or replayable encoding. Fault-reporting errors
cannot reopen admission. Legacy encoding follows the same failure rules, while
old archive reads remain independent. Compact readers reject malformed schemas,
indexes, delta bases, field counts and special-value tags.

## Off-thread processing of the shipped journal

The always-on storage journal accepts the same ordered records. Append now captures
owned raw fields immediately, without running JSON or the storage codec. Ordered
key vectors are shared within transport batches; opaque lot handles keep their
complete owned values. Mutable metadata is detached before append returns.

A Blob Worker runs the existing codec, UTF-8 encoding, SHA-256, gzip and IndexedDB
writes. Finished batches use exact native binary transport, transferred during the producing tick, so processing
can overlap an atomic simulation day. The worker processes batches serially and
acknowledges only after one transaction commits both chunk and manifest. Main
retains each sealed binary buffer until its checked acknowledgement; captured object graphs are released. A separate transferable copy preserves fault-tail ownership. Archive format, checksum
chain, canonical readers and tagged export remain compatible; chunk boundaries
can differ. There are no field watches or graph comparisons.

Unsealed capture accounting deliberately overestimates storage; sealed buffers use their retained byte length plus entry overhead. The admission watermark is 16 MiB, with a separate 32 MiB estimated raw batch target. Crossing the watermark
seals a short unfinished batch immediately at the day boundary. A synchronous day
can exceed the watermark: all its records remain accepted, and another day waits
for the worker. This does not establish a strict within-day heap limit. Direct
out-of-band calls must also respect admission. Closing the tab before completion
can lose its uncommitted tail, as before.

Worker/persistence/protocol failures close admission and retain the complete binary/unsealed
pending tail. `records()` and `stream()` combine the acknowledged prefix with that
tail, including uncertain commits without duplicating records. An independently
opened archive reads its actual durable prefix. No uncertain write is retried or
silently moved to another writer. Capture failures retain their rejected context.

`FURLONG_STORAGE_FOREGROUND_AUDIT=true` before boot selects a diagnostic foreground
pipeline. Worker startup failure uses the same explicit foreground fallback;
`FURLONG_STORAGE_LOG.status()` reports `processingMode` and `fallbackReason`.
Foreground mode uses the original OutcomeJournal codec and encoded write path, preserving all records without binary transport.

`node --test tools/storage-worker.test.mjs` exercises a real Node worker running the
embedded browser runtime, with asynchronous atomic IndexedDB fixtures. It checks
exact accepted/durable streams, opaque handles, own fields, special numbers,
BigInt, holes, mutable metadata ownership, immediate protocol faults, backpressure,
injected transaction failure, uncertain acknowledgement and prefix/tail export.
The fixtures establish pipeline semantics, not browser IndexedDB reliability.

`node tools/storage-worker-bench.mjs 131072 baseline` and `... 131072 worker` run
matched owned-handle events in fresh processes. A local run measured producer time
3102→1229 ms and total time 3201→1256 ms; main codec time 2225→0 ms, raw capture
279 ms and postMessage 136 ms. First worker commit occurred at 57 ms during the
producer; baseline first commit occurred after the producer at 3116 ms. Main heap
increase rose 62→127 MB; process RSS increase rose 204→501 MB. All 131,072 records
committed. These are synthetic Node diagnostics; native Chrome world histories,
ordinary-play performance and device memory limits require separate validation.
