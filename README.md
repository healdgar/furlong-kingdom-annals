# Furlong: Medieval Kingdom Sim

*A living medieval kingdom in a single file, from the strip of field to the crown.*

A procedurally generated (or real-region) medieval kingdom rendered in real-time 3D that you can
watch for five minutes or five hours. Zoom from a satellite view of the whole
realm down to a market square. Time runs; harvests come in; caravans crawl the
roads; a queen dies without a clear heir and the great houses raise banners;
plague follows the trade routes; a dragon notices the treasury has gotten
large. Everything that happens is written into a scrolling **Chronicle** in the
voice of a medieval annalist, and a cinematic **auto-director** flies the
camera to the story as it unfolds.

**The whole app is one file: [`index.html`](index.html).**
Vanilla JS + Three.js r128 from CDN. No build step, no framework, no backend,
no assets — everything is procedural (terrain, buildings, heraldry, names).

## Run it

Open `index.html` in a browser, or drop it on any static host (Netlify, GitHub
Pages). That's it. In a small container:

```sh
docker run --rm -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
# then open http://localhost:8080  (the browser fetches three.js from cdnjs)
```

- **Map size**: 9 km of ground by default, standing for a realm about 360 km
  across. `&km=4` to `&km=15` in the link sets another size (`&km=6` is the
  older, lighter map for slow machines). The ground keeps its grain in metres
  whatever the size, so a bigger map has more hills, rivers and places, not
  bigger ones. The terrain can also come from a survey of a real region
  (`&map=name`, or *Land* on the Realm tab): rivers, soils and sites then
  follow the real ground.
- **The Channel** (`&map=channel`): southern England and Normandy, London to
  Paris, from public elevation data (sea floor included). Founders favour the
  51 historic town sites and take their names; each place speaks the tongue
  of the nearest historic town reachable over land, so the sea parts English
  from French; the crown and each house speak their seat's. More regions:
  `python3 tools/realmap.py tools/regions/<region>.json` (a box, the towns and
  their tongues).
- **Over the water.** Each land mass has its own roads; sea lanes join them
  between their ports (more as ports grow). Carts never cross; the cogs carry
  that trade. A host that must cross charters transports (about 0.6 crowns a
  man per crossing, plus a fixed fee), waits some days at the port, sails at a
  ship's pace and is drawn as a squadron of cogs under its banner; it cannot
  fight at sea, and a lord who can't pay stays ashore.
- **Land and fate**: the map seed (`#s=1234567`) fixes the land; the fate seed
  (`&f=…`) fixes the history lived on it. A new game rolls a fresh fate, so the
  same land runs a different history each time (Realm tab: *Reforge* with the
  Fate box blank). *Copy share link* carries both, reproducing your realm and
  its history exactly.
- **Export chronicle** downloads the full annals of your run as a `.txt`.
- **Performance monitor** (`P`, or `#perf` in the URL): frame rate and frame
  time, how much of each frame the main thread is busy (simulation, world
  animation, mesh rebuilds, render submission), GPU time per frame where the
  browser exposes a GPU timer, draw calls, triangles, memory and scene size.
  *Copy report* puts it on the clipboard.

## Reading the realm

- **The map's names say what matters at a glance.** When you rule, your own
  places are named in gold and your enemies' in red; a city's name is larger
  than a town's, a town's than a village's. A sign before a name marks
  trouble: ⚔ under siege, ⚠ hungry, ☠ the pestilence, ⚑ near rising. Beside
  your legacy at the top, the road to dominance you are furthest along, and
  any rival nearer to theirs (hover for all four).
- **People on the streets are real.** Walk the camera into a town: the folk
  you see are its residents.
  - **Their own route:** each walks their own way along the town's streets,
    from their door to their work (the smithy, the shop, the fields), perhaps
    to market, and home. On Sundays the town walks to mass and rests after;
    a couple's households walk to the church on their wedding day; grown
    children visit their mothers.
  - **Their own pace:** children quick, the old slow, the hale brisker.
  - **On the calendar's clock:** each keeps personal hours by the day's
    clock. At life pace their walking looks true; faster speeds fast-forward
    their errands with everything else; pause freezes each one mid-errand,
    on the way to work, market, mass or a wedding (click to see which).
  - **Where they're seen:** indoors at home or at a workshop they aren't
    drawn.
  - **Their card:** click anyone for age, trade, home, spouse, parents,
    children, how their family came by its name, nature and learning, and
    where they're walking and by which street. Names on house and person cards
    link to each other.
- **Out at work.** Ploughmen go out to their own household's strips (a
  family works its strips together) and work up and down them: ploughing and
  sowing in spring, weeding in summer, reaping in autumn, threshing in the
  barn in winter; village wives join the weeding and the harvest.
  Woodcutters, foresters and hunters go to the place's wood, shepherds and
  herdsmen to the common, fishers and boatmen to the shore or river bank,
  quarrymen to the quarry and miners to the nearest crag. Villagers live in
  the village (an open-field village is nucleated) and walk out.
- **Errands between places.** Round trips, the traveller staying on their
  own town's roll: on market day a few villagers walk to the nearest market
  town and back; married daughters go home to see their mothers; at
  Eastertide pilgrims walk to the great churches. Click one on the road to
  see who they are and why they go.
- **People on the road.** Journeys are real:
  - a bride walks to her husband's village, and emigrants walk from a failing
    town to a growing one, at about 30 km a day on the realm's scale;
  - each cart, barge and cog has a named carter or master from its home town,
    who is away until the round trip is done;
  - the crown's envoys are named riders from the capital.

  Travellers are drawn on the roads; click one to see who they are and where
  they're going. The towns they're heading for already count them.
- **Life pace (🚶, or L).** A day takes half an hour: carts roll slowly
  on screen, hosts march, the flocks graze, and the townsfolk live their day
  in step with the sun (out at sunrise, market at noon, home at dusk). The
  simulation runs whole days just the same, only slower. On pause
  everything stands still.
- **One scale.**
  - **Travel between places:** the map's distances stand for a realm about 40
    times larger (9 km of map for ~360 km), so every traveller moves at its
    real pace in km a day ÷ 40. That gives, in map metres a day: ox-cart 500,
    host on the road 400 and across country 250, a routed host 900, envoys
    1,500, barges 700, cogs 2,800, great ships 3,500, the dragon 8,000.
  - **Inside towns:** towns and houses are drawn true size, so the townsfolk
    keep true time: a walk across town takes some forty minutes and passes in
    a blink at the faster settings. What you see is the rhythm of their day.
