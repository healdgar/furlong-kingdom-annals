# River crossings and settlement access

- [x] Quays, service alleys, church paths and ordinary streets cannot generate free bridge spans.
- [x] Existing highways, their identified town spokes and funded road works retain their crossings. A road beside the bank is not a crossing.
- [x] Street graph links and near-end joins cannot cross water without a built highway. The existing graph's node hash also serves construction access queries; no second spatial index is introduced.
- [x] Urban frontage and prospective lanes require a connection to the town. Houses cannot reach their street across unbridged water.
- [x] Rural homes and field hovels require a dry connection through built tracks or the town's existing highways. Unused parcel edges do not grant access.
- [x] Mill wheels face flowing river water outside the pond, preferring the river bank nearest the dam. A stagnant pond alone is not a river-mill site.

Access is checked during layout and construction. No daily walking budgets, new journal receipts, commodity records or maintained spatial indexes are added. Household pantry, hunger and debt tracking are unchanged.

Checks: focused crossing, frontage, rural track, service-door and mill fixtures; the full Node suite; native WebGL coastal/inland rendering, existing funded crossings, injected unpriced quay/lane crossings, mill wheel positions and service-road connectivity. Renderer artifacts remain local under `/tmp/furlong-paid-crossings-*`.

The UI worktree's unfinished river rendering remains excluded. These fixes apply when generating a realm or placing new buildings; existing saved homes are not demolished or households displaced.
