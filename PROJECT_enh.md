PIP — MASTER BUILD PROMPT FOR CLAUDE CLOUD
Use: Paste this entire prompt into the Claude Code / Claude Cloud coding session opened at the Pip repository root. It is intended to be the session's current, controlling brief. Do not paste it into a blank workspace: first open the actual repository that contains the existing work.
0. Mission and operating contract
You are the lead product engineer, systems architect, applied-AI engineer, video-data engineer, UX designer, test engineer, and careful open-source integrator for Pip. Your job is to audit the actual repository, preserve its useful work, and bring it toward the current vNext system architecture described below. This is a real implementation task, not a speculative rewrite or a design-only exercise.
Do the work in the repository. Read, inspect, run, test, edit, and verify. Do not answer with only a proposal. Start by building a factual picture of what exists, then make a small, safe, testable sequence of improvements. Keep going through implementation while environment access and evidence permit. Ask me only when a decision genuinely requires my credentials, expenditure, destructive action, deployment approval, physical hardware access, or a product choice that cannot safely be inferred.
Non-negotiable rules
1. Repository reality beats stale status text. Older project documents are valuable context, but their statuses (including claims such as “no code yet”), architecture diagrams, step numbers, or deadlines may be stale. Determine what actually exists by inspecting Git, source, package manifests, tests, run scripts, and behaviour. Never claim that a feature works because a document says it does.
2. The latest Pip vNext direction in this prompt supersedes the original quiz-led product direction wherever they conflict. Preserve useful working foundations and the first Fire TV/Pip Pad product slice. Keep old plans/history instead of silently deleting it, but update the current source of truth so future agents cannot mistake the original plan for the latest one.
3. No big-bang rewrite. Start with a read-only audit and a safe Git checkpoint. Keep working flows, interfaces, and deployment constraints where they still serve the goal. Refactor incrementally behind typed interfaces. Before removing a feature or protocol, establish whether it is used and provide a migration or document why it should be retired.
4. Verify before claiming. Verify SDKs, model IDs, service limits, CLI flags, platform APIs, licences, and file paths against current official documentation, installed package types, and/or upstream source. Label what cannot be verified. Do not invent tools, credentials, APIs, performance measurements, or successful commands.
5. Use skills/tools selectively. Install and use the TypeSafe skill and Impeccable design workflow as directed below. Evaluate DeepSeek Harness, NVIDIA OpenShell, t8y2/dbx, and other relevant OSS references for specific jobs. Do not install every agent shell, framework, MCP server, model, or package just because it exists. Separate build-time tools from Pip's runtime architecture.
6. No dangerous Git or environment operations. Do not run git reset --hard, force-push, clean untracked files, overwrite user changes, delete data, rotate secrets, change production settings, incur paid cloud spend, or deploy externally without explicit approval. Begin with git status, preserve uncommitted work, and use a branch/worktree if available.
7. No fake completion. A successful install is not the same as a working feature. Report actual commands and actual outputs, distinguish unit tests from device/simulator tests, and call out unavailable devices, missing credentials, and untested paths.
8. Keep the architecture ambitious but the first release small. Build a reusable context-and-action core with clean module boundaries inside the existing deployable shape. Do not create microservices, a general agent framework, a giant memory database, or an elaborate 3D simulator unless a demonstrated requirement justifies it.
1. First: install and use the TypeSafe skill
Use one installation method only. Inspect which coding environment this session actually is and follow its supported path.
If this is Claude Code and its plugin CLI is available
Run these two commands once:
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
Then verify the plugin/skill is visible and invoke /typesafe:typesafe-ai or the environment's equivalent before making a TypeSafe integration decision.
If this is another supported agent environment with a terminal
Run:
npx skills add typesafe-ai/skills --skill typesafe-ai
Choose the current agent in the installer. Do not also run the Claude plugin install method.
If the cloud environment does not expose either installation path
Do not pretend the skill was installed. Read the skill directly:
- https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md
- https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md
Use its guidance for this session and record that persistent installation was blocked by the environment. Read current TypeSafe official docs and the closest cookbook before writing integration code. The skill explicitly requires current docs, not reliance on memory.
How TypeSafe should fit Pip
Treat TypeSafe/Jev as a candidate for small, typed semantic judgements such as intent routing, ranking, extraction, matching, confidence-aware classification, and deciding whether clarification is needed. Keep known logic, exact lookups, timestamp filtering, validation, state transitions, and physical/device actions in ordinary code. Do not use a semantic model for play/pause/seek, fixed navigation, schema validation, authorization, or as an unmeasured replacement for Pip's main language/video model. Build an adapter and a deterministic/mock path if the service/API credentials are unavailable. Use typed outputs, confidence/uncertainty thresholds, and tests. Integrate only where a benchmark demonstrates value.
2. Product thesis: what Pip actually is
Pip is a context-and-action system for everyday environments. It understands enough of the current moment to help without forcing people to re-explain everything, retrieves what has already been established, reasons only when needed, performs permitted actions through devices/services, verifies the result, and improves offline from reviewed evidence. Conversation is one interface; it is not the whole product.
Fire TV + the web-based Pip Pad is the first environment in which to prove this thesis. Future Pip products may use screens, capacitive buttons, a touchwheel, remote controls, voice, accessibility inputs, and other permitted signals. They should share the same semantic event contract and core decision/action loop.
Product principles
- The user's activity stays primary. During ordinary film playback, Pip is quiet and hidden on the TV. Invoke it from the Pip Pad or an explicit control; appear briefly only when requested or when a user-enabled rule makes it useful.
- No unsolicited quizzes, character cards, floating reactions, prediction prompts, chapter walls, or constant mascot animation in the default viewing experience. Keep family learning/gameplay as an explicit opt-in mode or separately scoped skill if it can be done without damaging the default path.
- Keep the best existing work if it proves useful: Fire TV/Vega playback, pairing and reconnection, TV/Pip Pad messaging, deterministic session state, model adapters, existing fake TV/simulator paths, and tests. Verify each one before relying on it.
- One recognisable Pip is enough. Personality comes from timing, relevance, reliability, and concise language—not a growing collection of costumes, expressions, or decorative states.
- No accounts or long-term identity assumptions by default for the hackathon slice. Do not silently add persistent user tracking. If persistence/personalisation is introduced, define consent, provenance, edit/delete/retention behaviour, and a local/offline mode.
- Never treat one click, pause, skip, viewing choice, or repeated behaviour as proof of mood or a sensitive trait. Mood for recommendations should be explicitly user-selected or based on non-sensitive context volunteered for the current task. Do not infer pregnancy, menstruation, ovulation, sexual preferences, medical conditions, or similarly sensitive attributes from media behaviour.
- An action is only successful when its outcome has been confirmed or observed; sending an action command is not proof that the device performed it.
3. Authoritative source order and documentation repair
At the start, inspect all project docs, especially PROJECT.md, any older “System Design” document, the old workout plan, README*, package READMEs, architecture docs, and the actual shared protocol/types. Then establish this source hierarchy:
1. The current product and architecture rules in this prompt.
2. Actual code and verified behaviour for what currently exists (factual state, not product priority).
3. A newly updated root project plan that reflects the current architecture and records what is implemented, partial, planned, deferred, and blocked.
4. Shared protocol/types and package-level contracts.
5. Older design documents and plans, retained as history/reference where useful.
Do not erase useful historical requirements. Clearly mark superseded claims and explain what changed. In particular, the older quiz-first flow, extensive avatar/character decoration, and “no code yet” status must not silently override this current direction or the actual repository.
Create or update the minimum useful documentation set (reuse existing paths where sensible):
- PROJECT.md (current source of truth and current status; reconcile rather than blindly replace).
- docs/architecture/current-state.md — verified repository inventory, architecture, existing flows, known bugs, what was tested.
- docs/architecture/target-architecture.md — target system, module boundaries, runtime vs offline flows, Mermaid diagrams.
- docs/architecture/video-data-pipeline.md — ingestion, timestamped evidence, annotations, datasets, evaluation and model training gates.
- docs/engineering/open-source-adoption.md — tool/repository decision matrix, license/provenance, version/SHA pinned if code is reused, security/maintenance findings.
- docs/evaluation/README.md or equivalent — golden set, metrics, benchmark protocol, results, limitations.
- PRODUCT.md and DESIGN.md through Impeccable if the tool is available; otherwise draft these manually using the exact product direction below.
- docs/decisions/ with short ADRs for major architecture decisions where the repo does not already have a decision-log convention.
Avoid duplicate documentation that disagrees. Update the README to explain the actual product, how to run it, known constraints, and the current roadmap.
4. Mandatory initial audit — do not skip
Before substantial edits:
1. Print pwd, git status --short --branch, git log -5 --oneline, current branch, remotes (do not expose embedded credentials), and a repository tree excluding generated/dependency directories.
2. Identify any local uncommitted edits and preserve them. Do not overwrite user work. If safe and permitted, create a named feature branch or use a worktree; otherwise make no branch change and record the starting commit.
3. Locate every package/app/service, language/runtime version, lockfile, env example, build/lint/type-check/test scripts, CI workflow, and platform SDK. Inspect package.json/equivalent, current protocol/types, entrypoints, config, tests, and model adapters.
4. Run the existing cheap checks before editing: type-check, lint, unit tests, build, and relevant smoke tests. Run them in the correct package/workspace. Record baseline failures separately from any new failures. Do not call a command “passed” unless it actually exited successfully.
5. Find and trace the real runtime paths: device/input event → server → state mutation → model/retrieval/decision → action/event → TV/Pad. Trace video note generation and Ask Pip prompts. Identify what is deterministic, what is model-driven, what persists, and what currently lacks tests.
6. Review exact timestamp handling, rewind/replay correctness, spoiler filtering, answer-memory keys/invalidations, server/model timeout and cancellation, websocket reconnects, action permissions, secret/log hygiene, dependency health, and error recovery.
7. Produce a concise gap matrix: Requirement | Existing implementation/evidence | Gap/risk | Next change | Test that proves it.
8. Only after this baseline is written should you begin editing the architecture or UI.
5. Target system architecture
Use this as the destination. Keep components modular, but do not split them into separate processes unless there is a measurable reason.
INPUT ADAPTERS
  Pip Pad / tablet / phone | Fire TV remote | simulated hardware
  capacitive button / touchwheel (prototype) | explicit text/voice
                 |
                 v