- **Names are links.** Towns, great houses and living notables named in the
  chronicle or in a petition are underlined. Click one to fly there and open
  its card (a house opens its head's card).
- **Territory overlay:** each lordship is shown in a colour picked to stand
  apart from its neighbours, over greyed ground, with borders thick enough to
  see from any height. House names sit over the heart of their lands, and a
  legend lists each house with its places and hectares (click one to go
  there).
- **Tongues overlay:** every field coloured by the tongue of the place that
  farms it, each tongue named over its heartland, and a legend of places and
  souls with the towns where two tongues are spoken. Tongues move as the map
  develops:
  - each place keeps a mix of speakers; incomers (brides, emigrants) bring
    their own;
  - a town held for generations by a lord of another tongue takes on the
    court's speech (slowly; villages slower still);
  - when another tongue becomes the majority, the place changes its speech
    and the annals say so;
  - a great house seated among another people takes up their tongue within
    a generation or two (its children are named in it), and a cadet branch
    planted in a fief of another tongue often takes it at once.
- **Land & property value overlay:** every town lot is coloured by its own
  worth, fence to fence, and every furlong by its yield and how near its
  buyers are. A house's card gives its rent and lot size.
- **Land use overlay:** every furlong coloured by what it is doing now: corn,
  hay meadow, vines, gardens and closes, pasture, woodland, rough grazing (the
  common within a place's reach), scrub and fallow, burnt ground; the lords'
  home farms hatched. The legend gives the hectares under each, and the beasts
  at grass.
- **Acts** that can't be done just now are greyed out and say why (no dragon
  in this realm, already at war).

## Controls

| Input | Action |
|---|---|
| drag | pan (the ground stays under the cursor) · **right-drag** or shift-drag turn & tilt · **scroll** zoom toward the cursor · trackpad: two-finger swipe pans, pinch zooms · touch: one finger pans, two pinch and twist |
| click | inspect anything: settlements, buildings, armies, caravans, the dragon, walls, roads, streets, rivers, land parcels (tenure, lord, crop, state) |
| `Space` | pause · `L` life pace (a day in half an hour) · `1–5` speeds (half a day to a year per second) |
| `R` | **Rule the realm** — Sovereign mode (see below) |
| `C` | **Watch mode** — pure documentary screensaver |
| `M` | parchment map (click to fly) · `Esc` closes it |
| `H` | hide UI · `Esc` deselect / cancel placement |

Touch: one finger orbits, two fingers pinch-zoom.

The left drawer has five tabs: **Crown** (Sovereign mode), **Rates** (harvest,
plague virulence, house aggression, myth dial…), **Acts** (Unleash plague ·
Wake the dragon · Assassinate the monarch · Contest the succession…),
**Overlays** (territories, trade, prosperity, plague, unrest), and **Realm**
(seed, houses, succession — click a name to inspect them).

## The game

You play a dynasty, as the crown or as a great house (choose on the Crown
tab; pick a campaign of 100, 200 or 400 years first). Every house, yours
and its rivals, is measured each month on four paths; the Crown tab shows
your bar on each, a red mark for the best rival, and what is missing.

- **Conquest**: from the throne, rule three in five of the realm's people,
  with no rival able to raise a third of the crown's host. A lord must take
  the crown to finish it.
- **Concord**: every house bound to you, by a marriage pact or (for the
  crown) loyalty of 75, and a generation of peace.
- **Wealth**: half the realm's trade (its people and prosperity, weighted
  to towns), half its gold, and four chartered towns.
- **Glory**: one great city with its people, a minster with a stone spire
  or twin towers, stone walls, a castle ward within ward (or a citadel),
  paved roads to every neighbour, and a guildhall.

A path held long enough (five years for conquest and concord, three for
wealth, one for glory) wins the realm: for you, or for a rival (the
annals warn when one draws near). If no one wins before the end, the
chronicler weighs every house: its four paths, and your deeds. You lose if
your house dies out or is left landless, or if the throne passes from your
line.

**Deeds** are remembered in the game and across games in this browser:
twenty-five of them, good (a spire for leagues, ward within ward, seven
battles, wyrmslayer, a new town of your own planning…) and ill (sackcloth,
hunger, the pestilence, the wrecker, routed…), each adding to or taking
from your legacy. Only what you do after the game begins counts.

## Sovereign mode — rule it yourself

Press **♛ Rule** (or `R`) to stop watching and govern. Providence's dials and
Acts are sealed while you rule; the crown's own levers take their place:

- **Petitions.** Each names who and where it touches, with a link to show
  them on the map and what bears on the answer (standing, purse, towns;
  people, unrest, holder). The court brings decisions to you — restive houses demanding
  lands, famine relief, sealing a plague town's gates, answering the dragon,
  bounties on outlaws, debasing the coin, border disputes, tourneys. The game
  pauses when one arrives (toggleable); if you stay silent, the council
  decides on the due date. Out of Sovereign mode the council answers every
  petition at once, exactly as the automatic court always did.
- **Decrees** (gold + cooldown): royal feast, open the granaries,
  extraordinary levy, bounty riders, charter a village on the map, raise the
  royal host, sue for peace, pay the wyrm, send champions against it.
- **Works** (orders the world carries out over time, each marked on the map
  while it is in hand): lay a road between two places (surveyed and priced
  by the ground, built by gangs month by month, used by the carts when
  open); pave a road (a third faster); buy a lord's furlong (envoys make an
  offer; he answers weeks later); clear a quarter of a crown town (condemned,
  pulled down house by house as leases end, laid out anew and rebuilt by the
  town's own growth). In a lord's town the crown cannot order it, only
  persuade: a grant of gold, a grant of crown land beside his, a remission of
  his dues, the royal host at his gates (he yields or rises), or plain
  asking. Lords build roads of their own where a long way round carries
  much traffic.
- **Plan with the brush** (as the crown in its towns, or as a great house in
  its own): choose a brush and paint on the map.
  - *Street*: drag a line; its ends join the streets they meet. A street on
    its own must be 30 m or more; one that starts or ends on an existing
    street can be as short as a link (6 m), to tie a dead end in.
    *Stop up a street*: drag along a street, or the stub of one; that stretch
    is taken up (what is left either side stays), and any house left with no
    way to a street is bought out. The high road is not stopped up. *Square*:
    drag a loop; it becomes a market place (with a charter) or a square.
    *Wall*: drag a loop about the town's heart; the circuit follows it, along
    the bank where it meets water. *Pull down wall*: drag along the wall; that
    stretch comes down and stands open (a stone wall's blocks go back to the
    yards); pull down nearly all of it and the town is open. A gap weakens the
    whole circuit's defence. Buildings block a line only where it crosses
    their actual footprint.
  - The price is what the ground holds: every house under the brush is bought
    at 25 years' rent (so the dear heart of a town costs far more than its
    edge), field and meadow at their worth, then labour, timber and stone
    (stone the yards lack is carted in). Churches, castles, halls and the
    like cannot be painted over: the brush must go round them.
  - Commissioned, the line is pegged out on the map and reserved (no one
    builds on it); the householders are bought out one by one, then the works
    go forward as the purse allows, halting when it is empty. When done, the
    street, square or wall opens (or the wall comes down) and the town's own growth fills its
    frontage. The brush bar lists the works in hand.
- **Save, resume, share** (💾): a save is the world's seed and every command
  you gave, with its day; resuming grows the same world again and gives each
  command on its day (about a second for each year played). Saves are kept in
  the browser (and made each year and when you leave the page); *Share* gives
  a short code (or a link) anyone can load, a file, or posts it to the page's
  shared shelf on claude.ai. A save from an older build may unfold
  differently.
- **The great houses**: honour them, take a hostage (they are far less likely
  to rise for two years), arrange a royal match, or attaint them for
  treason — seize their lands on success, civil war on failure.
- **Settlements** (inspector): relief grain, garrison, walls, quarantine,
  suppress unrest — in the crown's own towns. A lord's towns are his: the
  crown must persuade him.
- **War**: click a host of yours → *Order a march* → click a town, or open
  ground to camp there (across country is slower than the road). Hosts hold
  where you send them until released to their captains. Everything moves on
  one clock: carts (500 m a day) arrive when their goods do, and hosts are
  slower (400 m a day on the road, 250 across country). Hosts meet where their
  paths cross, not only at towns; against a host keeping to its town, the
  battle is fought before the gates. A battle shows as two lines facing each
  other, surging and falling back, the dead where they fell, dust over the
  melee and a ⚔ over the field.
