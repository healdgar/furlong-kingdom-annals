# Parish graveyards

Prefer a small irregular plot within the church's actual property polygon. If that cannot fit, choose a nearby accessible adjunct parcel, favoring waste or woodland over valuable agricultural land. Reject water, active crops, pasture, occupied crofts, buildings, streets, and existing residential parcels. If no suitable plot exists, leave the church without a yard.

Yards reserve space through the existing placement hash. Final land reservation, tree clearing, and footpath creation wait until the survey and property polygons exist. Adjunct paths use existing route checks and paid river crossings; no bridge is created for cemetery access. Adjunct plots have a low boundary wall; church-property yards use the property's existing bounds.

Plain headstones and tomb slabs represent the most recent recorded parish burials, with a fixed maximum of 24 spaces and a 20-year reuse window. Every monument's full footprint must fit the plot. Population death records retain their full history. Clicking the yard opens its parish, plot, capacity, access, and named burial records.

Validation:

```sh
node --test tools/graveyard-layout.test.mjs tools/parish-graveyard.test.mjs
node tools/render-check.mjs --seeds 287970763:sea,2002:land --founding 370450810 --views capital --days 0 --graveyards --ui-references --out /tmp/furlong-parish-ui
```

The native audit checks actual generated plots, church-property containment, residential overlap, dry unworked land, monument footprints, adjunct access, picking, and duplicate hash entries. This is placement and rendering validation, not a long-term economic soak.