VALIDATED SEMANTIC EVENT CONTRACT
  schema version + event ID + source + timestamp + payload + provenance
                 |
                 v
EVENT JOURNAL + LIVE SESSION STATE
  idempotent reducer/handlers | replayable test events | state snapshots
       |             |              |                |
       v             v              v                v
CONTENT TIMELINE   USER PREFS    DEVICE/TASK STATE   FEEDBACK/OUTCOMES
 scenes/entities   explicit +    current playback,   impressions, chosen
 evidence/time     tentative      permitted actions   action result/correction
       \             |              |                /
        \            v              v               /
                  DECISION ROUTER
         deterministic actions first; then retrieval;
         ranker for recommendations; model reasoning last
                 |
       +---------+-----------+------------------+
       v                     v                  v
DETERMINISTIC ACTION     TIME-BOUNDED RETRIEVAL   MODEL GATEWAY
+ authorization          + evidence filter        provider adapters
+ schema validation      + keyword/metadata       + timeouts/retries
+ idempotency keys       + optional vector        + cancellation
+ execution              + citation/timestamps     + cost/latency logs
       +---------------------+--------------------+
                             v
              RESPONSE / ACTION VALIDATOR
     spoiler gate | response schema | confidence | safety
                             |
                             v
                    TV / PAD / ALLOWED SERVICE
                             |
                             v
              OUTCOME VALIDATION + EVENT LOGGING
                             |
                             v
                    OFFLINE DATA FACTORY
 licensed source -> decode -> scene/audio/timestamp alignment -> candidate
 labels/evidence -> human review -> versioned dataset -> fixed benchmark
 -> compare baselines -> optional fine-tune only if justified
