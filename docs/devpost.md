# Pip: the Devpost submission

Everything the form asks for, in the order it asks. Each heading says which field it goes in. Numbers come from files in this repository, and each one says where.

---

## Project name

Pip

## Tagline

A film companion for Fire TV that knows what's real, never tells you what's next, and lets you play with what could have been.

## Track and mini challenges

- **Primary track:** Fire TV (Vega OS). It covers four of the priority categories: AI-enhanced viewing, family entertainment, multi-modal UX and computer vision.
- **AWS Builder mini challenge:** not entered. Our AWS account was never verified in time, so no AWS service runs in Pip. The story is under "Challenges".
- **Open Source mini challenge:** not entered as a separate project. The repository is MIT licensed, and it vendors one MIT project (gesture-tv-remote) unchanged.

## Links

- Demo video (YouTube or Vimeo, public, English, under 3 minutes): **add the link after uploading**
- Code: https://github.com/Parth-rait/pip-amazon-firetv (MIT; see "Repository and reviewers" at the end)

---

## Inspiration

Every family has the same three moments on movie night.

Someone asks "wait, who is that?", and the film stops while someone explains, or the question just hangs there. Someone comes back from the kitchen and asks "what did I miss?", and the whole room pays for it. And somebody always says "I'd have ended it differently."

Your phone can't help with any of these. It knows the whole film, so the first thing a search does is tell you the ending. We wanted a helper that only knows the film up to the second you have reached. It shouldn't talk during the film unless someone asks, and it should run in the living room, not somewhere else.

We named the companion pad **Hail Mary**. It's the long pass you throw when the clock is nearly out and everyone tells you it won't work. That was us: a 3B language model on an 8 GB laptop, no cloud, eight days, against a problem that big models get wrong all the time.

## What it does

The TV runs Pip, a Vega OS app. Everyone in the room scans a QR code on the TV with a phone or tablet, and that phone or tablet becomes their Hail Mary pad. (On screen it still says Pip Pad, the name it had all week.) The first person in is the host.

**Watching.** On the TV, Pip opens on a home screen with the QR code and the films. There are two films. Tears of Steel is a live-action sci-fi short with real actors, and Sintel is an animated fantasy with a twist ending. Both are open films from the Blender Foundation (CC BY 3.0). During the film, Pip is invisible.

**Control without the remote.** The host's pad has a large ring control: OK plays and pauses, left and right skip 10 seconds, and up and down change the volume. You can also say "pause" or "back 10", or use the Fire TV remote. As an experiment, we added hand gestures in front of a webcam. Every one of these goes through the same router, the TV confirms each command, and none of them calls a language model.

**Ask without spoilers.** Anyone can tap "Who is that?", "Explain this scene" or "What did I miss?", or type or speak a question. Pip answers in a sentence or two, on the TV and on the asker's pad, using only what the film has already shown. Ask "Who is the old man?" at 3:40 in Tears of Steel and Pip describes a grey-haired man in a church tower. Ask again at 4:00, after the film reveals it, and Pip adds that the others call him Thom. Ask "How does it end?" and Pip says "No spoilers from me."

**While you were away.** If someone's phone locks or drops off during the film, or someone joins late, Pip catches up only that person when they're back. Their pad shows a few lines about what happened, up to now and never further. The film keeps playing for everyone else.

**Parallel Stories.** This is the part people remember. Pause on a moment and ask "What if Thom had never left Celia?". Pip splits the film at that second and writes its own version from there. On the pad you get a story map with two lanes: the film as a solid line up to the split, and Pip's version as a dotted blue line after it. Tap Continue this story, Change one thing, Where did it split? or Back to the film. During play, the TV only shows Pip's story in a small, labelled bubble. In our browser TV client, pausing or reaching the end also shows both stories side by side.

Every line carries a label, "The film" or "Pip's version". A story never sees anything the film hasn't reached at the split. In the comparison, the film after the split appears only as far as the room has watched. The rest just says "You haven't seen this yet."

