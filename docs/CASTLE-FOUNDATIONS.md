# Daily first-castle foundations

Recorded 2026-10-10 before implementation, following the dependency audit for #60.

The existing simulation supplies ruler authority, named purses, property value and
threat assessments, real construction wages/materials, saved daily projects,
fortification circuits and later castle upgrades. The missing operation connects
those systems; it does not regenerate a settlement or add a free castle.

A first foundation builds a modest tower and timber ward together. A lone keep
has no circuit in `fortOf`, so quoting it as a defended castle would give a
benefit the simulation cannot deliver. Before AD 1070 the tower is timber;
afterward it may be stone. The existing ward, tower, gate, chapel and outer-wall
development remains separate. Initial foundations do not receive free halls,
stables or other service buildings. Terrain-fitted motte foundations and broader
compound development remain further work.

## Dependencies and daily order

1. Opening ownership, politics and military changes establish the current ruler,
   actual seat/capital, exile and siege. Quarries, arrivals, markets, meals and
   households establish the stock, buyers and purses available for work.
2. `tickProjects` progresses existing foundation projects before ordinary growth.
   Revalidate authority and the retained ground/access against current canonical
   data before purchasing materials or paying labour. Lost ownership or purpose
   abandons the project; exile, siege, obstruction, funds or supply shortage stall
   it. Installed materials and prior wages are sunk work, never invented refunds.
3. `tickCastles` considers first foundations daily, after that day's growth and
   church changes. Require the actual capital, current lord's seat or explicit
   seat/fort/border role, no existing keep/ring and no pending foundation. Owning
   an ordinary village is insufficient. Apply purse and defence/value bounds
   before a site survey. Existing castle upgrades retain their annual cadence
   until their own decision/paid-progress conversion.
4. Rank street-front candidates with stable canonical ties and fully survey at most 24. Fit a ward around its
   tower using live terrain, water/rivers/lakes, street/road widths, standing
   footprints and lots, greens/markets, walls, tracks and pending works. Use
   existing roads for an actual connected approach. Read current coordinates,
   rather than trusting a stale layout hash or a count signature.
5. Only unoccupied ground within this settlement's domain and ruler's title is
   eligible. Reject household ownership/occupation, home crofts and protected lots. Unheld ruler demesne may be converted. The direct connector may meet an existing public street; agricultural cells newly occupied beyond that road still need the ruler's title. Its
   foregone land value is an economic opportunity cost; the ruler does not pay
   himself a synthetic purchase. Paid demolition and land acquisition are later
   proposals, not implicit in this foundation.
6. Retain the exact footprint, ward radii and access in a plain saved project.
   This is a construction plan, not a cross-day validity cache: check the fixed
   plan afresh on every paid day and completion. Other native builders reserve
   its ground. A blocked project stays at its paid site rather than moving the
   foundation without cost.
7. Only actual purchased/owned material is installed. Labour uses `buildWorks`
   and named recipients; no recipients means no paid progress. Keep the material
   quantities identical in quotes, installation and outstanding demand. Publish
   remaining stone/timber demand before outgoing trade. New proposals begin
   work tomorrow because the project phase has already run.
8. Completion installs the canonical keep and finished palisade, updates the
   layout's captured keep, access street, building/parcel/route state and native
   `fortPrepare`. The worker projects those same buildings/circuits/project
   geometry; rendering never chooses a site or pays for work. Native keep placement
   consumes the settlement's deterministic layout RNG, retained by world saves.

The same 52 daily dispatcher phases remain. Site surveys are bounded and occur
only after live eligibility/economic bounds. Fixed-site revalidation is limited
to active work; no whole settlement regeneration, daily maintained spatial index
or incompletely certified cross-day proposal reuse is added.

## Construction quantities

The first timber tower uses the existing 8 m square scale; a stone tower uses
the existing 13 m square scale. The ward fits a modest yard outside its actual
footprint. Labour uses the existing 500-crown keep scope scaled by tower area,
the native timber-wall cost by fitted perimeter, and approach length. Defence uses the existing ward's `0.06 × threat × protected value` proposal factor, plus the existing seat dignity term; the tower's material does not invent a separate combat bonus. A necessary minimum bill screens cash and payoff before geometry. Materials
are valued at current native prices for the proposal and bought from actual
sellers when work proceeds.