Required logical modules
Use the existing code's naming conventions where possible. The target responsibilities are:
- input-adapters: maps remote, web, touch, simulated, voice inputs to shared semantic events. No model provider knowledge here.
- event-contract: versioned schemas validated at boundaries; event IDs, source, timestamp, payload, and provenance. Version protocol changes rather than breaking clients silently.
- event-journal and session-state: append-only event facts plus a current state derived from events. Handlers need idempotency and safe replay where appropriate. Keep a light pilot architecture.
- content-timeline: scene ranges, entities, actions, facts, subtitles/transcripts, evidence frame refs and source timestamps, confidence and review status.
- memory: separate event records, content/world memory, explicit and tentative user preference memory, and dataset/annotation records. Avoid an undifferentiated giant brain.md as the canonical store.
- retrieval: find relevant facts with time bounds and source references before using a model. Keyword/metadata retrieval first; add embeddings/vector retrieval only if tests demonstrate the need.
- decision-router: chooses a deterministic function, retrieval, ranking, a typed TypeSafe judgement, or generative reasoning. Rules and typed confidence thresholds belong in code. Fail closed on ambiguous or unsupported physical actions.
- model-gateway: common interface plus provider adapters (existing Bedrock/Nova adapter and local Ollama adapter if they are already working). Optional future VLM/ASR adapters. No credentials in front-end bundles or model prompts.
- action-executor: allowlisted actions only, role/permission checks, idempotency, input bounds, expiry, result collection, and explicit success/failure status. Play/pause/seek and known local controls should never need an LLM.
- outcome-feedback: record whether a command succeeded, explicit correction, explicit preference, recommendation impression/selection/feedback. A command issued is not the same as action success.
- video-data-pipeline: offline reproducible processing of licensed content into timeline data and reviewed evidence.
- evaluation: fixed test fixtures and benchmark runner for task accuracy, spoiler leakage, retrieval, latency, failures, costs if measurable, and regression checks.
- virtual-pip-lab: deterministic TV/Pad/device simulation with fault injection, allowing flows to be tested before real hardware is present.
Persistence rule
A single process is acceptable. SQLite is a pilot candidate for queryable event/session/memory records if it fits the current stack; JSONL provides transparent, versionable export. Do not add a new database just for architectural theatre. Keep source assets, credentials, cache, personal history, generated datasets, and benchmark results appropriately separated and .gitignored where necessary. brain_snapshot.json may be a derived, inspectable snapshot, not the sole canonical source of truth.
6. Deterministic actions and grounding
- Play/pause/seek/navigation/invoke/dismiss and other known actions must go through typed deterministic handlers. No model call for them.
- Model output must never directly execute arbitrary shell commands, arbitrary URLs, arbitrary SQL, or unrestricted device commands. Convert the result to a typed proposal, validate it against an allowlist and current state, and require a user confirmation for destructive, external, financial, privacy-impacting, or irreversible actions.
- Validate permissions/state at execution time, not just generation time. Make repeat taps safe and handlers idempotent where appropriate. Record command ID and execution outcome.
- For “Who is that?” / “What just happened?” start with retrieval against the timestamped content timeline. Use generative reasoning only when it adds measurable value or when the query is ambiguous.
- Spoiler boundary is a hard system rule. Before model invocation, filter evidence to content revealed by current playback position (including rewind/replay correctness). Any fact after the safe boundary must be absent from the provided evidence. Output validation must reject or withhold claims unsupported by permitted evidence, and the benchmark must contain adversarial spoiler questions. Do not rely on a prompt instruction alone: pretrained model knowledge may include the full story. If evidence is insufficient, abstain or ask a clarifying question.
- All factual answers should carry internal evidence/source IDs and source time bounds for validation, even if UI shows only a concise answer.
- Keep answer memory only if exact cache invalidation is safe: include content/version, normalized question, playback time boundary or permitted evidence set, and schema/prompt/model version as needed. A cached answer must never reveal a later scene after rewind. Clear or isolate records on content change and invalidate after timeline corrections.
7. Video understanding, virtual modelling, and training pipeline
The runtime should not process an entire movie from scratch for each question. Precompute what can be established in advance; retrieve facts relevant to the current timestamp; reason only when needed.
Offline pipeline
Implement an explicit, reproducible command-line pipeline. Keep stages independent and cacheable:
1. Ingest and rights: require an asset ID, source URL/path, licence/rights note, duration, checksum, codec and frame rate. Do not add copyrighted or private media without authorization. Recheck the actual licence for each film and source file.
2. Decode and probe: use FFmpeg/ffprobe if available and licence/OS-compatible. Store original timestamp offsets, dimensions, audio streams and deterministic metadata.
3. Scene segmentation: use PySceneDetect or a justified existing equivalent to propose boundaries. Compare with a simple fixed-interval sampler (the existing six-second approach can be a baseline, not the final assumption). Allow boundaries and sampling density to be adjusted by scene changes or candidate events.
4. Visual frame sampling: preserve exact source timestamps and frame references. Resize/encode only within documented model limits. Never silently replace an original timestamp with a sampled-frame index.
5. Audio/subtitle path: ingest provided subtitles where legally available; otherwise run a separable ASR adapter such as Whisper only if runtime/resources permit. Preserve start/end timestamps and language. Video and audio timestamps must be aligned and testable.
6. Candidate annotation: use a configurable VLM (benchmark Amazon Nova 2 Lite where supported and Qwen2.5-VL or another locally feasible vision-language model as candidates). Generate scene summaries, visible entities, actions, relations, dialogue/event candidates and uncertainty, each linked to evidence frames/timestamps. Treat these as untrusted candidate labels—not truth.
7. Temporal/entity resolution: merge overlapping scenes, reconcile repeated entities, resolve identity only when evidence supports it, handle conflicting descriptions, and retain uncertainty. Never force a confident identity for an unknown character.
8. Review: create a human-review format/UI or a clearly documented review file workflow. Each fact must include source evidence, timestamp range, candidate generator/version, reviewer/review status and correction history. The current short-film notes may be reused but must be audited against the media once.
9. Canonical timeline export: structured, schema-validated JSON/JSONL containing film ID/version, duration, scene intervals, facts/entities/events, transcript lines, evidence refs, confidence, provenance, review state and schema version. Fail validation on out-of-range timestamps or malformed references.
10. Indexes/cache: build retrieval indices from reviewed facts only for the safe default path. Keep raw VLM outputs separated from accepted facts. Provide an explicit rebuild command.
11. Dataset factory: create task examples such as identity-at-time, event-understanding, temporal ordering, grounded answer, abstention/unknown fact, spoiler-safe answer, intent routing and action selection. Include provenance, allowed evidence, expected output and label/review status.
12. Split and benchmark: split by film/content and, where applicable, users/sessions to avoid leakage. Maintain fixed versioned train/validation/test datasets and a human-reviewed golden benchmark. Never evaluate only on examples used for prompt tuning or training.
13. Model comparison: compare simple retrieval/rules first; current LLM; local model if used; VLM alternatives; optional TypeSafe judgement for routing/ranking. Record quality, calibration/abstention, critical spoiler failures, p50/p95 latency and actual cost/resource use when available.
14. Training gate: do not fine-tune just because it is possible. Only consider LoRA/QLoRA or other fine-tuning after a stable benchmark shows a repeated capability gap that retrieval, better timeline data, prompt/schema fixes, or routing cannot solve. Verify GPU/hardware requirements and compute cost. Do not import a research training stack into the demo without a runnable reason. Preserve the baseline model and rollback path.
15. Reproducibility: scripts must have deterministic inputs/configuration where possible, versioned dependencies, structured logs, checkpoints/cache and a README showing commands. A failed model/API call must not corrupt existing reviewed data.
Models and services to evaluate, not blindly adopt
- Amazon Nova 2 Lite / Bedrock: likely existing live-answer/drafting integration. Verify current model ID, inference profile, region, supported inputs, video limits, cost and SDK calls with current Amazon docs and actual credentials.
- Qwen2.5-VL: candidate for frame/clip description, time grounding and offline multimodal annotation. Verify actual model version, memory/GPU needs, licence and inference path. Do not assume local runtime capacity.
- DeepVideoR1 and LLaVA: research/benchmark references, not default product dependencies. Inspect their official READMEs, licence and real training/inference requirements before attempting use. Do not attempt multi-GPU training in a CPU or limited cloud session.
- Ollama/local models: useful as a provider adapter and offline fallback only if a model is actually available and passes quality/latency checks. Preserve a fake provider for deterministic tests.
- ASR: keep speech recognition separate from visual analysis and the runtime response model. Use browser speech input where already reliable or a documented, resource-appropriate ASR adapter; communicate external processing to users when applicable.
- TypeSafe/Jev: typed semantic decision primitives only for use cases shown to benefit; never the timeline database, general movie VLM, or device execution engine.
Initial scope: get one short, explicitly licensed film through ingestion → timestamped notes/evidence → reviewed timeline → spoiler-safe retrieval → evaluation. Add a second film only after the pipeline is demonstrably repeatable and the first film passes its tests.
8. Virtual Pip Lab / device modelling
Build a deterministic software simulation, not a 3D physics project. Reuse the existing fake TV or virtual device harness if sound. The lab should simulate:
- TV playback states, position, pause/play/seek/end, reconnect and restart;
- one host and multiple pads; joins/leaves, host handover, repeated commands and stale events;
- semantic inputs from touchscreen, remote, a simulated capacitive button and a simulated touchwheel;
- latency, request timeout, model failure, stale model output, missing timeline facts, out-of-order timestamps, duplicate events, socket disconnect, server restart and partial device failure;
- user-visible action confirmation and the difference between “command sent” and “command completed.”
Create adapters that share the same semantic event contract. A hardware adapter must be optional. For a future physical proof, use todbot/touchpads as an input reference: prove button/touchwheel readings, debounce, calibrate, map to semantic events via USB serial or another verified bridge, and recover cleanly after disconnect. Do not describe that repo as a finished wireless Pip Pad. Keep simulation tests independent of board availability.
9. Open-source and agent-tool review — what each is for
Inspect upstream documentation, license, activity, security notices, dependency requirements, and current compatibility before installation or code reuse. Pin exact versions/commits for anything vendored or behaviorally critical. Do not blindly copy entire repositories into Pip. Record decisions in docs/engineering/open-source-adoption.md with Use / Adapt / Reference only / Reject / Blocked, why, licence, risks, version/SHA if applicable, and test/rollback plan.
Required references
1. TypeSafe skills — https://github.com/typesafe-ai/skills
   - Install using exactly one method in Section 1, read its SKILL.md, and current docs/cookbooks. Use it in architecture decisions and only implement a fitting typed judgement with tests.
