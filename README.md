# ANNALS — a living kingdom in a single file

A procedurally generated fantasy kingdom rendered in real-time 3D that you can
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
Pages). That's it.

- **Persistence is the seed**: the URL hash (`#s=1234567`) fully determines the
  generated world. *Copy share link* reproduces your realm exactly.
- **Export chronicle** downloads the full annals of your run as a `.txt`.

## Controls

| Input | Action |
|---|---|
| drag | orbit · **right-drag** pan · **scroll** zoom (5 m – 4 km) |
| click | inspect settlements, buildings, armies, caravans, the dragon |
| `Space` | pause · `1–4` speeds (up to 30 sim-days/sec) |
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

## Sovereign mode — rule it yourself

Press **♛ Rule** (or `R`) to stop watching and govern. Providence's dials and
Acts are sealed while you rule; the crown's own levers take their place:

- **Petitions.** The court brings decisions to you — restive houses demanding
  lands, famine relief, sealing a plague town's gates, answering the dragon,
  bounties on outlaws, debasing the coin, border disputes, tourneys. The game
  pauses when one arrives (toggleable); if you stay silent, the council
  decides on the due date. Out of Sovereign mode the council answers every
  petition at once, exactly as the automatic court always did.
- **Decrees** (gold + cooldown): royal feast, open the granaries,
  extraordinary levy, bounty riders, charter a village on the map, raise the
  royal host, sue for peace, pay the wyrm, send champions against it.
- **The great houses**: honour them, take a hostage (they cannot rise for two
  years), arrange a royal match, or attaint them for treason — seize their
  lands on success, civil war on failure.
- **Settlements** (inspector): relief grain, garrison, walls, quarantine,
  suppress unrest.
- **War**: click a crown host → *Order a march* → click a town. Hosts hold
  where you send them until released to their captains.
- **Ambitions & legacy**: eight ambitions (coffers, multitude, concord,
  beloved, ten years' peace, crush a rebellion, slay the dragon, found a
  village) plus two points per year build your dynasty's **legacy** (✦). If
  your line loses the throne, the reign is scored and you may rule on as the
  new dynasty. Best legacy per seed is kept in the browser.

## How it works

- Deterministic worldgen via seeded `sfc32` RNG with **separate streams** for
  generation and history — intervening in history never changes the map.
- Worldgen pipeline: fBm terrain with domain warping and a mountain spine →
  flow-accumulation rivers carved as soft valleys → biomes → settlement siting →
  A* king's roads relaxed into smooth curves → town layout → houses, heraldry,
  and a cast of ~140 named notables.
- Towns: streets radiate from a paved market square (each king's road enters
  along its own street) and ring lanes cross them; buildings are packed along
  the frontages facing the street, densest at the square. Leftover frontage is
  the growth queue, so towns grow outward along lanes and roads. Streets pick
  their way around steep ground and cross rivers on bridges; quays line the
  banks where a river runs through town.
- Walls trace the ground rather than a circle: along the crest where the land
  falls away, along the bank where a river or the sea runs close (the water is
  the moat), and left open where a cliff does the work. Gatehouses stand
  wherever a street leaves town. Towns are sited on defensible rises, and
  natural defences (water, hillside, cliff) lengthen sieges.
- Strip fields with hedgerows ring each settlement.
- Roads, streets and rivers are draped, connected strips (verges and ruts,
  shallows and deep water); bridges span wherever a road meets a river.
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