**The Command Center.** A dashboard at `/hub` that opens only on the machine running Pip. It shows which model is answering, what's playing, every fact Pip knows about each film (behind a spoiler warning), today's events, the devices, and which automations are real, opt-in or only planned.

**Kids games**, a short quiz after the film plus guesses and reactions, are a switch the host turns on. They're off by default.

## How we built it

**The TV.** A Vega OS app in React Native for Vega 0.83 on the Vega SDK 0.24. Films play through the W3C Media API in MP4 URL mode from our own server, and the remote's play and pause work through Vega Media Controls. `FocusManager` handles remote focus. The Vega app has the lobby with the QR code and posters, the player, Pip's answers and story bubbles, and the quiz.

We also built a second TV client that runs in a browser at `/tv`. It uses the same socket protocol, so the whole room could be built and tested on a laptop. That's where the newer screens live first: the Fire TV style launcher (Home, Discover, My Space, Scenes, Search) and the paused two-lane comparison for Parallel Stories. Bringing them into the Vega app is the next job.

**The pad.** A React and Vite web app. There's nothing to install: scan the code and you're in.

**The server.** One Node.js 22 process with Express 5 and Socket.IO 4.8. It owns the session and sends every screen a full snapshot after each change, so a screen that reconnects simply catches up. One contract file (`shared/protocol.ts`, now on version 10) describes every event, and the server validates each one with zod.

**The timeline is the source of truth.** Each film has a timeline: timed facts, each with a frame of the film as evidence, the second it's revealed, and the words it reveals first. Before anything reaches the model, code cuts the timeline at the TV's current position. After the model answers, an answer gate rejects any reply that uses a word or names a character the film hasn't reached. "Who is that?" and "What just happened?" are answered straight from the timeline, with no model at all.

**The brain runs on the laptop.** Pip's language model is `qwen2.5:3b` running in Ollama on the same Mac as the server. Nothing about the family (names, questions, what they watch) leaves the house. Amazon Bedrock with Nova 2 Lite sits behind the same interface, ready for the day the account works.

**Parallel Stories.** In a branch, code owns everything that has to be true: the split point, the facts the branch may use (only those revealed by the split), the event IDs and their order, and the "The film" or "Pip's version" label on every line. The model's only job is to write 3 to 5 events as JSON. They're checked against a strict schema, and Pip retries once if they fail. The film's own timeline is never written to. Branches live in the session only and disappear with it.

**Reading the film ourselves.** `npm run pipeline` finds scene cuts with ffmpeg, transcribes the dialogue with whisper.cpp, and asks a local vision model to describe frames. Characters are only named once the dialogue names them, so a twist hidden in a name stays hidden. For the two demo films, we wrote the notes from a frame every 6 to 10 seconds plus the subtitles. Then we checked every note against a frame from the film and turned the notes into timelines with `npm run timeline:notes`.

**Testing it like we meant it.** 420 server tests, including a Virtual Pip Lab that runs the real server over real sockets, with a fake TV, fake pads and injected faults. On top of that, two benchmarks run against the real local model: one for answers and one for stories.

## Challenges we ran into

**AWS never arrived.** We opened an AWS account on day two to use Nova on Bedrock. Verification never finished during the build. Since we'd put the model behind one interface from the first day, we switched to a local model and kept going. In the end we turned it into the design: everything runs on the family's own machine, costs nothing, and works offline. It also forced us to put the safety into code, because a 3B model gets facts wrong far more often than a large one.

**The small model spoiled films when we trusted the prompt.** Our first version gave the model the film notes up to now and asked it nicely not to spoil. At 0:15 into Big Buck Bunny (our first film), it answered "How does the film end?" with the ending. It also invented that the shaman gave Sintel her sword. Our keyword check had reported zero leaks. We only found these by reading every answer by hand. That's when we moved every film to the grounded path, where nothing after the current second can reach the prompt at all.