- **Attack a host**: give a march order and click an enemy host (or any
  other house's): yours pursues it, turning each day toward where it is
  going, until they meet. If your lords are not at war, drawing the sword
  begins it: a feud between two houses, a rising if the crown is one of them.
  Click the soldiers themselves, not just the banner; the hint under the
  cursor says what the click will do. A host lying in a town is attacked by
  marching on the town (a siege if it is walled).
- **Split and join**: a host can split into two columns (half the men and
  horse each, the second under another of the house's lords), and two of
  your hosts within 250 m can join. Lords' hosts gather the same way.
- **The watch**: every town keeps its own garrison, sized by its people, its
  walls and castle, and the danger it is in (raids, war, a border). The lord
  musters men each month toward it while the purse allows, and pays them
  off when the danger passes. Up close they stand at the gates and in the
  castle (a village's at its green). A host lying in its own (or, in peace,
  a friendly) town stands in the castle yard; *Leave in garrison* folds it
  into the watch.
- **More hosts**: any town you hold can *call out its watch* as a host
  (three quarters march, a quarter keep the gates) or *levy a host* of its
  people (300 gold).
- **Call to arms**: when an enemy host comes within about a day and a half's
  march, a town arms 4–15% of its people (more with walls, a castle and
  silver for arms). They man the walls and count in its defence and
  sorties, cost it prosperity while they are out of the fields and shops,
  and go home a few days after the danger has passed.
- **Reinforcements**: a host within 500 m of a battle, at war with one side
  and not the other, comes up and joins it, forming behind the line; the
  fight lasts a day longer for each, and the whole side wins or breaks
  together.
- **Why it turned back**: a host's card says why it is marching home (the
  war over, a siege failed, beaten in battle, wagons empty, laden with
  plunder), and you are told when one of yours does. Given new orders on
  the march, a host turns from where it stands; in peace your own hosts stay
  where you left them; routed, they rally after a few days and await orders.
- **Seize land by force**: click a lord's furlong within 450 m of one of
  your hosts. It is held by the sword: yours for good once one of your
  places is within 1500 m, otherwise only while a host of yours stays near.
  The lord loses loyalty (more each time) and bears you a grudge; every
  other lord a little; the crown a little legitimacy. A town's own ground
  goes with the town: take the town. In war your hosts take enemy furlongs
  about them as they go.
- **Territories**: the map's legend says how each house stands toward you:
  at war (⚔), in revolt, your liege, or a vassal (loyal, uneasy,
  disaffected, with its loyalty), feuding with whom, and whether it bears
  you a grudge.
- **Walls take time**: a new palisade, a stone wall or a bastioned trace is
  raised round the circuit from the main gate, over weeks for timber and
  years for stone; unbuilt stretches are open, half-done stone still shows
  the old palisade, and the defence grows as the work goes on.
- **Hosts are men**: up close a host is its soldiers. On the march it is a
  column on the road, three abreast, in companies each under its standard;
  it does not walk through houses or an enemy's walls (it bunches outside
  them). Lying at a town it camps on open ground outside, by a road. Siege
  lines stand clear of the suburbs.
- **Gates and breaches**: when a town is besieged its gates are shut and
  barred. The storming party masses on the road at the main gate under a ram
  in its shed. If the storm succeeds the gate lies broken in its passage and
  the host files in along the streets to the market.
- **Walls take damage**: each day of a siege the engines (rams and mining,
  then trebuchets, then guns) batter the stretch facing the lines, worst at
  the gate; a storm throws down the gate and the wall beside it; castles are
  battered the same way. Battered stretches are drawn lower, breaches as
  rubble, towers broken. Damage weakens the defence until repaired: each
  year the lord pays the masons if he can (the walls' card says what the
  repairs wait on), and a poor town lets its walls crumble.
- **Who wins**: each side's strength is weighed by:
  - its morale;
  - its commander (arms, riding, nerve and wits);
  - its men's own skill at arms (green levies against veterans and sell-swords);
  - horse against foot: riders count fully on open ground, little in wood or
    marsh, and half when charging uphill or out of a ford;
  - the ground the attacker must cross: charging up a slope or through a river
    costs it, and coming downhill helps;
  - fatigue: it builds up on the march (faster across country) and wears off
    in camp;
  - fighting before one's own walls;
  - weather and the day's luck.

  The chronicle gives the reason for the day ("could not carry the slope",
  "the charge of their horse told on the open ground"), and so does the cairn.
- **The host is its men**:
  - Levies are real people off the town's roll, the unmarried and practised
    first; the rest are foreign sell-swords with their own names.
  - Riders take the town's horses; a sell-sword who rides brings his own.
  - Losses fall on the least skilled, and horses die with their riders.
  - Released men walk home to their own villages.
  - The army card shows where its men come from and its best fighters.
  - A battle cairn lists every fallen man by side and home town, and the lords
    slain.
- **Sieges**: the besieged man their walls (or the castle's palisade, or
  barricades at the town's edge); the besiegers are strung round outside the
  walls, as far round as their numbers can hold. Roads through their lines
  are cut — carts halt before them and wait — while a host too small to
  encircle the town leaves the roads on the open side free to trade. A host too weak to
  storm a place raids it instead — burns and occupies its fields for a
  season, then withdraws with the plunder; taking a town means a siege.
- **Fortifications**: a town's defence is its garrison, burghers and sheltering
  hosts multiplied by its works — palisade and ditch, stone walls, a bastioned
  trace, citadel, motte or hill castle — raised further by the share of the
  circuit a river, cliff or hillside guards and by high ground. A siege ends in
  a storm weighed against that defence (hunger cuts it); a failed storm costs
  the besiegers dearly and either renews the siege or breaks it. A host
  fighting before its own gates takes heart from them: at even numbers it wins
  about 7 fights in 10 behind a palisade, 4 in 5 behind a typical circuit,
  9 in 10 behind the strongest. The town card shows the multiplier and its
  causes.
  Zoomed out, hosts, camps and the dragon show as heraldic badges.
- **Ambitions & legacy**: eight ambitions (coffers, multitude, concord,
  beloved, ten years' peace, crush a rebellion, slay the dragon, found a
  village) plus two points per year build your dynasty's **legacy** (✦). If
  your line loses the throne, the reign is scored and you may rule on as the
  new dynasty. Best legacy per seed is kept in the browser.

## Play a great house

In the Crown tab, *Or take up a great house* lists every landed house; pick
one (or open the game with `&h=N`, e.g. `#s=7&h=2`). The crown then governs
itself; you rule one lord's domain:

- **Purse and dues.** Your towns' rents fill the house purse; hosts,
  castellans and garrisons drain it. Set the dues on your tenants: heavier
  fills the purse and stirs the towns, lighter lets them prosper. The crown
  takes only a feudal aid from your towns (its own towns pay it in full).
- **Works and largesse**: keep open table, call out the levy or send it home,
  lay a road from one of your towns, pave a road to one, found a village on
  your own land or open waste, send gifts to court.
- **Neighbours**: defy a neighbouring house in a private war, or sue for peace.
  Houses marry into each other: a match is ten years' pledged peace (breaking
  it costs you your word). At a private war's end the towns taken go back,
  save the best one to a decisive victor; the loser remembers.