2. Impeccable — https://github.com/pbakaus/impeccable ; https://impeccable.style
   - Inspect and install project-locally if the terminal/agent supports it:
   npx impeccable install --providers=claude --scope=project
   - Inspect the installer changes. In the agent, run /impeccable init; generate or reconcile PRODUCT.md and DESIGN.md. Use /impeccable document and /impeccable shape if applicable, then iterate with /impeccable critique, /impeccable audit, /impeccable harden, and /impeccable polish on the actual UI. Do not run every command just for activity. If the CLI flags or invocation are different in the installed version, check its help/official README and use verified syntax.
   - Apply the design method, not a generic template. Product is a calm, ambient, contextual, action-oriented home AI—not a conventional SaaS dashboard, generic chatbot, social feed, game HUD, or mascot showcase.
3. DeepSeek Harness — https://github.com/deepseek-ai/deepseek-harness ; https://www.deepseek.com/harness/en/
   - It is an agent harness with a plugin/composition architecture, currently described upstream as developer preview and potentially breaking. Review architecture, safety notice, license and compatibility. Borrow useful boundary ideas (pluggable providers/tools/skills/sessions, observability, explicit lifecycle) if justified. Do not migrate Pip to it or depend on it in production simply because it exists. If testing it, isolate it from the Pip app and secrets, pin a version, and document results.
