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
Pages). That's it. In a small container:

```sh
docker run --rm -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
# then open http://localhost:8080  (the browser fetches three.js from cdnjs)
```

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
  When a city outgrows its wall the old line becomes a street with a few
  towers left standing. Institutions stay put and are rebuilt larger on
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
  Distance fields (about 6 m) to water, walls, roads, the wood's edge and
  buildings are kept current as the map changes, and the terrain shader
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
  shallows and deep water); bridges span wherever a road meets a river.
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