- **Town works** (in any town of your own, crown or lord): a mill (+20% grain),
  a granary (keeps 60% more against famine), a market charter (dues half
  again), assarters (for three years the plough takes in the wood and waste).
  Lords and the council build these on their own too.
- **Why?** Your standing at court is explained: what moves it year by year
  (tax, unrest, legitimacy, the monarch's character, a strong house's pride)
  and the recent swings with their causes; the purse shows last year's
  accounts (rents, markets, hosts, castellans, garrisons, works, land).
- **Your hosts** wait on your orders like the crown's (click one, then a town).
- **The throne**: raise your banners and claim it, or seek a royal match to
  bring royal blood into your line (a claim). When a monarch dies with no
  child, the crown passes to the royal kin; failing them, the great houses
  elect (royal blood, might, friendships and grudges sway the votes, and the
  runner-up may fight). A crown with no legitimacy left and most houses
  estranged is set aside by election. If your house wins the crown, you rule
  on as the sovereign.
- **Your table**: your own petitions come to you — the crown's summons in its
  wars, a rising's envoys asking you to join, a weak throne you could claim,
  creditors when the purse runs dry, a rioting royal town offering itself to
  your banner. Everything else the lords and the council decide as before.
- **Ambitions**: three and six towns, a full strongroom, the crown's favour,
  a won private war, a village of your own, and the crown itself.

## The economy drives it

What happens is decided by quantities the economy produces, not by numbers crossing hand-picked lines
(the register of what was replaced, and what remains, is [docs/SIM_DEBT.md](docs/SIM_DEBT.md)):

- **Prosperity** is a town's measured surplus: what its land, trade and crafts keep beyond its people's
  needs, less hunger, disorder and danger. Shocks knock it down; it returns to what the economy supports.
- **A living** comes from the land a place ploughs and the waste it could still clear (discounted by the
  clearing), its fisheries, the margin on the trade through its market, its workshops and offices, the
  surplus of the country about it, and, for a seat, the dues of its lands. A village becomes a town when a
  good share of it lives by its market.
- **People move** from where life is hard or crowded to where there is a living and room (weighed against
  rent and the length of the road); strangers come by sea and the border roads.
- **Houses** are built for households without one, as fast as the town's means and timber allow; burned
  plots are rebuilt first; empty houses fall vacant in proportion to the vacancy; owners rebuild in better
  stuff where the value added repays it; lanes open as the shortfall of plots needs.
- **Walls** are paid for by the burghers' murage and raised when the danger, weighed by what the town is
  worth, outruns their cost; repairs come from the murage, then the lord. **Castle works** are ranked by
  what they add to the defence of what they protect, against cost. **Churches** take gifts from what lords
  have to spare; a new parish comes when the churches cannot seat the people.
- **Lords** invest where the return repays the cost, sell fiefs at their rents, found towns where carts pass
  and forts where held land is worth keeping; **risings** come when a lord's grievance, weighed by his
  chance of winning, outruns the risk; **towns** revolt when their anger outruns the garrison's hold;
  **wars** end when the realm wearies of them.
- **Households** keep their own purses and make their own choices once a year:
  - **Growing up:** grown children set up house of their own when they can earn their keep (by
    twenty-six at the latest), with a portion from their parents; their new household needs a roof,
    which is what builds the town.
  - **Spending:** the necessaries (bread, fuel, cloth) are bought at the town's prices; what is left goes
    as the family's temper takes it (the bold to the tavern, the vain to finery, the careful into
    savings), a cow for a farming family that can afford one, land when a neighbour must sell.
  - **The trades live on it:** what families spend is the living of the bakers, carpenters, smiths,
    carters, merchants and the rest, shared among those who follow each trade, so a crowded trade pays
    less and a scarce one more.
  - **Choosing a trade:** at fourteen the young take up what pays best here: the father's trade is
    learned at home, any other costs an apprenticeship the family must afford; a man under forty whose
    trade has failed him turns to a better one.
  - **Moving:** a family goes to another place when its trade would do better there by more than the
    road and setting up anew would cost; whole named households take to the road together.
  - **Homes on the land:** a farmer who owns his strips builds a farmstead out among them when the walk
    saved and the eye kept on his crops repay the cost and the company of the village (less so in
    troubled times); a landlord builds one for his tenant when the rent repays him; woodmen and fishers
    put up huts by the wood and the water.
  - **Time:** the poor work on past dusk; a man with coin to spare and a taste for company stops at the
    tavern on his way home.
- **Every coin comes from someone and goes to someone.** The accounts are the households' purses, the great
  houses' coffers, the crown's treasury, each church's fabric fund, each town's murage chest, and the world
  beyond the realm. Every building has an owner (a household, the lord, the church, the town); rent goes to
  the owner, and an owner who lives in his own house pays none.
  - **The market:** every unit in a town's stores belongs to someone: a seller who has offered it, or a
    household that has bought it and not yet used it. Each month the harvest is offered by those who grew
    it (the tiller's share, the landowner's, the lord's home farm and his tenants' rents in kind, the
    church's tithe, the mill's multure), and the catch, timber, ore, tools, cloth, wine, hay and stone by
    those who made them. Households buy the month's bread, fish, fuel, cloth and tools as their purses and
    their credit (beasts and land they could sell) allow; the cheaper of bread and fish is eaten more; what
    they cannot buy, they go without, and a town whose families cannot pay goes hungry with full barns.
    A household tops up to a month's need: what is still in the crock from last month is not bought again.
    Smiths buy iron and charcoal, weavers wool, only when the work pays. A buyer takes his own stock first,
    then pays every seller content with the price in proportion; a craftsman or merchant will not sell
    below what his stuff cost him; the millers, bakers, carters and tailors take their margin.
  - **Prices** are found, not set: each month a good's price rises when buyers wanted more than was sold
    and falls when stock stands unsold (half a year's stock is no glut), by at most about a quarter a
    month. The carters carry goods from where they are cheap to where they are dear; foreign ships sell at
    no less than the world price and buy only where goods are cheaper than abroad.
  - **Great households spend what comes in:** a lord's hall lives on what the month left over, and draws
    down what lies beyond a quarter's revenue (or saves toward it): rents came at the quarter days, and a
    great house lived from one to the next. His household's bread, wine, cloth, spice and silk are bought
    at his seat as his people need them; what the market cannot sell him goes on more hands and the town's
    crafts. The court spends the same way, keeping a war chest.
  - **Rents and taxes are paid, not reckoned:** a lord's income is what his barns sell, his houses let,
    his mill and his market take; the crown's is a hearth-penny from each household, customs and tolls
    from the merchants, and aids from the lords. Hosts, garrisons and the watch are paid to the households
    their men come from; castellans to their own; sell-swords carry their pay out of the realm.
  - **Merchants and carters:** every few days the dealers of each place look over what it has to spare and
    send the best load someone will take: a merchant household of the place, or a dealer of the market the
    goods will go to riding out to buy (strangers come only by sea), and a carter (by road) or boatman (by
    water) of either place who is free; a carter who trades on his own account drives his own load. The driver is away for the trip and
    back, and is paid his freight on delivery at the place's going rate, which rises when loads wait for want
    of a driver and falls when drivers stand idle. The merchant pays the market toll and the crown's aid on
    what he brings, and will not sell at the far end below what the load cost him laid down there: the
    price at the origin, the freight and the tolls. Foreign ships buy and sell for silver from abroad.
  - **The labour market:** each trade is paid for its own work: the millers and bakers for bread, the
    tailors for clothes, the brewers for ale, the shoemakers, potters, coopers and the rest out of what
    families lay out on sundries. Where a place has no one in a trade, families take the want to the nearest
    market town that has it (the more of it the nearer the town lies: that is how a town lives off the country
    round), do the rest themselves (or hire strangers, for building), and the want is noted. Families
    already there when the annals open, and newcomers, take the trade among those they hear of that would
    keep a household best: a town is not seeded with smiths because it has smithies. Each year a place reckons what its people in
    each trade actually earned (less what their stuff cost them) and the work that wanted hands; the young
    choose, and a man under forty changes to, the trade that would pay best here, a grown child moves to
    where his trade pays, and a master is paid to take an apprentice (with none here, the boy goes away to
    learn).
  - **Building is wages:** castles, churches, walls, roads, plans, new houses and rebuilds pay the masons,
    carpenters, thatchers and carters of the place (or the nearest that has them); stone is bought from
    the quarry's owner. Whoever will own a new house pays for it.
  - **Death and marriage:** a dead man's purse, beasts and buildings pass to his widow or eldest grown
    child, else escheat to the lord; a bride brings her purse and beasts to her husband's household.
  - **Wards:** when a place grows into a greater neighbour, it becomes its ward (keeping its name and its
    church: the parish stays its own); under one lord it is simply taken in, else the greater lord buys the
    rights at a dozen years' purchase of what the ward actually yields its lord (rents, his share of the
    harvest, tolls), as fiefs are sold. Ward and town keep one market: goods move between them with their
    owners' shares.
  - **Spoils of war:** a sacked town loses half (a raided one a fifth) of its households' coin, its church
    plate and its town chest. By the custom of thirds a man keeps two thirds of the coin he takes himself
    and his lord a third; the chests go to the lord, and the crown takes a third of all the lord's gains.
    Goods come home only as far as they can be carried (spice and silk well, cloth and tools some, grain
    hardly at all); the rest is burned, spilled or trampled. Driven herds go two thirds to the men's own
    families and a third to their lord.
  - **Ways are kept up by use:** a lane with no house on it grasses over (and comes back with the first
    house); a king's road is mended by the lords at either end while the tolls of its carts repay the
    roadmen, else it wears to a rutted track, narrower and slower, never quite gone.
  - **Buildings are reused:** an empty house is taken by a craftsman who fits it out as his workshop, or
    mended by its owner while a tenant may yet be found, and only then let fall; a family lodging in a
    house gets a storey added when that is cheaper than a new house.
  - **Debts stand:** purses and coffers may run below nothing; a family in debt sells beasts and then
    land (the lord buys when no neighbour can), and a lord in debt sells fiefs.

