# Pip vNext: product re-evaluation and system build plan

Version 2.0, 16 October 2026. Written by Parth; this file is the source of truth for direction from now on. Where it differs from PROJECT.md, this file wins; PROJECT.md stays the reference for the infrastructure that is kept (pairing, playback, the socket protocol, coding standards).

Parth's notes with it (16 Oct): the Pip Pad, not the remote, controls everything; voice commands for play, pause, plus or minus 10 s, volume, brightness and ambient light; Pip is a button on the pad, invisible during the film and shown only on a pause or when called; one simple, cute mascot in the spirit of Bandhu (RouteMate), not overbearing; quizzes and games are a child-learning function, not the selling point; the selling point is Pip as a helpful intern-like assistant that understands what has happened so far, learns user patterns from datasets, and recommends what to watch for the mood the user chooses; replace Big Buck Bunny with a shorter film now and add a longer one later. References: awesome-smart-tv, the Xiaomi Mi TV Stick recovery project, DeepVideoR1, LLaVA, todbot/touchpads, and an annotation tool called "JEV" (not yet identified).

## 1. The decision

Pip is not a chatbot, a movie quiz, a mascot, or a fitness coach. Those can be skills, but none is the company thesis.

Pip is a context-and-action system for everyday environments. It observes permitted signals from the user's environment, builds a time-aware state of what is happening, remembers useful interactions with clear provenance, chooses the least expensive reliable way to help, and acts through the devices and services already available.

The Fire TV + Pip Pad prototype is the first environment in which to prove that idea. The long-term product line can include different screens, sensors, physical controls, and household devices, all connected to the same underlying context, memory, and action framework.

The next build must prove five things:

1. Pip understands enough of the current situation to be useful without making the user explain everything again.
2. Pip can do things, not merely respond with paragraphs.
3. It remembers the right things and improves through feedback without confusing clicks with intent.
4. It remains quiet until invoked or until a user-approved event makes an intervention useful.
5. The interface can grow beyond a phone/tablet screen into a physical interaction device.

## 2. What the reported build got wrong

The reported implementation added chapters, character cards, timed predictions, quizzes, floating reactions, player avatars, costume-like avatar options, confetti, and additional mascot expressions. Those are deliverable features, but they optimise the experience for a playful movie-companion demo rather than Pip's intended system-level role.

The problems are structural, not merely visual:

- Too much product surface, too little persistent intelligence. Many screens and cards do not establish a reusable understanding of the user or environment.
- A quiz is an interruption. A film's most valuable property is the uninterrupted viewing experience. Questions and games belong in an explicit child-learning or group-play mode, not in the default adult viewing path.
- A chat completion is not an action. Repeated model calls for routine controls add latency and do not make Pip more useful.
- Handwritten content notes are brittle if not treated as evidence. The reported timestamp correction and answer-memory reset show why scene facts need provenance, validation, and a reproducible content pipeline.
- A mood-themed mascot is surface polish. Tone should be consistent, warm, short, and unobtrusive. It must not need a model call or a new UI state for every personality variation.
- The tablet web app is only one input modality. The linked touchpads project opens a pathway toward physical capacitive controls. That belongs in the long-term input architecture now, even if hardware prototyping happens in parallel with the first software pilot.
- There is no demonstrated learning loop yet. Logging events is not the same as building verified memory, an annotated dataset, an evaluation set, and a system that improves against that set.

Keep proven infrastructure where it is useful: TV playback, pairing, TV/pad messaging, session reconnection, and the current model adapter if it is reliable. Do not preserve feature logic solely because it has already been written.

## 3. Product principles

### 3.1 Default experience

- The film or activity remains the main experience.
- Pip is hidden on the TV during normal viewing. It appears briefly when the user invokes Pip from the Pip Pad, when the TV is paused and a small affordance is useful, or when the user has explicitly enabled a relevant prompt.
- No unsolicited quizzes, character cards, floating reactions, chapter walls, or constant mascot animation in the default mode.
- Every interaction should lead to a useful action, a compact answer, a meaningful preference update, or nothing at all if no intervention is warranted.
- One quiet, recognisable Pip character is enough. Pip's product personality comes from timing, relevance, reliability, and restraint.

### 3.2 Skills are modules, not the product

