# 0004: A command is done only when the TV's report shows it

Date: 2026-10-16. Status: accepted.

**Context.** The baseline relayed host commands to the TV and never learned whether they worked.

**Decision.** Every playback command gets a `commandId` (repeats are ignored) and a tracked expectation (paused, playing, or a position after a seek). The TV's next playback report confirms it (`done`); after 4 s without one it is `unconfirmed`. The view carries `lastAction`, and the pad says "Pausing…" while sent and "Paused" only when done. Play or pause on a player already in that state, by a fresh report, counts as done.

**Consequences.** The Vega app must keep reporting playback after every change (PROJECT.md already requires this). The protocol gained a required `commandId` on `tv:command`, safe because no TV app existed yet.
