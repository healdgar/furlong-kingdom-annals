# Food replenishment — 2 October 2026

This report records the earlier, food-only fix at source hash `f5b61c…`. The subsequent [household ownership implementation](HOUSEHOLDS.md) supersedes its communal-larder architecture; the measured before/after cohort below remains evidence for that earlier fix, not a forecast for the ownership refactor.

Households bought a month's food on their town's monthly market day. When growth, migration or lost stocks exhausted that larder early, `tickPopulation` recorded hunger even when food remained for sale and households could afford it. Population consumption also preceded the monthly market, so a shortage could trigger famine immediately before that day's scheduled purchases.

`topUpFood` now buys the missing portion of today's meal before consumption. It first takes each household's own stock, then clears purchases of the cheaper available food and substitutes the other food for any remaining shortfall. Existing money, bread-credit limits, seller reservations and grain retained by other farming households still constrain purchases. No food is given away or money created.

New grain and fish are offered by their producers before an extra purchase; physical food and ownership are reconciled for spoilage. This draws only food from accumulated output, leaving other goods for the usual monthly market. The monthly household, craft and price reckonings continue.

## Direct reproduction

Native Chrome replayed coastal seed 688673834 through day 132 with the original source. Two identical histories then advanced to day 133; one used the original functions, and one replaced only the four changed provisioning/population functions before advancing.

Port-Neuf began both comparisons with 133.048 people, 1,100.152 grain, 883.058 fish and only 0.428 purchased grain. Its daily net need was 1.329; household purses held 756.441 coins in total.

| After population consumption | Original | Fixed |
|---|---:|---:|
| Hunger | 0.678002 | 0 |
| Grain remaining | 1,099.724 | 1,098.854 |
| Fish remaining | 883.058 | 883.027 |

The extra purchase conserved realm money to floating-point precision (3.6e−12 coin difference). This isolates the provisioning defect without attributing later divergent histories to one mechanism.

Local replay outputs: [original](../tools/soak-results/provision-replay/baseline.json), [fixed](../tools/soak-results/provision-replay/fixed.json). The replay script and source hashes are retained beside them.

## Twenty-year comparison

Five seeds (`688673834,1001,2002,3003,4004`), each coastal and inland, completed AD 850–870 in native headless Chrome 154 on the Apple M4 Max Metal GPU. Node was 25.2.1. Famine exposure is famine-flag people-days divided by total people-days.

| Metric | Original | Fixed |
|---|---:|---:|
| Coastal famine exposure | 3.18% | 0.74% |
| Inland famine exposure | 2.93% | 1.44% |
| Overall famine exposure | 3.05% | 1.09% |
| Overall mean hunger, weighted by people-days | 0.0638 | 0.0284 |
| High-hunger place-days with a day's fish still stored | 24,988 | 10,844 |
| Fish eaten by residents | 602,080 | 723,114 |

Aggregate famine exposure declined by about 64%. This is a descriptive ten-world comparison, not a guarantee for every seed: inland seed 4004 increased from 2.40% to 2.75%. Hunger, purchases, deaths, famine events and subsequent random draws change histories; differences in population, settlement counts and later timing follow from those changed histories.

Remaining hunger can reflect inability to pay or borrow, food retained by other owners, seller prices, and genuine shortage. The fix addresses failure to replenish between markets; physical stores alone do not establish that every household can obtain food.

All ten fixed worlds completed without recorded simulation errors, nonfinite population or money, extinct realms, or excessive wall ratios. Annual money-flow reconciliation still fails in both cohorts. The first 120 days' audit shows no population-phase reconciliation discrepancy after this change; the pre-existing domain, project and garrison discrepancies remain. The run therefore exits nonzero despite completing every world.

The extra market work increases population-phase cost (12.1% of measured tick time in the fixed cohort versus 3.2% originally). Final places range from 15 to 124 versus 13 to 89 originally; therefore total timing differences also include changed realm sizes. This is a correctness fix, not a performance improvement. Profiles are retained for future optimization.

Local evidence: [fixed summary](../tools/soak-results/provision-final-20/summary.md), [original summary](../tools/soak-results/provision-baseline-20/summary.md), [weighted calculations](../tools/soak-results/provision-final-20/comparison.json). Frozen source hashes are original `da2f5569408bccf4dec95b0d1f88f320229fef62797f0e2f21d459695a33389f` and fixed `f5b61c00e0805588288809d57b16532a526d3d5211717aaaaa1afd54d146a6b5`.

## Checks

```sh
node --test tools/provision.test.mjs
node tools/soak.mjs --seeds 688673834,1001,2002,3003,4004 \
  --coast sea,land --years 20 --par 6 --profile 20 --audit 120 \
  --out tools/soak-results/provision-final-20-new
```

Fourteen focused tests cover an exhausted larder after growth, fish/grain substitution, penniless producers' own food, inability to pay, funded and exhausted credit, craft fees and the lord's payment limit, other farmers' grain reserves, ownership of new catches, spoilage, fair allocation of scarce food, and avoiding purchases when the larder is sufficient. Eleven defect cases fail against the original source; all fourteen pass against the fixed source. Unrelated rendering, land and political systems are stubbed in these tests; complete-world runs exercise them together.

A separate animated smoke run exercised realm and street views at maximum speed on the Metal GPU, advancing both from AD 850 to AD 855 without recorded errors. [Drawing measurements](../tools/soak-results/provision-render-smoke/s688673834-sea.render.json) are retained; this was not a matched before/after performance comparison. Its zero-year annual summary does not measure famine or money.

The 200-year soak was interrupted when work was redirected to this fix; neither cohort establishes long-term calibration. The change is isolated on `codex/provisioning`, based on `36648d5`, in `/Users/alexwall/.codex/worktrees/provisioning/furlong-kingdom-annals`. Integration status and final ownership validation are recorded separately in the local worker handoff.
