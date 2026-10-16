# Current state (verified)

> **Read section 7 first.** Sections 1 to 6 are the cloud session's record of branch `claude/pip-vnext-core`, which started from `8e7b472` (Step 6 code, no TV app) and was merged onto `mac/film-and-tv` on 17 Oct 2026. They stay as history; section 7 is the merged state.

This file records what the repository actually contains and does, checked by running it. Plans live in [PROJECT.md](../../PROJECT.md) and [target-architecture.md](target-architecture.md); this file only records facts. Update it when the facts change.

## 1. Baseline audit (October 16, 2026, before the vNext work)

| Item | Value |
|---|---|
| Starting commit | `8e7b472` (merge of PR 1, `claude/step-1-s3o378`) on `main` |
| Working branch | `claude/pip-vnext-core`, created from `8e7b472`; no uncommitted user work existed |
| History | 6 commits: scaffold and contract, server skeleton and the first Nova call, sessions/players/host/QR, Pad join/lobby/host controls |
| Runtime | Node 22.22.0, npm 10.9.4 (`.nvmrc` = 22) |
| Packages | `server/` (Express 5, Socket.IO 4.8, zod 4, AWS SDK v3 Bedrock Runtime, qrcode, dotenv; vitest, eslint, tsx), `pad/` (React 19, Vite 8, socket.io-client; vitest, oxlint). Root has no dependencies. Each package has a committed lockfile |
| Not present | `tv/` (Vega app; must be generated on the Mac with the Vega CLI), `server/media/` (the film, gitignored), `.mcp.json`, any CI workflow, any `docs/measurements.md` |

Baseline commands, run from the repo root after `npm ci` in `server/` and `pad/`:

| Command | Result |
|---|---|
| `npm run check:shared` | Pass (server and pad copies current; tv skipped) |
| `npm run typecheck` | Pass (server `tsc --noEmit`, pad `tsc -b`) |
| `npm run lint` | Pass (eslint, oxlint) |
| `npm test` | **1 failure**, 75 passed: `server/src/app.test.ts` "serves the pad for any other GET" got 404 |

The failure was a test bug, not an environment problem: the test created a temporary `padDir` but never passed it to `createApp`, so it only passed on a machine where `pad/dist` had been built. Fixed by passing `padDir` (first vNext commit).

## 2. What works (verified by tests and the code)

- **Pairing and sessions:** a TV says `tv:hello`, gets a 4-character code and a `tvKey`; a live session can be reclaimed only with the key; after a server restart the first TV with a valid code re-creates it and resumes `watch` from its playback report.
- **Players and host:** join with a cleaned first name, unique-name suffixes, 8-player cap, rejoin with the same player id, host is the first joiner, 10 s grace before hand-over, join rate limit per address for unknown codes.
- **Realtime safety:** every handler is wrapped in a try/catch; payloads are validated with zod; events without an ack function are dropped (a smoke test proves a missing ack does not crash the server).
- **Playback relay:** host `play`/`pause`/`seek` (seek clamped to ±60 s) are sent to the TV socket only; `tv:playback` is accepted only from the session's current TV socket and for the chosen film.
- **HTTP:** `/health`, `/api/films` (never notes or quiz), `/qr/:code` (PNG only for live sessions), `/media` with Range support and a JSON 404, the built pad with an SPA fallback.
- **Model wrapper:** `TextModel` interface, Bedrock Converse adapter with `maxAttempts: 2`, abort signal plus `withTimeout`, and a fake model for tests.
- **Pad:** join screen (code boxes, name), lobby (host picks a film), watch screen with host controls (−10 s, play/pause, +10 s, progress estimate), status pill with reconnect and "Join another TV", automatic rejoin with retry, debug ping overlay. Reducer has tests.
- **Dev tools:** `fake:tv` script, `smoke:join` (two pads and a TV over real sockets), `smoke:ai` (one real Nova call; needs AWS credentials).

## 3. Runtime paths traced

| Path | Steps | Deterministic or model | Persisted |
|---|---|---|---|
| Join | Pad `pad:join` → zod → rate limit → `joinPlayer` → `pickHost` → ack with view → broadcast | Deterministic | Memory only; pad keeps id, name, code in localStorage |
| Host control | Pad `pad:host` → zod → host check → stage check → `tv:command` to TV socket | Deterministic | Nothing. **No command id, no outcome check**: the server never learns whether the TV obeyed |
| Playback | TV `tv:playback` → zod → current-TV and film checks → store with arrival time → broadcast | Deterministic | Memory |
| Ask Pip | Pad would send `pad:ask` | — | **Not implemented.** `askSchema` exists in `validate.ts` but `realtime.ts` registers no `pad:ask` handler, so questions are silently dropped |
| Video notes | `server/content/big-buck-bunny.json` | Hand-written | **Placeholder only** (one note, one quiz question, both "Placeholder") |
| Quiz | `QuizRun` type and timer key only | — | Not implemented (Step 9) |

## 4. Known gaps and risks at baseline