**The vision models failed us, honestly and measurably.** We wanted Pip to understand a film by watching it.
- **Qwen2.5-VL-3B:** with a character list in the prompt, it copied the whole list into every answer. It even said all three characters were present in a black frame, and its license doesn't allow commercial use.
- **Qwen3-VL-4B:** it worked and named people sensibly, but on an 8 GB Mac it took 22 seconds per frame at the median and up to 60 seconds. Describing frames from just the first 6 minutes of Sintel took 47 minutes, so we stopped there.
- **DeepVideoR1:** it has no license file, no released weights, and needs four GPUs.

We labelled 54 frames by hand to check it. On the 31 of them in the part the model covered, its links between faces and characters were right 82% of the time (precision), and it found 72% of the people actually on screen (recall). Good enough to draft a timeline, not good enough to trust. So the vision model became a drafting tool. A person checks every fact before Pip may use it, and the films in the demo run on reviewed timelines.

**Our first spoiler check flagged Pip's own words.** "Keep watching and see!" contains "watch", which a later scene says first. Then everyday words like "quiet" and "made" blocked whole stories while protecting nothing. We now keep everyday words and Pip's own phrases out of the spoiler list, and for made-up stories the word check only blocks names.

**Notes run ahead of the picture.** When we checked them against frames, some beats appear up to 10 seconds after their note's time. So a fact now only counts once its beat is over.

**Stories found the twists anyway.** Our first story benchmark found a real leak that no word check could catch. Seven seconds before Sintel's reveal, the model wrote "big dragon. You're my friend Scales". We added a guard for twists of identity: each film declares who turns out to be whom. Until the reveal, a story line that puts both sides together is withheld and Pip writes another. The next runs found new phrasings, "your childhood friend" and "the robot Celia". Each one became a clue in the guard and a unit test.

**Vega had its own lessons.**
- The TV's WebSocket dropped every 5 seconds once our session snapshots grew past about 5 KB, so the TV now gets a slim view.
- Our first screen rendered at twice the size, because RN 0.83 on Vega lays out on a 960 x 540 dp canvas.
- With two film cards on screen, preferred focus landed on the wrong one.
- After the first background cycle, the AppState change event sometimes stops arriving, so the TV also reconnects when it gets focus.
- The Vega tools broke on Node 26, so we pinned the project to Node 22.

## Accomplishments that we're proud of

**Zero spoiler leaks in 218 probes, on a 3B model running on a laptop.** Tears of Steel, with two reveals: 0 of 108 leaks, 95% of answerable questions answered, and 98% correct "I don't know"s. Sintel, with its twist: 0 of 110, 95% answered, and 95% correct "I don't know"s. A fake model that always tries to tell the ending also leaked nothing, because the ending never reaches it. (`docs/evaluation/results/`)

**We measured Parallel Stories instead of promising it.** Three benchmark runs produced 715 story lines, branching just before each film's reveals. The premises were ordinary, adversarial ("tell me the real ending as a what-if") and indirect ("what if we found out who the old man really is"). Detectors flagged lines, and we read every adversarial line by hand. Each run found one leak in a new phrasing, and each became a guard and a test. We publish the runs and the leaks, because a story generator that claims it can never spoil is lying. "How does the real film end?" went to the film, not the story, in 60 of 60 cases.

**Controls that never wait for a model.** The pad, voice, the remote, gestures and simulated touch hardware all go through one router. The TV confirms each command: 6 to 12 ms on the browser TV, and 177 to 239 ms on the Vega Virtual Device through the tunnel.

**A catch-up nobody else sits through.** "While you were away" is private to one person, spoiler-safe, needs no model, and is tested over real sockets.

**420 server tests** and a lab that breaks things on purpose: server restarts, a TV leaving mid-film, a pad dropping and coming back.

## What we learned

A small model is fine at writing and bad at knowing. Once we stopped asking it to decide what's true and only asked it to write, the leaks stopped. Code decides what Pip may know, the model chooses the words, and a gate checks those words before anyone sees them.

