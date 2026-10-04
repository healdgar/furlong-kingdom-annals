# Pooled timber and construction custody repair

The inland seed/fate 1001 baseline first strands charcoal title during a pooled
timber transfer from Pontecala on day 1302. `char` is a legal fuel claim backed by
physical timber. `moveStock` moved every physical timber lot, including charcoal
lots, but moved only `held.timber` claims. Charcoal claims stayed at the origin.

Before the transfer, physical timber was 406.92595112042716; afterward it was
367.72752530853126. The transferred fraction applied to the 41.98288601417815
charcoal claims is 4.04413392231434: exactly the excess found by the baseline
storage check on day 1303. The repair transfers both held claim kinds with their
existing lots. Existing custody transfers do not complete unrelated pending
purchases at the receiving settlement.

Six construction purchase boundaries also removed requested pooled material
rather than what the buyer actually acquired. New/rebuilt houses, castle/church
stonework, stone walls and house upgrades now install `purchase.got` from that
buyer's pending lots. A buyer able to afford two units of a requested four
installs two; the remaining seller stock and another buyer's pending purchase
survive. An unfunded buyer consumes nothing. The non-lot fallback also consumes
only the purchased quantity. Tiny positive quantities are retained.

Legacy work progression still permits partial local supply. This patch changes
physical/title/payment correctness without adding a new construction stall or
rewriting existing life/history details. New seed outcomes can differ because
unbought material survives. It is a correctness revision to the storage engine
version 2 baseline, not a schema migration or continuation guarantee.

Unpurchased pooled stone draws remain in the low-level first/wider wall, wharf,
citadel, wall-project, wall-repair and paving paths. Those use a different legacy
communal-work model and are unchanged here; this repair does not prove their
payment semantics.

Focused tests cover affordable/unfunded purchases, specific buyer custody,
positive tiny balances, non-lot behavior, charcoal transfer and unrelated pending
receiver purchases. Mature probe evidence uses an intentionally volatile event
sink to locate first corruption quickly. It does not establish durable-journal
correctness or full long-duration clearance; integrated durable soaks must be
rerun against their exact source hash.

A fresh immutable-baseline probe wrapped the complete `moveStock` transaction:
first permanent violation is day 1302, combined claims 371.7716592308457 against
physical 367.72752530853126, with no caught simulation errors. The earlier
inside-`offer` trace includes an intentional transient while the pooled transfer
is in progress; it is not the permanent-defect boundary. Baseline source SHA256
is `0e2054a57172acc644701c9f0781a93a834e584422b70dcbd33ca910cc5c394a`.
Evidence remains local in `.git/storage/2026-10-03/inventory/inland-permanent-baseline`.
A controlled fixture reuses the observed mature physical/charcoal quantities and
proves both settlements' title and physical conservation after repair.

The candidate source
`323c095e5c31992727aa57aabcbbac4e91e60ecde002f84f853a172adcee16c7`
completed a fresh seed/fate 1001 inland fast-sink probe through day 1440,
including the original day-1302/1303 boundary: no Pontecala combined timber/char
overclaim and zero caught simulation errors. Evidence is
`.git/storage/2026-10-03/inventory/inland-repair-candidate`. This targeted probe
does not establish all-world inventory matching or durable outcome persistence.
All 235 Node tests pass, including nine new material/custody regressions.
