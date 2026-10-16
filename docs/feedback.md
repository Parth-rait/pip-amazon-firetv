# Product feedback

What we noticed while building Pip, per Amazon tool. Written as it happened; Parth edits before submitting.

## Vega SDK and CLI (SDK 0.24.12112, CLI 1.4.4)

- What worked well: `vega project generate` wrote a working helloWorld app straight into our folder, and `npm run build:release` plus `vega run-app` installed and launched it on the Virtual Device on the first try. `vega device start-log-stream` was the most useful debugging tool we had: our diagnostics screen mirrored each check into the device log, so we could read the TV's state without looking at it.
- What was hard: the CLI's first-run setup stops at an interactive question, which blocks a scripted or agent-driven setup. Our plan expected `~/vega/env`, which CLI 1.4.4 does not create; we added `~/vega/bin` to the PATH ourselves. Every command prints `vvman not found` warnings that turn out to be harmless, and Metro prints a Watchman "Operation not permitted" error for projects on the Desktop before falling back. There is no command to take a screenshot of a device, so checking the UI meant giving the terminal macOS Screen Recording permission.
- What we'd like next: a non-interactive first run (a flag or environment variable), and `vega device screenshot`.

## Vega Virtual Device

- What worked well: it ran beside a local model, Chrome and VS Code on an 8 GB M2 MacBook Air. `inputd-cli button_press KEY_PLAYPAUSE` (found through ADBT) let us press remote buttons from scripts, and the remote's play and pause worked through Vega Media Controls with no code of ours.
- What was hard: pressing Home closes the app, and the next launch is a new process, so our TV took a new pairing code. That is reasonable, but it surprised us during a live test.
- What we'd like next: the same screenshot command as above.

## React Native for Vega 0.83

- What worked well: native-driven `Animated` for Pip's five states, including `transformOrigin` for the quiz countdown bar; `FocusManager` for remote focus.
- What was hard: our first lobby rendered at twice the intended size. RN 0.83 on Vega lays out on a 960 x 540 dp canvas (scale factor 2 at 1080p); the migration guide says so, but a new app from the template does not, and our design was in 1080p pixels. With two focusable film cards, `hasTVPreferredFocus` on the first one put focus on the second; `FocusManager.focus(findNodeHandle(ref))` after the cards loaded fixed it. The rule that one view must not mix native and JS animation drivers (a SIGABRT in 0.83) shaped how we built Pip, and was good to learn from the docs rather than from a crash.
- What we'd like next: the dp canvas size stated in the template's README, and preferred focus that works when several focusables mount together.

## W3C Media API (`@amazon-devices/react-native-w3cmedia` 2.3.2)

- What worked well: MP4 in URL mode, over HTTPS through a Cloudflare tunnel, with seeking by Range requests and `play`, `pause`, `seeked` and `ended` events that map straight onto our playback reports.
- What was hard: the surface has to be attached before `src` is set (Amazon's URL-mode pattern). One error read only "media error 3: Error Occurred.", which did not say what failed.
- What we'd like next: a reason in the error message (network, decode, unsupported format).

## Amazon Devices Builder Tools (MCP)

- What worked well: the guides it serves were exactly what the coding agent needed: the media player, focus management, the remote's key names and `inputd-cli`, the RN 0.83 layout in dp, and the native-driver rule. Searching the docs found the dp canvas note in seconds.
- What was hard: the documentation tools only appeared after restarting Claude Code, and the setup appended a long block to our CLAUDE.md.
- What we'd like next: tools available without a restart.

## Amazon Bedrock and Nova 2 Lite

- What happened: our new AWS account (Free plan, created on day two of the build) was still waiting for verification that day, so we could not call Nova yet. We kept building with a free local model behind the same interface and switch to Nova once the account works.
- What we'd like next: a clear status and expected time for account verification in the console, and which services a Free plan account can use before it is verified.
