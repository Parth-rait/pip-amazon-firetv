# Merging the cloud's vNext work onto the Mac branch

Date: 17 Oct 2026. Branch `merge/cloud-vnext`, from `mac/film-and-tv` (`b187bd7`). Rollback: `mac/film-and-tv` is unchanged; tag `pre-vnext` as before.

## What happened

On 16 Oct a cloud session (claude.ai `session_01Mnm3oQ…`) worked through PROJECT_enh.md. It started from `main` at `8e7b472` (Step 6 code) instead of `mac/film-and-tv`, so it never saw Steps 7 to 12, the TV app or the vNext phases 1 and 2. Its branch `claude/pip-vnext-core` was merged into `main` as PR 3. Both lines then held their own version of the same ideas: protocol v3 with `commandId` and an input envelope in the cloud, protocol v5 with `tv:applied` and `PipInput` on the Mac. A trial merge conflicted in 33 files.

Decision (Parth, 17 Oct): keep the Mac branch as the base and bring the cloud's work on top.

## Commits

| Commit | What |
|---|---|
| `9b4a043` merge | Mac versions in all 33 conflicts and in the auto-merged PROJECT.md, config, pad store and vite config; the cloud's pure modules (evidence timeline, spoiler boundary, retrieval, answer check, answer cache, text router, judge interface, timeline loader, pipeline, lab film, dataset, golden probes) and its docs kept; the pad's quicker rejoin after a server restart kept |
| `f86d4ba` grounded Ask Pip | `answer.ts` on the Mac flow: films with a timeline answer through the boundary, retrieval, the model only when needed and the answer gate, with an evidence-keyed cache and a re-check after a rewind during thinking; films without one keep the notes path and now get the no-spoiler line for questions about the future |
| `c9994f3` benchmark | `npm run eval`, plus `--ollama` for a free local-model run |
| `88a441c` typed commands | commands typed into Ask Pip run through `actions.ts` without a model (server) or are sent as inputs directly (pad, up to 4 words); optional TypeSafe judge that may only offer choices |
| `01475f0` Virtual Pip Lab | `createPipServer` and 20 real-socket scenarios rewritten for protocol v5 |
| (this commit) docs | architecture, decisions 0004 and 0005 amended, evaluation, this report, CLAUDE.md |

Dropped, because the Mac versions cover them: the cloud's command tracker (playback-report confirmation), its input envelope adapters and its in-memory journal. Not merged: the cloud's browser TV simulator, Ask and lab panels and browser end-to-end script; the Vega app is the TV.

## Evidence

Repository root, Node 22, macOS:

| Check | Result |
|---|---|
| `npm run check:shared` | pass |
| `npm run typecheck` | pass in server, pad and tv |
| `npm run lint` | pass: 0 errors; 4 warnings, all Vega "system distributed library" notices |
| `npm test` | server 296 tests (41 files), pad 29, tv 10 |
| `npm run lab` (in `server/`) | 20 of 20, five runs in a row |
| `npm run eval -- --ollama` | 0 spoiler leaks in 68 probe runs for every strategy; the fake-model rows match the cloud's run exactly; qwen2.5:3b answers 30/30 when it should, cites the expected fact 25/25, abstains 65 to 68 of 83 (not fully deterministic), p95 about 2 s |
| Live server, `LAB_CONTENT=true`, AI off, real sockets | "What just happened?" at 50 s: answered from 2 facts in 37 ms, no model; "What happens at the end?": the no-spoiler line; typed "pause": the TV paused, the reply went to the asker's pad only; logs held no question text |
| Live server, default films | starts, `/health` ok, `/api/films` lists Big Buck Bunny and Sintel |

## Not verified, and open

- The merged server against the TV app on the Vega Virtual Device. The TV-facing protocol did not change (only `Source` gained `'timeline'`, which neither client reads), but run `run-pip` once before relying on it.
- Big Buck Bunny and Sintel have no timeline yet. Run the pipeline on the Mac (`npm run pipeline`, docs/architecture/video-data-pipeline.md) and review the facts; until then they use the notes path, which has no answer gate.
- Two annotators exist: `npm run annotate` (Mac, local vision model through Ollama, candidates with provenance) and the pipeline's `annotate` stage (manual or Nova). They should become one stage of the pipeline.
- PROJECT_enh.md asks for TypeSafe and Impeccable installs. The cloud session read and used both (docs/engineering/open-source-adoption.md); nothing is installed here. TypeSafe needs a paid key.
- Nova (`npm run eval -- --nova`, `smoke:ai`) waits for AWS.
