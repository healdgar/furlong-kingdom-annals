# Ruler controls

Crown tax and a lord's tenant dues appear above all court views, rather than below campaign progress. Use the slider or enter a percentage and commit it by leaving the number field. Crown tax remains 5–30%. Tenant dues remain 50–160% of customary dues; 100% is the customary rate, not the household's entire income.

The Crown sets the existing realm tax. A lord sets only their own house's dues. Chroniclers, watch mode and exiled houses cannot change these ruling controls. Existing taxes, rents in kind, unrest and prosperity calculations are unchanged. Rate changes retain the existing same-day command coalescing and replay format; unchanged values add no command.

Governance lists only the player's directly owned towns, with hunger, unrest, prosperity, town accounts and a link to town orders. Orders retain existing authority checks, costs and cooldowns. This exposes relief, quarantine, garrisons, levies, walls, mills, markets and storage without duplicating their implementation. House accounts remain available across court views.

Validation: `node --test tools/ruler-controls.test.mjs` checks authority, bounds, numeric commitment, synchronized controls, command coalescing, save replay and town scoping. Native browser checks cover both playable roles, court navigation and opening town orders.