The same platform may eventually support movie understanding, media recommendations, child learning, workouts, household control, and additional assistants. Each is a skill backed by shared capabilities; adding one should not require a separate memory system or personality engine.

### 3.3 Mood-aware recommendations

The recommender may use user-selected mood and context (for example, "something soothing," "something funny," "I have 25 minutes," or "we're watching as a family"). It must not infer sensitive states such as pregnancy, menstruation, ovulation, sexual preferences, or medical conditions from viewing behaviour. A click is evidence of a click, not proof of a person's emotional state.

### 3.4 The "helpful intern" standard

For any request, Pip should determine:

1. What outcome is the user trying to achieve?
2. What does Pip already know that is relevant and permitted to use?
3. Can an existing action, search, or deterministic function solve it?
4. If reasoning is needed, what minimum context should be sent to a model?
5. What action was performed, and did it actually succeed?
6. What, if anything, should be learned from the outcome?

This is the core loop. Conversation is one interface to it, not the entire system.

## 4. todbot/touchpads as an input-hardware reference

Repository: https://github.com/todbot/touchpads. Related: https://github.com/todbot/TouchyTouch (Arduino capacitive sensing with debouncing) and https://github.com/todbot/picoslidertoy (a larger Raspberry Pi Pico control surface).

The touchpads repository describes two capacitive-input primitives:

- Touch buttons: copper touch electrodes read by a microcontroller; the project describes a simple circuit using a GPIO pin and, usually, a 1 MΩ pull-down resistor. CircuitPython `touchio` and the Arduino TouchyTouch library are example implementation paths.
- Touchwheel: three interleaved capacitive electrodes produce relative readings that can be interpreted as a continuous position around a 0–360° wheel. The touchwheel0 design is roughly 30 mm in diameter and has CircuitPython and Arduino examples.
- picoslidertoy combines capacitive buttons and linear/rotary controls using a Raspberry Pi Pico. Treat it as a prototyping reference, not as a requirement to copy its entire design.

The repository uses an MIT licence, according to the repository page. Preserve upstream attribution and re-check the licence and notices for each file or dependency actually reused before shipping.

### 4.1 What this means for Pip

Pip should support multiple input adapters that emit the same semantic event contract. The intelligence layer should not care whether a `pip.invoke` event came from a glass touchscreen, a capacitive button, a touchwheel, a TV remote, voice, or a supported accessibility control.

A future Pip Pad could use one tactile/capacitive Pip button to invoke the assistant; a touchwheel for coarse media seeking, volume adjustment, or navigating a list of recommendations; a second capacitive control for play/pause or back; a display for context-specific choices and confirmations; later, microphone, camera, haptics, and sensors when they earn their place in the experience.

Do not attempt to replace every touchscreen interaction with capacitive hardware. The touchscreen stays useful for rich choices and text input; physical controls add quick, eyes-free interaction. Make the mapping learnable and consistent.

### 4.2 Prototype without coupling the product to one board

Use an input interface such as:

```ts
export type PipInputEvent =
  | { type: "pip.invoke"; source: InputSource; at: number }
  | { type: "media.playPause"; source: InputSource; at: number }
  | { type: "media.seekRelative"; seconds: number; source: InputSource; at: number }
  | { type: "media.volumeDelta"; delta: number; source: InputSource; at: number }
  | { type: "navigation.move"; direction: "next" | "previous"; source: InputSource; at: number }
  | { type: "navigation.confirm" | "navigation.back"; source: InputSource; at: number };
```

`InputSource` identifies the adapter, not the user: for example `tablet_touch`, `touchwheel_proto`, `capacitive_button_proto`, or `tv_remote`.

For the initial hardware proof, read the prototype board with a supported microcontroller and bridge semantic events to the Pip host over a simple transport such as USB serial. First prove input detection, debouncing, event mapping, and recovery from disconnects. Bluetooth or a custom wireless board can be investigated later.

Architecture requirement now: create the input adapter contract and a simulated adapter. Hardware experiment: run the physical touch button/wheel as a parallel prototype if the board or parts are accessible. The intelligence layer must work with both, and the hardware experiment must not block the software pilot.

### 4.3 First mapping experiment

