# Household ownership

A household has a stable `hh…` identity, members, a head, an account, a home, debts and creditor records, population cohorts by community, and daily hunger. Changing its head preserves the account. Personal health, age, skills, kinship and careers remain individual.

Each community keeps an owner inventory indexed by the household or institutional account. `held` is bought/retained stock; `sale` is stock offered on the market; `reserve` records minimum prices; `animals` is the owner's local byre. All game goods use this ownership model. Inventory quantities exist once: market Maps are views of the owner inventory. Purchases move quantities from offered stock into the buyer's intended use; carriage moves purchased stock or offered stock with its owner. Remote holdings retain their location.

Legacy head fields (`w`, `herd`, `bh`, debt and economic counters) project the household account. Only the head exposes the purse, preventing duplicate censuses. Account transfers to another member still reach the household. `s._lard` is an aggregate compatibility view, used for reconciliation and diagnostics; households eat from their own inventory. The town's physical `stores` remain a custody cache for production, shipping, construction and shocks. Output may briefly be pending in `_made`; it is assigned before consumption. Spoilage reduces pending output and every owner's claims together.

Food is replenished daily if necessary, subject to ownership, actual payment, credit limits, reservation prices and retained grain. Milk/meat food and fleece belong to the byre owner. Homespun consumes the family's own wool; workshops consume their buyer's inputs and own the output. Winter fodder belongs to its owner: one family's full haystack cannot conceal another family's shortage. Relief is explicitly distributed by population and hunger. The hall's pantry belongs to the great house and feeds its own table.

The community's population is the sum of household cohorts. Daily births/deaths use each household's hunger; community hunger and food fulfillment are population-weighted household aggregates. Community prosperity responds to these aggregates. Existing plague, recruiting and migration code adjusts the aggregate through a compatibility setter that distributes changes over cohorts. The named parish roll remains a periodically reconciled projection of continuous population, not a second stock of people. New places without a named roll have an explicit cohort, provisioned by the local lord until named households arrive.

## Household transitions

Marriage merges independent accounts, inventories and debts. A dependent child receives a modest parental portion, not the parents' entire purse. Adult household formation creates a new account; inherited land/building rights follow their beneficiary. A full household move preserves its identity and carries purchased goods and animals; offered goods and land remain at their physical location. An individual departure receives a proportional share of movable stock and obligations. A bridal move includes resident dependents; a levied child is not copied from an army into the parish.

## Inheritance

There was no single medieval rule for every region, century, tenure and kind of property. The game's common-household model distinguishes:

- **Land and buildings:** existing cultural presets remain eldest-son or partible succession. Minors can inherit; descendants represent a deceased child. Daughters, near kin and a surviving spouse prevent automatic escheat. `s.custom.land` can specify `eldest`, `partible` or `youngest`. Strip/building identifiers allocate indivisible properties; this is approximate apportionment, not a division of every plot by area/value. Land records retain a household owner and a named beneficiary; work/occupation is separate. Superior lordship and tenure remain separate existing rights.
- **Widow use:** land held by an heir retains the widow's lifetime dower share of family crop proceeds. The default is one third and can be overridden. The household home survives a head change.
- **Movables:** debts are settled before division. Insolvent estates transfer chattels in kind at local prices; unpaid debt is recorded in the estate, not imposed as personal debt on minor heirs. English households from AD 1180 use widow/children/soul thirds (halves where widow or children are absent); elsewhere the default is a simplified widow/kin division. Kin sharing one household receive their combined shares in that account. The soul share goes to the parish, with the lord/crown as institutional custodian if no parish exists. `s.custom.movables` can override the preset.
- **Servile holdings:** a default heriot transfers one best beast to the lord. It does not seize the entire household stock. This can be disabled with `s.custom.heriot=false`.
- **Natural children:** paternal land eligibility follows local custom; the Celtic/Welsh preset permits it, while maternal rights remain. `s.custom.naturalLand` can override this. The pedigree is treated as acknowledged paternity; the game does not model a separate recognition lawsuit.
- **Guardianship and later payments:** a minor household retains its holdings and a guardian reference. Debts subsequently repaid to a dead lender follow that person's estate shares. Extinct/merged accounts retain successor references for outstanding transactions. Noble titles and institutional coffers continue through their existing dynastic systems.

