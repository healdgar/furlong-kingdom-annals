# Motte and bailey within the fortification system

Status: implemented locally; publication follows integrated verification.

The implementation now uses a continuous outer enclosure around court and mound,
a separate summit strongpoint, shared circuit commands, excavated terrain, and
bounded instanced timber works. Keep, hall and longhouse retain ordinary ownership
and inventory. Rulers reside in the existing seat keep or hall.

Campaign orders target settlement capture, pillage, devastation, the lord's seat,
a building, or a wall span. Orders plan physical routes around existing building
footprints and closed walls; rivers require a shallow ford, existing bridge, or
a timber-funded army raft. Permanent crossings use existing road projects.
Church placement requires a public approach and reserves it before later works.
Bandit membership references existing villagers; household accounts remain shared.

Limits: local route searches are bounded and can reject a distant detour. Routes
are checked when ordered, not continuously per person. Seizing a seat uses existing
conquest/political consequences; it is not a separate assassination mechanism.
Bandit food remains in existing household hunger, pantry and debt accounting.
No new pantry, wallet, person, or maintained spatial index is created per camp.

The original design rationale follows.

## Intended result

A motte and bailey is an early castle: a timber keep on a natural rise augmented
by an earthen mound, connected to a lower defended courtyard. Its palisades are
small walls with the same gates, construction, damage, breach, repair, selection
and defender rules as later castle curtains and town walls. Courtyard buildings
remain ordinary functional buildings, with their existing owners and inventories.

## Confirmed problems in the current source

- `layoutSettlement` chooses the highest fitting keep site within 60–150 m, but
  assigns fixed circular motte/bailey footprints. It does not evaluate the hill,
  added mound, usable lower courtyard and access together (index.html:2037–2056).
- The separate hill-castle search excludes the motte age; the timber/motte case
  inside that search is consequently unreachable (index.html:2020–2031).
- The mound is a fixed-height cylinder/frustum placed on the height at its centre.
  The ditch is a flat `RingGeometry`; the summit fence is an open, double-sided
  cylinder. These do not represent an excavated, traversable earthwork
  (index.html:6511–6517). Buildings receive a separate fixed height offset
  (index.html:2502).
- Town walls have a terrain profile and segment damage/build progress. Castle
  curtains use another circular rendering routine and aggregate castle damage.
  Gate attacks, breach entry and selection remain tied to the town circuit
  (index.html:5980–6035, 6473–6502, 10541–10555, 13624–13643).
- Defenders can be drawn around a castle, but their elevation and positions are
  estimated independently of its actual walkable wall surfaces
  (index.html:13962–13970).
- A real keep, hall and longhouse already exist in the bailey. Retain those
  records; do not replace them with decorative copies (index.html:2050–2053).

## Design decisions

### One fortification circuit implementation

Generalize the existing wall circuit to accept its own centre, traced perimeter,
material, wall/walk height, gates, build progress and damage. Town boundaries,
bailey walls, summit defences and later wards use this implementation. They may
have different dimensions and owners; they do not have separate wall rules.

Keep distinct circuits for the bailey and summit, connected by a gate and access
path. Preserve their boundaries where they meet; omit duplicate wall stretches.
A later town circuit may join the castle or enclose it as an inner strongpoint.
One radial profile per circuit is sufficient initially; do not introduce a
complex general polygon engine to solve this small enclosure.

Migrate the current canonical town/castle fields into this representation.
Temporary compatibility accessors must reference the same arrays/records, not
maintain a second copy. Generalize all consumers that assume the wall centre is
`s.pos`, including picking, gates, rams, demolition, breach paths and defence.

### Site the whole castle on the terrain

Use one bounded deterministic site search during foundation or explicit planning.
Score the natural rise, prominence above approaches, dry ground, slope, usable
lower bailey, street access and earthmoving required. Validate the entire mound,
ditch and courtyard footprint; the keep footprint alone is insufficient.

On a suitable hill, shape a compact mound onto the rise and level only its summit.
On flatter ground, raise a larger artificial mound. Added height is bounded and
adapts to the site. Place the bailey on the accessible lower side, shaped around
the hill and existing roads. Do not force a circular disc onto steep or wet land.
Reserve these footprints through existing placement mechanisms before other
buildings and roads are laid out.

### Earthwork surface shared by graphics and movement

