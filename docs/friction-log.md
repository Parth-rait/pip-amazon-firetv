# Friction log

The same entries as in docs/devpost.md, in the format the hackathon asks for: task, steps, expected, actual, severity, workaround, suggestion.

**1. Calling Nova on Bedrock from a new AWS account**
- *Task:* call Nova 2 Lite for Ask Pip on day two.
- *Steps:* created the AWS account (Free plan) and followed the console checklist for a new account, then tried to set up an IAM user and `aws configure --profile pip`.
- *Expected:* a working Bedrock call within the first hour.
- *Actual:* the account stayed in verification for the whole build, so there was no profile and no Bedrock call.
- *Severity:* critical (blocked the AWS part entirely).
- *Workaround:* a local model behind the same interface. We made local-first the design.
- *Suggestion:* show verification status and an expected time in the console, and which services work before verification.

**2. The TV's WebSocket dropping every 5 seconds**
- *Task:* send the full session snapshot to the TV, as we do to the pads.
- *Steps:* added companion content (chapters and character cards) to the snapshot, about 5 KB.
- *Expected:* the same stable socket the pads have.
- *Actual:* on the Vega Virtual Device, the TV's connection dropped and reconnected about every 5 seconds once snapshots grew to that size.
- *Severity:* high.
- *Workaround:* a slim view for the TV with only what it draws.
- *Suggestion:* document message size limits for WebSockets on Vega, or raise them.

**3. The first screen rendered at twice the size**
- *Task:* lay out the TV lobby from a 1080p design.
- *Steps:* generated an app from the template and used pixel sizes from the design.
- *Expected:* a 1920 x 1080 layout.
- *Actual:* everything was twice as big, because RN 0.83 on Vega lays out on 960 x 540 dp.
- *Severity:* medium.
- *Workaround:* one `dp()` helper for every size.
- *Suggestion:* state the canvas size in the template and the getting-started guide.

**4. Preferred focus with two cards**
- *Task:* focus the first film card when the lobby opens.
- *Steps:* set `hasTVPreferredFocus` on the first card.
- *Expected:* focus on the first card.
- *Actual:* focus landed on the second.
- *Severity:* low.
- *Workaround:* `FocusManager.focus(findNodeHandle(ref))` after the cards loaded.
- *Suggestion:* make preferred focus reliable when several focusables mount together.

**5. Reconnecting after the app comes back**
- *Task:* reconnect the TV when the app returns from the background.
- *Steps:* listened for AppState change events.
- *Expected:* "active" every time the app comes back.
- *Actual:* after the first background cycle, change events sometimes stopped. Focus and blur still arrived. This matches community thread t/29128.
- *Severity:* medium.
- *Workaround:* treat focus as "back" too, and only disconnect on "background".
- *Suggestion:* fix the event on SDK 0.24, or note it in the AppState docs.

**6. Vega tools on Node 26**
- *Task:* run the Vega CLI and ADBT on the Mac's newest Node.
- *Steps:* installed with Node 26.
- *Expected:* tools that run.
- *Actual:* the tools failed until we switched to Node 22.
- *Severity:* medium.
- *Workaround:* `.nvmrc` pinned to 22.
- *Suggestion:* check the Node version at startup and print a clear message.

**7. CLI first run in a script**
- *Task:* set up the Vega CLI from a script and from a coding agent.
- *Steps:* ran the first command after installing.
- *Expected:* setup that finishes without input.
- *Actual:* it stopped at an interactive question, and `~/vega/env` wasn't created.
- *Severity:* low.
- *Workaround:* answered by hand and added `~/vega/bin` to the PATH.
- *Suggestion:* a flag or environment variable for non-interactive setup.
