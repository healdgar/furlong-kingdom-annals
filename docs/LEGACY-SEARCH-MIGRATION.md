# Legacy search audit

Run from the repository root:

```sh
node tools/legacy-search-audit.mjs > /tmp/furlong-searches.json
node --test tools/legacy-search-audit.test.mjs tools/legacy-search-gate.test.mjs
node tools/legacy-search-gate.mjs
```

The report lists functions, absolute `index.html` lines, scan patterns, loop
nesting, and callers. It uses the local vendored JavaScript parser. Nothing runs
in the game; no simulation writes, indexes, or journal records are added.

The tests reject new or increased recognized scans relative to
`tools/legacy-search-inventory.json`. Reduce that inventory when a migration
removes a search. Existing inventory entries identify pending work, not approved
architecture. Do not refresh the inventory merely to pass a failed test.

The stricter migration command intentionally exits **1** while these reviewed
transaction searches remain:

- [ ] `borrow`: household lender search per credit request.
- [ ] `buildWorks`: repeated construction/carriage worker rosters.
- [ ] `commodityExposed`: unscoped commodity row materialization.
- [ ] `commodityFacilities`: daily whole-building reconciliation.
- [ ] `storageRoute`: street signature reconstruction per route lookup.

At source `0626f4e`: **11 unresolved transaction sites**, **291 scan sites**
across the full inventory. Necessary one-pass updates also appear in the report;
these counts do not measure defects or CPU cost.

Coverage includes `heads_`, `workers_`, `headsOf`, iteration of `folk`, `_owners`,
`buildings`, and `streets`, simple aliases, and unscoped `.entries()` calls.
Dynamic dispatch, destructured/parameter aliases, computed property names, and
index-loop bounds require manual review. The call graph resolves top-level
named functions and collection callbacks; it is not a complete runtime graph.

Separate from these searches, failed warehouse completion repeatedly invokes
road pathfinding. The native two-year profile at `0626f4e` attributed about 84%
of year-two CPU time to that placement path. Review site access and completion
retry behavior before adding search structures.