The base terrain grid is approximately 27 m, too coarse to cut a small ditch
accurately. Use a bounded local terrain patch with a shared height profile for
mound, flat summit, berm and depressed ditch. Replace/mask the covered base terrain
faces so the original terrain cannot fill the excavation or show through it.
Do not refine the entire world or alter regional rivers and resource surveys.

The same local surface must ground the keep, wall footings, gate bridges and
people using the approach. Remove the independent `MOTTEH` building offset.
Resolve the surface through existing local terrain/placement structures or the
known circuit context; no global earthwork scan in every height query and no new
maintained spatial index without a demonstrated processing benefit.

The ditch has inner/outer banks and a visible bottom below the local ground.
It follows the actual defensive perimeter, with bridges or causeways at gates.
It is dry by default. Only an existing credible water supply and matching level
permit a wet moat. Do not represent dry earthworks as blue discs or painted rings.

### Timber walls and troops

Use batched solid wall sections and instanced timber stakes, with an interior
walk/platform, gates, stairs or ramps, and modest timber gate/tower structures.
The wall height is measured from its local ground, not a single town datum.
Visual detail can vary; troop placement reads the same usable wall sections.
Skip gates, unfinished spans, demolished spans and breaches. Keep the existing
bounded representative soldier rendering; do not simulate each soldier walking
along a wall or create records for individual stakes.

### Courtyard use and protection

Keep ordinary building placement, ownership, occupancy, construction and economy
rules inside the enclosure. Start with the existing keep, hall and longhouse;
use existing storage building types when a supported store is required. Leave
usable space for paths and mustering. Gate paths must connect the town, courtyard
and summit; walls and ditches must not cut through buildings or sole access routes.

Defence follows the selected enclosure, its intact works, access and actual hill.
A small bailey must not magically protect every house outside it. Preserve the
existing aggregate garrison/militia model and scope its protection appropriately.
Breach and repair target the actual attacked circuit. Where an inner summit
strongpoint remains, do not treat the bailey breach as an intact castle or award
both circuits' full bonuses to the same line of defence.

Stone rebuilding upgrades the same sites, buildings and circuits. It must not
teleport the castle, duplicate walls or reset building owners and inventories.

## Delivery order

1. **Shared circuits:** parameterize the existing wall consumers and replace the
   split town/castle wall state. Keep existing site geometry initially. Verify
   gate picking, construction, breach, repair and demolition on both scales.
2. **Terrain siting and earthworks:** implement the bounded site evaluation,
   shared local surface, real ditch, summit and connected approaches. Remove
   the cone, flat ditch overlay and independent keep elevation adjustment.
3. **Solid timber walls and functional court:** use the shared circuit renderer,
   real gates/walks and ordinary courtyard buildings. Ground representative units
   on the actual usable surfaces and keep paths open.
4. **Defence and progression:** apply circuit-specific siege effects and protected
   scope, then retain timber-to-stone and outer-town-wall progression on the same
   canonical works. Review changed siege balance independently of visual quality.

## Acceptance criteria and performance bounds

- Natural hill plus added mound is visible in profile; no floating mound skirt,
  submerged courtyard, exposed base-terrain face or unsupported keep foundation.
- Ditch is visibly lower than its banks; gates provide valid crossings. Water is
  conditional on supply, not on fortification type.
- Palisades have visible thickness and structural posts. Defenders stand on valid
  walks/platforms, never in the ditch, a gate opening or an absent wall.
- Keep, hall, longhouse and any storage retain normal ownership and function.
  Growth, upgrades and demolition preserve their records and access.
- The same wall commands and siege routines operate on town and castle circuits;
  damage, breaches and repairs agree with the rendered state and inspector.
- Inspect flat, hilltop, sloped and coastal sites; include a rebuilt stone castle
  and a later town wall adjoining/enclosing its original timber castle.
- Replaying the same seed and commands reconstructs the same fortifications.
  New siting intentionally changes layouts; validate revised saved-command replay.
- No new daily whole-town scans, per-person budgets, per-stake records or duplicate
  inventory/journal layers. Circuit geometry is rebuilt on relevant changes;
  representative troops remain bounded. Reuse existing instancing/material batches.
- Budget local earthwork tessellation and nearby detail explicitly; no world-wide
  terrain subdivision, high-resolution textures or one draw call per timber post.
  Check frame cost and simulation tick cost separately before making gain claims.
