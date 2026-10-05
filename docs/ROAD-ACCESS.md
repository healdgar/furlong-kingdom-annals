# River crossings and settlement access

- [x] Quays, service alleys, church paths and ordinary streets cannot generate free bridge spans.
- [x] Existing highways, their identified town spokes and funded road works retain their crossings. A road beside the bank is not a crossing.
- [x] Street graph links and near-end joins cannot cross water without a built highway. The existing graph's node hash also serves construction access queries; no second spatial index is introduced.
- [x] Urban frontage and prospective lanes require a connection to the town. Houses cannot reach their street across unbridged water.
- [x] Rural homes and field hovels require a dry connection through built tracks or the town's existing highways. Unused parcel edges do not grant access.
- [x] Mill wheels face flowing river water outside the pond, with pond-fed mills immediately downstream of the dam. A short timber flume feeds an overshot wheel when the head exceeds three-quarters of the context-fitted diameter and reaches the upper rim; otherwise it feeds an underfed wheel. Bank height and building clearance bound diameter. Rotation follows the water at the active blades, and discharge returns to the river. Sites without a downhill feeder are rejected. A stagnant pond alone is not a river-mill site.

Access is checked during layout and construction. Service planning tries at most twelve distinct streets; repeated highway samples cannot monopolize those attempts. Inaccessible mill sites remain unbuilt. Race geometry is batched into two shared meshes. No daily walking budgets, new journal receipts, commodity records or maintained spatial indexes are added. Household pantry, hunger and debt tracking are unchanged.

Checks: focused crossing, frontage, rural track, service-door and mill fixtures; the full Node suite; native WebGL coastal/inland rendering, existing funded crossings, injected unpriced quay/lane crossings, mill wheel positions and service-road connectivity. Renderer artifacts remain local under `/tmp/furlong-paid-crossings-*`.

The UI worktree's unfinished river rendering remains excluded. These fixes apply when generating a realm or placing new buildings; existing saved homes are not demolished or households displaced.