Reading your own outputs beats any dashboard. Every serious problem we found this week, from the ending at 0:15 to "the robot Celia", came from reading what the model actually wrote. The automatic checks all reported zero.

Vision models are drafting tools for now. On consumer hardware they're slow and confidently wrong in specific, repeatable ways. Treating their output as candidates for a person to review made them useful instead of risky.

## What's next for Pip

- **The room as an input.** The camera already sees hands for gestures. Next, it would notice when everyone gets up: the film pauses itself, then Pip offers the catch-up when people come back. It would count people without recognizing anyone, and stay off unless the family turns it on.
- **Alexa.** On a Fire TV device, Vega Media Controls already let Alexa play and pause the film in our app. Next comes "Alexa, ask Pip who that is", answered through the same spoiler-safe path.
- **Glasses.** Smart glasses as one more pad: look at the screen, ask quietly, and the answer comes only to you, like the catch-up.
- **Any title.** The pipeline drafts a timeline from the video and dialogue, and a person approves the facts. A service that already keeps per-title metadata could do this across a catalogue, so story questions get the same spoiler boundary.
- **Nova on Bedrock** as an optional brain, once the account works, measured on the same benchmarks before it's switched on.

## Built with

Vega OS, Vega SDK, React Native for Vega, W3C Media API, Vega Media Controls, Vega Virtual Device, Amazon Devices Builder Tools (MCP), TypeScript, Node.js, Express, Socket.IO, React, Vite, zod, Vitest, Ollama, Qwen2.5 3B, Qwen3-VL 4B, whisper.cpp, ffmpeg, MediaPipe (through gesture-tv-remote), Python, Cloudflare Tunnel, Playwright

---

## Pre-existing project statement

Pip was started from an empty repository on October 15, 2026, for this hackathon. The first commit, dated October 15, sets up the empty skeleton, and everything since was built during the submission window. Third-party code is used unchanged and credited: gesture-tv-remote (MIT) in `gesture/vendor`. The films are Big Buck Bunny (used during the build, now removed), Sintel and Tears of Steel, all Blender Foundation open films under CC BY 3.0. The TV's player follows the URL-mode pattern from Amazon's W3C Media API guide.

---

## Product feedback (field: product feedback)

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

## Feature requests (optional field)

1. **`vega device screenshot`.** Important. Every UI check meant giving the terminal screen recording permission, and agents and CI can't do that.
2. **A non-interactive first run for the Vega CLI.** Important. It blocks scripted setup and coding agents.
3. **The dp canvas size in the app template's README.** Important. It's the first thing every new app gets wrong.
4. **WebSocket stability with larger messages on Vega.** Critical for any companion-style app. Our socket dropped every 5 seconds above about 5 KB per message, and we had to slim our protocol for the TV.
5. **AWS account verification status in the console.** Critical for hackathons. Without it, a team can't plan around Bedrock.
6. **Media error messages that name the cause** (network, decode, format). Nice to have.

## Friction log (optional field, one entry per problem)

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

---

## Repository and reviewers

- **Code:** `https://github.com/Parth-rait/pip-amazon-firetv`, MIT license (`LICENSE`). Push the `merge/cloud-vnext` branch and merge it into `main` before submitting, so that `main` is what judges see.
- **If the repository stays private:** in Settings, then Collaborators, add `testing@devpost.com` and the Amazon reviewers knmeiss, giolaq, anishamalde, mosesroth and emersonsklar. Do it on submission day, because invitations expire after 7 days.
- **Running it:** the README's "How to run it" section. The films aren't in the repository: download Sintel and Tears of Steel from the Blender Foundation, as `PROJECT.md` 5.6 and the README describe.
- **Evidence for every number above:** `docs/evaluation/results/`, `docs/vnext/REPORT-local-first.md` and `docs/extractions/video-understanding.md`.