1. Ask Pip, the main product interaction, does not exist yet; the pad has no Ask box.
2. No film notes, no evidence or timestamps, no evaluation probes (`server/evals/` is empty).
3. Spoiler safety is a prompt rule in the plan only; no code filters evidence or checks answers.
4. A host command is "fire and forget": the pad cannot tell "sent" from "done".
5. No shared input contract: only pad buttons exist; no remote-key, button or touchwheel path.
6. Default watch screen shows a disabled "The quiz unlocks as you watch" button: an unrequested activity prompt.
7. No TV app; no way to see or test the TV experience in the cloud.
8. Duplicate taps are safe for play/pause (absolute commands) but not for seek (a double tap seeks twice).
9. `PROJECT.md` says "Status: Ready to build. No code yet." while six commits of working code exist.
10. No CI; nothing runs the checks on push.

## 5. Gap matrix (vNext requirement → evidence → next change → proving test)

| Requirement | Baseline evidence | Gap / risk | Next change | Test that proves it |
|---|---|---|---|---|
| Quiet default playback | Watch screen shows a disabled quiz button | Unrequested prompt | Remove quiz from the default path; quiz becomes an opt-in mode | Pad screenshot; `view.features.quiz` false by default |
| Invoke, ask, dismiss Pip | No `pad:ask` handler, no Ask UI | Core loop missing | `pad:ask` flow, `assist` in the view, `pad:assist` dismiss, Ask panel | `flow` and lab scenario tests |
| Grounded, spoiler-safe answers | Placeholder notes | Leaks would come from model knowledge | Timeline with evidence, time-bounded retrieval, abstain without evidence, answer validator | Spoiler, rewind and unknown-fact tests; eval run |
| Safe answer memory | None | — | Cache keyed by permitted evidence set; re-validate on delivery | Rewind cache test |
| Deterministic controls never use a model | True today | Typed "pause" would go to the model once Ask exists | Decision router sends commands to the action executor | Router tests |
| Command outcome confirmation | None | "Sent" shown as "done" | `commandId`, tracker confirms from playback reports, `lastAction` in the view | Executor tests; lab scenario with a TV that ignores commands |
| Shared semantic input contract | Pad buttons only | No remote, button or wheel | `pad:input`/`tv:input` envelopes and adapters into one path | Adapter tests; lab scenario |
| Event journal | Logs only | Hard to replay or diagnose | Per-session append-only journal, idempotent event ids, JSONL export | Journal tests |
| Virtual Pip Lab | `fake:tv`, `smoke:join` | No fault injection, no TV UI | In-process lab harness with faults; browser TV simulator | Lab scenario suite |
| Video data pipeline | None | No reproducible timeline | Pipeline CLI: ingest, probe, scenes, frames, sheets, annotate, review, export, validate, dataset | Pipeline tests on a generated fixture film |
| Evaluation | `evals/` empty | No measurements | Golden set and runner with real local measurements | `npm run eval` output in docs/evaluation |
| Source of truth | PROJECT.md says "no code yet" | Agents misled | Reconcile PROJECT.md; mark quiz-first parts as history | Doc review |

## 6. After the vNext work (October 16, 2026, branch `claude/pip-vnext-core`)

Verified in this cloud session (Node 22.22.0, Ubuntu, Chromium from Playwright 1.56.1):

| Check | Result |
|---|---|
| `npm run check:shared` | Pass |
| `npm run typecheck` (server, pad) | Pass |
| `npm run lint` (eslint, oxlint) | Pass |
| `npm test` | Server 198 tests in 30 files pass (19 of them are Virtual Pip Lab scenarios over real sockets); pad 13 tests pass |
| Lab stability | `npm run lab` passed 6 times in a row after the rejoin retry fix |
| `npm run smoke:join` against a running server | `JOIN OK` |
| `npm run eval` (lab film) | 0 spoiler leaks in 68 probe runs for every strategy; AI off: 99% correct abstentions, 87% correct answers, 100% routing |
| `node scripts/e2e-browser.mjs` (TV simulator at 1920x1080, phones at 390 and 360 px, tablet at 820 px) | 14 of 14 checks, no console errors |
| `npx impeccable detect` (pad and TV pages, `pad/src`) | 0 findings (page scans see the first screen only) |
| `npm audit` (server, pad) | 0 known vulnerabilities |
| Pipeline on the lab film | Scene detection F1 1.00 at threshold 3 (default 10: 0.25; fixed 6 s: 0.27); 51 frames with exact decoded times; 18 facts accepted after the script check; timeline valid |

**Not verified here:** anything on Fire TV or the Vega Virtual Device (no Vega app yet; Mac only); real Nova calls (no AWS credentials in this environment: `smoke:ai`, `eval --nova`, the Nova annotator); the TypeSafe API (host unreachable, no key); the Big Buck Bunny pipeline run (`download.blender.org` refused by the network policy); the browser speech input (no microphone in headless Chromium); any physical button or touchwheel.

**Behaviour now:**