| Physical interaction | Initial semantic action | Why |
|---|---|---|
| Tap/hold Pip control | Invoke Pip / open assistant surface | Deliberate entry point; avoids always-on UI |
| Touchwheel rotation while browsing | Move between candidate recommendations | Natural continuous navigation |
| Touchwheel rotation during playback | Seek by a calibrated time increment | Familiar, eyes-free media control |
| Dedicated capacitive button | Play/pause | High-frequency command that must not invoke a model |
| Secondary button/gesture | Back or dismiss | Fast escape from the assistant |

Do not make the same gesture mean several things without a visible mode indicator. Calibrate the touchwheel's step size and acceleration with real users.

## 5. Target architecture: one brain, several interfaces

```text
Inputs
  ├── Pip Pad web app / touchscreen gestures
  ├── Capacitive button + touchwheel prototype
  ├── Fire TV remote and platform media controls
  ├── Explicit user text or voice
  └── Permitted, on-device visual/activity signals
            │
            ▼
Input adapters → validated semantic event contract
            │
            ▼
Event journal + current session state
            ├── Content timeline / scene graph
            ├── User preference memory
            ├── Current task and device state
            └── Feedback and outcome records
            │
            ▼
Decision router
  ├── Deterministic command/action
  ├── Structured retrieval
  ├── Recommendation ranking
  └── Model reasoning only when required
            │
            ▼
Action executor → TV / Pad / approved connected service
            │
            ▼
Outcome validation + compact user feedback + event logging
            │
            ▼
Offline annotation, evaluation, and versioned data improvement
```

Runtime and offline work are separate. The runtime path receives input, reads current state, retrieves relevant records, chooses an action and responds quickly; it never waits for annotation or training. The offline path enriches films, generates candidate labels, applies human review, creates dataset snapshots, evaluates candidates and optionally fine-tunes a model.

For the pilot a single server process is enough, with modules separated by responsibility. Keep the TV/pad socket protocol if tests show it is stable; version it rather than replacing it. No microservices, agent framework or new database just to look sophisticated.

## 6. The brain: structured memories, not one giant file

Use a canonical structured store and produce a compact, human-readable brain snapshot when required.

1. **Event journal** (what happened): append-only events with source, timestamp, schema version, consent scope and references to session and content. A raw event is never overwritten because a later interpretation changed.
2. **World/content memory** (what is supported by evidence): film metadata, scenes, entities, actions, relationships, timeline facts and source frames or timestamps, with confidence and review status. Shared at the content level.
3. **User memory** (what is known or tentatively preferred about a person): explicit preferences separately from inferred patterns, with provenance, confidence, last-seen date and whether the user can edit or delete it. A single click is never a stable preference.
4. **Training/evaluation data**: input context, expected output or action, evidence, annotation instructions, annotator/model provenance, review status and dataset version. The live user's raw history is never silently made into a training set.

Pilot persistence: an append-only JSONL event export; one small queryable store for sessions, events and preferences (SQLite if it fits the stack); versioned JSON/JSONL annotation files; `brain_snapshot.json` derived from the canonical records, never the only source of truth. Retention, pilot consent, deletion/export and access controls are explicit before storing personal histories.

Example event record:

```json
{
  "schema_version": 1,
  "event_id": "evt_example_0001",
  "session_id": "session_example",
  "subject_id": "pseudonymous_user_example",
  "timestamp_utc": "2026-10-16T10:30:00Z",
  "event_type": "recommendation.selected",
  "content_id": "film_023",
  "source": "pip_pad",
  "context_ref": "recommendation_set_018",
  "explicit_feedback": null,
  "consent_scope": "pilot_personalisation",
  "provenance": { "kind": "direct_observation" }
}
```

What should be learned: a click or skip is behavioural evidence, but its reason is unknown. Prefer explicit feedback ("too slow", "too intense", "exactly what I wanted", "not for me"). Inferred preferences are hypotheses with confidence and decay. No sensitive personal inferences. Users can inspect, correct or delete stored preferences.

## 7. Visual-language memory for films

A structured timeline of what has happened up to the current playback point, not a transcript dump and not a prompt containing the whole film.