## How it works

- **Holdings beneath the lords.** Every strip has a holder and a worker: a
  villein (owing labour), a free tenant (a small quit-rent), a leaseholder
  (money rent), a sharecropper (half the crop to whoever owns it), or the
  lord's demesne worked by hired hands. Tenures follow the age: villeinage
  early, leases after the great plague, when lords sell off their home farms.
  - Each household keeps a purse: its share of the harvest, its craft or its
    wages, less its keep and its rent.
  - Only a freehold can be sold: in hard years the indebted sell to the
    better-off and stay on as sharecroppers; a yeoman with more strips than
    his household can work lets them to the landless.
  - A holding passes to the eldest son, or is shared strip by strip among the
    sons where the custom is partible (Welsh, German, Slav, Norse); else to a
    daughter or the widow, else back to the lord.
  - Field and person cards show who holds, who works, on what terms, and
    what each household is worth.
- **The land market.** Each year every town's ground is valued on a 16 m
  grid for the two uses that bid for it. *To live on:* the jobs within a walk
  (workshops, the market, wharves, the castle's household, the churches),
  the market's nearness, the safety of the walls (worth more in war), less
  the stink of tanners and dyers. *To trade from:* the passing trade of the
  street at the door, the households near enough to buy, the market. Ground
  is worth its best use, scaled by the size of the town; a building is worth
  its ground's value for its use, by its floor and how well it is built. From
  this alone: the town builds first on its most valuable open lots (so a
  walled town's safe, central ground fills before its outskirts);
  households weigh commute against rent against their purse; yards are
  built on where a house would earn more than the garden; and where
  valuable ground has no street to it, a lane is laid in. A lord's new
  street lets its plots at a charter rent below the market.
- **Where people live.** A household without a roof chooses its lot by the
  walk to its work (its strips, its workshop, the market or quay), the rent
  against its purse, and the safety of the walls (worth more after raids and
  sieges); the best-off choose first. A poor field hand may put up a hovel by
  the strips he works, and a yeoman far from his land builds out on it: the
  home lot is carved out of the field, which loses that much ploughland.
- **Rent shapes the town.** Where rents are dearest, houses rise a storey
  (after 1250 a fourth, jettied over the street) and take lodgers; the
  cheapest houses stand empty first in bad times; half the townsfolk's rents
  reach the lord.
- **Streets cut through.** Each year a town's households' walks to work and
  market are traced along its streets; where the way round costs the town a
  great deal, and the lord can pay, a new street is cut straight through and
  the houses in its line are pulled down and their owners paid (never a
  church, castle, hall or the walls), more cheaply over ground a fire has
  cleared. The annals and the town's history record it.
- **Churches are built in parts.** A church's nave is sized to its parish
  (two souls to the square metre, half the parish at a mass); the parts are
  paid for one by one from a fabric fund (a share of the tithe, the alms and
  bequests of the well-to-do, a bishop's revenues, a rich lord's gift), with
  stone from the town's yards or carted in at a price.
  - Crowded: the nave is lengthened eastward, then given aisles, then (a
    great church) transepts; the houses in the way are bought out. Hemmed in,
    the parish saves for other works.
  - Timber gives way to stone; a bellcote on the west gable to a west tower
    built onto the west end; then a shingled spire, a stone one; a minster
    gets twin west towers and a crossing tower. Each parish has its own
    leaning: some build spires, some keep a plain tower with pinnacles.
  - A rounded apse in the old style; after c.1190 the new style: a square
    east end, buttresses, a loftier nave.
  - The west front and its door face the street or square when the church
    stands end-on to it; otherwise the altar is to the east and a porch opens
    on the street side.
  - Click a church: its fabric, its congregation and room, its fund and what
    it is saving for.
- **Castles grow by parts.** A lone tower keep is given a palisade, then a
  stone curtain, about its yard (the houses within are pulled down); curtains
  gain towers (square, then round after c.1200), a gatehouse of two towers,
  then a barbican; the yard a chapel and a hall of stone; the crown's own
  castle at last an outer curtain, making it concentric. How far a castle
  goes depends on what the place is worth (a village fort, a town, a seat,
  the capital); each work waits on the lord's surplus and comes sooner on a
  border or in war. Each part adds to the defence a siege must overcome.
- **The yards fill.** Behind each town house lies its toft. Where ground is
  dear (in the heart of a town, from about 1100), a yard is worth more built
  on than dug: the householder puts up a cottage at the foot of the garden
  to let, or lengthens the house back into it. A rich household keeps its
  garden. Out at the edge, where rent is cheap, the yards stay green. The
  field strips stop at a yard's fence.
- **Settlers on new streets.** A street laid out by a lord's plan
  lets its plots cheap: a few households a year take them up, beyond the
  town's own growth, and growth prefers them.
- **Courtyard houses.** From the mid-1100s, in the dearest fifth of a town,
  the richest household (a spicer, a merchant) buys out its neighbours along
  the street (paying them their houses' worth) and rebuilds the run of plots
  as one stone house about a small paved court: a range on the street with a
  carriage arch, wings down the sides, a range at the back (Field House,
  Hôtel Marchand, Palazzo Neri…). With the extra storeys of the dearest
  streets, this is how a crowded town packs more onto its best ground.
- **Towns grow together.** When the built-up edge of a lesser place meets a
  greater's, the greater takes it in as a ward (as London took in Southwark).
  - The ward keeps its name, church and streets; its market, stores, lord and
    prices become the town's, and carts stop running between them.
  - Across a lordship boundary the town's lord must buy the rights. If the
    seller holds a grudge, the buyer is short of gold, or both are at war, the
    two grow on side by side in dispute and try again later.
  - A town stops growing short of a rival as great as itself that it can't
    take in, meeting it halfway.
  - A ward's name is shown smaller, like a quarter's; the town's card lists
    its wards and the souls in all.

- **Every soul.** Each town's population is a roll of real people, each
  with a name, a family, a trade and parents. The roll follows the town's
  numbers:
  - the frail and very young die first;
  - young people leave shrinking towns for growing ones;
  - brides move to their husband's village;
  - levies march with the host, and the survivors come home;
  - married mothers give birth, and newcomer households arrive when births
    can't keep up.
- **Nature.** Seven inherited traits, weighted by twin-study heritability:
  - wits ~0.5, vigour ~0.4, stature ~0.8;
  - boldness, warmth and diligence ~0.4–0.45;
  - fertility ~0.25;
  - plus hair colour.

  A child's genes are the mean of its parents' plus random variation. What
  shows mixes that with its own fortune. A hungry childhood stunts stature
  and vigour; a lord's table adds to them. Vigour fades after forty.
- **Nurture.** Nine skills are taught over a lifetime:
  - letters, reckoning, scripture and law;
  - arms, riding and courtesy;
  - a craft and husbandry.

  Rank, place, trade and age set the chance to learn; wits and diligence set
  the speed, and youth learns fastest. Commoners mostly learn a trade or the
  fields: a parish school, a town grammar school or a cathedral teaches a few
  to read, and a merchant's son is taught to reckon. The great houses' children
  get tutors, courtly fostering and squiring, so nobles are lettered and armed.
- **What it changes.**
  - A commander's arms, riding, nerve and wits weigh in battle.
  - A lord who can reckon and knows husbandry collects more of his rents.
  - Vigour sets a noble's death rate, fertility their children.
  - The old two-word characters (bold, shrewd, pious…) are now read off each
    person's nature and schooling.
  - Commoners rise out of the roll: a new peer from the ablest of the seat's
    folk, the outlaws' king from the hardest man of the nearest village, the
    comet's prophet from the capital.
  - The midsummer games are won by the realm's actual strongest wrestler, best
    archer or best rider.
- **Beasts.** Every place keeps sheep, cattle, horses and swine.
  - **Feed:** pasture and common waste, the fallow third of the open fields,
    hay meadow for the winter, and the wood for swine.
  - **Herd size:** each herd grows toward what the place needs: plough-teams
    for its fields (oxen, and more horses after 1100), cows for its people, a
    lord's stable at his seat, and sheep for whatever grass is left. Growth is
    as fast as the herdsmen's husbandry allows, and never beyond what the grass
    can carry. An overstocked place loses beasts in a hard winter.
  - **Outputs:**
    - milk, cheese and pork add to food;
    - wool becomes cloth (homespun in villages, broadcloth where there are
      weavers and dyers);
    - too few plough-teams cut the grain harvest;
    - the stable mounts the host's riders.
  - **Losses:** raiders drive the herds home with them, murrain spreads from
    village to village, and pasture that nothing grazes goes back to scrub.
  - **Trade:** beasts and wool are goods like grain. A place sells only the
    beasts it doesn't need, and drovers walk them to where they fetch more: a
    lord's stable short of horses, a village short of plough-oxen, a town
    with no grass. Wool goes from sheep country to the towns with weavers and
    dyers. Nobody invents grass where there is none.
  - **Water mills:** a town with a mill on its river or millpond grinds corn,
    fulls cloth (from 1150), drives trip-hammers for the smiths (1200) and
    saws timber (1250).
  - **Clickable:** click any beast, however small, to see whose it is, how many
    head the place keeps and wants, and the price there.
  - **On the map:** the herds are drawn from the real counts, one beast for
    every few head, in flocks of their own kind: sheep on the widest pasture,
    cattle on the pasture nearest the village, pigs in the wood, horses in the
    paddock by the town, and after harvest the flocks go onto the stubble. A
    flock keeps together and drifts across its field as it grazes, inside the
    fence and clear of the tracks. The town card
    shows the herds, the grazing and whether the plough-teams are enough.
- **Ports and the sea beyond.**
  - **Great ships** sail in from off the map: knarrs in the early centuries,
    then great cogs, hulks and carracks. They come from Venice, Genoa,
    Alexandria, Constantinople, Bruges, Lisbon, Bordeaux, Bergen, Lübeck,
    Seville and others, each in its own era.
  - **Cargo in:** spice and silk from the Levant, wine from Gascony and
    Lisbon, stockfish and timber from the Baltic.
  - **In port:** a ship ties up at a wharf, or on the shore where there is no
    wharf, and pays the port lord's customs. If every berth is taken it lies
    off and waits. It sails home loaded with the realm's wool, cloth, tin and
    corn.
  - **Onward trade:** spice and silk travel inland to the court and the rich
    towns, who pay the most for them.
  - **Wharves:** when a year's crowding outruns the berths, a new wharf is run
    out from the quay into deep water, as a real building on the waterfront:
    timber at first, stone after 1250 if stone can be had. Each wharf berths
    two ships.
  - **Cogs** between the realm's own ports now come alongside at the
    waterfront rather than sailing up the high street.
  - Click a ship to see where it's from, what it brought and what it's
    loading.
- **Property.** Land is held at two scales that fit together with no gaps
  between them.
  - **Furlongs** (the fields, commons and waste) tile the whole realm. Land
    is unowned only until someone expands into it; a hole of unclaimed
    ground enclosed on three sides by claimed land is claimed too.
  - **Town ground:** the furlongs a town's houses stand on belong to that
    town and follow its lord. A siege, a sale or a grant never splits a
    town's own ground from the town.
  - **Lots:** in the towns, each building's lot is its share of the ground
    nearer to it than to its neighbours (weighted by size). It runs back until
    it meets a neighbour's lot, a street, a place, the town wall or a castle,
    so neighbouring lots and back lanes close up.
  - **Subdivision:** when houses are built on farmland they take their lots
    out of the furlong, and the furlong's ploughland shrinks to match.
  - The land card shows a town's ground as such.
- **Homes and households.** Every occupied house has a named household: a
  married man's, a widow's or an unwed adult's. Unmarried children live with
  their mother. Tradesmen live over their shops; a family keeps its house from
  year to year; when a place is full, lodgers double up. Click a house to see
  who lives there.
- **Woodcutters, hay and the winter.**
  - **Woodcutters** are real villagers wherever there is wood, and timber
    comes from their axes.
  - **Hay** is mown in summer from the hay meadows and pasture.
  - **Winter:** mixed herds share one pasture and one hayrick. Each winter
    the beasts need hay for the part of their keep that stubble and frosted
    grass can't give. A place short of hay buys it in autumn (hay is traded
    like any good) or loses beasts.
- **Fences.**
  - Every worked field is fenced where it meets waste, another village's land,
    or ground put to a different use (corn against pasture, to keep the
    beasts out of the crop).
  - No fence runs between the open-field strips of one village.
  - Fences are dry-stone walls where the ground is stony or stone is cheaper
    than timber, and post-and-rail otherwise.
- **Farm tracks.** No lord or crown keeps them. Each village's tracks run
  from its edge out to every one of its fields along the bounds between
  holdings, never across anyone's corn, and step round water and steep banks.
  Where a track runs, the fences stand back on either side of the lane. Click
  a track to see it.
- **Stone.**
  - **Quarries:** a place with crag, scree or steep hillside nearby opens a
    quarry once towns within reach want stone.
  - **Trade:** stone is a heavy good, carried cheapest by sea and river.
  - **Building in stone** waits until the stone is in the yards, and uses it
    up: stone walls, keeps, baileys, citadels, churches rebuilt larger, stone
    houses in the rich heart of a town, stone wharves, and paved roads.
  - **Paving:** a paving project stalls, with a note in the chronicle, until
    stone reaches either end of the road.
- **Family names** are fixed when a family is founded, and then inherited:
  - from what the founder did (Smith, Schmidt, Lefèvre, Kovář);
  - from where the family lived (Atwood, Dubois, Brookes);
  - from the founder's looks, as the neighbours saw them (Long, Little, Brown,
    Leroux);
  - or from the founder's father's name (Johnson, Haraldsson, ap Rhys).

  Given names are drawn from pools of ~50–70 male and ~45–50 female names per
  language. The name least used among the living wins, and siblings never
  share a name.
- **Names of places and houses.** A place-name root or ending already used in
  the realm is passed over, and no two great houses share a name.
- **The annalist's voice.** Recurring events rotate through several wordings
  and weave in the weather, the commander and the walls, so no wording repeats
  until all have been used. The harvest names where the corn stood heaviest
  and whose strips were best.

- **The great houses' wealth.** A lord lives on his tenants' rents and the
  dues of his markets (the crown takes only a feudal aid from his towns);
  each fief beyond his hall keeps a castellan out of its own rents; hosts and
  garrisons are paid by the head, and garrisons go home in peace. Debt past
  what a lord's lands can answer for costs him land (to a richer neighbour, or
  to the crown for the debt). A great lord enfeoffs cadets or castellans with
  his outlying fiefs and sells some for silver; a house with silver and no
  land buys one. A line that dies out escheats to the crown. So the crown
  tends to grow, as crowns did, by escheat, forfeiture and purchase, while
  the houses rise and fall around it.

