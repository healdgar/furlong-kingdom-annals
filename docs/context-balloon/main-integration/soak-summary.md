# Soak: 4 worlds, 1 years each

2026-10-05T06:15:18.766Z · source SHA256 0ff103ad6ab23ab8736f4ea20a71e86b87096618d02da23cc37ec5145cc91a8e · build build 2026-10-05 05:51 UTC · coastal land mask

| world | land | boot s | AD | pop start→end | places | famine days/place-yr | famine pop share | hunger | tilled/head | money residual/yr | ms/day first→last | checks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| s1001-sea | 89.3% | 3.9 | 851 | 2703→2533 | 12 | 0 | 0.0% | 0.0065 | 0.2207 | 0 | 119.03→119.03 | pass |
| s1001-land | 100.0% | 3.9 | 851 | 2638→2471 | 12 | 0 | 0.0% | 0.0164 | 0.2889 | 0 | 142.33→142.33 | pass |
| s2002-sea | 89.6% | 3.9 | 851 | 3330→3184 | 15 | 0 | 0.0% | 0.0031 | 0.1916 | 0 | 153.11→153.11 | pass |
| s2002-land | 100.0% | 3.9 | 851 | 3396→3227 | 15 | 0 | 0.0% | 0.0058 | 0.202 | 0 | 164.56→164.56 | pass |

Descriptive correlation only; paired seeds and a small sample do not establish causation.

Land share against famine (share of people in famine): r = 0.00 over 4 worlds.

Timing includes instrumentation and deferred land work; tickMsDay in JSON excludes deferred callbacks. Audit years also include the purse census overhead. Drawing scenarios restart from the same undrawn year, then advance at the selected speed; startDay/endDay retain that interval.

Money reconciliation checks every year's residual against 0.01 coin; a net residual alone can hide cancelling errors. The oracle pairs declared prepaid star credits with their synthetic negative lost-account mirror. Missing upstream debits, omitted purses and actual creation/loss still produce residuals.

## Declared prepaid payouts (all worlds; upstream debit must reconcile)

- works: 18,223
- paid: 309
- land: 196
- street works: 196
- carriage: 176

## Where a day's time goes (share of tick time, mean over worlds)

- tickEconomy: 51.0%
- tickPopulation: 23.1%
- tickMarket: 22.5%
- tickProjects: 0.7%
- tickHouseholds: 0.7%
- tickLivestock: 0.5%
- tickGrowth: 0.4%
- tickMilitary: 0.3%
- tickDomains: 0.3%
- tickFolk: 0.2%
- tickThreats: 0.1%
- tickTravel: 0.1%

## Hottest functions (CPU profile, self time)

- (garbage collector): 10.1%
- storageLotHandleUnsafe:3168: 5.7%
- write:13909: 5.3%
- outcomeTransportCapture:13859: 3.9%
- inventoryAudit: 3.1%
- coalesce:3266: 3.1%
- string:13908: 3.0%
- storageTitles:3346: 2.9%
- total:3268: 2.7%
- outcomeTransportSchema:13854: 2.7%
- accessible:3305: 2.6%
- (program): 2.6%
- near:1634: 2.3%
- storageTitleEvent:3318: 2.2%
- keys:3265: 2.0%
- event:3256: 1.9%
- walk:13861: 1.9%
- consumeOwned:3409: 1.9%
- storageInventoryStock:3246: 1.6%
- room:13906: 1.4%

## Fish and provisioning

| world | GPU | fish produced | fish bought by households | fish eaten | high-hunger place-days with a day's fish still in storage |
|---|---|---|---|---|---|
| s1001-sea | ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version) | 23988 | 1038 | 952 | 0 |
| s1001-land | ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version) | 17127 | 617 | 644 | 0 |
| s2002-sea | ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version) | 30303 | 1271 | 1198 | 0 |
| s2002-land | ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version) | 21429 | 1109 | 1139 | 0 |

Boot: s1001-sea 3.9 s, s1001-land 3.9 s, s2002-sea 3.9 s, s2002-land 3.9 s
