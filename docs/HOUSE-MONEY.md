# Noble house reserves

Generated noble strongrooms now receive their existing `800 * (wealth || 1)` reserve during `makeHousesAndCast`, before any live receipt, payment, or money baseline. The crown remains represented by `W.treasury`. Existing zero, negative, and positive balances are preserved. A missing live noble purse in `tickDomains` raises an error rather than creating unaccounted money.

Previously generated houses had no `gold` field. An early payment created a small balance and bypassed the reserve; an untouched house instead received the reserve during monthly domain processing. This was an actual delayed mint, not an omitted census purse or prepaid-flow classification issue.

## Reproduction and validation

Seed 2002, sea, day 20, `tickDomains`: original parent `9753322dea76eeca750a928e9133cf38d17f211d` produced residual `+741.6212972253383`; integrated source SHA256 `17c151b8e976e833cdd60a990a5de94860a03bc8313111eb4424efead2beacef` produced `+741.6212972253584`. House Gamsburg lacked a purse and its wealth `0.9270266215316951` generated exactly `741.6212972253561` coins. Ordinary same-phase payments explain its lower ending purse; they do not explain the world surplus.

The repaired seed 2002 sea world completed 360 days with no phase money violation or simulation errors. The unchanged oracle checks six money-mutating phases and retains its `0.01` threshold and prepaid mirror accounting. Seven focused regressions cover initial reserve, subsequent transfer conservation, zero/debt preservation, one-time initialization, crown exclusion, and rejection of live initialization. All 250 Node tests pass.

Evidence is local under `.git/storage/2026-10-03/inventory/domain-money-{original,frozen,repaired}` and `domain-money-tests.txt`. This one-world, one-year check does not establish multi-seed mature-world correctness. Initial money and ensuing economic outcomes intentionally differ from the buggy baseline; no history or life records are removed.