Content preparation pipeline: (1) ingest: licensed source, duration, metadata, usage rights; (2) sample: frames and scene boundaries, adaptive around scene changes; (3) extract: candidate scene descriptions, visible entities, actions, relationships, dialogue cues where permitted, evidence timestamps; (4) resolve: link recurring entities and keep unresolved identities unresolved until evidence supports a reveal; (5) validate: human-review a small, deliberate initial dataset, especially chronology, identity, causal events and revelations; (6) index for the runtime; (7) test at fixed playback positions, including "not revealed yet" and ambiguous cases.

Minimum scene schema:

```json
{
  "content_id": "film_001",
  "scene_id": "scene_007",
  "start_sec": 320,
  "end_sec": 371,
  "summary": "The traveller enters a cave and notices a large shadow.",
  "entities": ["traveller", "unknown_creature"],
  "events": [
    { "type": "enters", "subject": "traveller", "object": "cave", "evidence_refs": ["frame_320", "frame_338"] }
  ],
  "known_from_sec": 320,
  "confidence": 0.91,
  "review_status": "needs_human_review"
}
```

A confidence value means nothing until calibrated against reviewed examples.

Spoiler boundaries are enforced in retrieval: at playback time t, the retrieval layer drops every record whose evidence or reveal time is later than t before building any model context. Keep both the event time and the time a viewer could reasonably infer the fact; for ambiguous chronology use a conservative boundary. Pip may say "The film hasn't revealed that yet" or "I can't tell from what we've seen", and prefers no answer to a confident unsupported one.

Start with one short, openly licensed film; once the timeline, reveal handling and evaluation pass, add a longer film. Every film needs a rights and attribution record.

## 8. Decision engine: no unnecessary chatbot calls

| Request/event | Default path | Model required? |
|---|---|---|
| Play/pause, seek, volume, navigation | Direct validated action | No |
| Invoke/dismiss Pip | State transition | No |
| "Who is that?" | Resolve time-bounded entity evidence | Often no; optional wording model |
| "What just happened?" | Retrieve recent scene/event summary | Often no if a precomputed summary suffices |
| "Why did they do that?" | Retrieve evidence and separate fact from interpretation | Possibly |
| Recommend for a stated mood and time limit | Filter candidates and rank on explicit metadata/preferences | Optional explanation, not per candidate |
| "Remember I prefer short comedies" | Save an explicit preference, confirming if ambiguous | No |
| Unknown or contradictory request | Ask a concise clarification or report uncertainty | Possibly |

Latency: measure input-to-server, routing, lookup, model time, action dispatch and visible response separately; report p50 and p95. Cache safe repeated retrievals; never cache user-specific answers across users. Playback control never depends on model latency.

Outcome validation: a tool call is not a successful action until the target device confirms the result. Track requested action, executed action, success or failure, elapsed time and fallback.

## 9. Recommendation system and feedback loop

Pilot signals: user-selected mood or intent; available time and alone/together if the user gives it; genre, duration, tone/intensity, language and other catalogue metadata; explicit likes, skips with reason, saves, replays and direct feedback; repeated behaviour as a low-confidence, decaying signal.

Loop: (1) a small licensed catalogue with good metadata; (2) ask one question only when it materially improves the result; (3) filter on hard constraints (duration, language, availability, exclusions); (4) rank on explicit preferences and observed outcomes; (5) a small shortlist with a short reason for each; (6) log the candidate set, the selection, feedback and outcome; (7) evaluate ranking changes offline before using them. No fine-tuning on a pile of clicks: first collect labels with a clear target.

## 10. Annotation and model strategy

Model-agnostic: scene extraction with a video-capable model or frame sampling plus a vision-language model, precomputed outside the viewing session; candidate labels from one or more models with model/version and raw output stored; human review for ground truth, identity and reveal timing; runtime answers retrieval-first, a model only when needed; ranking with rules and a simple ranker first.

The referenced research: LLaVA is a visual-language research foundation with multi-GPU training recipes, a benchmark candidate rather than something to run responsively on a Mac. DeepVideoR1 is video-reasoning reinforcement fine-tuning research configured for a four-GPU node, for later experiments if the evaluation shows a video-reasoning gap. Awesome Smart TV is an ecosystem list. The Xiaomi Mi TV Stick recovery project is device-specific. First compare existing hosted/local models on the same reviewed scene and question set; fine-tune only once the failure pattern, compute, licensing, data and test split are known.