- Deterministic worldgen via seeded `sfc32` RNG with **separate streams** for
  generation (map seed) and history (map seed mixed with the fate seed) —
  intervening in history, or rolling a new fate, never changes the map.
- Worldgen pipeline: fBm terrain with domain warping and a mountain spine →
  flow-accumulation rivers carved as soft valleys → biomes → settlement siting →
  A* king's roads relaxed into smooth curves → town layout → houses, heraldry,
  and a cast of ~140 named notables.
- Settlements exist for a reason, and the reason picks the site: a seat of
  power or fortress on a defensible rise, a port on the shore, a bridge town
  where a road meets a river, a market town amid plough-land, farming,
  fishing, woodcutting and mining villages.
- Towns are grown, not planned. The founders' nucleus (a tower keep, a
  landing, a hamlet at the ford, farms about a green) is followed by ages of
  growth: houses ribbon out along the roads, back lanes branch where there is
  room, bend with the ground, stop at water and walls and join older streets.
  Each wall is traced around the dense core of its age (keeping to the near
  bank of a river, riding hill crests, left open at cliffs, pulling down the
  houses in its way); later suburbs spill past the gates and across bridges.
  A wall never runs through a keep, hall, church, bailey or close; it goes
  round them. When a city outgrows its wall the new circuit reuses the old
  wherever the town has not spilled past it and runs out only around the
  suburbs; stretches of the old wall left inside are pulled down for a
  street where streets already cross them, or built into by houses, with a
  few towers left standing. Institutions stay put and are rebuilt larger on
  their own ground (keep → castle, church → minster); fires clear districts
  that are rebuilt in stone on straighter streets; sieges raze suburbs that
  grow back. Each town's history is in its inspector card, and natural
  defences lengthen sieges.
