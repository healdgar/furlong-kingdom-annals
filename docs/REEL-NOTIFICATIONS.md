# Notifications while reeling

Reel years suppresses transient event bubbles automatically. Starting reel clears the old popup queue; events generated during reel never enter that queue. Slowing or pausing admits new bubbles normally, without replaying a backlog. Chronicle events remain recorded normally.

Petitions retain their queue, council deadlines and the ruler's pause preference. With petition pausing disabled, reel shows the petition badge rather than opening new sheets. The player can explicitly open a petition while reeling. Slowing reveals a pending petition normally. Entering reel dismisses an old event or petition card; manually opened inspectors and court controls remain available.

This is UI state only. No journal entries, simulation records or indexes are added. Hidden reel bubbles skip candidate projection and queue maintenance; unopened petition sheets skip content construction.

Check: `node --test tools/reel-notifications.test.mjs`.
