# 0004: A command is done only when the TV confirms it

Date: 2026-10-16. Status: accepted; amended 2026-10-17 at the merge of the cloud branch.

**Context.** The baseline relayed host commands to the TV and never learned whether they worked.

**Decision.** Every TV command carries an `id`; an input id that was already seen is refused, so a double tap acts once. The TV's player answers each command with `tv:applied { id, ok, detail }`. With no answer within 3 s the command counts as failed (`actions.ts`). The view carries `device.lastAction { id, action, ok }`: `ok` is null while sent, true when confirmed, false when it failed, and the pad says so. Every step is in the journal (`action.requested`, `action.confirmed`, `action.failed`).

**Amendment.** The cloud branch first inferred confirmation from the TV's next playback report (`commandId`, `sent`/`done`/`unconfirmed`). The Mac branch had already built explicit `tv:applied` confirmation into the Vega app and measured it on the Vega Virtual Device (73 to 120 ms), and it also covers volume and brightness, which no playback report shows. The merge kept `tv:applied`.

**Consequences.** Every TV app must answer each `tv:command`, including failures ("not watching", no player). The Virtual Pip Lab's fake TV can ignore or fail commands to test both paths.
