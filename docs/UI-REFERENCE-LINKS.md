# UI reference links

References in game prose should open their recorded person, household, family, place, building, land parcel, trade, commodity, or army. Shared names offer an explicit choice. Existing controls remain intact; markup and attributes are never name-matched.

Resolution runs when displayed prose changes. Household, property, and historical-person candidates are transient UI data; they add no maintained simulation index, journal entry, or daily accounting work. Hidden annals retain their small existing name cache and receive richer links when opened.

## Tests

Run focused semantic checks:

```sh
node --test tools/reference-links.test.mjs tools/inspector-details.test.mjs tools/active-title-tick.test.mjs
```

Run the rendered Chrome audit:

```sh
node tools/render-check.mjs --seeds 287970763:sea --founding 370450810 --views capital --days 0 --ui-references --out /tmp/furlong-ui-references
```

`tools/ui-reference-audit.mjs` inspects visible DOM text against canonical game names independently of the production linker. It reports missing references and reference anchors without navigation attributes. The harness visits event bubbles and details, household and trade views, inspectors, timeline, accounts, menus, and annals. It checks household/trade navigation and deliberately removes both a settlement link and an anchor's `href`; both faults must be detected.

The audit covers the views and world exercised by that run. It does not prove every possible event, conditional control, historical state, or link destination. Extend the scenes when adding UI; use additional seeds and `--days` for other world states. Existing clickable entity rows and buttons count as navigation controls, and hidden text, inputs, code, and tooltips are excluded.
