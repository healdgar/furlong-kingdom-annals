# Missing institutions: design notes

Status: design notes only (2026-10-07). Nothing here is in the game yet. These notes cover #35–#43 in `docs/ISSUES.md`, and tie them to #20–#23 and to the technology proposal (#44, `docs/TECH-TREE.md`).

## Why now

A medieval capital always bought more food than its own trades paid for. The difference was rent collected in the countryside and spent in town by the court, the magnates and the abbeys. Services the capital sold to the whole realm paid for the rest: justice, finance and learning. One payer came from outside the realm: foreign merchants buying wool. The game collects rent but has few of the institutions that spent it or that sold those services.

The economy agent measured three worlds on the batch 3 tip (EC-10: 1001 land, 2002 land, 287970763 sea; years 3–5). The crown's and houses' accounts below come from its four-world run `b4base`. All figures are per world and per year.

| Measure | Value |
|---|---|
| The capital | ~730–870 souls; 60–230 of them in households with no coin |
| Food the capital buys | 15–26k |
| What the capital earns | 12–14k: the court's spending 5–8.7k, its own households' crafts 4–5.7k, errands from the country 0.1–1.9k. Wages from lords and the crown: 0.3–1k |
| The capital's gap | 2–12k |
| Crown revenue | 4.9–8.3k: rent grain and fish sold 2.5–4.7k, hearth tax ~0.6k, wool ~0.7k, other sales ~0.9k, land ~0.4k |
| Revenue of all the houses | 5.4–6.9k: wool ~1.6k, grain ~1.2k, other sales ~1.3k, hay ~0.7k, market tolls ~0.45k. About 2.7k goes on hall servants |
| Rent grain that rots | houses 180–650 grain, crown 280–700. Of the grain allotted to them, a seventh of the houses', a quarter of the crown's and a quarter of the church's |
| Grain price at year 5 (base 2) | villages 0.7–3.6, towns 2.9–5.7, capital 4.7–12.6 |
| Coin in purses at year 5 | villages 2.2–6k, towns 3.6–13.3k, capital 3–7.7k; 16.5–23k in all households |
| Fish that rots | 13–25k, 58–65% of it in villages |

What these show:
- Coin moves out of the capital to buy food and does not come back, except through the crown's spending.
- Lords spend at their own seats; their stewards buy at the capital only wine, cloth and spice that are cheaper there with the carriage. The capital sees almost none of their silver.
- Rent in kind lies where the strips are, mostly where grain is cheapest, and rots there.

Each institution below is built as a real actor with a purse and a reason to act. The table estimates what each would add. Estimates come from the data above and from historical proportions; the soak fields in each note test them.

## Ranking

Ranked by the real income and employment each would add. All figures are coin per world per year. "Real" income means coin or goods that would otherwise not exist or would rot; money that is only moved from one holder to another is shown separately.