These are explicit game abstractions. The kin default, uniform heriot/dower defaults, regional culture presets, guardianship management and in-kind debt settlement do not purport to reproduce every medieval jurisdiction or procedural law. The simulation does not yet distinguish individual trusts or testamentary bequests within a co-resident household's common purse.

The historical distinction between inherited land and movable chattels, creditors' priority, and late-twelfth-century English widow/children/soul shares follows the [Magna Carta Project's Clause 26 commentary](https://magnacarta.cmp.uea.ac.uk/read/magna_carta_1215/Clause_26?com=aca) and [Clause 27 text and commentary](https://magnacarta.cmp.uea.ac.uk/read/magna_carta_1215/Clause_27?com=aca). Early Welsh equal division among acknowledged sons, including natural sons, is described by [Oxford's Medieval Welsh Law](https://academic.oup.com/reference/62978/reference-article-abstract/565162571) and the [Open University's early Welsh law account](https://www.open.edu/openlearn/history-the-arts/introduction-law-wales/content-section-1.1). Cultural presets outside these examples are inherited simulation conventions, not independently validated national legal codes.

## Validation

```sh
node --test tools/source.test.mjs tools/provision.test.mjs tools/ownership.test.mjs
node tools/ownership-replay.mjs tools/soak-results/replay-new
node tools/soak.mjs --seeds 688673834,1001,2002,3003,4004 \
  --coast sea,land --years 20 --par 5 --audit 120 \
  --out tools/soak-results/ownership-new
node tools/soak.mjs --seeds 688673834 --coast sea --years 0 \
  --render 0 --devices laptop --cpu 1 --speeds 5 \
  --out tools/soak-results/ownership-render-new
```

The focused tests execute actual ownership, market, population and inheritance functions; unrelated rendering/politics are stubbed. The browser tools use native Chrome, Metal on this Mac, and reject software rendering. Simulation remains JavaScript on the CPU; rendering uses the GPU. Each run freezes the source and records hashes. Results are local and ignored by Git. Seed/journal saves rebuild these accounts by replay; old saves retain their format but may unfold differently under changed economics.

Realm-wide money reconciliation still fails on baseline defects, including initial lord wealth without a flow entry and prepaid wages mislabelled as minted money. The harness now completes initial household registration before its baseline census and counts any remaining unmigrated purse. It does not relax the reconciliation threshold. Passing ownership fixtures or a replay is not a clean realm-wide monetary audit.

### Recorded results — 2 October 2026

Final `index.html` SHA256: `7dab1670f07749f01c331b996fe41b23719e0d6613661ff96f5c3bf6487f3dac`.

- All 58 source, ownership, inheritance and provisioning tests pass. Log: `tools/soak-results/ownership-tests-final.txt`.
- Exact-source native Chrome save/resume replay agrees at day 360 for household identity, membership, heads, cash, debt, population and local held/offered/animal inventories; zero simulation errors. Evidence: `tools/soak-results/ownership-replay-final/result.json`, `before.json`, `after.json`.
- Exact-source ten-world, five-year matched sea/inland soak completes with no simulation errors, NaN money or invalid population; the realm and wall checks pass. Every world still fails the unchanged global money reconciliation check. Evidence: `tools/soak-results/ownership-final-5/summary.md` and yearly JSONL.
- Exact-source animated realm and street smoke checks at speed 5 pass on Apple M4 Max Metal: finite frames and population, zero simulation errors. Evidence: `tools/soak-results/ownership-render-checked/s688673834-sea.render.json`. These are correctness checks, not a performance clearance.
- The preceding source `9656f00c9836a8c669f5591d847a37924a41a5b2ba35e4e2a2ab8e634a5510da` completes all ten matched worlds for twenty years with the same result: no simulation errors, global money reconciliation fails. It includes the bridal/army duplicate-person correction but predates three final changes: same-day household census invalidation, fresh person lookup for new property owners, and monthly provisioning to the unnamed cohort's own pantry. Focused regressions and the final five-year cohort cover those three changes. Evidence: `tools/soak-results/ownership-release-20/summary.md`. This is not a twenty-year validation of the final source.

The older `ownership-final-20` run is superseded: it exposed the bridal/army duplicate-person bug and is retained as failure evidence. The earlier food-only comparison in `PROVISIONING.md` is historical evidence, not a paired comparison of the full household architecture. No 200-year run completed. Integration must rerun checks on the combined source; these results do not establish main-branch integration or release readiness.
