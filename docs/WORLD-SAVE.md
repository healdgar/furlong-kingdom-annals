# World save

A world save is the running world itself at a day's end, in one document. Loaded into a fresh realm in place of `startSimulation`, the days go on exactly as they would have in the world that was saved. The classic save (the seed and the ruler's commands, replayed day by day) stays the permanent format; a world save is for the late-world farm (#48), checkpoints (#49) and fast resumes (#6).

Phase A (now): save and load at a day boundary, in Node. The browser worker does not yet use it.

## Use

```js
const doc=await worldSave({source});           // Uint8Array; source: the game script (or sourceSHA256)
const packed=await worldSaveZip(doc);           // gzip (CompressionStream)
// in a fresh realm with the same world hash (#s=..&f=..&c=..&y=.., km, map):
await worldLoad(packed,{source,outcomeJournal}); // then simTick() as usual
worldSaveHeader(doc).header                    // format, version, build, sourceSHA256, world, day, save (the classic save)
```

- `worldSave` refuses a world in prehistory, while replaying, or kept in the old lot ledger (`FURLONG_COMMODITY_BALANCES===false`). It first settles the day's goods (`commoditySettleAll`, journaled as `{k:'settle'}` when anything was pending, as a classic save does) and commits the outcome journal (`STORAGE_OUTCOMES.flush()`).
- `worldLoad` refuses a realm that already has a world, a document of another format version, another build (`code:'build'`), or another realm (`code:'realm'`). The refusal carries `save`, the classic save, to replay instead (`startSimulation` then `replaySave`). It needs a fresh outcome journal (`seq` 0), as `startSimulation` takes one.

## The document

- **Header:** the magic `FURLW1`, a little-endian u32 length, then JSON: format `furlong-world`, version 1, `build` (`buildId()`), `sourceSHA256` of the game script (as `STORAGE_OUTCOMES.begin` computes it), `world` (`worldHash()`), seed, fate, coast, start year, day, AD, realm name, node count, and the classic save without its wall-clock time and camera. The document holds no wall-clock time: saving the same world twice gives the same bytes.
- **Body:** three sections; each starts with its non-integer numbers as eight byte planes, sign and exponent first:
  - the tables: strings (UTF-16 code units as varints), shapes (key lists with property flags), each function's source hash and length, the class names;
  - the makers, the paths of what they make, the binders, the annals' anchor and the node count;
  - the nodes, in the order a breadth-first walk first meets them.
- **Nodes:** object (class, extensible, shape, values), array (generic or dense), Map and Set (entries, then own properties), ArrayBuffer (bytes), typed-array view, function (source hash; an RNG stream's state), Proxy (the old larder, by its place).
- **Values:** a tag byte (undefined, null, booleans, small integers in the tag itself, varint integers, float64, string, node, bigint).

Property order, flags, frozen and non-extensible objects, null prototypes, holes, `-0`, NaN and exact float bits all survive. The encoding is explicit little-endian and spec-ordered, so it does not depend on the engine or the Node version.

## Kept

- `HISTORY.roots()`: W; the globals `SEED`, `FATE`, `COAST_PREF`, `START_AD`, `PID`, `NID`, `armyN`, `campN`, `entryCount`, `JOURNAL`, `MOD`, `allLines`, `REPLAYING`; the playback scalars; the RNG states; each place's layout context.
- Query scratch on world objects (`__hs`, `_popValid`, `_popTotal`), as it stands.
- `ANNAL_META`, `HASH_STAMP`, `RESUMED`, `storageArithmeticNext`, `SIM_FAULTS` (`n`, `first`, `list`).
- Each commodity ledger's private state: volumes, the day's buffers, owners' facilities, row ranks and the next rank (`CommodityBalanceLedger.historyState` and `historyAdopt`).
- Each ledger's spoilage as world data: each good's clock of days of spoilage and its rate (`spoilage`), the crumbs (`crumbs`), the stores left below a crumb today, to be swept out with the next day's spoilage (`sweep`), and on each owner's store of a good at a facility the count it was last settled at (`since`, a non-enumerable property of its Map). A store's quantity today follows from these in closed form (#55).
- Each place's active claim records (`STORAGE_ACTIVE_CLAIMS`): ranks, ready and fallback.
- Each account's view targets, which hold its beasts.
- The outcome journal's `seq`, `chunk`, `committed` and character count.
- Whether the notable and household indexes were in use.

## Made again

No closure is stored. Every function in the world must be one a maker or binder makes, or the save fails and names its path. The loader checks each made function's source against the saved hash.

- **Makers**, run over placeholders before the world is filled:
  - `layoutSettlement(s,saved)`, given a saved context, makes a place's closures over it and lays nothing out: `s._lay`, its `live` operations, its spatial hashes and RNG, the context's `TRADES`;
  - `makeHash(cs)` makes `W.rivHash` and `W.treeHash` (the cell size is kept on `near.cell`);
  - `ownershipLard(s)` makes the old larder's Proxy.
- **Binders**, run on the filled world:
  - `householdFieldsBind` (a member's household fields);
  - `householdHerdBind` (a household's herd);
  - `settlementPopBind` (a place's population);
  - `commodityStoreBind` (a place's stock of a good);
  - `commodityAccountViews` (an owner's held and sale views);
  - `commodityCargoQtyBind` (a cargo's quantity);
  - `furlongRightsBind` and `buildingRightsBind` (property rights).

  The living code calls the same binders; their closures' source text is what it was.
- **Indexes adopted**: notables (`notableIndexRebuild`) and household members (`householdMemberIndexAdopt`), in the mode they were saved in; the ledgers take up their saved private state, with `commoditySpoiled` as the hook that hears what a settled store lost (the save refuses a ledger with another).
- **RS** is seeded again, then each stream restored.

## Left behind

Caches outside the world fill again as they are asked. Each gives what a fresh computation would:

- `ROUTING`, `ARMY_ROUTES.memory`, `MARKET_TRADE_INDEXES`, `SETTLEMENT_DISTANCE_CACHES`, `ARMY_SETTLEMENT_INDEXES`, `HASH_BOUNDS`, `VACANT_RESIDENTIALS`, `HUNGRY_HANDS`;
- the storage walk's memos, `NPOOL`, `LANDV`, `TREE`;
- the ledgers' query caches;
- function statics, the `G` memos (`_seaChart`, `_seaF`, `_landComp`);
- presentation state.

## Verified

`tools/world-save.test.mjs`, on 42 sea and 1001 sea:

1. Plays 37 days in one worker realm and saves.
2. Loads into a fresh worker realm.
3. Requires:
   - the loaded world captures equal to the saved one (`captureExpression()`: world graph with closures' source text, RNG streams, annals, commands, storage journal);
   - saving it again gives the same bytes;
   - every one of 23 more days is the same day in both realms.

On 2026-10-08, 42 sea at day 37 measured:

| Measure | Value |
|---|---|
| Document | 15.6 MB, 7.7 MB gzipped (about 350,000 nodes; non-integer numbers are most of it) |
| Save | 2 s CPU |
| Load | 2.4 s CPU, against about 6 s to generate the world and 6 s to play the 37 days |

## Not yet

- **The browser:** the worker's `init` still resumes by replay.
  - `RawOutcomeJournal` (the worker's journal) is untried.
  - The IndexedDB storage-outcome archive of a loaded world starts afresh (`continuation:false`).
  - The full history recorder (`history=full`) is not carried over.
- **Untried:**
  - closures that first appear later in a game fail the save loudly;
  - worlds past day 60.
- **Size:** coordinates and terrain floats are most of the document; derivable data (tree spots, cached routes) is kept as it is.
