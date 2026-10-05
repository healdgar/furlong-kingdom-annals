# Public order

The local watch, friendly idle or arrived hosts in town, and half the emergency militia deter riots and revolts. Royal troops can support a peaceful vassal's town, and vassal troops can support the Crown's town, under the existing friendly-town rules. Marching, routed, enemy and field armies do not count. Presence lowers unrest by up to 0.35 points per day, reaching that limit at 15% of the population under arms. The effect fades below 40 unrest and stops at 10. Hunger, taxation and other existing causes still apply.

Town orders can muster up to 40 local watch recruits for 10 crowns per recruit, without raising the total watch above 12% of the population. Existing watch wages and demobilization apply. Calling the watch out as a host retains its effect while it remains in town; marching it away removes that contribution.

Forceful suppression requires troops present. Its immediate reduction scales with their numbers, capped at 20 points. It retains the 150 crown cost, 30 day cooldown, prosperity loss and risk of violent resistance. Troop presence reduces riot probability by at most 90%; it cannot guarantee peace.

This uses the existing army settlement index and unrest value. It adds no simulation index, per-person budget or daily journal event. Focused checks: `node --test tools/public-order.test.mjs tools/army-settlement-index.test.mjs tools/ruler-controls.test.mjs`.