The tower's timber frame is calibrated at 0.06 abstract loads per cubic metre of
its envelope; stone towers require timber floors/roof at 0.08 loads per square
metre. Palisade timber is 0.25 loads per metre. The existing 150-load stone keep
scope applies to the 13 m tower. Total paid installation duration combines the existing timber
wall duration (60 days plus perimeter/15), tower installation at two timber loads
or half a stone load per working day, and approach work at four metres per day.
These are explicit construction-model rates, not decision throttles or claims
of historical calibration. Materials are secured and consumed into the unfinished work first; the resulting installation duration is then worked through paid labour days. Partial actual wages advance a fraction of a day, and the last share is only the remaining work. Only funded working days advance the saved project.

The ward and 2.6 m approach polygons use `occupiedGroundCells`, the existing 15 m agricultural-mask resolution. The same union of newly occupied cells governs rights, foregone value summed across all affected fields, and completion's `markOccupiedGround`. No cash flow is posted for the ruler's own land. Completion removes the yard and approach from production and clears trees inside those surveyed boundaries.

The saved quote is a decision at commission time. Labour/material quantities stay fixed; material purchases use current prices and each day checks current cash. Changed prices may exhaust the purse or strand a project. Previously spent wages and installed material are sunk work.

## Verification boundary

Gate current role/owner/value/cash and duplicate suppression; native protected
ground and connected access; same-count terrain/road/building/title edits;
partial purchases, zero crew and paid-day stalls; single canonical completion;
outstanding demand and real money/inventory reconciliation; mid-project world
save/continuation; worker projection purity and identical history at all speeds.
This deliberately changes eligible settlements' histories. Century-scale
throughput and daily paid conversion of existing upgrades/housing are not claimed.

## Historical references and next construction phases

The user identified David Macaulay's *Castle* (1977) and *Cathedral* (1973), owns
copies, and supplied a photograph of the castle/town-wall illustration. These
books are copyrighted; historical facts and construction methods can inform
our original model, but their text and drawings are not game assets. The
[Castle library record](https://catalog.wake.gov/Record/479664) describes a
fictional thirteenth-century Welsh castle and town; it is a reference case, not
a universal plan or a model of every 1066 timber castle.

The supplied spread makes a useful distinction: the compact castle enclosure
stands beside a much larger town circuit. Gates, towers and curtain stretches
are separate building works, and the circuit responds to its site. Subsequent
phases should model those functional components and their paid construction,
rather than automatically placing a copied arrangement or a complete castle
compound. The present phase builds only a first tower, palisaded yard and
approach; it does not add a stone town wall or domestic ranges for free.

[St Briavel's Castle](https://www.english-heritage.org.uk/visit/places/st-briavels-castle/history/)
provides a specific example of successive keep, curtain, domestic and gatehouse
works. [Canterbury's construction account](https://learning.canterbury-cathedral.org/how-did-they-build-that/building-the-cathedral/)
and [Norwich's Close](https://cathedral.org.uk/explore/the-close/) provide
references for skilled supervision and transported stone. Construction stages
must follow the chosen building and materials; there is no single obligatory
sequence for every castle, abbey or cathedral.

The user requests a commit, push and browser link after each operable, verified
phase. Following this foundation release, retain the AD 850 option, implement
deterministic generation of established era starts without centuries of
prehistory ticks, and test AD 1066–1350. Changing the initial world model is
authorized; history after that initialization must remain identical at every
speed.

The user's compound clarification is recorded in
[COMPOUND-BUILDINGS.md](COMPOUND-BUILDINGS.md): castles and abbeys share canonical
component, site and paid-work mechanics, while institution authority, rights,
accounts and economic reasons remain explicit. Buildings may serve several
purposes concurrently. The present foundation is the first client slice;
general compound composition and the actual abbey institution remain future
work.

## Survey cost and reviewed searches

A foundation survey builds one operation-local building hash and one street hash
from current coordinates after cheap authority, funding and benefit checks. The
two new `castleFoundationSite` inventory sites are reviewed here: another town's
building or lot may lie inside the search area, and a moved building or frontage
must invalidate a retained plan even when collection counts remain unchanged.
These passes construct the hashes once; the bounded 24 candidate surveys query
them rather than scanning those collections again. The inventory records these
specific sites; it does not approve broader or repeated transaction searches.

An impossible yard stops its radial survey as soon as one direction cannot
contain the required keep clearance. Every fitted radius is limited by that
direction's cap, so no later survey could recover the minimum size. Other open
space callers retain the original fitting path. Native 150-day whole-world, RNG
and raw-outcome comparison gates this performance change against the complete
survey, alongside mixed-speed construction checks.