"JEV": not yet identified. Keep the annotation interface pluggable; any tool must export labels in a documented schema, keep model/annotator provenance, support corrections and review states, and allow reproducible dataset versions.

## 11. Dataset factory and evaluation protocol

Tasks: scene summary and event extraction; entity consistency and relationships; questions about what has happened; spoiler-boundary tests at given times; uncertainty and contradiction handling; recommendation ranking for an explicit request; action selection and action-success validation.

Each example: example_id, schema_version, source/content ID, timestamp or scene range, input context, expected answer/action, supporting evidence, forbidden future evidence, annotation source/model, reviewer, status, confidence, dataset version. Model labels stay distinct from reviewer-approved labels; corrections are preserved.

Leakage controls: split by film; no near-duplicate interactions of one user across train and test; a held-out final test set; spoiler tests at several times around each reveal; unsupported premises, ambiguous identity, unanswerable scenes and contradictory assumptions included.

Metrics: factual correctness against reviewed evidence; spoiler leakage (target zero on the acceptance set); "not enough evidence" precision and recall; entity consistency; recommendation success from explicit satisfaction and pairwise choices; action success and failed/duplicate command rate; p50/p95 latency per request class; model calls per successful task; interruptions and usability feedback.

## 12. Revised primary demo

1. The user opens Pip from the pad; Pip is otherwise invisible during the film.
2. The user says, types or chooses an intent such as "I have 20 minutes; recommend something light."
3. Pip uses the catalogue and explicit preferences to return a small justified shortlist.
4. The user chooses; Pip starts playback and records the recommendation outcome.
5. During the film the user taps the Pip control and asks "What just happened?" or "Who is that?"
6. Pip retrieves only time-bounded scene evidence and answers briefly, or admits uncertainty.
7. The user corrects or rates the result; that becomes a structured feedback record for later review, not a hidden training update.
8. The touchwheel or touchscreen controls playback without a model call.

The quiz/game experience, including child learning, is a separate opt-in skill.

## 13. Implementation plan

Every phase has an exit test and leaves a working build.

- **Phase 0, audit and freeze.** Inspect branch, tree, commits, screens, content, model adapter, persistence and socket events; run typecheck, lint, tests and the TV/pad happy path; tag the current state; mark each feature keep, remove from default, defer or broken. Exit: a truthful baseline report and a rollback point.
- **Phase 1, rebuild the experience layer.** Remove quizzes, timed predictions, reactions, avatar customisation, confetti and chapter/character panels from the default viewing path; hide Pip during play; one obvious Pip control on the pad and a small paused-state affordance on the TV; keep play/pause, seek, back, pairing, recovery and accessible controls; child-learning/games only behind an explicit opt-in. Exit: a whole film plays with no unsolicited overlay; Pip can be invoked and dismissed reliably.
- **Phase 2, canonical event and input contracts.** The versioned semantic event schema; validated adapters for touchscreen and remote events; a simulated touch-button/touchwheel adapter with repeatable traces; event logging with pseudonymous session IDs, timestamps, source and consent scope; reject malformed, duplicate or stale events. Exit: the same actions from the touch simulation and the screen produce the same semantic events; logging never blocks playback.
- **Phase 3, time-aware content memory.** The first short licensed film as scene/entity/event records with timestamps, evidence references, review state and known/reveal time; pure retrieval that filters by playback time before any prompt; a fixed question set with ambiguous and not-yet-revealed cases; remove stale answer caches built from superseded annotations, with cache version dependencies. Exit: no future record can enter the prompt for the fixed spoiler set; answers cite the scene internally and fail safely.
- **Phase 4, decision engine and actions.** Direct controls to deterministic handlers; retrieval-first "who is that?" and "what just happened?"; a small action registry (input schema, permission, execution, confirmation, timeout, fallback, result logging); a model only for unresolved interpretation, complex intent or wording; the model adapter behind a stable interface, chosen by benchmark. Exit: playback commands make zero LLM calls; common content questions use retrieval; action outcomes are recorded.
- **Phase 5, physical touch proof.** Verify the board and upstream examples; test a capacitive button and touchwheel separately; send semantic events over a simple bridge; measure missed touches, false activations, wheel jitter, event-to-action latency and reconnects; keep the simulator for CI. Exit: the button invokes Pip and the wheel controls one function, through the same handlers as the tablet; without parts, the contract and simulator ship and the hardware stays an explicit unverified experiment.
- **Phase 6, preferences and recommendation pilot.** A small licensed catalogue with clean duration/genre/tone/language metadata; filters and a simple deterministic ranker; explicit mood/intent selection, no sensitive inference; record candidate set, selection, rating/reason and completion; a small reviewed recommendation evaluation set. Exit: a fixed request returns a shortlist with inspectable reasons, and one click never becomes a permanent profile fact.
- **Phase 7, annotation and benchmark.** Confirm the annotation tool ("JEV"), keep a portable JSONL export either way; instructions and review states; version a pilot dataset and freeze the test set; compare the baseline with at least one candidate on identical examples; report quality, spoiler leakage, latency and model calls. Exit: one reproducible offline run creates a candidate dataset and an evaluation report.
- **Phase 8, fine-tuning gate.** Only if a repeated failure survives retrieval, data fixes, logic and prompting; there are enough clean, consented, licensed examples; a leakage-controlled split exists; compute and licence allow it; and there is a win condition and rollback. Otherwise write down why not yet.

