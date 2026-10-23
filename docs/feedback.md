# Product feedback

The same text as in docs/devpost.md: what we used each tool for, what worked, what needs work, and whether we'd build with it again.

**Vega SDK and CLI (SDK 0.24, CLI 1.4.4).**
- *What we used it for:* creating, building and running the TV app.
- *What worked:* `vega project generate` gave us a working app on the first try, and `vega run-app` installed it on the Virtual Device without trouble. `vega device start-log-stream` was our best debugging tool: our diagnostics screen wrote every check into the device log, so we could read the TV's state without looking at it.
- *What needs work:* the first-run setup stops at an interactive question, which blocks scripted or agent-driven setup. `~/vega/env` wasn't created, so we added `~/vega/bin` to the PATH ourselves. Every command prints a harmless "vvman not found" warning. There's no command to take a screenshot of the device.
- *Onboarding:* good once we pinned Node 22. *Would we build with it again:* yes.

**Vega Virtual Device.**
- *What we used it for:* running and testing the TV app.
- *What worked:* it ran next to a local language model, Chrome and an editor on an 8 GB MacBook Air. `inputd-cli button_press` let our scripts press remote buttons.
- *What needs work:* pressing Home closes the app, and the next launch is a new process with a new pairing code, which surprised us mid-test. A screenshot command would help a lot. *Would we build with it again:* yes.

**React Native for Vega 0.83.**
- *What we used it for:* the TV's interface and Pip's animations.
- *What worked:* native-driven animations for Pip's states, and `FocusManager` for remote focus.
- *What needs work:* our first screen rendered at twice the size, because layout is on a 960 x 540 dp canvas. The migration guide says so, but the template doesn't. With two focusable cards, `hasTVPreferredFocus` put focus on the second; calling `FocusManager.focus` after the cards loaded fixed it. On SDK 0.24 the AppState change event can stop after the first background cycle. *Would we build with it again:* yes.

**W3C Media API (react-native-w3cmedia 2.3.2).**
- *What we used it for:* playing the films.
- *What worked:* MP4 in URL mode over HTTPS through a tunnel, with seeking by Range requests, and events that map straight onto our playback reports.
- *What needs work:* one error read only "media error 3: Error Occurred", which didn't say what failed. *Would we build with it again:* yes.

**Vega Media Controls.**
- *What we used it for:* play and pause from the remote.
- *What worked:* it needed no code of ours, and it's the path Alexa voice control takes on a real device.
- *What needs work:* nothing we ran into. *Would we build with it again:* yes.

**Amazon Devices Builder Tools (MCP).**
- *What we used it for:* our coding agent read the Vega guides through it: the media player, focus, key names, `inputd-cli`, dp layout and the native animation rule.
- *What worked:* it found the dp canvas note in seconds.
- *What needs work:* the tools only appeared after restarting the editor's agent, and setup appended a long block to our agent instructions file. *Would we build with it again:* yes, it saved us hours.

**Amazon Bedrock and Nova 2 Lite (AWS).**
- *What we used it for:* nothing ran in the end. Our new AWS account was still waiting for verification for the whole build, so Pip never called Bedrock. The adapter is written and tested against a fake model only, and we say so in the README.
- *What we'd like:* a verification status with an expected time in the console, and a list of what a new account can use before it's verified.

**Other tools.** Ollama and Qwen2.5 3B were reliable and fast enough for answers (2 to 6 seconds for a story). Qwen3-VL 4B was usable but slow on 8 GB. whisper.cpp transcribed a 15-minute film in about 30 seconds. Cloudflare quick tunnels change their URL on every start, which means rebuilding the TV app each time.

## Feature requests

1. **`vega device screenshot`.** Important. Every UI check meant giving the terminal screen recording permission, and agents and CI can't do that.
2. **A non-interactive first run for the Vega CLI.** Important. It blocks scripted setup and coding agents.
3. **The dp canvas size in the app template's README.** Important. It's the first thing every new app gets wrong.
4. **WebSocket stability with larger messages on Vega.** Critical for any companion-style app. Our socket dropped every 5 seconds above about 5 KB per message, and we had to slim our protocol for the TV.
5. **AWS account verification status in the console.** Critical for hackathons. Without it, a team can't plan around Bedrock.
6. **Media error messages that name the cause** (network, decode, format). Nice to have.