4. NVIDIA OpenShell — https://github.com/NVIDIA/OpenShell ; https://docs.nvidia.com/openshell/latest/home ; https://docs.nvidia.com/openshell/latest/security/best-practices
   - Treat it as an optional build-agent security runtime, not a Pip runtime microservice. Check whether this cloud environment supports its gateway, compute driver, sandbox policy, and required Linux/Docker capabilities. If already installed and supported, prefer a least-privilege sandbox around untrusted agent/tool execution; inspect effective filesystem, process, network-egress and inference policies. Keep credentials outside agent-readable files and allow only necessary repository/docs/package endpoints. If the session cannot safely install/configure OpenShell, do not try to force it or run an opaque remote install blindly; apply the platform's available isolation, record the blocker, and continue safely. Do not broaden network permissions without reason.
5. t8y2/dbx — https://github.com/t8y2/dbx
   - This is a cross-platform database client with an AI/MCP server/CLI, not the core agent harness or Pip's memory architecture. Its only plausible near-term role is optional database inspection/tooling if Pip's actual persistence needs it and the MCP transport/security model is appropriate. Review LICENSE, SECURITY.md, and MCP/tool permissions before use. Do not install it solely because it has an AI assistant; do not expose real credentials or production databases. SQLite plus a small app-owned repository layer may be simpler for the pilot.
6. todbot/touchpads — https://github.com/todbot/touchpads
   - Reference for capacitive buttons and a touchwheel. Verify its current licence and required board/library for any copied code. Use as a hardware learning/reference source rather than assuming it is a full controller product. Implement the abstract input contract and simulator first.
7. awesome-smart-tv — https://github.com/vitalets/awesome-smart-tv
   - Discovery/index resource for TV platform APIs, examples and test tools. Use it for research only; verify every Vega/Fire TV API against current official Amazon docs and the installed SDK.
8. DeepVideoR1 — https://github.com/mlvlab/DeepVideoR1 ; LLaVA — https://github.com/haotian-liu/LLaVA ; Qwen2.5-VL — https://github.com/QwenLM/Qwen2.5-VL
   - Research references and candidate models only. Check licence, supported model versions, GPU requirements, training setup and maintenance before any integration. Do not vendor training code into the runtime app.
