Read docs/vnext/PLAN.md before any task (section 0 first: since 22 Oct the build is local-first, without AWS): since 16 Oct 2026 it is the source of truth for direction (Pip as a quiet, context-and-action assistant; the build order in its section 13). PROJECT.md stays the reference for the infrastructure that is kept (pairing, playback, the socket protocol, coding standards). Where they differ, docs/vnext/PLAN.md wins. docs/vnext/AUDIT.md is the Phase 0 baseline; rollback tag `pre-vnext`. PROJECT_enh.md (16 Oct evening) is Parth's master build brief on top of the plan; where the two differ, PROJECT_enh.md wins. What exists now: docs/architecture/current-state.md section 7 and docs/vnext/REPORT-cloud-merge.md; decisions in docs/decisions/; product and design in PRODUCT.md and DESIGN.md.

# Pip for Fire TV: agent notes

Hackathon project (Amazon Developer Hackathon, Fire TV track). Deadline: Fri Oct 23 2026, 12:00 PDT; target submit Thu Oct 22.

## Where things are

| Path | What | Status |
|---|---|---|
| `PROJECT.md` | Plan, architecture, contracts, standards, step-by-step build prompts (section 13) | Done |
| `shared/protocol.ts` | The only definition of socket events and payloads | Version 10 (`pad:away`, `pip:missed`, `pad:branch`, `pip:branch`, `BranchView`, source `imagined`, film `tags`, `SceneView`, `HubSnapshot`); PROJECT.md 7.1 shows version 2 |
| `scripts/sync-shared.mjs` | Copies the contract into `server/src/shared`, `pad/src/shared`, `tv/src/shared` | Done |
| `scripts/run-all.mjs` | Runs `typecheck`, `lint` or `test` in each package that has a `package.json` | Done |
| `scripts/tunnel.mjs` | Cloudflare quick tunnel; writes `PUBLIC_URL` and `SERVER_URL` | Done (used from Step 3) |
| `scripts/preflight.mjs` | `npm run preflight`: PASS or FAIL per demo check (Node 22, HTTPS URL, film, quiz, pad/dist, smoke:ai) | Done |
| `server/` | Node 22 + Express 5 + Socket.IO 4.8 + Bedrock. `src/core/` = Pip Core, `src/film/` = film night | Steps 2, 4, 7, 8 and 9 done: config, films, /health, /api/films, /qr, /media, model wrapper, sessions, players, host, realtime handlers, Ask Pip, quiz drafts, quiz and results, fake:tv, smoke:join, smoke:quiz |
| `server/.env` | Local config (gitignored), copied from `server/.env.example` | Done |
| `pad/` | React + Vite web app: the Pip Pad at `/`, the browser TV at `/tv` (`pad/src/tv/`, a second TV client on the same protocol), and the Command Center at `/hub` (`pad/src/hub/`, this machine only); `pad/README.md` | Steps 5, 7, 9 and 10 done: join, lobby, host controls, status pill, Pip and its motion, debug overlay, Ask Pip, quiz, results, fullscreen, wake lock |
| `tv/` | Vega OS app (React Native for Vega) | Steps 3, 6 and the TV parts of 7, 9 and 10 done: lobby with QR and posters, watch with host commands and Pip's bubble, quiz and results, Pip's moods and colors. Commands in `tv/README.md` |
| `PRODUCT.md`, `DESIGN.md`, `docs/architecture/`, `docs/decisions/`, `docs/evaluation/`, `docs/engineering/` | Product, design, architecture (current state and target), decisions, benchmark, open-source review; from the cloud session, reconciled at the merge | Done |
| `docs/` | Friction log, product feedback, measurements, demo script; later devpost | Templates, empty measurement tables and a devpost draft done; demo script needs the scene times from the notes |
| `.claude/skills/` | `ship-step` (definition of done and commit) and `run-pip` (start the whole stack) | Done |

`pad/` and `tv/` must not be created by hand: their generators expect an empty or missing folder, and `sync-shared` would otherwise write into them early.

## Progress