- Not every town is founded the same way. Besides the grown town
  (Göttingen), a **border fortress** or old capital starts from a Roman
  grid with a square forum and cathedral, later ringed by a bastioned trace
  with a ditch, a cleared glacis and a star citadel for which a quarter is
  razed (Metz); a **port** grows twin nuclei, the bishop's burg on the rise
  and the merchants' waterfront, with canals cut inland (Hamburg); a
  **market town** may be laid out by a duke: one broad market street with
  runnels (Bächle), back streets, a minster square and a castle on the hill
  above (Freiburg). Mill dams upstream of river towns back up a pond.
- Towns keep growing while you play. Empty houses are re-let first, then
  open frontage is built on, nearest the heart first; when there is none the
  town reaches further out along its highways and lays new lanes, and when it
  can spread no further its houses rise a storey and take lodgers. A town
  that loses its people leaves its outermost houses empty to fall in.
- The whole realm is surveyed. Every settlement holds a domain (its parish
  and lordship): the ground it reaches before a neighbour does, by effort
  over slopes and rivers, drawn on the parchment map as dotted bounds.
  Mountains and land beyond anyone's reach are not divided. Within the bounds
  the land lies in furlongs, each divided as its place demands: open-field
  strips running down the slope in unhedged furlongs of different headings,
  grouped into three great fields that rotate winter corn, spring corn and
  fallow year by year; Waldhufen (long hedged holdings running back from the
  street) for forest and colonists' villages; hay meadows on the floodplain;
  crofts behind the houses; vineyards on a town's best south slopes; the
  lord's demesne in broad strips by the castle; hedged closes won from the
  wood. Land within a walk of the village is ploughed as the mouths require
  and the rest lies as common grazing and waste. The terrain shader draws
  the strips, ridge and furrow, headlands and hedgerows from small data
  textures.
- The ground is dressed by its surroundings rather than a texture library.
  Distance fields (about 6 m texels; exact to the edge of each road, wall
  and river near it, so verges and ditches run true) to water, walls, roads,
  the wood's edge and buildings are kept current as the map changes, and the terrain shader
  paints by circumstance and by combinations of circumstance:
  - river + town: stone embankments; river alone: mud and reeds;
  - river + wood: alder carr; river + steep: a raw cut bank;
  - the tide line: sand and shingle;
  - walls: a trampled foot;
  - roads: worn verges and ditches, hollow ways where they climb, mud at fords and landings;
  - the wood's edge: bracken and a wood bank with its ditch, and wattle fences where fields meet it;
  - steep ground: scree down the fall line;
  - sloping ploughland: lynchet terraces;
  - houses: yards and kitchen-garden beds;
  - open ground: tussock and flowers.
- The history keeps going while you play. The generation steps that shaped
  each town's past also run live, triggered by the simulation: a town that
  outgrows its wall raises a wider circuit that keeps what it can of the
  old; a great fire's burned district is cleared and laid out again in
  stone on a straight street; a siege burns the suburbs outside the gates;
  a thriving village is chartered as a town; keeps and churches are rebuilt
  larger on their own ground. Dated entries appear in each town's history.