| Rank | # | System | Income added, and where | Employment added | Cost to build | Depends on |
|---|---|---|---|---|---|---|
| 1 | 36 | Lords' customary income | +1–2.5k real to houses and crown (rent grain no longer rotting, fines, tolls); 2–4k of rent in kind paid in coin instead; from villages and towns to lords' seats; to the capital through the crown's own lands | 5–15 households (mill and oven farmers, toll-keepers, bailiffs); servants kept on liveries of grain | medium | none; better with #37 |
| 2 | 35 | Monasteries | +0.5–1.5k real (rent grain eaten, wool sold forward abroad, corrodies); 0.3–0.8k of a founder's rents spent at the abbey; capital +0.5–2k if a house stands there | 15–40 households per abbey (servants, shepherds, masons); alms to the coinless | high | #36, #37 (its own court); feeds #40, #44 |
| 3 | 39 | Estates and self-government | crown +1.5–3k in a grant year (0.6–1.5k a year on average), from village and town purses; capital +1–3k (court spending, lords' and burgesses' attendance) | collectors; the capital's victuallers during sessions | medium | lords' whereabouts (built here); better after #37 |
| 4 | 37 | Courts and royal justice | lords +0.3–0.7k, crown +0.5–1k; capital +0.5–1.5k (officials, litigants' board) | 10–25 households (stewards, clerks, bailiffs, justices, a gaoler) | medium–high | shares sessions with #36; enables #38 |
| 5 | 38 | Credit and coin | lenders +0.3–1k interest (moved, not new); crown +0.2–0.6k (tallage, mint charges); rent grain sold forward before harvest | 2–6 (lenders, moneyers, changers) | medium | #37 (pleas of debt); #44 bill of exchange |
| 6 | 41 | The knightly world | crown +0.3–1k (reliefs, wardships, scutage in war years); a tourney brings 0.2–0.5k to its town | armourers, saddlers; companies hired at home instead of abroad | medium | #39 (consent to scutage), #37 |
| 7 | 40 | Learning | capital or the university town +0.2–1k (scholars' board and fees, paid by families elsewhere) | 4–12 (masters, hall-keepers, stationers) | medium | a cathedral or #35; #37 (demand for clerks); feeds #44 |
| 8 | 43 | The craft ladder | ~0 net; guild dues of 0.1–0.3k spent on feasts, alms and a chantry | journeymen paid wages by masters, instead of an equal share of the craft's takings | medium | #39 (communes) |
| 9 | 42 | Bondage and freedom | lords +0.1–0.3k (manumission, chevage); labour moves to towns | none new; mobility | low–medium | #36, #37, #39 |

**Order of building** differs from the ranking, because courts are where most dues are collected: #36 → #37 → #39 → #35 → #38 → #41 → #40 → #43 → #42 (see *Order of work* at the end).

## Common ground

These rules apply to all nine.

- **Accounts.**
  - Two new owner kinds join households, houses, the crown, churches, town chests and `'out'`: an **abbey** and a **guild**. Each is a record with a purse, known to `acct`, `means` and `transfer`, and registered as a commodity-ledger owner so it can hold stores.
  - Every payment goes through `transfer(from,to,v,why)`. A house's side is booked with `book()` under a new label. `transfer` already pays only what the payer has; what it cannot pay is kept as an arrear on a named record, never coined.
- **Records, not crowds.**
  - An institution is one owner with a purse, land, stores, a building and a few named people.
  - The named people are household heads holding an office: a new `office` field on the head (steward, clerk, bailiff, moneyer, collector, master, warden). Being a head, each still eats, marries and dies. Great officers (abbot, justice) are notables made by `mkNotable` with a new role.
  - Monks, nuns and scholars away from home are counted on their institution, not kept as people, once they leave their household. The leaving is a real event in that household.
- **Hooks, not loops.**
  - Every new act happens inside a pass that already runs: `tickTenure` (each place's yearly day, `dueOn(si,360,37)`), `tickHouseholds` (`dueOn(si,360,29)`), `tickMarket` and `shareOutput` (monthly, `dueOn(si,30,11)`), `tickDomains` (the 20th of each month), `tickEconomy` (the crown's monthly reckoning), `tickChurches` (each place's own day), and the single events `inherit`, `marryHouseholds`, `borrow`, `repay`, `ladeIn` and `tickShips`.
  - A court session is a new place-day of its own, `dueOn(si,90,salt)`.
  - Events append to short, bounded lists on the place, which the next session reads. Nothing scans all places against all places.
- **Quantities and customs.**
  - Each decision compares two quantities that exist in the state.
  - A rate that was historically a custom or a decree is held on the place, the house or the crown, set in the world, and named in a comment as the allowed exception. Examples: an heir's entry fine, merchet, a toll, the rate of a lay subsidy, a usury ban, an amercement cap. The player may change it by a journaled command.
  - No price is clamped or pinned.
- **Determinism.**
  - Institutions draw from a new stream, `'inst'`, made by `seedStreams`. Their draws therefore do not shift the `'sim'` and `'folk'` streams. History still changes once behaviour changes; re-baseline the affected tests when each system lands.
  - Use the game's own math functions once #45 lands.
  - Every lever is a journaled command (`runCmd` → `{k:'c'}`, or `setRulerRate` → `{k:'set'}`).
- **Worker and screen.**
  - All state lives in the worker's `W`.
  - The map gets projected fields only for what it draws, through `visualSettlement` or the building records; `tools/simulation-projection-drift.test.mjs` must pass.
  - Panels are built in the worker (`workerQuery('court',…)` → `crownPanelHTML`, `lordPanelHTML`; inspect cards). The advisor reads them through `game:panel`, `game:inspect` and `game:state`. Annals lines come from `emit`, and life lines from `life`.
- **Performance budget.**
  - The 15 km world measured 161 ms per day at year 5 (batch 3). Year 10 has not been measured; take it as roughly 200 ms.
  - Each system has a target share of a day at year 10, stated in its note. All nine together should stay under 2%.
  - Each runs inside its own `simPart` (for example `inst:courts`), so the hot list ranks it.
- **Measures.**
  - The soak gains an `inst` section per year (fields listed in each note).
  - `tools/soak.mjs --audit` must still find no unexplained coin.
  - Each system gets one focused test file that runs the real functions on a fixture world, in the manner of `tools/ownership.test.mjs`.

---

## 1. #36 Lords' customary income

**1. History.**
- Manorial accounts c. 1250–1350 put a manor's income at:
  - money rents ("of assize") 35–45%;
  - demesne produce sold 30–40%;
  - the court's profits with entry fines, heriot and merchet 8–15% (up to 20% in land-hungry years);
  - the mill 4–7%;
  - labour services sold back to the villeins 2–5%;
  - pannage, wood and warrens 3–6%.
- The lord usually let his mill to a miller for a yearly sum, the "farm". Tenants owed "suit of mill": they had to grind there and pay the toll, multure (1/16 to 1/24 of the grain).
- Lords on the Continent also held the oven and the wine press as monopolies.
- Villeins owed week work and harvest boons. These were commuted to money where the demesne needed fewer days than were owed, or where hired hands cost less. After 1349 demesnes were leased.
- Lords and towns took pontage and pavage from carters. In royal forests the crown took pannage on swine and fines for clearing the wood (assarts).
- Parks, warrens, dovecotes and fishponds fed the lord's own table: they saved purchases rather than earning income, and the pigeons ate the tenants' grain.

**What the game already has:**
- Multure: 6% of the grain in kind, offered to the mill's owner in `shareOutput`.
- The miller's and baker's margin, paid in coin through `craftWork(s,h,MARGIN.grain,…)` on every bread purchase in `topUpFood` and `provision`.
- Villein tenure, as a smaller crop share (`TEN_SHARE`: villein 0.62, free 0.85).
- Heriot, in `inherit`.
- Market tolls, in `ladeIn`; customs, in `tickShips`.
- Sale of the demesne when hands are dear, in `tickTenure`.
- Road upkeep in `tickWays`, which reckons tolls it never collects (#36 note in `docs/ISSUES.md`).

**2. Actors and state.**
- Existing: houses, the crown, places, strips (`f.ten`, `f.own`, `f.wk`, `f.lord`), mills and windmills (`LORD_ARCH`), bakehouses (`bakery`), toll houses (`toll`, kept by a reeve), the households of millers, bakers, reeves and swineherds, pannage (`grazeOf(s).pann`).
- New, on a mill, bakehouse or toll house: `b.farm`, holding the farmer's id, the rent, the end of the term and last year's takings.
- New, on a villein strip: `f.svc` (`'works'` or `'money'`) and `f.qrent`, the money rent fixed when commuted (a custom of the manor).
- New, on the place: `s.custom` gains `entryHeir` (an heir's entry fine, in years of the strip's rent), `merchet` and `toll`. These are customs set in the world; the lord changes them by command.
- New, on each road: a cached list of the toll houses standing on it, built when a road or a toll house is built.
- New ledger labels: `mill farm`, `oven farm`, `rents`, `entry fines`, `merchet`, `tolls`, `pannage`, `assarts`, `liveries`.

**3. Hooks.**
- **Mill and oven farms**, at `tickTenure`:
  - The lord lets or renews the farm, and the farmer pays the year's rent.
  - In `shareOutput`, the 6% multure then goes to the farmer: `ownerAcct(mill)` returns the farm's holder while the term runs.
  - Suit of mill: in `craftWork`, a family with a lord's mill in its place pays the grinding margin to the mill's farmer instead of "doing it themselves". The same applies to bakers where the lord keeps a bakehouse.
  - A lord's press takes its share of `M.wine` in `shareOutput`.
- **Commutation**, at `tickTenure`, per villein strip:
  - A commuted strip gets a free tenant's share in `shareOutput`, and the lord's share in kind ends.
  - At the next `tickTenure`, the holder pays `f.qrent` by `transfer` (label `rents`). What he cannot pay is an arrear on his household, pleaded at the manor court (#37).
- **Entry fines**, in `tickTenure`'s loop over strips, where `heirOf` or a new tenant takes a strip: the incoming holder pays.
- **Merchet**, at the wedding in `yearOfFolk`, just before `marryHouseholds`: paid when the bride's household holds villein land, detected as `inherit` already detects it.
- **Tolls**, priced once per cached route in `route(ai,bi)` (from its hops' roads), and paid in `ladeIn` with the carter's fee.
  - `tickWays` then pays road upkeep from the toll house owner's `tolls` takings first, and from his purse after.
- **Pannage**: in `tickLivestock`, in its autumn month, swine owners pay the wood's lord per beast fed on pannage.
- **Assarts**: in `tickLand`, when it takes wood into tillage, the household that clears it pays the wood's lord (the crown in a royal forest) a fine. The strip then owes rent.
- **Liveries**, in `tickDomains`' hall spending: part of the servants' `household` wage is paid in grain from the lord's own unsold stock at his seat (`mkt(T,'grain').get(h)`), valued at the local price, so rent grain is eaten instead of rotting.

**4. Quantities.**
- **Farm.**
  - A miller's bid is last year's multure at the local grain price, plus the place's grinding margin, minus his household's year of bread (`foodYr()` × its size). Bids come from the millers of the place and the nearest place.
  - The lord lets the mill when the best bid exceeds what he netted keeping it himself: multure actually sold (not rotted) plus margin, minus repairs. The rent follows the takings; no rate is fixed.
- **Commutation.**
  - Commute a strip when its money rent is worth more than what the lord's share in kind actually brought him last year: the commodity ledger already counts, by owner and place, what was sold and what rotted.
  - The money rent is the difference between the villein and free crop shares, × last year's crop, × the local price.
  - So lords whose rent grain rots in cheap villages commute first, and lords near dear markets keep their grain.
  - Repeated arrears return the strip to the lord or to a bidder.
- **Entry fines.**
  - An heir pays the custom.
  - A stranger's fine is bid by the landless tillers (`dayHands` without strips): up to the smaller of their surplus (purse less a year's bread) and the strip's expected net yield over its rent for the custom's years. Land hunger raises it and empty land lowers it.
- **Tolls.**
  - A lord builds a toll house where expected tolls (road volume `r.vol` × the toll) exceed the keeper's wage and the building. Town growth already raises toll houses on demand at gates and bridges.
  - Carriers pay the toll through `freight`'s cost, which already decides whether a load pays.
- **Liveries.** Pay a servant in grain when that grain's sale value net of rot is below the coin wage it replaces.
- **Parks, warrens, fishponds and dovecotes** (second phase): a lord builds one when the hall's purchases of meat or fish it would replace exceed the keeper's wage, the rent the land would have let for and, for dovecotes, the grain the birds eat.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| miller or baker household | lord | mill farm, oven farm |
| growers (grain in kind) | mill farmer | multure, which he sells |
| villein household | lord | commuted rent; arrears to the court |
| incoming holder | lord | entry fine |
| bride's household | lord | merchet |
| carter (or the merchant hiring him) | toll house owner | pontage, pavage |
| toll house owner | masons, carters | road upkeep (`buildWorks`, `roads`) |
| swine owner, assarter | the wood's lord or the crown | pannage, assart fine |
| lord (grain in kind) | servants | liveries |

- The lords' and crown's rent grain that rots, 460–1,350 grain a year, is worth 1–4k at village and town prices. Commutation and liveries would put perhaps half of it to use: **+0.5–2k a year of real income**.
- Mill and oven farms turn ~400 grain of multure into 0.5–1.5k of coin rent. Entry fines, merchet, tolls and pannage add a few hundred a year.
- In all: **+1–2.5k real, and 2–4k of rent paid in coin instead of in kind**. Against today's revenue (houses 5.4–6.9k, crown 4.9–8.3k), that is +15–35%.
- The coin comes from village and town purses (villages hold 2.2–6k, towns 3.6–13.3k).
- The capital gains directly only from the crown's own lands, because the crown's coin feeds the court's spending: 0.3–1k of its gap. Lords' coin reaches the capital only once they attend there (#39).

**6. Performance.** Everything runs in existing per-place passes. Tolls cost a few road lookups per caravan, using `W.routes` and a per-road toll list. No new index beyond that list. Target: **0.25% of a day** at year 10 on the 15 km world (~0.5 ms).

**7. Screen and advisor.**
- Settlement card: "The mill is let to Hugh Miller for 34 a year, to 1188"; villein strips commuted, n of m; the toll house's takings. Lord's ledger: the new labels.
- Lord's panel: the place's customs (entry fine, merchet, toll) beside the dues slider, by journaled `set`; per place, "commute services" or "keep them in hand" (journaled `c`). Crown panel: the same for crown places, and a decree setting a forest's bounds.
- Annals: "The villeins of Becville commute their week-work for a money rent."
- Advisor: `game:panel house` for the ledger; the settlement card through `game:inspect`.

**8. Tests and measures.**
- Tests (`tools/customary-dues.test.mjs`): multure goes to the farmer and the farm to the lord, sums equal to transfers; commutation removes the share in kind and adds a rent no larger than it; an entry fine only when the holder changes; merchet only from villein households; tolls paid equal the sum over toll houses on the route; upkeep only from named purses; replay; the audit clean.
- Soak fields: rent grain allotted, sold and rotted by owner kind (from the commodity ledger); coin by label (mill farm, rents, entry fines, merchet, tolls, pannage); the share of villein strips commuted; road upkeep against tolls.
- Working means the lords' share of rot falls and their coin revenue rises, while village hunger does not rise.

**9. Dependencies.**
- None hard.
- #37 holds the sessions that collect arrears and record transfers of land.
- #42 moves merchet and heriot from the strip to the person.
- #44: windmills (no river needed), fulling mills (`millUses` already lists fulling from 1150) and the horse collar change a mill's takings, and so its farm.

---

## 2. #35 Monasteries, abbeys and nunneries

**1. History.**
- Benedictine houses were refounded from the 10th century (Cluny 910; the English reform c. 960). The Cistercians, from 1098 (England 1128), farmed granges with lay brothers and sold wool forward to Flemish and Italian merchants; Pegolotti's list of c. 1320 names some 200 English houses.
- Augustinian canons spread in the 12th century. Nunneries made up about a seventh of houses and were poorer. Friars came in the 13th century (the game draws friaries).
- A house of 20–40 religious kept two or three lay servants for each. It gave alms at the gate, lodged guests, kept almonry and novice schools, and sold corrodies (board and lodging for life, for a lump sum; houses often lost on them).
- Abbeys took parish churches into their own hands ("appropriated" them): about a third of English parishes by the 14th century. The abbey kept the great tithe and paid a vicar.
- Founders gave land for prayers for their kin. By the 1530s the monasteries held perhaps a quarter of England's cultivated land.

**2. Actors and state.**
- An **abbey** record: id, name, order (Benedictine, Cistercian from 1128, Augustinian from 1100, nuns), the founder's house, its site place, `gold`, and its stores as a ledger owner.
- People:
  - `religious`: a count of monks or nuns. Their bread is counted as mouths in its pantry.
  - The abbot or abbess: a notable with role `abbot`.
  - The cellarer: a household head with an office. Servants are household heads hired at wages.
- Land: strips granted "in free alms". The lordship of the place stays with the house; a new `f.alms=abbeyId` sends the strip's rents and demesne crop to the abbey.
- Granges use the existing `grange` storage type. The abbey's sheep are its own beasts on the place's grazing.
- Building: a church with a new `abbey` flag (as `friary` is a flag on `temple`), plus cloister buildings placed by the town's layout.
- `ch.approp=abbeyId` on an appropriated parish.
- `corrodies`: a list of {household, daily bread, until death}.

**3. Hooks.**
- **Founding**, at `tickDomains`' yearly day, beside `foundTown`.
- **Income**, in `shareOutput`, where the lord's share is decided: on a strip with `f.alms`, the demesne crop and the rents in kind go to the abbey. The tithe of an appropriated parish goes to the abbey, and a vicar's portion (a custom, a third) to `ch.fund`.
- **Feeding**, in `tickMarket` and `provision` at its site: the abbey is fed from its own stores like a household or a hall (the pantry, `hallN` mouths). The mouths are its religious, servants, guests and corrodians.
- **Servants** are hired from `hungryHands(site)`: paid partly in bread from its stores (livery) and partly in coin (`household`).
- **Alms**, at the same pass: bread from its stores is given by `giveFood(site,'grain',q,abbey)` to the hungriest households, as parish relief is in `provision`.
- **Building**, on its site's `tickChurches` day: an abbey church grows by `chNext` like any church and pays through `buildWorks`, but at abbey scale and over decades.
- **Wool**, at `tickShips`: when a ship calls, the abbey's clip is sold to `'out'`. A forward contract (#38) has the merchant pay in advance for the next years' clips; wool short at a ship's call is repaid.
- **Novices**: in `tickHouseholds`, where grown children decide to set up house. A son or daughter who cannot make a living there (expected trade income below a year's bread and no strip) may enter the abbey if the family can give the entry gift. The person leaves the folk the way an emigrant leaves the realm; the abbey's count rises. Nuns' dowries came the same way.
- **Corrodies**, at `tickHouseholds`: an old household with coin may buy one. Feeding ends at the corrodian's death, in `inherit`.
- **Deaths**: the abbey's count falls on its yearly day, by the life table's rate for adults.

**4. Quantities.**
- **Founding.** A house founds an abbey when all of these hold:
  - its head is pious (trait `pious`, or high `KS` scripture);
  - the endowment's yearly yield, from demesne strips at one or two of its places, is less than the house's yearly surplus (`h._netA`, the monthly net already after hosts and garrisons, × 12);
  - its purse beyond `hostTarget` × 4 can pay the first works.
- The crown founds by the same test, with the treasury in place of the house's purse.
- **Order.** A Cistercian house wants waste or wood to make granges and sheep runs (`grazeOf(s).wild`). A Benedictine house wants a town and its tithes.
- **Hiring.** The abbey hires servants and takes corrodians while its stores hold more than a year of its mouths. Beyond that, it sells.
- **Corrody price.** The abbey asks the expected years of life at the buyer's age × bread at the local price. A dear year makes it lose.
- **Novices.** A family offers a child when the gift costs less than setting up that child's house.
- **Land.** An abbey buys land when the yield beats its idle coin. It is the natural buyer in `tickDomains`' debt sales and of crusaders' land (#41).

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| tenants of alms strips | abbey | rents in kind or coin |
| tithe payers of an appropriated parish | abbey; vicar's portion to the parish | great tithe |
| `'out'` (foreign merchants) | abbey | wool, often in advance |
| family of a novice | abbey | entry gift, dowry |
| old household | abbey | corrody |
| abbey | servants | wages and liveries |
| abbey | masons, carters | church works |
| abbey stores | hungry households (in kind) | alms |
| abbey | quarry, market sellers | stone, what it does not grow |

- The founder's strips (0.3–0.8k a year of rents in kind) stop going to a lord and are spent at the abbey. That money is moved, not new.
- A house of 20 religious with 30–40 servants and guests eats 150–250 grain a year: a large part of the lords' 460–1,350 grain of rot, if its rents are that grain.
- New income is the grain eaten instead of rotting, wool paid for from abroad and corrodies: **+0.5–1.5k a year**.
- Employment: **15–40 households per abbey** (servants, shepherds on its granges, masons).
- Alms go to the coinless at its gate.
- At the capital (a Westminster or a Saint-Denis), its estates' rents are spent in the capital: **0.5–2k of the gap** (economy agent's estimate). Elsewhere it strengthens a town.

**6. Performance.** Abbeys are few: at most one per house and one for the crown. Founding is checked once a year per house. An abbey's feeding, hiring and alms join its site's monthly pass as one more owner. Its building joins the site's church day. Target: **0.2% of a day**.

**7. Screen and advisor.**
- An abbey card (`game:inspect abbey:N`): order, abbot, religious, servants, granges and sheep, stores, alms given this year, works in hand, corrodians; the settlement card links to it. The map draws the abbey's buildings, projected as other buildings are.
- Lord's and crown panels: found an abbey (journaled; choose the site and the endowed strips); give to it.
- Annals: "Ranulf of House ap Hywel gives the demesne of Coedmelin to found a house of white monks." "The abbey sells its next three clips to a Florentine."

**8. Tests and measures.**
- Tests (`tools/abbeys.test.mjs`): the abbey's account conserves; alms never exceed stores beyond a year of its mouths; servants hired only while stores exceed a year; a corrodian fed until death and not after; founding only when the test holds; a forward wool contract delivered or repaid; replay; projection drift.
- Soak fields: abbeys and religious; servants employed; grain eaten by abbeys against lords' rot; alms given; wool sold to `'out'`; corrodies sold and their running loss; the abbeys' share of land.

**9. Dependencies.**
- #36: the abbey is a lord for its strips and mill, so the farm, commutation and court code must take an abbey as owner. This is the main generalisation: the lord's account may be a house, the crown or an abbey.
- #37: its own manor court.
- Feeds #40 (almonry and novice schools) and #44 (scholars count towards learning).

---

## 3. #39 Estates and self-government

**1. History.**
- Great councils grew into parliaments: León 1188, England 1265 and 1295, the French Estates-General 1302, the German Landtage.
- Taxation by consent:
  - England's lay subsidy on movables, a fifteenth in the shires and a tenth in towns, fixed at about £38k after 1334, was the crown's largest revenue in war decades.
  - The Saladin tithe of 1188 and the thirteenth of 1207 came before it.
- Parliament usually sat for a few weeks at the capital. Shires and boroughs paid their members' wages (4s and 2s a day), which the members spent there.
- Lords kept town houses (inns) in the capital.
- Communes: sworn associations of townsmen in northern France from the 1070s. English boroughs bought the "fee-farm": the town paid the crown a fixed yearly sum and collected its own tolls and court profits. London paid £300 a year.
- Grants were bargained against redress of grievances: charters, pardons, lower dues.

**2. Actors and state.**
- Existing: the crown, the houses, towns (`s.murage`, the town chest), the capital, petitions.
- New: `W.estates`, holding past sessions (day, length, why called, grant) and grants (rate, places assessed, collected, arrears).
- New, **the lords' whereabouts**: `h.at`, the place a lord's household is at and until when. The game has none today except an army's commander. It is used here and by #37 and #41.
- New, per town: `s.commune`, holding the charter year, the farm, the term and the mayor (a head with office `mayor`); the burgesses; collectors (heads with office `collector` while a grant is gathered).

**3. Hooks.**
- **Summons**, in `tickEconomy`'s monthly crown reckoning, which already keeps `W._crIncA` and `W._crNetA`.
- **Attendance**, in `tickDomains`' hall spending: while `h.at` is the capital, the hall buys at the capital (`T=W.capital`) for the share of the month spent there. The steward still pays the seat's servants.
- **Burgesses' wages**, from their town chest when the session ends. They spend those wages at the capital through `craftWork(W.capital,…,['cook','brewer'])` and bread purchases.
- **Assessment**, after a grant, on each place's next `tickTenure` day:
  - Movables are counted: households' coin, plus their beasts at local prices (`herdOf`), plus their held goods.
  - The rate is 1/15 in villages and 1/10 in towns and crown places.
  - Each household pays by `transfer` to the crown, label `subsidy`, and only what it holds. The rest is an arrear on its record.
  - The collectors keep a customary allowance.
  - In a lord's place the subsidy is still the crown's: it is the realm's tax.
- **Fee-farm**, at a town's `tickTenure` day:
  - The town bargains with its lord.
  - Once chartered, the lord's market toll in `ladeIn` goes to the town chest, and so do the town court's profits (#37).
  - On its day the town pays the farm to the lord (label `fee farm`).

**4. Quantities.**
- **Summons.** The crown summons when its expected need over the next six months is more than the treasury plus a quarter's revenue. The need is the hosts' pay (`hostPay`) for the campaign in hand, plus pay already owed (`a._arrears`), plus debts to lenders (#38).
- **Consent.** Each attending lord and town weighs:
  - the threat: an enemy host within reach of its places (`townThreat`), the realm at war;
  - its loyalty and the crown's `W.legitimacy`;
  - the burden: grants in the last five years, its hunger and unrest;
  - any redress the crown offers (a charter, a lower `MOD.tax`, a pardon).

  A grant passes when the weighted sum is positive. No dice decide it.
- **Attendance.** A lord attends when the favour to be had is worth more than the cost of his household's travel and of buying at the capital's prices. The favour is real state: royal grants, and the loyalty already kept on `h.loyalty`. A lord at war stays away.
- **Fee-farm.**
  - The farm offered is the lord's average yield from the town's tolls, rents and court over the last years (`s._ltY` and the ledger).
  - The town pays when it expects to keep more than the farm, plus interest on the entry fine (one or two years' farm, raised from the chest and by `levy(s,…,s,'charter')`).
  - The lord accepts when farm plus entry beat his expected yield, or when he is in debt.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| households | crown | subsidy |
| crown | collectors | allowance |
| town chest | its burgesses | wages of attendance |
| burgesses, attending lords | capital's sellers and crafts | board, hall spending |
| town (chest, levy) | lord or crown | charter fine; yearly fee-farm |
| market sellers | town chest | tolls, after a charter |

- A fifteenth and a tenth on ~17–23k of household coin, plus beasts, is **1.5–3k per grant**. Granted every two or three years in war, that averages **0.6–1.5k a year**: +10–25% of crown revenue.
- Most comes from towns (3.6–13.3k in purses) and villages (2.2–6k).
- The crown spends it through its court spending (`tickEconomy` → `W.capital._poolCash`) and through hosts' pay to the men's own households.
- Attendance moves part of lords' hall spending (halls spend 1–6.7k a year) to the capital: 0.1–0.8k.
- The capital gains **1–3k in a grant year**: 20–60% of its gap, the largest single lever for it (economy agent's estimate).
- Fee-farms move tolls from lords to towns, with an entry fine of 0.2–1k once.

**6. Performance.**
- A monthly crown check, linear in the number of houses.
- A session is a flag read by `tickDomains`.
- Assessment is one pass over a place's households, on its own day, once per grant: the same cost as the hearth tax in `tickTenure`.
- Target: **0.1% of a day**.

**7. Screen and advisor.**
- Crown panel, an Estates section: summon a parliament (journaled); the mood of lords and towns, with its parts; grants, arrears and redress offered. Lord's panel: attend or stay (journaled). Town card: charter, farm, mayor.
- Projected: a lord's banner at the capital while he attends (`h.at`).
- Annals: "Parliament meets at Rougecastel; the commons grant a fifteenth against the war with House Gamsburg." "The burgesses of Pontecala buy the farm of their town for 120 a year."
- Advisor: `game:panel crown`; the estates fields in `game:state`.

**8. Tests and measures.**
- Tests (`tools/estates.test.mjs`): paid plus arrears equals assessed; no household pays more than it holds; consent follows the quantities (fixture with and without a threat); an attending lord's purchases land at the capital; after a charter, tolls reach the chest and the farm is paid; replay.
- Soak fields: grants by year (assessed, collected, arrears); the capital's craft-pool income by source (court, attendance, burgesses, households, country); lords' days at the capital; towns chartered.

**9. Dependencies.**
- Builds `h.at`, which #37 and #41 also need.
- Better after #37: sheriffs collect, and arrears are pleaded.
- #38: the crown borrows against a grant.
- #41: scutage is the lords' alternative.
- Communes give #43 its ordinances and #42 its year and a day.

---

## 4. #37 Courts and royal justice

**1. History.**
- **Manor courts.** The manor court (hallmote) sat about every three weeks. It recorded transfers of land with their entry fines, heriots and merchets. It amerced trespass, bad work, default of services, and brewing and baking against the assize (in effect a yearly licence on alewives and bakers). It heard pleas of debt: 30–40% of its business.
- **Amercements** were small and scaled to means: Magna Carta's "saving his contenement". The poor were often pardoned ("quia pauper").
- **Hundred and shire courts** sat monthly, and the sheriff's tourn twice a year. The sheriff farmed the county's royal revenues for a fixed sum and owed any shortfall to the Exchequer.
- **Royal justice.** Justices in eyre visited each county about every seven years in 13th-century England; one visit could take hundreds to thousands of pounds in amercements (vills fined for robberies they had not pursued, felons' chattels, purprestures). From the 1170s royal writs drew freeholders' land pleas to the king's courts, fixed at Westminster after 1215, where litigants and jurors lodged. The profits of justice were about a tenth of royal ordinary revenue under John.
- **Officials**: stewards, bailiffs, clerks, coroners, gaolers; professional justices and attorneys by the 13th century.

**2. Actors and state.**
- Existing:
  - houses (the manor court of each lord in his places), the crown;
  - the reeve trade, and the law skill (`KLaw`), which reeves and the ruling class already learn;
  - debts (`h._owe`, `h._debt`);
  - grazing pressure (`s.hm.press`);
  - robbed caravans (`c.robbed`), bandit camps and outlaws, riots and unrest.
- Name clash: the game's `tickCourts` and its `court` archetype are courtyard houses, not law courts. The law court sits in the lord's hall or the town hall (`hall`). Its part of the day should be named `tickJustice`, and the old one could become `tickCourtyards`.
- New, per place: `s.court` {next session, pleas pending (a bounded list), this year's profits}. A plea is {kind, from, against, sum, day}. The list is capped at 64; beyond that, the oldest of a kind fold into a count.
- New officials: one steward per house (a lettered head at its seat, office `steward`) and his clerk; for the crown, a sheriff for its places and two or three justices (notables, role `justice`, chosen by `KLaw`).

**3. Hooks.** Pleas are appended where their events already happen:
- **Debt**: in `repay`, when a loan entry in `h._owe` is a year old and unpaid while the debtor holds coin or beasts, the creditor may plead.
- **Trespass**: in `tickLivestock`, when `M.press>1`, the owners of beasts beyond their share of the grazing.
- **Assize of ale and bread**: at the great court twice a year, the place's brewers and bakers (from `tradeCounts`).
- **Land**: entry fines and surrenders from #36's `tickTenure` hooks; heriot (`inherit`) and merchet (#36) are entered on the roll.
- **Riot**: when a riot breaks out, the households of the ringleaders (the hungriest and boldest heads, as `tickBandits` already ranks them).
- **Robbery**: in the caravan pass when `c.robbed` is set, and when a bandit camp raids a place. These are held for the eyre against the vill whose ground it was.
- **Felony**: when a man joins an outlaw camp in `tickBandits`, his share of his household's chattels is held for the eyre.

Sessions and their rulings:
- **The manor court** sits on its own day, `dueOn(si,90,salt)`, with the great court every second session.
- **Ruling on debt**: the debtor pays by `transfer` from his purse, then by his beasts (the path the insolvent estates in `inherit` already use). The loser is amerced.
- **The eyre**: the crown's justices ride a circuit to each town on its own day in turn, with no daily movement. They hear the held pleas of every place in its hundred (the town and its nearest villages).
- **The bench**: in `tickTenure`'s land market, when a freeholder loses a strip, or when a debt is large, the plaintiff may sue at the capital: he pays a writ to the crown and spends days at the capital's market.

**4. Quantities.**
- **Sitting.** A court sits when the expected amercements and fees of its pending pleas exceed its cost: the steward's and clerk's customary fees for the day. Otherwise the pleas wait. Old pleas grow, so a court with business always sits in the end.
- **Amercements.** The harm (the debt, the beasts' excess grazing at the hay price, the brewer's year of takings × the custom) × the offender's means. The house or the crown sets a cap (a custom, "saving his contenement"; journaled). A household with no coin is pardoned, never paid from nothing.
- **Pleading.** A creditor pleads when recovery × the chance of judgement (his debtor's goods against the debt) exceeds the clerk's fee and his lost day.
- **Suing at the capital.** A plaintiff goes when the strip's or debt's value × his chance exceeds the writ, the journey and his days of board (`foodYr()` per day, at the capital's price).
- **The eyre** rides when the held pleas' expected profit exceeds the justices' wages and travel. With much robbery and riot it comes often; in a quiet realm, rarely.
- **Effects on other systems.**
  - A court that recovers debts raises what lenders will advance: `creditOf` gains the court's recovery rate as a factor. This is the bridge to #38.
  - Unheard pleas and unpunished robbery feed the hardship score that `tickBandits` already uses.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| offender households | lord (manor), crown (eyre, sheriff) | amercements |
| debtor | creditor | judgement of debt |
| plaintiff | clerk | fee for the plea |
| plaintiff | crown | writ |
| plaintiff | capital's sellers and crafts | board while suing |
| vill (`levy` on its households by means) | crown | eyre amercement for an unpursued robbery |
| felon's chattels | crown | forfeiture |
| lord, crown | steward, clerk, sheriff, justices | fees and wages |

- Manor court profits at 5–10% of a lord's revenue: **+0.3–0.7k for the houses** (5–10% of their 5.4–6.9k).
- The eyre, writs and the sheriff: **+0.5–1k for the crown** (7–20% of its 4.9–8.3k).
- Officials' wages of 0.3–0.6k employ **10–25 households**.
- The capital gains from justices and clerks living there and from litigants' board: **0.5–1.5k of its gap** (economy agent's estimate).
- Coin comes from village and town purses in proportion to offences. Courts also make debts recoverable, which #38 needs.

**6. Performance.**
- Each session reads only its own place's plea list. Pleas are appended at events that already happen.
- The eyre visits one town on its day.
- Target: **0.25% of a day**.

**7. Screen and advisor.**
- Settlement card, a Court line: the next session, pleas waiting, the year's profits, the steward. A roll card (`game:inspect court:si`): the last session's pleas and rulings.
- Crown panel, a Justice section: the next eyre, held pleas by town, profits; send the justices (journaled). Lord's panel: the amercement cap (journaled `set`).
- Annals: "At the hallmote of Becville, Wat Carter is ordered to pay Hugh Smith the 6 he owes." "The justices in eyre amerce the vill of Gué-Beau 40 for the robbery on the Lignonne road."
- Advisor: the roll and panels through `game:inspect` and `game:panel`.

**8. Tests and measures.**
- Tests (`tools/justice.test.mjs`): every amercement at most the offender's means and the cap; a court sits only when profit exceeds cost (fixture both ways); a judgement conserves coin; plea lists stay bounded; the coinless pardoned; a robbery held to the eyre and amerced once; replay; projection drift for the card fields.
- Soak fields: sessions held and adjourned; pleas by kind; amercements by kind and payer place kind; debts recovered; officials paid; days spent suing at the capital; eyres held.

**9. Dependencies.**
- Collects #36's fines.
- Lets #38 lend at interest.
- Hears #42's claims of status.
- Draws clerks from #40.
- #44's "Roman law revived" (1100) makes royal pleas worth more by raising the chance of judgement, through the justices' `KLaw`.

---

## 5. #38 Credit and coin

**1. History.**
- **Jewish lenders.** In England from c. 1070 to the expulsion of 1290 they lent under royal protection at about 2d in the pound a week (~43% a year), registered their bonds in official chests, and were taxed by tallage (£1–5k a year at times). The crown could seize their bonds.
- **Italian lenders.** Cahorsins and Lombards lent in the 13th century. Italian houses lent to the crown against the wool customs (the Riccardi, Frescobaldi, Bardi and Peruzzi; the last two failed in the 1340s).
- **Christian credit** avoided the usury ban:
  - rent-charges: a lump sum bought a yearly rent from a holding, until redeemed;
  - pawns;
  - credit sales;
  - merchants' bonds (the Statute of Merchants, 1285).
- **Harvest credit.** Peasants borrowed in the lean season and repaid from the harvest sale.
- **Mints.** Coining was the king's monopoly, struck by moneyers in many towns. Recoinages (1180, 1247–50, 1279) charged a mint fee of about 5% of the silver brought in, and the crown kept part of it. France debased its coin for profit under Philip IV.

**2. Actors and state.**
- **Existing credit:**
  - `borrow`: interest-free bread loans from the best-off neighbour, the parish or the lord.
  - `repay`: oldest debt first.
  - `creditOf`: what a household's beasts, strips and spare income can repay.
  - `commodityCreditPurchase`: bread on the slate.
  - The crown lends too, and recovers little: across four worlds it lent ~10k in five years and took back ~1k.
- **Existing coin:** the debasement dilemma (`courtDilemma`) is a `levy` labelled `debasement`. No mint stands behind it.
- **New lenders:** a lender is a household head with office `lender` and a book of bonds (debtor, sum, rate, pledge, day). Two kinds:
  - licensed lenders, who come from beyond the realm through the "few who come from beyond the realm" path in `tickHouseholds`, and are taxable by the crown;
  - any household of means, lending by rent-charge or pawn.
- New, per place: a short list of its lenders, refreshed on its yearly day.
- New, per town: a mint, with a moneyer (office `moneyer`).
- New, the crown: a usury custom (`W.usury`: banned to Christians / tolerated), set by decree.

**3. Hooks.**
- **`borrow`** first asks neighbours, the parish and the lord, as now: interest-free bread on the slate, a charity. Beyond what they will give, it takes the cheapest willing lender on the place's list and records the bond with its rate and pledge.
- **`repay`** pays interest first.
- **`tickTenure`**, on each place's yearly day:
  - rent-charges are paid;
  - a defaulted pledge passes to the lender through the court (#37): a beast moves, or a strip's `f.own` changes.
- **Forward sales**, at `tickDomains`' month before harvest: a merchant (dealer) may buy a lord's coming rent grain at a discount. He pays now and takes the grain in `shareOutput`'s harvest months.
- **Mint fee on exports**, in `tickShips`' export loading (`purchase(s,g,'out',…)`): sellers paid in foreign silver bring it to the mint, which keeps a fee for the moneyer (brassage) and the crown (seigniorage).
- **Recoinage**, by decree: each place, on its next `tickTenure` day, pays the fee on the coin its households hold.
- **The debasement dilemma** becomes a recoinage into a lighter coin at a higher fee. Foreign merchants (`'out'`) take the realm's coin by its silver, so their asking prices for imports in `tickShips` rise by the silver taken, and home prices follow through the market. No levy stands in for it and no price is set.
- **Tallage**, at the crown's monthly reckoning in `tickEconomy`, by decree: a `levy` on licensed lenders' purses.

**4. Quantities.**
- **The lender's rate.** A lender lends when the expected return beats his alternative:
  - the return: principal × rate × chance of repayment, plus the pledge's value if it fails;
  - the alternative: buying land at the land market's price, which `tickTenure` puts at about twelve years' purchase, so ~8%.
  - The rate he asks is that yield plus the default rate of his own book over recent years. Rates follow risk; none is fixed.
- **The court's part.** Where #37 recovers debts, the chance of repayment rises and the rate falls.
- **The borrower** takes the loan when the bread or seed it buys is worth more than the interest: hunger before harvest.
- **Forward sales.** A dealer buys forward when the expected harvest price, net of freight and rot, exceeds the price paid now plus his interest.
- **Recoinage.** The crown recoins when the fee on the realm's coin exceeds the cost in trade slowed and unrest. It is a decree in the world, journaled.
- **Tallage.** The crown tallages when it needs coin and the lenders hold it. Over-tallaged lenders lend less or leave.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| borrower | lender | interest, principal |
| pledge (beast, strip) | lender | default, by judgement |
| strip's holder | rent-charge buyer | yearly rent |
| lender | crown | tallage |
| dealer | lord, then grain to dealer | forward purchase |
| exporter | moneyer, crown | mint fee on foreign silver |
| households | moneyer, crown | recoinage fee |

- Lending of 3–10k at 10–40%: lenders gain **0.3–1k a year**, moved and not new. It moves to the capital and the towns where lenders live: perhaps 0.1–0.5k of the capital's gap.
- Tallage 0.1–0.3k; mint fees on 1–3k of exports 0.05–0.15k; a recoinage of 5% on ~20k, once a decade. The crown gains **0.2–0.6k a year**.
- Forward sales put rent grain in dealers' hands before it rots, and coin in lords' hands before harvest.
- Employment: **2–6 households**.

**6. Performance.**
- `borrow` runs inside bread purchases, which are hot. It must read only the place's lender list: no scan of heads (today it scans the place's households).
- Bonds are settled where `repay` already runs.
- Target: **0.2% of a day**. The lender list should cut today's per-loan scan, so the change may cost less than it adds.

**7. Screen and advisor.**
- Settlement card: lenders and their going rate; the mint. Household card: debts with rate and pledge.
- Crown panel, a Coin section: mint fees, recoinage, tallage, the usury custom (each journaled).
- Annals: "Aaron of Rougecastel lends the lord of Becville 300 against his wool." Advisor: panels and cards.

**8. Tests and measures.**
- Tests (`tools/credit.test.mjs`): interest paid equals the bonds' terms; a pledge passes only by judgement; the rate follows the default history (fixture); the mint fee only from foreign silver or held coin; recoinage conserves; no lender lends beyond his purse; replay.
- Soak fields: loans by lender kind; going rates; defaults; interest by place kind; forward sales and the rot they prevented; mint fees; tallage.

**9. Dependencies.**
- #37 for pleas and pledges.
- #39: the crown borrows against grants.
- #35: abbeys sell wool forward and buy pledged land.
- #44: the bill of exchange (1250) and double-entry bookkeeping lower merchants' costs and defaults.

---

## 6. #41 The knightly world

**1. History.**
- **Military service and scutage.** Knight service was forty days a year. Scutage, paid instead, was often 2 marks a fee (about 7% of a fee's yearly income). "Fines not to cross" were larger.
- **Feudal incidents** were together about a tenth of royal income:
  - relief on inheriting (Magna Carta: £100 for a barony);
  - wardship of a minor heir (the crown took the lands' income, or sold the wardship);
  - the marriage of heiresses;
  - aids.
- **Tournaments** from c. 1100, licensed in England from 1194 with fees by rank. Losers forfeited horse and harness or paid ransom; armourers, saddlers and victuallers profited. **Orders of chivalry**: the Garter, 1348.
- **Mercenary companies**: Brabançons in the 12th century, free companies in the 14th; they lived off the land between wars.
- **Crusades**: the Saladin tithe of 1188 took 10% of movables; crusaders mortgaged land to abbeys and lenders; men and coin left the realm.

**2. Actors and state.**
- Existing:
  - houses' hosts (`ensureHosts`, `hostTarget`, `hostPay`), `levyMen`, `hireMen` (sell-swords from `'out'`, paid to `'out'` by `soldiersPay`);
  - riders (`KRi`) and horses;
  - `feastGames`;
  - a tourney petition whose 700 is spent through `buildWorks` by `runPetition`: a stand-in;
  - house successions in `killNotable`.
- New, per house: `h.ward` {crown or buyer, until the heir's majority}.
- New, per war: `W.war.service` {house: sent | scutage}.
- New, per tourney: {host, place, day, entrants, prizes}.
- New, per company: {captain, men, purse, employer}.

**3. Hooks.**
- **Scutage**: when the crown is at war and calls its vassals (where `tickMilitary` raises royal hosts), each house either sends its host or pays.
- **Relief**: in `killNotable`, when a house's head passes to an heir.
- **Wardship**: in `killNotable`, when the heir is a minor. While the ward lasts, `tickDomains` pays the house's monthly net to the warden.
- **Tourneys**:
  - Proclaimed by a crown decree or a lord's command, replacing the petition's stand-in.
  - Held on a place's day: the host pays the lists (`buildWorks`) and the prizes.
  - Entrants' houses pay their riders' board at that place (purchases there).
  - Bouts are settled by the riders' skill, as `feastGames` settles its contests. Losers' horses move to winners' houses, or ransom is paid.
- **Companies**: in `tickMilitary`, when a war ends and paid men are discharged, the hired and the landless may stay together as a company. It takes service with whoever bids, or turns outlaw (the camps of `tickBandits`).
- **Crusades** (an era option): called by decree. A crusade tithe is levied, crusaders' houses mortgage land (#38, #35), and men leave the realm (`'out'`).

**4. Quantities.**
- **Scutage.** A house pays when the scutage is less than its host's pay for the campaign plus its expected losses plus the risk of leaving its places bare. The crown asks scutage when hired men cost less per useful day than vassals' levies, and the rate needs consent (#39) after 1215.
- **Relief.** A custom: a share of a year's revenue (`h._incA` × 12).
- **Wardship.** The crown keeps it, or sells it when a house bids more than the wardship's expected income.
- **Tourneys.** Held when the honour won (the existing loyalty and legitimacy quantities) is worth more than the host's cost. A house enters when a rider's expected winnings (skill against the field) exceed his board.
- **Companies** hire at the going pay; with no employer, they raid when their purse runs out.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| house | crown | scutage, relief, fine for a marriage |
| ward's estates | crown or buyer | wardship |
| buyer house | crown | sale of a wardship |
| host | carpenters (lists), prize winners | tourney |
| entrants | host town's sellers and crafts | board |
| loser house | winner house | horse and harness, ransom |
| crown, houses | company, or `'out'` for foreign companies | hire |
| households | crown, then `'out'` | crusade tithe, then spent abroad |

- Crown: **+0.3–1k a year** (5–15% of its revenue): reliefs and wardships come with deaths (about one head in four years among five houses); scutage only in war years. Paid by the houses, so it moves lords' coin towards the capital, where the crown spends.
- A tourney brings **0.2–0.5k** to its town.
- Native companies keep hire money in the realm that now goes to `'out'`.
- Crusades are a drain, which is why they are optional.

**6. Performance.** Events only: deaths, the start and end of wars, decrees. Target: **0.1% of a day**.

**7. Screen and advisor.**
- House card: ward and warden; relief paid. Crown panel: scutage, sale of wardships, proclaim a tourney (journaled). Tourney results in the annals and the riders' life lines.
- Annals: "House Gamsburg pays scutage rather than send its knights south." "At the tourney of Montepino, Ranulf Strong unhorses three and takes their horses."

**8. Tests and measures.**
- Tests (`tools/knighthood.test.mjs`): a house cannot both send its host and pay scutage for the same call; relief and wardship move only named purses; a ward ends at majority; a tourney's ransoms conserve; companies paid only by a named employer; replay.
- Soak fields: scutage paid; reliefs; wardships and their income; tourneys and the coin spent; companies formed, hired and turned outlaw.

**9. Dependencies.**
- #39: consent to scutage.
- #37: wardship disputes.
- #38 and #35: crusaders' mortgages.
- #44: plate armour, the longbow and the cannon change a knight's worth, and so the scutage a crown can ask.

---

## 7. #40 Learning

**1. History.**
- Schools: cathedral and collegiate schools (Chartres, Laon, York, Canterbury), monastic and almonry schools, and town grammar schools from the 12th–14th centuries.
- Universities: Bologna c. 1088, Paris c. 1150–1200, Oxford c. 1167, Cambridge 1209. Masters lectured for fees; colleges came later (Merton 1264).
- Oxford's ~1,500 scholars in a town of ~5,000 each spent £2–4 a year on board and hall rent: as much as a large manor's income, paid by families elsewhere.
- Scholars became clerks, priests, stewards and lawyers. A rectory paid £5–10 a year.
- Bishops, kings and lords paid stipends and founded colleges.

**2. Actors and state.**
- **Existing:**
  - `eduPlace(s)` grants a church, cathedral, school or grammar school by era and size.
  - `educate()` raises letters, reckoning, scripture and law (`KL`, `KR`, `KS`, `KLaw`).
  - Nobody teaches and nobody is paid: schooling without a schoolmaster.
- **New schools:** a school is a schoolmaster (a head with office `master`) at a place with a church, cathedral or abbey, and a roll of pupils (person ids).
- **New, the university:** a record at a town {masters, scholars (count and family links), halls, patrons' stipends}.
- **New, a scholar away:** a named person with `p.away` at the university town, as travellers are now. He is still a member of his household, which pays his keep.

**3. Hooks.**
- **Schooling.** In `tickHouseholds`' choice of trade at fourteen (where apprenticeship is decided), school is one more choice. Younger children enrol at their parish or cathedral school on the same day.
- **Fees and board**, paid by the household on its own day: fees to the master (`transfer`, label `schooling`); board at the university town through purchases and `craftWork` there.
- **Learning.** `educate()` raises lettered skills by enrolment and the master's own skill, instead of by `eduPlace` alone.
- **Graduates** take offices: #37's clerks and stewards, #35's novices, priests, merchants' clerks. These are offices that pay.

**4. Quantities.**
- **Enrolling.** A family enrols a child when the lettered trades' expected income exceeds the fees, board and the child's lost earnings over the years:
  - the lettered trades: `tradeIncome` for merchant and reeve, and the fees of #37 offices;
  - the lost earnings: `tradeIncome` of the father's trade.
- **Masters.** A master opens a school when fees and stipends cover his bread.
- **The university.** It forms when enough masters can live by the scholars' fees in one place: at least four. The cathedral school is its usual seed.
- **Patrons' stipends** (crown, lords, abbeys) lower a scholar's cost; this is the lever #44 counts.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| families | masters | fees |
| families | university town's sellers and crafts | scholars' board and lodging |
| crown, lords, abbeys | masters, scholars | stipends |
| families | parish or abbey | almonry school gifts |

- At this realm's scale: a cathedral school of 10–20 scholars and later a small university of 40–100.
- At one to two `foodYr()` a scholar a year, **0.2–1k a year** comes into the capital or the university town from village and town families.
- Employment: **4–12 households** (masters, hall-keepers, a stationer).
- The larger effect is indirect: supplying #37's clerks and #44's learning.

**6. Performance.** Yearly, on each household's own day, for its children only. A university record is updated on its town's day. Target: **0.1% of a day**.

**7. Screen and advisor.**
- Settlement card: school, master, pupils. University card. Crown and lord panels: stipends and founding a college (journaled); these feed #44's learning view.
- Annals: "Masters gather at Rougecastel; the schools there are called a university."

**8. Tests and measures.**
- Tests (`tools/learning.test.mjs`): skills rise only with enrolment; fees conserve; a school closes when fees fail; a scholar's board is paid where he lives; replay.
- Soak fields: pupils and scholars by place kind; masters; fees and board by place; graduates by office taken.

**9. Dependencies.**
- A cathedral (which exists) or #35.
- #37 for demand.
- Feeds #44 directly: scholars are its first source of learning.

---

## 8. #43 The craft ladder

**1. History.**
- Apprenticeship of seven years (London from c. 1300), with premiums of £2–10. Journeymen earned day wages of 3–6d. Masters kept a shop; the freedom of the city came by apprenticeship, patrimony or purchase (20s–£3).
- Merchant guilds from the 11th–12th centuries, craft guilds from the 12th–13th. Their income: entry fines, quarterage (4–12d) and fines from searches for bad work. They spent on feasts, a chantry, alms and funerals for poor members, and they limited entry. Towns set the assize of bread and ale.

**2. Actors and state.**
- **Existing:**
  - Apprenticeship, in `tickHouseholds`: a fee paid to a master of the trade, or to `'out'` with none.
  - A trade's takings, shared by `payCrafts` among its households by weight (`TRADE_W`, shop tier, `KCr`).
  - A guildhall archetype (`TOWN_ARCH`) without a guild.
  - A dilemma ("the merchant guilds seek a charter") in which the crown pays 500 and every town's prosperity rises: a stand-in.
- **New, on heads of a trade:** `master` or `journeyman`.
- **New, a guild per trade per town:** an owner {trade, town, chest, wardens (heads with office `warden`), members, entry fine, quarterage, ordinances}. The ordinances are in-world customs: apprentices per master, and the quality searched.

**3. Hooks.**
- **Takings**, in `payCrafts`: a master's share by weight as now. He pays his journeymen a wage from it (`transfer`, label `wages`), instead of each taking an equal share.
- **Becoming a master**, in `tickHouseholds`' trade choice and setting up house: a journeyman becomes a master when he can pay the entry fine and a shop's rent.
- **Quarterage**, on the town's `tickHouseholds` day.
- **Searches**, at the great court of #37 or the guild's own day: fines for poor work (low `KCr`) go to the chest.
- **The chest's spending**, on the town's day: the feast (purchases at the town), alms to members in want (as parish relief does, from the chest), a gift to the parish fund, and guildhall upkeep (`buildWorks`).
- **The charter dilemma** becomes a real purchase: the guild buys its charter.

**4. Quantities.**
- **Forming a guild.** A trade's masters form one when each new entrant would lower their income per master (the trade's takings ÷ masters) by more than their share of the charter's price.
- **The entry fine.** The guild sets it at the present value of that dilution. It rises in crowded trades and falls in scarce ones.
- **Journeymen.** A master hires one when his share of the takings exceeds what one man of his skill can work: a shop of a higher tier, a better hand. The journeyman's wage is what he would earn as a labourer or a master elsewhere (`tradeIncome`).
- **No price fixing.** Guilds keep to entry, dues and quality. The town's assize of bread and ale is a decree in the world: the allowed exception.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| apprentice's family | master | premium (exists) |
| master | journeyman | wages |
| new master | guild | entry fine |
| members | guild | quarterage, search fines |
| guild | victuallers, poor members, parish, masons | feast, alms, chantry, guildhall |
| guild | lord, crown or commune | charter |

- Net new income is about 0: the craft's takings are divided differently.
- The chest turns 0.1–0.3k of dues into relief for the trade's own poor and into spending in town.
- Effect on the capital's gap: little (economy agent's estimate).
- Its value is structure: journeymen paid by masters, entry limited by a quantity, and a safety net within each trade.

**6. Performance.** Per town, on its yearly day, over the trade's members. `payCrafts` already runs over them. Target: **0.15% of a day**.

**7. Screen and advisor.**
- Settlement card: guilds, their chests, masters and journeymen. Guild card. Lord, crown or commune panel: grant or refuse a charter (journaled).
- Annals: "The weavers of Pontecala buy a charter; no man may set up a loom there unless he is free of their guild."

**8. Tests and measures.**
- Tests (`tools/guilds.test.mjs`): takings conserved between master and journeymen; a chest pays only from what it holds; entry follows dilution (fixture); no guild sets a price; replay.
- Soak fields: guilds; masters and journeymen by trade; entry fines; alms from chests; incomes per master in guild and non-guild towns.

**9. Dependencies.**
- #39: communes license guilds.
- #37: searches at court.
- #44: guilds may slow a technique; TECH-TREE question 4.

---

## 9. #42 Bondage and freedom

**1. History.**
- Personal unfreedom (villeins, serfs) was distinct from tenure, though the two went together.
- The unfree owed merchet, heriot, tallage at will, leyrwite, and chevage (2–12d a year) for living off the manor. They could not leave without licence.
- A year and a day unclaimed in a chartered borough made a man free (Glanvill).
- Manumission was bought, for several years' rent.
- After 1349, scarcity of labour brought flight, commutation, leasing and higher wages. The Statute of Labourers (1351) decreed wages; the rising of 1381 followed. Serfdom faded in England by 1500 and deepened east of the Elbe.

**2. Actors and state.**
- **Existing:**
  - villein tenure per strip; "servile" in `inherit` means holding a villein strip;
  - free migration (`tickHouseholds`, `journey`);
  - the dearness of hands (`tickTenure`'s `dear`).
- **New:** `status` on a household head (`free`, `villein`), passed to his children by custom (through the father in England; a custom on the place).
- **New:** dues attach to status: merchet, heriot and tallage follow the person.
- **New:** a fugitive record {household, from place, lord, day fled}.

**3. Hooks.**
- **Leaving**, in `tickHouseholds`' moves: a villein household leaving its lord's places pays a licence fine or chevage yearly, or flees.
- **Flight to a chartered town** (#39): after 360 days unclaimed, the household is free. In that time its lord may claim it at the town's court (#37).
- **Manumission** is bought on the place's `tickTenure` day.
- **Wages after a plague**: `tickTenure`'s `dear` measure, already present, drives #36's commutation and leasing. A decree may cap wages: an in-world decree, the allowed exception, which raises unrest.

**4. Quantities.**
- **Flight.** A villein flees when the gain from better work in town (`tradeIncome` there, minus here) outweighs the holding and chattels he leaves and the chance of being reclaimed.
- **Reclaiming.** A lord claims a fugitive when the dues lost outweigh the plea and the journey.
- **Manumission.** The villein buys when the value of dues avoided plus better prospects exceeds the price. The lord sells when the price exceeds the dues' present value, or when he needs coin.

**5. Money flows.**

| Payer | Recipient | Why |
|---|---|---|
| villein household | lord | manumission, licence, chevage |
| lord | court officials | a claim for a fugitive |

- Lords: **+0.1–0.3k a year**.
- The larger effect is labour: households move to towns that can feed them, which bears on #20 and #22 (hamlets multiplying).

**6. Performance.** Folded into moves and tenure days already run. Target: **0.1% of a day**.

**7. Screen and advisor.**
- Household card: status. Settlement card: villein and free households; fugitives harboured. Lord's panel: manumit, claim (journaled). Crown: the wage decree.
- Annals: "Wat of Becville, a year and a day in Pontecala, is a free man."

**8. Tests and measures.**
- Tests (`tools/bondage.test.mjs`): status passes by custom; a fugitive is freed at 360 days unless claimed; manumission conserves; replay.
- Soak fields: free and villein shares; fugitives; manumissions; moves to towns.

**9. Dependencies.** #36 (dues), #37 (claims), #39 (chartered towns).

---

## Order of work

1. **Groundwork.**
   - Two new owner kinds (abbey, guild) in `acct`, `means`, `transfer` and the ledger.
   - Offices on household heads.
   - The `'inst'` random stream.
   - Lords' whereabouts (`h.at`).
   - Bounded per-place record lists.
   - The soak's `inst` section.
2. **#36.** Mill and oven farms, commutation, entry fines, merchet, tolls, liveries. Its soak fields test the claim that rot falls and lords' coin rises.
3. **#37.** Manor courts first, collecting #36's dues. Then the eyre and the bench.
4. **#39.** Subsidy, attendance, communes.
5. **#35.** Abbeys, reusing #36 and #37 with an abbey as lord.
6. **#38.** Interest and pledges (needs #37), forward sales, the mint.
7. **#41, #40, #43, #42**, in that order.

Each lands as a behaviour change in its own batch, with the matched soak the test runner already uses (money, famine, population, CPU and economy at once). Calibration choices go to the user.

Era gates, following the kept historical gates:

| From | What |
|---|---|
| the start | manor courts, mills, tolls, Benedictine houses |
| 1070 | communes |
| 1100 | Augustinian canons |
| 1128 | Cistercians |
| 1150 | universities |
| 1166 | the general eyre (Assize of Clarendon) |
| 1194 | licensed tourneys |
| 1265 | parliaments |
| 1349 | leasing after the plague |

#44 may bring some earlier or later.

## Open questions

1. **Abbeys' land.** Should a founding take a house's existing demesne, shrinking its revenue, or only waste and wood turned into granges? Or both, as history did?
2. **Lords' whereabouts.** A lord at the capital: a record of days only, or a household that travels and is drawn on the road?
3. **Commutation.** Decided by each lord's quantities alone, or also a player command for the player's lord and the crown?
4. **Usury.**
   - Model the Church's ban: licensed lenders, and Christians lending only by rent-charge and pawn?
   - Or a plain interest market?
   - If the ban: are Jewish lenders and the expulsion of 1290 part of the history, an option, or left out?
5. **Subsidy rates.** The conventional fifteenth and tenth (a custom in the world), or a rate the crown asks and parliament votes?
6. **Amercements.** Should the coinless be pardoned ("quia pauper"), so courts take nothing from the poorest? And who sets the cap: custom, the lord or the crown?
7. **Spoilage.** Offered grain rots quickly in open yards ("exposure-loss"), while dry grain kept one to two years in a barn. This is #23 calibration, but it sets how much #36 and #35 can recover. Should lords' rent grain go to a barn (the `grange` storage type) first?
8. **Fish.** 13–25k rots a year, mostly in villages. Should abbeys' fast days and salting (the salter trade) be in #35's scope, or a separate item?
9. **Crusades.** Include them (a drain on coin and men, and a land market) or leave them out?
10. **Era gates.** Hard historical years (the table above), or arrival through #44's learning?
11. **Parks, warrens and dovecotes.** They are the lord's own table, not income. Do they need a new good (game) for the hall, or can they wait?
12. **New owners in the census.** Should abbeys and guilds appear as holders of their own in the money census and the accounts panel, or be folded into "church" and "town funds"?

## Decisions (user, 2026-10-07)

1. **Abbeys follow the Cistercian model** (#35). Founded on lords' grants for prayers and burial, mostly marginal land (moor, marsh, waste) cleared into granges worked by lay brothers (conversi) and hired hands. Wool is the great trade, often sold years ahead, with real risk of debt when scab or murrain takes the flock. Mills and tanneries for their own use, fishponds and fisheries (no meat of four-footed beasts), an almonry at the gate and hospitality. Papal privilege frees self-worked land from tithe; the order visits its own houses (mother and daughter houses, the yearly General Chapter abroad). Early statutes forbid villages, serfs, rents and tithes; leasing granges for rent comes later, sooner after a plague thins the lay brothers. Benedictine abbeys, the manorial landlords with markets at their gates, may follow as a distinct kind.
2. **Fish is in scope for abbeys** (their diet and fishponds).
3. **Lords travel visibly** to court, parliament and war; a lord at the capital is a person who went there, not a record.
4. **Commuting labour services** follows the lord's own reckoning; the player may intervene with an order.
5. **Usury is a policy choice** for the ruler (allow, licence or forbid), not a fixed rule.
6. **Taxes are set by the lord or the player**; a parliament votes them only once a parliament exists (#39).
7. **Pardoning the poor's fines** is a player or lord order, part of strategy.
8. **Lords' rent grain goes to a barn first** (it rots less), as calibration for #23, #35 and #36.
9. **Crusades and foreign wars** exist as something a ruler or lord can undertake.
10. **Institutions arrive through the technology tree's learning** (#44), calibrated so that average play reaches them near their historical years.
11. **Goods that mattered get added** (e.g. venison, rabbits, pigeons, fish from ponds) when their system needs them.
12. **Abbeys hold their own purses and land in the money census;** the order and the wider Church (bishops, chapters, the papacy) are separate holders, some abroad, and real flows leave the realm to them (tenths, Peter's Pence, the order's contributions).