## 14. Acceptance tests for the next build

- Experience: a 10-minute viewing test shows no unsolicited quiz, card, prediction or reaction overlay; Pip is hidden during viewing and can be invoked from the pad in one deliberate interaction; every assistant surface has a clear dismiss path.
- Input and action: the same semantic command from touchscreen, simulated capacitive control and remote reaches the same handler; playback commands make no model call; duplicate and stale events make no duplicate actions; a failed device action is reported honestly.
- Content understanding: every benchmark answer has supporting evidence or a valid uncertainty response; future evidence is removed before context construction at every tested position; questions near a reveal are tested just before, at and after it; missing or contradictory notes give an uncertainty response.
- Memory and learning: raw events stay unchanged after annotation corrections; explicit and inferred preferences are stored separately; one skip never becomes a confident permanent preference; every training example has provenance and review status; dataset versions can be reproduced.
- Performance: p50/p95 for input-to-action, retrieval, model and total question latency, separately; model calls per completed task; tested on the real target devices and network; thresholds chosen after the first baseline run, never "instant" without measurement.

## 15. Scope and sequencing

Build now: quiet Pip invocation, a stable TV/pad, fast paths for common actions, structured events, one short film timeline, spoiler-safe retrieval, basic recommendation ranking from explicit context, latency tests, and a pluggable touch input contract. Prototype in parallel if hardware is available: the touchwheel and capacitive button on a microcontroller, mapped into the same events. Build next: reviewed multi-film timelines, profile controls, better recommendation learning, multimodal ingestion, a larger pilot dataset, systematic evaluation. Later, on evidence: fine-tuning, a custom PCB/enclosure, always-on sensing, complex agent frameworks, accounts/household sharing, new device families.

## 16. Instructions for the coding agent

Read this plan and the repository before editing; first return an audit of the branch, uncommitted changes, file tree, event protocol, content schema, model calls, persistence and tests. Preserve working pairing, playback and reconnection code. Stop adding quizzes, character cards, avatar variants, reactions or mascot polish to the default experience. Work in this order: (1) quiet viewing and Pip invocation, (2) semantic input and event contracts, (3) time-bounded content retrieval, (4) deterministic action router and instrumentation, (5) touch input simulator, (6) preference and recommendation pilot, (7) annotation and evaluation tools. Small commits; after each phase report files changed, commands and real outputs, pass/fail tests, unknowns and the rollback point; never claim a test passed without the evidence.

## 17. References

- todbot/touchpads, todbot/TouchyTouch, todbot/picoslidertoy (capacitive input, MIT per the repository pages).
- vitalets/awesome-smart-tv (smart-TV ecosystem index).
- haotian-liu/LLaVA (visual instruction tuning; research and benchmark candidate).
- mlvlab/DeepVideoR1 (video reasoning reinforcement fine-tuning; four-GPU examples).
- RodrigoDeveloperX/xiaomi-mi-tv-stick-4k-mdz-27-aa-recovery (device-specific recovery).

These are building blocks, not a ready-made Pip stack. Verify upstream code, hardware, versions, licences and reproducible results before integration.