- How many a place can hold is not a fixed number. It is the land actually
  under the plough (while more can be taken in, land is no limit), plus
  fisheries, plus for towns the surplus of their market villages and for
  the seat the rents of the realm, and it is also bounded by housing: a
  cramped site builds upward and then stops growing.
- The countryside follows the people. As they multiply, old pasture is
  ploughed again, then common waste, then the wood is assarted, and in the
  end the bounds are driven out into unclaimed land. After plague or war the
  far fields go to grass, then scrub, and at last the wood returns.
  Besiegers burn the standing crops. Land under the plough bounds the
  harvest, and a place with no land left sends its younger sons to found
  Hufen villages in the waste.
- Growth decisions (which lot is built on, which house empties, which
  furlong is taken in or given up, where colonists settle) are weighted
  choices: candidates are scored and one is drawn at a temperature, so the
  likely usually happens but not always.
- Roads, streets and rivers are draped, connected strips (verges and ruts,
  shallows and deep water); bridges span wherever a road crosses a river.
  A road never meets a river at less than 50°: a shallower approach bends
  gently to that angle, and a road that only runs alongside keeps to the bank. A river's width goes
  with the square root of what drains into it, so where two like streams
  meet it swells; a tributary's mouth flares into the other's channel.
- Lots: wilderness belongs to no one until it is taken in; farmland is held
  in furlongs; and houses built on a furlong take their lots out of it.
  The ground about the houses is cut into adjoining parcels, each house
  holding what lies nearer to it than to its neighbours (weighted by size),
  up to the street, the river, the market square and the town wall.
  Fences follow the parcel lines: wattle, paling, then low stone walls.
- Trade consignments run on the sim clock, but what you see is their traffic:
  each sends out a small convoy of carts (one per unit of goods), barges or
  cogs that travel at a walking pace in real time.
- Events are marked where they happen: a ring in the colour of their kind and
  a short scene (bells and confetti for a feast, a slow toll for a death,
  dust and arrows for a battle, smoke over a robbed road, stump fires in an
  assart, spray for a flood). Lasting states show while they last:
  festivals, plague haze, besiegers' campfires, riot torches, famine dust.
- Town walls are placed by a trade-off rather than a set shape: each house
  left outside is a loss, each metre of wall a cost, a falling slope is
  cheaper to wall and water cannot be walled. The cheapest closed line is
  found by dynamic programming, so ribbons of houses along roads stay
  outside the gates. Bastion ditches are wet only where a river, pond or
  the sea can feed them.
- Beyond the map the unknown lands fade into the haze and the sea runs on.
- Speed ⏩ (key 5) reels through about a year a second to watch growth.
- One history. Every realm is founded the same way in AD 850: thinly
  peopled hamlets, fords and landings in timber and thatch, the lord's
  seat a motte and bailey. Everything after that (walls, stone, charters,
  new towns, parishes and friaries, bastions, the lords' wars and
  bargains) is the live simulation. Choosing a later start (World tab, or
  `#s=SEED&y=1250`) runs that same history forward unseen to the chosen
  year, then hands you the realm as it has become. The one date-dependent
  rule is what builders of a year know how to make: charters c. 950,
  framed houses and rebuilt churches c. 1000, stone keeps c. 1070, planned
  towns c. 1120, stone walls and baileys c. 1150, stone houses in town
  cores c. 1200, friaries c. 1220, bastions c. 1500. Dates are shown AD.
  About two seeds in five lie by the sea; the World tab (or `&c=sea` /
  `&c=land`) can ask for a coast or keep the realm inland.
- Every great house has a tongue (English, German, French, Italian, Norse,
  Slavic, Celtic, Castilian): most share the crown's, the marches may not.
  Places are named in the tongue of the nearest seat and for why they are
  there (a ford, a bridge, a hill fort, a harbour, a mine, a clearing):
  Ashford, Eschfurt, Gué-le-Frêne, Vado de Lobo. Daughter villages often
  take their mother's name (Neu-, Nether, Villanueva de). Castles,
  churches, town halls and mills are named in the same tongue; inns and
  shops have signs made in its grammar (Zum Goldenen Hirsch, À la Couronne
  d'Or, U Zlatého Jelena), their master's name, or a promise to customers.
- Overlays (Overlays tab) read the simulation directly: territories;
  the trade network (each road as wide as its share of all journeys between
  places, sea lanes and river barges in blue); land and property value
  (fields by yield and nearness to buyers, houses by their rent: the market,
  a busy frontage, the walls, stone); production and stores (a chart over
  each place); prosperity, plague and unrest.
- Trades sit where their custom is. A lot becomes a shop, tavern, inn,
  smithy, bakehouse, tannery, warehouse or granary only where enough
  custom reaches its door: households within a short walk, the realm's
  traffic on that road (each road carries the people-weighted share of
  all journeys between places that must use it), travellers at the gate,
  boats at the quay, the market close by. A trade shares that custom with
  the rivals already near, and noisome trades keep off homes and the
  market. Each year some homes where custom has grown open as shops, and
  trades whose custom has gone close. Click one to see why it stands there.
  Institutions follow the same rule: a windmill on high open ground by the
  fields (from c. 1180), a bathhouse by running water among many households,
  a hospital by a gate or a busy road near a church, a dyehouse on running
  water near the cloth market, a toll house at a gate or bridgehead on a
  busy road, a guildhall on the market.
- A realm of fiefs. Every furlong has a lord, and fighting moves it:
  - every house keeps a standing household host at its seat, recruited
    from its people; neighbouring lords with grudges or land-hunger fight
    private wars and call out their tenants, and rebellion against the
    crown is only one kind of war among many;
  - a host on enemy land takes the furlongs about it, lives off the corn
    and burns what it cannot hold; land taken within reach of the new
    lord's own villages becomes theirs to plough, clear and build on; land
    held only by the sword slips back to its people when the host leaves,
    unless the lord plants a fort there, and the fort's settlers take it up;
  - armies need supply: they are fed at their own towns and on their own
    land, suffer attrition far from home, and fall back when their wagons
    are empty;
  - houses keep purses: rents in, hosts and castellans out (a large domain
    costs more than its size, and far fiefs yield less), and a lord in debt
    sells his outlying towns to a richer neighbour; the crown grants fiefs
    to loyal vassals and recalls exiles; partible inheritance founds cadet
    branches with their own arms and quarrels;
  - lords' borders are drawn on the ground in their colours, land held by
    force is hatched, and the Territories overlay colours the realm by lord.
- Land nobody works goes back to nature: grass, then scrub by the fifth
  year, young wood by the twentieth, saplings visibly growing; the wood also
  creeps into abandoned ground beside it, while grazed commons stay open.
- Sim tick = 1 day: Weather → Economy → Population → Politics → Military →
  Threats → Growth → Chronicle. Every positive feedback loop ships with a
  predator (big treasuries attract dragons and courtly waste; strong houses
  chafe; growth strains granaries).
- Two-layer population model: pools per settlement drive economy and levies;
  named notables age, marry, inherit, win epithets, and die on camera.
- Threats are couplings, not effects: plague rides caravans (settlements above
  15% infected refuse trade — emergent quarantine), fire spreads through the
  building graph biased by wind and drought, bandit camps prey on the roads,
  and the dragon's wake probability scales with the treasury.

Verified: 200 unattended sim-years keep population, treasury, and the houses
within sane bounds — and the realm still produces story.