- Join, lobby and host flows as before; `pad:join`, `tv:hello` and the host hand-over are unchanged.
- Watch is quiet: the TV shows only the film; `view.assist` is null until someone asks.
- `pad:ask` routes text: play, pause and seek phrases run as host-only commands without a model; "never mind" dismisses; "stop" offers "Pause the film" and "Hide Pip"; questions about the future get "No spoilers from me. Keep watching and see!"; recap and "who is that" are answered from the timeline; other questions go to the model with only permitted facts and must cite them.
- Replies show on the TV for 8 s (or until Done, Hide or the remote's Back) and only on the asker's pads.
- Host commands, remote keys and the pad's button and wheel go through one executor; repeats of a `commandId` or `eventId` are ignored; `view.lastAction` says sent, done (the TV's report showed it) or unconfirmed (4 s without it).
- Big Buck Bunny has no timeline, so Pip says it has no notes for that film. The lab film (`LAB_CONTENT=true`) has 18 accepted facts.

**Gap matrix status** (section 5): every row has a change and a test, except the parts that need the Mac or credentials: the Vega TV screens, a reviewed Big Buck Bunny timeline, real-model numbers and a live TypeSafe comparison. Those are listed in PROJECT.md section 0.4 as next steps.

**Defects found and fixed during the work:** the baseline test bug (section 1); the pad's first rejoin retry waited 10 s, so after a server restart a pad that returned before the TV stalled (now 1, 2 and 5 s first); "what happens next" was routed as a recap; "who owns X" was treated as identify; the AI-off keyword match accepted a name alone; on the TV the credit line ran under Pip's bubble; the disabled Ask button had no visible shape; the Ask field truncated on narrow phones.

## 7. After the merge onto the Mac branch (October 17, 2026, branch `merge/cloud-vnext`)

The cloud branch and `mac/film-and-tv` grew the same vNext ideas separately for a day. The merge keeps the Mac branch as the base and brings the cloud's work on top; the full record is [docs/vnext/REPORT-cloud-merge.md](../vnext/REPORT-cloud-merge.md).

| Item | Value |
|---|---|
| Packages | `server/`, `pad/` and `tv/` (the Vega app, checked on the Vega Virtual Device) |
| Contract | `shared/protocol.ts` v5: `PipInput` over `pad:input`, `TvCommand` with `id` confirmed by `tv:applied`, `pad:ask`, `SessionView.assistant` and `device`; `Source` gained `'timeline'` (additive) |
| Kept from the Mac branch | protocol v5, `actions.ts`, `core/journal.ts`, `core/touch.ts` and `sim:touch`, the TV app, the pad's watch screen and Pip sheet, kids mode, answer memory, the local model |
| Ported from the cloud branch | grounded Ask Pip (`answer.ts`, `core/context/`), the text router (`core/intent/route-text.ts`, `ask-commands.ts`), the optional TypeSafe judge, the timeline loader, the video data pipeline and lab film, the dataset and golden probes, the benchmark, the Virtual Pip Lab (rewritten for v5), and these docs |
| Not merged | the cloud's command tracker, input envelope adapters and in-memory journal (the Mac versions cover them); the browser TV simulator, its Ask and lab panels and the browser end-to-end script (the Vega app is the TV) |

Checks on the merged branch (Mac, Node 22):

| Command | Result |
|---|---|
| `npm run check:shared` | pass |
| `npm run typecheck` | pass (server, pad, tv) |
| `npm run lint` | pass: 0 errors; 4 warnings, all Vega "system distributed library" notices |
| `npm test` | server 296 tests (41 files) including 20 Virtual Pip Lab scenarios, pad 29, tv 10 |
| `npm run lab` | 20 of 20, five runs in a row |
| `npm run eval -- --ollama` | 0 spoiler leaks in 68 probe runs for every strategy, including the local model (`docs/evaluation/README.md`) |
| Live server with `LAB_CONTENT=true`, AI off, real sockets | "What just happened?" at 50 s answered from 2 facts in 37 ms; "What happens at the end?" got the no-spoiler line; typed "pause" paused the TV, with the reply on the asker's pad only |

**Behaviour now:**

- A film with a timeline answers through the spoiler boundary, retrieval, the model only when needed and the answer gate. Only the lab film has one (`LAB_CONTENT=true`); Big Buck Bunny and Sintel still answer from their notes, now with the fixed no-spoiler line for questions about the future.
- Text sent to Ask Pip that is a command ("pause", "back 30 seconds", "never mind", "stop") runs through the action executor without a model; the pad also sends short typed commands as inputs directly.
- Everything else is as in docs/vnext/REPORT-phase-1-2.md: quiet viewing, Pip on demand, TV-confirmed commands, the journal, the touch adapter.

**Not verified on this branch:** Nova (AWS not set up); the TypeSafe API (paid, no key); a timeline for Big Buck Bunny or Sintel; the merged server against the TV app on the Vega Virtual Device (the TV-facing protocol did not change, but it has not been re-run).
