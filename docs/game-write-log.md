# Direct game history prototype

The playable game still uses the validated native v3 storage journal. The tools
here develop broader game coverage; they are not loaded by `index.html`.

The intended contract is a founding graph snapshot followed by ordered effects
at actual write sites. Existing graph branches are not scanned or compared after
founding. New referenced data receives a stable identity once. Reading the log
later reconstructs state and can derive undo information and indexes.

`game-write-transform.mjs` lowers supported member/cell writes and contracted
native mutations. `game-write-log.mjs` captures their precise effects, including
collection order, descriptors, array holes, shared buffer bytes and references.
`game-write-game-config.mjs` inventories actual game roots, private state and
facades. The local build tool pins source, generated code, parser, runtime,
configuration and mutation manifest; unresolved contracts reject production
admission. The vendored MIT Acorn parser requires no installation or network.

Run all checks with `node --test tools/*.test.mjs`. Inspect the unresolved source
inventory locally with `node tools/game-write-build.mjs index.html --audit`.
Without `--audit`, the game build intentionally fails until coverage is complete.

Architecture checks measure work rather than wall-clock thresholds: an isolated
write cannot enumerate untouched model branches; appending one life event cannot
copy existing history; one terrain write captures only that element's bytes;
the default journal cannot run canonical codecs; failed admission retains the
exact rejected outcome and prevents later canonical writes. Production household
paths are transformed and replayed against independent backing-ledger comparisons.

The prototype does not yet cover all private planner/RNG cells or recreate all
source-defined ledger views and closures. Household tests compare canonical
backing data, not the dynamic `_lard` Proxy projection or executable callback
hydration. Full-game snapshot-plus-log continuation and rewind remain unverified.
No performance improvement is inferred from fewer records or these unit checks.
