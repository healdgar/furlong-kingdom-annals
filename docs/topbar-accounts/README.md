# Top-bar information and visible accounts

Local review: http://127.0.0.1:8766/?accounts-review=1#s=1001&f=1001&c=sea

- Furlong opens About, with the requested company notice and retained MIT attribution.
- The date opens recorded timeline milestones and recent history, linking to the existing Annals and filters.
- Gold opens the kingdom balance sheet, recorded house ledgers, external realm flows and town account links. Menu also contains Kingdom accounts.
- Compact town cards have an Accounts action. Expanded town details contain the same balance sheet and an Accounts section link.
- Sheets reuse the parchment card, expansion, scrolling, minimize, keyboard navigation and dismissal.

Money is read from existing treasuries, household purses, church funds, town funds, craft pools, dragon hoard and persuasion escrow. Shared accounts are counted once. Debt is separate from coin; goods are quantities, not estimated gold values. Sale stock is a subset of stored stock; transit stock is separate. Livestock offers are read from existing ownership records. Opening a sheet creates no accounts, quotes or transaction records.

The source does not record a complete royal transaction ledger. House ledgers and realm boundary flows retain their actual scope; neither is presented as a complete royal ledger. Town purse totals can overlap when family members reside in different towns, as explained in the sheet. These are cash and goods summaries, not valuations of every property or asset.

## Validation

`node --test tools/account-sheets.test.mjs tools/context-card.test.mjs tools/inspector-details.test.mjs`: 19 passing checks. `git diff --check` passes.

Native browser review, isolated paused seed 1001 sea game:

- About notice and licence link; date milestones; Annals navigation and existing town links.
- Gold opens a modal kingdom sheet; town buttons switch to town sheets; refresh retains scope.
- Enter activates Gold; Escape minimizes then dismisses; closing restores the initiating Gold or Menu button. Focus stays inside the full sheet after changing towns or refreshing.
- Town detail Accounts jump and compact town Accounts action both expose balances. Inspector state clears when entering the separate accounts sheet; cached sheets have no duplicate IDs.
- The date, treasury, account census, flow book, household count and annals count remain unchanged across account navigation while paused.
- 1280 × 720 desktop and settled 390 × 844 phone viewport: readable tables, working navigation, scrolling and no horizontal overflow. Viewport overrides were removed afterward. This is desktop browser emulation, not physical-phone verification.

Screenshots: [kingdom desktop](kingdom-desktop.png), [kingdom phone](kingdom-phone.png), [town phone](town-phone.png). Source hash and browser readback are in `browser-check.json`.

Changes remain in the local test worktree; publication is separate.