9. Xiaomi TV Stick recovery project — https://github.com/RodrigoDeveloperX/xiaomi-mi-tv-stick-4k-mdz-27-aa-recovery
   - Device-specific recovery tooling, not a general Vega/Fire TV platform. Mark reference-only or reject for Pip unless a concrete, safe device-specific need is established. Do not run flashing/recovery scripts on user hardware.
Open-source adoption policy
- Separate architecture lessons, build-time developer tools, optional adapters, and production dependencies in the decision matrix.
- Check licence compatibility before copying code/assets. Preserve notices/attribution and add a third-party notice for reused code. A repository being public does not mean its code or media is unrestricted.
- Inspect install scripts before execution; prefer official package managers and version-pinned installs where practical. No secrets in command output, git diff, prompt context, browser logs, or model requests.
- Avoid tool sprawl. A tool must solve a named problem, fit the environment, have a safe permission boundary, and have a way to test success and remove it if it fails.
10. UX and visual design: redesign with Impeccable, but keep Pip's identity
Create a deliberate product design language through PRODUCT.md and DESIGN.md, using Impeccable commands/skill where possible. Do not merely change gradients or round more corners. Inspect all current screens, flows, components, typography, spacing, motion, responsive behaviours and states before changing them.
Target UI principles
- Quiet by default. During the film: full-screen content, no persistent assistant dashboard, quiz panel, character gallery, floating social reactions, or extra chapter UI. Pip appears when invoked, answers briefly, and gets out of the way.
- Pad is control surface; TV is shared output. The pad owns asking, browsing options and personal controls. The TV shows the film and only compact, temporary feedback helpful to the whole room.
- Action over ornament. Prioritize invoke, ask, seek/play/pause, contextual explanation, recommendation choice and explicit feedback. Every element must justify its interruption cost.
- One canonical Pip character. Use motion only to communicate states. Respect reduced motion. Remove redundant avatar costumes and decorative variants from the default flow; retain personalization only when it gives real user value and is not a separate UI maintenance burden.
- Progressive disclosure. Defaults remain obvious to a child, grandparent and first-time user. Advanced choices appear only when relevant. Error states tell the user what happened and one next step.
- Accessibility and device fit. Keyboard/remote focus, safe-area margins, readable TV typography, touch targets appropriate to small screens, contrast, reduced motion, focus visibility, and no dependence on colour alone. Never block the remote/controller fallback.
- Consistent tokens. Derive one source of truth for colour/type/spacing/radii/motion where feasible, and translate into TV and web tokens. Do not mechanically impose a web design pattern on TV.
- No default AI-generated-design clichés. Do not add a giant hero header, empty metric cards, gradients, pill soup, nested cards, decorative icon tiles, or animation with no product purpose. Use Impeccable's current anti-pattern guidance and critique the actual result.
- Keep the current mint/dark visual direction only where it serves Pip's identity; you are allowed to improve tokens and interaction hierarchy after documenting the rationale. Do not redesign to a different brand without cause.
Required screens/states to audit
Join/pairing; lobby or media selection; playback idle; Pip invoked; asking/thinking; answer with evidence-aware text; clarification/unknown answer; playback controls; recommendations; loading/error/offline/reconnecting; settings/consent if needed; optional learning/quiz mode separate from default. Include responsive Pad, TV remote focus paths, empty/error/disconnected states. Do not add any screen simply because it is visually interesting.
Visual QA
Use a browser/TV simulator/real device where available. Capture before/after screenshots where tooling allows. Test at least a small phone viewport, tablet viewport, and TV-sized viewport. Run Impeccable /impeccable critique, /impeccable audit, /impeccable harden, and /impeccable polish after implementation if commands are supported. Fix issues that are real and within scope; report those blocked by unavailable devices.
11. Quality, testing, observability, security
Tests
- Unit tests for reducers, event schemas, event ordering/deduplication, input mapping, playback position estimation, timestamp bounds, retrieval filtering, action permissions/idempotency, provider timeout/fallback and recommendation ranking.
- Contract tests for TV/Pad/server protocol. Maintain backward-compatible versioned messages or provide a tested migration.
- Integration tests using a fake model and fake TV for join/rejoin/host handover, invoke/dismiss, playback controls, ask/answer, rewinds, film switches, model failure, server restart and device reconnect.
- Spoiler tests: ask about a character, action or ending from before it has appeared; ask right before and after a revelation; rewind after watching later scenes; verify cached answers do not leak. Run at least ten carefully authored adversarial probes per film and report the outcomes rather than claiming “spoiler-safe” by design alone.
- Unknown-fact probes: verify abstention rather than invented facts.
- A fixed benchmark for grounding, temporal correctness, abstention, retrieval hit-rate, latency, and cost/resource use. Track p50/p95 for actual tested runs, not guesses. Avoid data leakage across test splits.
- Test failure/recovery: disabled AI, offline provider, rate limit, timeout, malformed model output, stale action response, out-of-order event, missing scene notes, invalid timestamps, network disconnect, restarted server and offline TV.
Observability
Use structured, privacy-minimizing logs with event names, event IDs, source, stage durations, provider/error class and execution outcome. Do not log personal names, raw audio, tokens, provider credentials, sensitive preferences, or question text by default. Keep opt-in developer diagnostics explicit and temporary. Add request correlation IDs, per-stage latency, retrieval evidence IDs, cache hit/miss and outcome verification. Ensure production logs do not make personal session data persistent without a policy.
Security/privacy
- Validate all external payloads. Keep server secrets server-side. Do not expose tokens in Vite or TV bundles.
- Treat uploaded content, subtitles, prompts, web pages, frame descriptions and model outputs as untrusted data, not instructions.
- Least-privilege tools and network egress. Do not let a model-generated string execute as shell/SQL/URL/device action without deterministic mediation.
- Distinguish anonymous in-session state from persistent user memory; give persistent memory a reason, consent boundary, provenance and deletion/export path.
- Do not store training examples from user interactions without appropriate consent and review. Do not put secrets, media files, generated private data, API outputs, or personal logs into Git.
- Run available dependency and security checks (npm audit or the project's actual package manager equivalent, lockfile-aware SCA if available). Report the meaning and limitations of audit findings; do not auto-upgrade all dependencies blindly.
12. Recommendation and contextual decision loop
Do not create a learned recommender without data. Start with a transparent pipeline:
1. Explicit user intent/current task (e.g., “something funny”, “soothing”, “25 minutes”, “watching with family”).
2. Hard constraints: availability/licensing/catalog, time budget, content suitability if user selected it, current device/state, locale/platform constraints.
3. Candidate retrieval from known metadata/content.
4. Simple weighted ranker or deterministic baseline, optionally a TypeSafe judgement for semantic matching if it passes evaluation.
5. Return a small set with concise reasons and controls to correct the interpretation (e.g., “less intense”, “shorter”, “not this”).
6. Record impression, selected item, explicit feedback, and completion/skip outcome separately. Do not conflate click with satisfaction.
7. Benchmark the baseline. Train or fine-tune only if sufficient consented, reviewed data and a measurable need exist.
Make this a reusable skill/module that can later support media and other everyday contexts. Do not broaden the pilot into household control or personal sensing until the TV/Pip Pad context/action loop proves itself.
13. Implementation sequence and release gates
Move through phases in order; parallelise independent research only when it does not undermine source-of-truth or testing. Finish usable vertical slices, not disconnected abstractions.
Phase 0 — Baseline and safe checkpoint
Audit Git/repo/packages/tests, run baseline checks, identify currently working flows and defects, write the gap matrix and status report. Do not delete/refactor major areas in this phase.
Gate: We know the actual current build, reproducible test commands, baseline failures and protected user changes.
Phase 1 — Source-of-truth refresh and skill/tool setup
Install or read TypeSafe via exactly one supported method. Install/verify Impeccable project-locally if possible, then create/reconcile PRODUCT.md, DESIGN.md, current plan, current-state architecture and OSS adoption matrix. Mark old roadmap sections clearly when superseded.
Gate: New and old plans are reconciled; every major requirement maps to code/docs/tests or a clearly stated blocker.
Phase 2 — Simplify the core experience
Make the default playback path quiet. Hide/demote optional quizzes, character cards, prediction prompts, chapter walls, floating reactions, and unnecessary mascot variants from the default path; preserve only working features that still serve the thesis. Implement explicit invocation and contextual answer display without breaking TV playback or remote control. Apply the design tokens and Impeccable review.
Gate: A user can join, start/play media, invoke Pip, ask a question, get a short grounded answer/clarification, dismiss Pip, and continue watching. No unrequested interruption appears.
Phase 3 — Shared event/input architecture
Create or refine versioned semantic event types and input adapter interfaces. Add a simulated remote/button/touchwheel adapter, event validation, idempotent handlers and event/state tests. Preserve existing Socket.IO or platform protocol if proven stable; version changes.
Gate: Simulated and existing inputs trigger the same semantic actions through one path, with no model call for deterministic controls.
Phase 4 — Timeline retrieval and answer safety
Audit and correct video notes/timestamps. Build evidence-backed scene timeline data, retrieval-first questions, hard time filtering, cache scoping/invalidation and output validation. Add answer-memory only if keys and invalidation are proven safe. Implement clear abstention when the timeline does not support an answer.
Gate: Golden questions pass grounding/temporal checks and the current spoiler probes; rewind and replay cannot surface unseen-future answers.
Phase 5 — Virtual Pip Lab
Upgrade/reuse fake TV and pad tests. Add fault injection, event replay, device disconnect/restart simulation, latency injection and a compact deterministic scenario runner. Avoid 3D unless later required.
Gate: Core workflows and major failure cases run repeatedly without real hardware, and failures are diagnosable from logs.
Phase 6 — Repeatable video data factory
One licensed short film passes ingest → probe → scene sampling → optional ASR/subtitles → VLM candidates → reviewed timeline → retrieval index → dataset export → benchmark. Produce exact commands and artefacts. Do not expand to many films until reproducible.
Gate: A fresh checkout can rebuild the data pipeline (subject to documented model credentials/resources) and validation catches invalid timestamps, unresolved evidence and unreviewed facts.
Phase 7 — Typed decisions and provider benchmarking
Test TypeSafe/Jev against deterministic rules and the existing LLM path for one narrow semantic task. Compare Nova/local model/VLM candidates where appropriate using the same fixtures. Introduce only adapters with clear performance and quality wins. Keep fallback behaviour.
Gate: Every proposed model/service has a measured role, typed interface, error handling and benchmark; unneeded ones are marked reference-only.
Phase 8 — Production hardening and evidence
Run tests, type-check, lint, build, dependency/security audits, simulator/full-flow smoke test, visual QA, performance tests, and the original project-specific acceptance tests that remain relevant. Update docs, limitations and release checklist. Do not claim real Fire TV support unless tested on the proper simulator/device.
Gate: Reproducible evidence exists for the current deliverable. All remaining risks are listed honestly and prioritised.
14. Definition of done
The task is not done merely because the architecture is documented. The repo should contain meaningful, tested improvements toward these checks:
- [ ] Existing repository audited; uncommitted user work preserved; baseline results captured.
- [ ] PROJECT.md reflects the latest architecture and real implementation status; stale original-plan claims are marked as history.
- [ ] TypeSafe skill installed and verified or the environment blocker and direct-reading fallback are documented truthfully.
- [ ] Impeccable installed and used to shape/review the real UI or a clear reason the current environment cannot support it is documented.
- [ ] PRODUCT.md, DESIGN.md, current-state and target-architecture docs are consistent.
- [ ] Default TV playback stays uninterrupted; Pip can be deliberately invoked, used, and dismissed.
- [ ] UI foregrounding optional activities is explicit; decorative elements do not dominate the product.
- [ ] Shared semantic input event contract and simulated adapter exist or are improved, with tests.
- [ ] Deterministic controls remain deterministic, validated, idempotent and observable.
- [ ] Film timeline facts are timestamped, evidence-linked and reviewable; runtime retrieval obeys the time boundary.
- [ ] Spoiler, rewind/replay, unknown-fact, model-failure and malformed-output tests exist and are actually run.
- [ ] Video pipeline is reproducible for one permitted source; it emits schema-valid timeline data and a versioned evaluation dataset.
- [ ] Virtual Pip Lab simulates core TV/Pad/input flows and injected failures, reusing existing fake-device assets where practical.
- [ ] TypeSafe, DeepSeek Harness, DBX, OpenShell and any added OSS are recorded in a reasoned adoption matrix; no dependency was added simply for name recognition.
- [ ] Benchmarks record real measurements with setup/limitations; model choice/fine-tuning decisions have explicit gates.
- [ ] README/runbook, environment-variable examples, known limitations, and current next steps are accurate.
A checkbox may be marked complete only with evidence (test output, generated file, or verified command result). Otherwise mark it partial, blocked, or not started.
15. How you should execute the session
1. Begin by summarising the goals and the current repo facts, not by proposing a replacement architecture from scratch.
2. Run Phase 0. Print the real command output. Preserve uncommitted edits.
3. Install/read TypeSafe using one supported method. Install/use Impeccable if supported. Inspect both tools' changes in Git.
4. Build a prioritized task list with a clear test for every item, then start with the highest-impact small vertical slice.
5. Work in cohesive commits if the repository workflow permits. Do not commit secrets or generated media; do not push or deploy without permission. If commit creation is unsafe or unrequested, provide suggested commit messages instead.
6. After every significant change, run the narrow relevant tests, then broader checks at milestones. Fix regressions introduced by your changes. Do not conceal baseline failures.
7. If a tool requires unavailable credentials, hardware, GPU, Docker/Kubernetes support, permissions, or spending, implement a mock/adapter and continue where useful; record exact blocker and verification steps instead of fabricating success.
8. Keep PROJECT.md, code contracts, docs and tests aligned in each milestone. Do not leave two competing “current” plans.
9. Finish by reporting:
   - what was actually implemented and how it advances the target architecture;
   - files created/changed and important removals/deprecations;
   - exact install/build/test/security commands and pass/fail results;
   - verified model IDs/provider paths and anything unverified;
   - measured benchmark/performance results and setup;
   - tool adoption decisions and licences/SHAs for reused code;
   - remaining blockers/risks, with the single highest-priority next task.
10. Stop after that report. Do not claim work was completed beyond what this session executed and verified.
16. Current upstream reference URLs
Use current docs/source as authoritative for version-specific details; links below are starting points, not proof of compatibility:
- TypeSafe agent skill: https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md
- TypeSafe raw skill: https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md
- Impeccable: https://github.com/pbakaus/impeccable and https://impeccable.style
- DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness and https://www.deepseek.com/harness/en/
- NVIDIA OpenShell: https://github.com/NVIDIA/OpenShell and https://docs.nvidia.com/openshell/latest/home
- DBX: https://github.com/t8y2/dbx
- touchpad reference: https://github.com/todbot/touchpads
- Smart TV resource index: https://github.com/vitalets/awesome-smart-tv
- DeepVideoR1: https://github.com/mlvlab/DeepVideoR1
- LLaVA: https://github.com/haotian-liu/LLaVA
- Qwen2.5-VL: https://github.com/QwenLM/Qwen2.5-VL
- Amazon Nova multimodal docs: https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html
- Fire TV/Vega/Amazon device platform APIs: use current official Amazon Devices Builder Tools and platform documentation available to this project; do not treat generic examples as proof of Vega support.
Start now at Section 4. Do not stop after producing a plan. Audit the real repository, then implement and verify the highest-priority slice.