- Step 0 (Parth): Mac setup and the film. Done except AWS (IAM user, `aws configure --profile pip`, Bedrock access): the film is in `server/media/` (596 s), Node 22, Vega SDK 0.24 and the VVD work.
- Step 1: root skeleton, contract, docs templates, ship-step skill. Done, except the ADBT `init-context` run (Parth runs it; re-check this file afterwards, since it may rewrite CLAUDE.md) and the first commit.
- Step 2: server skeleton, film file, first Nova call. Code and tests done in the cloud. Open for Parth on the Mac: convert the film into `server/media/` (PROJECT.md 5.6), set `durationSec` from ffprobe, run `npm run smoke:ai`.
- Step 4: sessions, players, the host and QR pairing. Done (smoke:join prints JOIN OK).
- Step 5: Pip Pad join, lobby and host controls. Done (checked with two Playwright browsers and fake:tv).
- Step 7: Ask Pip with guidance. Server and pad done in the cloud with a fake model. Open: Parth writes the premise, notes and evals; `smoke:ai` and `eval:ask` on the Mac; the TV bubble comes with the TV app (Steps 3 and 6).
- Step 8: quiz drafts. Done in code (`npm run draft:quiz -- big-buck-bunny`). Open: Parth runs it on the Mac after writing the notes, checks the 5 questions and copies them into the film file.
- Step 9: quiz and results. Server and pad done in the cloud (smoke:quiz prints QUIZ OK; three Playwright players played a whole quiz). Open: the TV's answer grid and results screen come with the TV app.
- Step 10: polish and resilience. Pad parts done in the cloud: Pip motion, 180 ms fades, 56 px targets, fullscreen, wake lock; every row of PROJECT.md 4.10 walked through in browsers (known issues in README.md). Open: the TV's Pip motion, safe margin and type scale.
- Step 11: demo hardening. Cloud parts done: `npm run preflight`, `docs/demo-script.md`, empty measurement tables. Open (Mac): preflight passing, scene times in the demo script, measurements, usability test, rehearsals, tag v0.1.0.
- Step 12: drafts only: README.md (what, why, architecture, Amazon tech, how to run, tests, known issues, credits) and docs/devpost.md, with "After" marks for what needs the TV app, measurements or the usability test. `npm audit`: 0 vulnerabilities in server/ and pad/.
- Step 3: TV spike. Done on the Mac (gate 1): every diagnostics line green on the VVD through the tunnel, round trip 28 to 104 ms, the film plays, the remote pauses it. `smoke:ai` waits for AWS.
- Step 6: TV lobby and watch. Done on the Mac (gate 2): QR join, host commands 177 to 239 ms, remote OK starts the film, server restart keeps the film playing.
- Oct 16 (agreed with Parth, PROJECT.md 2.4): film notes and quizzes drafted for Big Buck Bunny and Sintel (the agent read a frame every 6 s and the subtitles; Parth checks the times); local brain `AI_PROVIDER=ollama` with qwen2.5:3b; answer memory (PROJECT.md 5.9). eval:ask: 0 leaks on both films; the 3B model still makes up small facts, so the demo uses Nova.
- Oct 16: Pip moods (Chill, Playful, Sassy) and colors, avatars, greetings, posters (contract v3); pad redesigned (chat-style watch screen, remote-style host controls, "Make Pip yours" sheet); TV follows Pip's color and shows greetings and avatars.
- Step 9 TV part: quiz screen (2 x 2 choices, countdown bar, players light up when they answer, the reveal with picks and Pip's explanation) and results screen. Checked on the VVD with three players: reveals as soon as everyone answered, results match the taps, Keep watching resumes where the quiz started. Lobby focus starts on the first film (FocusManager).
- Step 11, parts without people: preflight checks every film (Range request, poster, 5 questions), that the TV app uses this tunnel URL, and notes the local model; `smoke:ai` uses the configured brain; the demo script has real scene times, the mood moment and a Sintel no-spoiler cutaway; `docs/measurements.md` has a labeled local-model baseline. Fixed: `npm run tunnel` could not rewrite a wrapped `SERVER_URL`. Preflight passes (local model). Not tagged yet: v0.1.0 waits for preflight on Nova.
- Step 12 drafts: README (two films, moods and customization, screenshots of every TV stage and the pad in `docs/screenshots/`, the local brain and answer memory, Amazon tech, known issues, credits for both films), `docs/devpost.md` with "After" marks only for what needs Nova or people, `docs/feedback.md` per Amazon tool, the AWS entry in the friction log. `npm audit`: 0 in server/ and pad/; tv/ findings are Vega build tooling (tv/README.md).
- Oct 16, agreed with Parth: the Pip Pad becomes a companion. Chosen: Understand (Catch me up: chapters of the story so far with pictures; Who's who: character cards whose facts unlock as the film reaches them), Play (reactions that float up on the TV, with the favourite moment in the results; Predict it: votes at key moments, revealed later), Polish (Pip's face per mood, little-Pip avatars, a more child-like quiz). Answers: wait for Nova (no prepared answers). Not chosen: parent heads-up and after-film activities.
- Companion built (contract v4): server (chapters, character facts and "What happens next?" votes cut at the family's position, reactions per scene, favourite moment, Pip reacting to reveals), content for both films (`npm run companion:images` makes the pictures), pad (tabs Pip, Story, Who's who; reaction bar with drawn faces; prediction card), TV (reactions float up, prediction panel with voters then picks, favourite moment in the results). Fixed: notes and quiz times were about 6 s early; the TV's WebSocket on Vega dropped every ~5 s once views carried the companion (~5 KB), so the TV now gets a slim view (`tvView`); the TV releases its player and socket in the background (AppState).
- Polish built: little-Pip avatars (8 shapes, one per color) on the pad (SVG) and TV (views); Pip's face per mood (chill sleepy eyes, playful sparkles and cheeks, sassy brow) on both, through `data-pip-mood` on the pad; confetti and a star for a right answer, star rows in the results on both.
- Oct 16, vNext (docs/vnext/PLAN.md): Phase 0 audit committed (docs/vnext/AUDIT.md, tag `pre-vnext`). Phases 1 and 2 built (contract v5): quiet viewing (Pip hidden on the TV during play, shown on invoke, pause or answer), a pad remote with volume, brightness and simulated lights, voice commands without a model, the Pip button and sheet, kids games as an opt-in, semantic inputs through `server/src/actions.ts` with TV confirmation (`tv:applied`), the event journal, and the touch adapter with `npm run sim:touch`. Evidence and open questions: docs/vnext/REPORT-phase-1-2.md.
- Oct 17: the cloud session's vNext work (PR 3 on main, built from Step 6 code without the Mac commits) merged onto this branch on `merge/cloud-vnext`, Mac as the base (docs/vnext/REPORT-cloud-merge.md): grounded Ask Pip for films with a timeline (spoiler boundary, retrieval, answer gate, evidence-keyed cache, re-check after a rewind), typed commands without a model, optional TypeSafe judge, the video data pipeline and lab film (`LAB_CONTENT=true`), `npm run eval` (with `--ollama`: 0 leaks), the Virtual Pip Lab (`npm run lab`, 20 scenarios on v5). Server 296 tests, pad 29, tv 10.
- Oct 17: hand gestures fixed after the first webcam run (one seek per point, a 1.2 s fist for Pip, the TV reconnects unless backgrounded, TV connects and disconnects journaled). The browser TV at `/tv` (contract v6: `tv:home`, film `synopsis`): a Fire TV style home (featured film, rows, the Pip Pad panel) and player (transport bar, command toasts, quiet Pip), the keyboard as the remote; checked in headless Chrome with a pad socket (pause, play, seek, Pip open and close all confirmed by the TV in 6 to 12 ms). Kids-mode screens on the browser TV are not yet walked through.
- Oct 17-21: video understanding (docs/extractions/video-understanding.md): `npm run pipeline -- asr` runs whisper.cpp (video/setup.sh), `understand` runs qwen3-vl:4b-instruct through Ollama over the frames with a character roster; names only from dialogue (`namedSec`), first-mention spoiler terms, an `unsupported-term` answer check, honest coverage for a partial run. Sintel's generated timeline (content/timelines/sintel.json, 155 candidate facts, frames 0 to 384 s; the run was stopped to spare the 8 GB Mac) answers with `TIMELINE_REVIEW=candidate`; by default Sintel stays on its notes. Tracking vs 31 hand-labelled frames: precision 0.82, recall 0.72. Server 374 tests. Rejected with reasons: Qwen2.5-VL-3B, PySceneDetect, DeepVideoR1 (no licence or weights); Nova blocked on AWS.
- Oct 22, local-first (docs/vnext/PLAN.md section 0; AWS not verified in time, so no AWS): `AI_PROVIDER=ollama` is the default; both demo films answer through reviewed timelines built from their notes (`npm run timeline:notes`; every note checked against a frame, revealed 10 s after its time; the pipeline's Sintel timeline moved to `server/pipeline/timelines/`); golden probes and datasets for both films. Benchmark with qwen2.5:3b: 0 leaks in 104 (Big Buck Bunny) and 110 (Sintel) probes. "While you were away" (contract v7: `pad:away`, `pip:missed`): a pad hidden or offline during the film, or a late joiner, gets a private recap up to now, no model call. The pad on a tablet: the film's still in a now-playing card, Pip beside the remote. README and docs/devpost.md rewritten. "What if...?" (v8): Pip makes up another version of the story from what has been shown, through the spoiler gate, labelled "made up by Pip". Evidence: docs/vnext/REPORT-local-first.md.
- Oct 22, later: Big Buck Bunny replaced by Tears of Steel (live action, CC BY 3.0; notes from a frame every 10 s and the subtitles; 0 leaks in 108 probes, 95% answered). The browser TV gets Home, Discover, My Space, Scenes (watched chapters only, `GET /api/films/:id/scenes?until=`) and Search; the pad a directional control, quick actions and push to talk; the Command Center at `/hub` (`GET /api/hub`, this machine only, 403 through the tunnel). Palette: Void #050914, Surface #0B1424, Electric #168BFF, Ice #8ED8FF.
- Oct 22, last: Parallel Stories (contract v10, `server/src/branch.ts`): a "what if" splits the film at the ask; code owns the split, the canon (facts revealed by the split only), ids, order and labels; the model writes 3 to 5 JSON events; follow-ups stay in the branch; Back to the film; session memory only. Identity-twist guard from content `sameAs` (terms and clues). Pad story map; browser TV comparison on pause and at the end. `npm run eval:branches`: three runs, every confirmed leak and fix in docs/vnext/REPORT-local-first.md 2c. Server 419 tests.
- Next (Parth): the VVD walk-through of this build (rebuild the TV app on v10), a 10-minute viewing test, the recording, "What we learned" in docs/devpost.md, tag v0.1.0 after `npm run preflight` passes. Cut for the submission: Phase 5 hardware, Phase 6 recommendations, Nova.

Update this list when a step is committed.

## Commands (repo root)

```bash
npm run sync:shared    # copy shared/protocol.ts into each package
npm run check:shared   # fail if a copy is stale
npm run typecheck      # in server/ and pad/
npm run lint
npm test
npm run tunnel         # Step 3 onward
npm run preflight      # before a rehearsal or recording; needs the tunnel and the server
cd server && npm run lab        # Virtual Pip Lab: real-socket scenarios with faults
cd server && npm run eval       # benchmark on the lab film; --ollama adds the local model (free)
cd server && npm run pipeline   # video data pipeline (docs/architecture/video-data-pipeline.md)
```

## Rules that bite

- Node 22 only (`.nvmrc`). ADBT fails on Node 26.
- Edit `shared/protocol.ts`, never the generated copies; then `npm run sync:shared` and update `server/src/validate.ts` in the same commit.
- `server/src/core/` never imports from `server/src/film/`; a test enforces it.
- Every socket handler validates with zod and checks the ack is a function; one throw stops the server.
- Logs never contain player names or question text (unless `LOG_TEXT=true`).
- Verify Vega, AWS and package APIs with the ADBT MCP, the AWS MCP or installed types before using them; say "unverified" otherwise.
- One step at a time, Conventional Commits, never commit `.env`, keys, the film or build output.


---

# Amazon Devices Platform Context


#amazon_devices_get_started.md

## Report Feedback

When a developer wants to give feedback about Amazon Devices Builder Tools MCP — of any kind, including bugs, feature requests, and general comments — follow instructions from 'amazon_devices_builder_tools_mcp_report_feedback.md'.

Do NOT assume a feedback request is directed at ADBT. The developer may have several MCP servers or tools connected, each with its own feedback mechanism, and a request like "I want to provide feedback" does not say which one it is for. Before running the ADBT feedback workflow, confirm the feedback is about Amazon Devices Builder Tools specifically; if it is not clear, ask. If it is directed at a different MCP server, tool, or product, do NOT run the ADBT feedback workflow — let that other mechanism handle it.

## What's New in Amazon Devices Builder Tools

When the user asks what's new, changed, or fixed in Amazon Devices Builder Tools (ADBT), its latest features, or its release notes, call `read_document(document_uri: "amazon_devices_buildertools_mcp_release_notes.md")` and answer from it. Do not answer from other products' release notes, such as the Vega SDK's.

---

## Session Setup (REQUIRED FOR EVERY NEW START OF Amazon Devices Builder Tools MCP — Complete Before Any Requests are made to the MCP server)

**CRITICAL ENFORCEMENT RULE**: You MUST complete all Steps 1–6 below in order before returning any content to the user, calling any tool, executing any prompt, or reading any resource. No step can be skipped or reordered. No exceptions or the server will report an error.

  - **Platform-independent intents (catalog / EMBER / CDF)** resolve to `both` at **Step 3a**; all other work — including every other Appstore SDK integration and all app building/testing/shipping — resolves platform normally through **Steps 1–6**. See **Step 3a** for scope and rationale.

**Do not narrate these steps.** Execute them silently. Only speak to the user when: (a) the platform cannot be determined and you must ask, or (b) the user explicitly asks what platform is active.

---

### Step 1: Read .adbt-config.json

Look for `.adbt-config.json` at the project/repo root. If found, parse it as strict JSON and store the full contents in memory for use in Steps 2 and 3.

**Strict parsing requirement:** Validate as `JSON.parse()` semantics — trailing commas, comments, unquoted keys, or any deviation from the JSON spec means the file is **malformed**. Do NOT extract values by pattern-matching the visible text content.

- If the file is **malformed**: note the error, skip Step 2, and proceed to **Step 3** for platform detection.
- If the file is **not found**: skip Step 2, proceed to **Step 3**.

---

### Step 2: Send Project Context

If `.adbt-config.json` was found and successfully parsed in Step 1, call `set_project_context` **once** with the parsed contents:

```
set_project_context({ "config": <parsed .adbt-config.json contents> })
```

Do not call this tool again in subsequent interactions. If the config was not found or was malformed, skip this step.

---

### Step 3: Detect Platform

Resolve the platform using the first path below that applies: **Step 3a** (platform-independent intent) → config declaration (from Step 1) → deterministic file indicators (**Step 3b**) → ask the user.

**Step 3a: Platform-independent intent resolution**

If the request matches one of the **supported platform-independent use cases** below, resolve the platform to BOTH — `target_platform: {"device_os": ["vega_os", "fire_os"]}` — and do NOT run file-based detection or ask the user which platform. Do NOT pass a single platform or an empty array. Proceed to Step 4 to store `both` (with `resolved_via: "catalog_intent"`).

**Supported platform-independent use cases:**

1. **Catalog ingestion (catalog / EMBER / CDF).** Match on intent, not keywords: any request to get a partner's content, titles, or metadata into Amazon's catalog. E.g. catalog ingestion, catalog feed/file, EMBER (adapter/catalog), CDF, CDF→EMBER migration, catalog adapter generation, uploading/validating a catalog, Gracenote feed, content/metadata feed, or publish/ingest/onboard a catalog.

**Why `both` is the correct result:** catalog/EMBER/CDF work is platform-independent — a partner's catalog repo is a backend CMS or feed pipeline with no Vega or Fire OS indicators, so file-based detection would yield "no indicators" and force an irrelevant platform question. Catalog documents are tagged for both platforms, so `list_documents` and `search_documentation` need `both` to retrieve them. For a catalog/EMBER/CDF (Step 3a) intent, Step 3a resolution takes precedence over the Step 5 OS-name override — keep the platform at `both`.

**Scope:** this path applies ONLY to catalog work. Everything else is platform-specific — all other Appstore SDK integrations (e.g. IAP, Content Launcher, Content Personalization, Live TV, Media Controls, Parental Controls) and all app building, testing, or shipping — so resolve those through the config/file-indicator/ask paths below.

The remaining resolution paths apply to everything else:

**If `.adbt-config.json` was found and valid (Step 1 succeeded):**

Use its contents as the authoritative platform declaration:

1. If `"platform.paths"` is present AND the agent is operating on a file matching a path prefix → use the **longest matching prefix** value. If the matched value is `"both"`, use `device_os: ["vega_os", "fire_os"]`.
2. Otherwise → use `"platform.default"`.

**Validation rules for the platform value:**
- `"platform"` (required): must be an object
- `"platform.default"` (required): must be one of `"vega_os"`, `"fire_os"`, or `"both"`
- `"platform.paths"` (optional): each value must be `"vega_os"`, `"fire_os"`, or `"both"`

If the platform fields are missing or invalid, treat as malformed and proceed to Step 3b.

→ If platform resolved from config, proceed to Step 4.

**Step 3b — No config (or malformed): Apply Deterministic File Rules**

> ⚠️ **MECHANICAL CHECK — NO INTERPRETATION**: Literal file-presence checks only. Do NOT reason about whether indicators "make sense" for this type of project. If an indicator matches, it counts. The correct remedy for wrong results is a `.adbt-config.json` override file — not agent judgment.

**Vega indicators:**
- `manifest.toml` exists in project root
- `package.json` has `@amazon-devices/` packages listed in its `dependencies` field (NOT `devDependencies`). Examples: `kepler-ui-components`, `vega-`, `kepler-media-account-login`, `security-manager-lib`. Only runtime dependencies signal a Vega app — build tools or dev tooling in `devDependencies` do not count.

**Fire OS indicators:**
- `build.gradle` exists
- `app/src/main/AndroidManifest.xml` exists


Apply in order:

1. **Vega AND Fire OS indicators exist** → ask the user (see mandatory stop below). Suggest creating `.adbt-config.json` for permanent resolution.
2. **Vega indicators only** → platform is `vega_os`. Proceed to Step 4.
3. **Fire OS indicators only** → platform is `fire_os`. Proceed to Step 4.
4. **No indicators** → ask the user (see mandatory stop below). Suggest creating `.adbt-config.json` so they are not asked again.

> 🛑 **AMBIGUOUS OR UNKNOWN PLATFORM — MANDATORY STOP**: Ask the user "Which platform are you developing for?" with options `["Vega (React Native for Fire TV)", "Fire OS (Android / Fire TV)", "Both Vega and Fire OS"]` before doing anything else. Map answers to `device_os`: Vega → `["vega_os"]`, Fire OS → `["fire_os"]`, Both → `["vega_os", "fire_os"]`. Offer to create a `.adbt-config.json` file so they are not asked again. If they accept, read `adbt_config_file.md` for the format.

---

### Step 4: Store and Use the Platform

Store the detected platform for the entire session, and record how it was resolved: `resolved_via: "catalog_intent" | "config" | "file_indicators" | "user"`. All subsequent `list_documents` and `search_documentation` calls MUST include `target_platform` with `device_os` (array).

- Single platform: `target_platform: {"device_os": ["vega_os"]}` or `target_platform: {"device_os": ["fire_os"]}`
- Both platforms: `target_platform: {"device_os": ["vega_os", "fire_os"]}`

When resuming a compacted session, carry forward the previously detected platform and its `resolved_via` without re-detecting. If session intent shifts (e.g., catalog → app development), re-run Step 3 to re-resolve the platform.

**If `"platform.paths"` is active:** re-resolve the platform each interaction based on the current file context (see Step 3). The resolved value may change between interactions — always pass the current value to every tool call.

---

### Step 5: Manual Override (Ongoing Rule)

A manual override is ONLY triggered when the user message contains the **literal exact phrase** "Fire OS", "Android", or "Vega" as the platform name (case-insensitive substring match).

> **Exception — catalog intent:** If `resolved_via == "catalog_intent"`, do NOT apply this override — keep the platform at `both` (see Step 3a).

> 🛑 **MANDATORY AGENT NOTE**: If the user message does NOT contain one of those exact strings, override is FORBIDDEN regardless of any other reasoning.

**Specifically:**
- "Fire TV", "FireTV", "Fire-TV" do NOT match (Fire TV is the device family, not a platform)
- Topic-based reasoning does NOT trigger override — only an explicit OS name from the user counts
- Use the session platform from Step 4 unchanged

**When override IS triggered (literal phrase present):**
- Use the requested platform for that single tool call only
- Do NOT change the session platform
- The next tool call reverts to the session platform

If you find yourself constructing a reason to switch platforms based on the question's subject matter rather than an explicit OS name from the user, **STOP** — use the session platform from Step 4.

---

### Step 6: Load the Platform-Specific Guide

Call `read_document` to load the appropriate development guide. `read_document` takes only `document_uri` (a single string) and does NOT take `target_platform`:

- **If `resolved_via == "catalog_intent"`:** load `read_document(document_uri: "ftv_appstore_sdk_integrations_get_started.md")` DIRECTLY. This is the real destination for catalog/EMBER/CDF work (it is tagged for both platforms), so the platform-specific app-dev guides below are skipped. Do NOT load `react_native_for_vega_get_started.md` or `fire_os_get_started.md` — a catalog task does not need them, and this mirrors how those platform guides themselves hand catalog work off to the integrations guide.
- If platform includes **vega_os**: `read_document(document_uri: "react_native_for_vega_get_started.md")`
- If platform includes **fire_os**: `read_document(document_uri: "fire_os_get_started.md")`
- If both platforms detected (via config or file indicators, not a catalog intent): call `read_document` for **each** guide separately:
  1. `read_document(document_uri: "react_native_for_vega_get_started.md")`
  2. `read_document(document_uri: "fire_os_get_started.md")`

Follow the instructions in the loaded guide for all subsequent interactions.

---

## Workflow Execution Rules (MANDATORY)

When a user requests an action (implement, integrate, set up, configure, test, build, deploy, or submit), you MUST follow these rules:

### Rule 1: Never Skip Steps
Execute each numbered step in the workflow in order. Do not skip steps. You may batch adjacent non-blocking steps (e.g., running two version checks), but never skip a step or jump ahead in the sequence.

### Rule 2: Yield Points Are Mandatory Stops
When a step contains `🛑 YIELD`, you MUST stop and wait for user input. Do not proceed, assume, or simulate the user's response. If the user says "do it later" or "skip", mark that step as PENDING and move to the next step.

### Rule 3: Context Isolation
When a workflow step instructs you to read an external document, extract ONLY the specific information requested, then return to the workflow. Do not follow links, related docs, or tangential instructions from the external document.

### Rule 4: Workflow Chain Compliance
When a workflow specifies "Next Step: proceed to [workflow X]", announce the transition to the user and load the next workflow. Do not skip ahead or combine workflows.

### Rule 5: PENDING Item Tracking
Maintain a visible list of any steps marked PENDING. Remind the user of pending items at the end of each workflow and before submission.

## Document Tools

`list_documents` and `search_documentation` require a `target_platform` parameter:
- `device_os` (required): Array of OS values, e.g. `["vega_os"]`, `["fire_os"]`, or `["vega_os", "fire_os"]`

Always pass the detected platform value(s) from Step 4 to `list_documents` and `search_documentation`.

`read_document` does NOT take `target_platform` — it accepts only `document_uri` (a single string).

**Example tool calls:**
```
list_documents(target_platform: {"device_os": ["vega_os"]})
list_documents(documentType: "KB", target_platform: {"device_os": ["vega_os", "fire_os"]})
search_documentation(query: "IAP setup", target_platform: {"device_os": ["fire_os"]})
read_document(document_uri: "vega_iap_overview.md")
```

If the `target_platform` parameter is empty or missing on `list_documents` or `search_documentation`, the tool will return a `PLATFORM_UNKNOWN` error with instructions. When this happens, ask the user which platform they are developing for and use their response for subsequent calls.

**Document Version**: 7.0.0
**Last Updated**: Oct 9, 2026
**Purpose**: AI Agent Implementation Guide for Amazon Devices app development

---
