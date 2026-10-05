# Central inventory investigation

Gameplay remains at validated commit `19a4f06`; this report adds no engine code.
The grain authority prototype is abandoned and preserved locally under ignored
`tools/soak-results/grain-authority-2026-10-04/abandoned-source/`.

## Findings

Physical inventory already lives in town StorageLedger lots with owner, good,
quantity, location and availability. Held/sale accounts separately express legal
claims; purchases, production and movement currently update these representations
at different boundaries. Replacing balances with getters requires rewriting those
boundaries to prevent double consumption, double credit and custody reassignment.
The intended future design is one authoritative quantity, with household, building
and town views that reflect the same immediate mutation.

A bounded grain-consumption adapter retained those claim balances. Seven focused
checks passed. A fresh 30-day sea scenario (seed/fate 1001, year 850) matched
accepted journals, physical storage snapshots and RNG against `19a4f06`. It
recorded the same 205,286 journal events. Profiled throughput was effectively
unchanged (candidate/baseline 0.996). Broad model fingerprints differed at some
boundaries; the adapter intentionally skipped warming derived total caches, but
complete normalized graph equality was not established. It did not achieve the
single-authority design and is not included in production.

The subsequent authority generator was unfinished: its first runnable build
failed function extraction for a generator function. No complete candidate,
end-to-end validation or speed claim exists. Neither experiment was deployed.

## Browser database query check

A separate fresh native-Chrome run used actual day-30 household grain data:
1,659 rows, 894 owner/settlement groups. Five rounds of 256 identical quantity
queries compared indexed in-memory groups with a compound IndexedDB index.
Each IndexedDB round used one readonly transaction; setup was excluded. Both
methods returned the same quantities. In-memory rounds measured 0–0.1 ms;
IndexedDB rounds measured 3.3–3.8 ms. Sub-millisecond readings have timer limits.
This is a query microbenchmark, not a whole-game comparison or an SQLite test.

Use in-memory indexed records for immediate hot-path mutations and the existing
durable database for journal persistence unless a matched engine benchmark shows
otherwise. IndexedDB asynchronous transactions and structured cloning are
specified in [the browser database documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Local evidence: `tools/soak-results/grain-ledger-baseline30-2026-10-04/`,
`tools/soak-results/grain-ledger-pilot30-compare-2026-10-04/`,
`tools/soak-results/grain-authority-2026-10-04/`, and
`tools/soak-results/grain-database-probe-2026-10-04/`.
No unfinished adapters or tests belong in the production source tree.
