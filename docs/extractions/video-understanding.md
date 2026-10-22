# Extraction manifest: video understanding

Video understanding for Pip: who and what is on screen, what is happening, scene changes, dialogue,
and how the current scene relates to earlier ones, so Pip can answer "Who is that?", "What just
happened?" and "Why did they do that?" at the exact playback position without spoilers. Built from
existing open-source tools and models, connected to Pip's offline pipeline and its existing
timestamp, spoiler boundary, retrieval and answer gate. Extracted 17 Oct 2026 on a MacBook Air M2
with 8 GB of memory (macOS 27), the machine this has to run on.

How to run it: [Run it](#run-it). What was measured: [Evidence](#evidence-sintel-17-oct-2026).

## What was reused, and from where

| Part | Source | Version | Licence | How it is in Pip |
|---|---|---|---|---|
| Speech recognition | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | commit `d1be6fde11ac` (v1.9.5, 6 Oct 2026) | MIT | Built from source by `video/setup.sh` into `video/.tools/` (git-ignored); called as `whisper-cli` by `server/src/pipeline/speech.ts` |
| Whisper model | `ggml-small.en.bin` from [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) (OpenAI Whisper small.en, converted) | sha256 `c6138d6d…9c41e5d` (matches Hugging Face's LFS record) | MIT | Downloaded and checked by `video/setup.sh` into `video/models/` (git-ignored) |
| Vision-language model | Qwen3-VL-4B-Instruct ([QwenLM/Qwen3-VL](https://github.com/QwenLM/Qwen3-VL); `QwenLM/Qwen2.5-VL` now redirects there), as Ollama's `qwen3-vl:4b-instruct` | Ollama digest `ee4b975b58c1`, Q4_K_M, 4.4 B parameters | Apache-2.0 (model card and `ollama show`) | Called over Ollama's local HTTP API by `server/src/pipeline/vlm.ts`; `ollama pull qwen3-vl:4b-instruct` |
| Scene cuts | ffmpeg `scdet` (already in Pip) | Homebrew ffmpeg | LGPL/GPL build, used as a tool | Unchanged; kept over PySceneDetect on evidence (below) |
| Timeline, boundary, retrieval, answer gate | Pip itself (`server/src/core/context/`, `server/src/answer.ts`) | | MIT | Extended, not replaced |

No third-party source code is copied into the repository: whisper.cpp is built from its pinned
commit, and both models are downloaded with their checksum or digest recorded. Nothing new runs on
the Fire TV: Vega does not run these models, so understanding happens offline on the Mac and the TV
only reports its playback position, as before.

## Selection: what was tried and why it was kept or dropped

All on the M2 8 GB Mac, on Sintel (888 s, CC BY 3.0), on 17 Oct 2026.

### Vision-language model

| Candidate | Result | Decision |
|---|---|---|
| Qwen2.5-VL-3B (`qwen2.5vl:3b`) | With the character roster in the prompt it copied the roster into every answer: all three listed characters "seen" in each of 6 test frames, including a black frame and a market with none of them. ~17 to 25 s a frame. Licence: Qwen Research License (non-commercial), not Apache. | Rejected |
| Qwen3-VL-4B (`qwen3-vl:4b-instruct`) | On the same 6 frames: right characters and actions in 3, correctly empty in 2 (a black frame, a dark empty room), missed 1 (a motion-blurred fight). Read on-screen credits word for word. Linked the red-haired woman across shots. ~13 to 35 s a frame warm (about 1,080 image tokens; 27 to 34 % of the model on the CPU). Apache-2.0. | **Selected** |
| Qwen2.5-VL-7B (Apache-2.0) | Not run: about 6 GB quantized, which leaves no room on an 8 GB Mac that already offloads a third of the 4B model to the CPU. | Not feasible here |
| Amazon Nova 2 Lite (Bedrock) | Not run: no AWS credentials on this Mac (`~/.aws` is missing; profile `pip` not found). Pip's existing `--generator nova` path (`server/src/pipeline/nova-annotate.ts`) is unchanged and still unverified. | **Blocked** (credentials) |
| mlvlab/DeepVideoR1 | The repository has no licence file (GitHub reports none, so no rights are granted to reuse it), contains training code only (Reg-GRPO on Qwen2.5-VL-3B, "configured for a node of 4 GPUs", vLLM inference), and no released weights were found (Hugging Face search for `mlvlab` and `DeepVideo`: none). | **Blocked** (licence, weights, hardware). Not imported |

### Scene cuts

PySceneDetect 0.7.2 (BSD-3-Clause) against Pip's ffmpeg `scdet` at threshold 3. On Sintel,
`ContentDetector` (default 27) found 214 cuts, `AdaptiveDetector` 149, and `scdet` 160 scenes after
merging scenes under 1.5 s, 150 of which agree with `ContentDetector` to within 0.5 s. Where the two
disagreed I looked at 12 frame pairs each (0.25 s before and after): 11 of 12 cuts only `scdet`
found were real shot changes; about 6 of 12 only `ContentDetector` found were real (the rest were a
title fading in, a flash or motion inside one shot). `scdet` stays; PySceneDetect is not added.
Small sample, judged by me, not a person.

### Speech recognition settings

whisper.cpp small.en on the whole Sintel soundtrack (about 28 s each, Metal):

| Setting | Result |
|---|---|
| Defaults | "Scales" heard correctly, but every line from 446 s to 463 s skipped (including "These are dragon lands, Sintel."), "Lemon." made up in music |
| `-sns` (suppress non-speech tokens) | "Scales" misheard as "Skills" five times; whole-second timestamps |
| `--vad` (Silero v6.2.0, MIT) | Unusable at this commit: one "segment" from 208 s to 749 s |
| **`-mc 0`** (no text context) | Sub-second times; "Goodnight, Scales." at 227.5 s; the shaman's lines at 445 to 463 s, with "Sintel" at 460.5 s. Leftovers: one repetition loop ("I'm sorry" ×8, dropped by `isRepetitionLoop`), "Mom!" and "Scout!" (misheard calls), "Lemon." |

`-mc 0` is used. The VAD model was deleted after the test.

## How it works

Offline, once per film (`npm run pipeline -- ...` in `server/`):

1. `scenes`, `frames` (existing): cuts from `scdet`; one frame shortly after each cut and every
   4 s, each with its decoded timestamp. Sintel: 161 scenes, 247 frames.
2. `asr` (now real): 16 kHz mono audio to whisper.cpp; lines with ids such as `ln-02275` (starts at
   227.5 s); sound captions, dashes and repetition loops dropped.
3. `understand` (new):
   - The vision model sees each frame in story order with a roster of the characters seen so far
     ("c1: young woman with red hair (person)") and answers in JSON: characters (roster id or new,
     kind, looks, doing), action, setting, objects, on-screen text. Never names.
   - `SceneMemory` (`server/src/pipeline/scene-memory.ts`) links each character: the model's id is
     trusted when the kind agrees; a "new" character with the same kind and similar words within
     12 s is the same one; otherwise a new track. A character seen only once is dropped.
   - For every name heard in the dialogue (capitalised, not opening a sentence, or a sentence on its
     own: "Goodnight, Scales.", "Scales?"), the model gets the frame at that line and the characters
     on screen around it and says which one is called that, or "unknown".
   - Candidate facts, each with its evidence and reveal time: first appearances, captions, settings,
     every dialogue line, namings ("The small dragon is called Scales: someone says ..."), a
     character coming back after a minute or more ("... is back, last seen at 3:39 (...)"), and a
     return to an earlier place ("Back in ..., last shown at 1:44"). These are the links between the
     current scene and earlier ones.
   - Every reply is cached per frame; the whole run is committed as
     `server/pipeline/understanding/<asset>.observations.json`, and `--replay` rebuilds the
     candidates from it without the model.
4. `export`, `validate` (existing, extended): the canonical timeline now carries the transcript
   `lines`; a fact may cite a line as evidence (it counts from the line's end).

At playback time nothing is processed again: the server loads `content/timelines/<film>.json`
once, and each question uses the TV's reported position (`estimatePosition`, unchanged).

## Spoiler rules added

- **Names only from dialogue.** A character is called by its look ("the small dragon") until its
  name is heard and matched to it (`Entity.namedSec`, `label`). Before then the name is a
  restricted term: a question naming it gets "not sure", and an answer containing it is withheld.
  The evidence key changes at the naming, so a cached answer from after it cannot return after a
  rewind. The timeline check refuses an intro that gives the name away.
- **Names the model knows from outside the film** (it may know Sintel) are scrubbed from its text
  until heard.
- **First mentions.** Every kind of thing the film shows (a character's kind, an object) is a
  spoiler term of the first fact that shows or says it: before anyone says "a dragon" (143.7 s in
  Sintel), Pip cannot use the word.
- **Names from the film card** (`--known Sintel`, the title) count as known from the character's
  first sighting.
- **Heard names nobody was matched to** are spoiler terms of the line they are first said in.
- **Answers must be supported.** Every word of the film's own vocabulary in an answer (character
  names and labels, heard names, things shown) must appear in the facts it cites, or the answer is
  withheld (`unsupported-term`). "The big dragon is Scales" citing a fact about a rooftop is the
  model's knowledge of the film, not evidence. Uncited answers that name any of them were already
  withheld; the vocabulary now includes the spoiler terms.
- **Partial understanding is said, not hidden.** A timeline records how far the frames were looked
  at (`coveredUntilSec`); after that, "Who is that?" and "What just happened?" say "I haven't looked
  closely at this part yet" instead of describing an older scene as now.
- Unchanged and still applied: only facts revealed by the position are used; restricted terms are
  checked before any model call and on every answer; answers must cite permitted facts; the answer
  is re-checked if the film was rewound while Pip was thinking.

## Changes in Pip

New: `video/setup.sh`; `server/src/pipeline/vlm.ts`, `transcript.ts`, `speech.ts`,
`scene-memory.ts`, `understand.ts`, `tracking-score.ts` and their tests;
`server/pipeline/truth/sintel.characters.json`; `server/pipeline/understanding/sintel.observations.json`;
`server/pipeline/annotations/sintel.candidates.json`; `server/content/timelines/sintel.json`;
`server/src/lab/video-understanding.test.ts`; `server/src/pipeline/sintel-understanding.test.ts`.

Changed:

- `scripts/pipeline.ts`: real `asr` (skipped with a reason without whisper.cpp); new `understand`
  (`--model`, `--known`, `--limit`, `--replay`, `--cached-only`) that prints a tracking score when
  hand labels exist;
  `annotate` and `export` know about lines; frames no longer need ffmpeg's `drawtext`, which
  Homebrew's ffmpeg does not have (the frames stage failed on this Mac before).
- `src/pipeline/artifacts.ts`, `review.ts`, `src/film/timeline-file.ts`,
  `src/core/context/timeline.ts`: transcript lines, line evidence, `label` and `namedSec`.
- `src/core/context/boundary.ts`: entities seen but not yet named, and their names as restricted
  terms.
- `src/core/context/retrieve.ts`, `src/answer.ts`: "Who is that?" picks the newest character in the
  latest shot, leads with the name once heard, hedges when the sighting is unconfirmed
  (confidence below 0.6) and says "I can't tell who that is" when nobody has been on screen for
  30 s; "Who is Scales?" never falls back to whoever is on screen; "Why did she do that?" retrieves
  the earlier facts about whoever is on screen; "What just happened?" tells the first sentence of
  each of the two latest facts (whole dialogue lines); past `coveredUntilSec`, the coverage line.
- `src/core/context/check-answer.ts`: the `unsupported-term` check; `lexiconOf` adds labels and
  spoiler terms.
- `src/flow.ts`: a timeline answers only once it has facts the review policy allows; until then the
  film stays on its notes. `src/lines.ts`: two lines. `src/lab/harness.ts`: a scenario can use
  another film.
- `.gitignore`: `video/.tools/`, `video/.venv/`, `video/models/`.
- `docs/architecture/video-data-pipeline.md`: the `asr` and `understand` stages.

No socket protocol change; the pad and TV apps are untouched.

## Run it

```bash
video/setup.sh                       # once: whisper.cpp at the pinned commit, small.en (checked)
ollama pull qwen3-vl:4b-instruct     # once: the vision model (3.3 GB)
cd server
npm run pipeline -- asr sintel       # ~30 s for 15 minutes of film
npm run pipeline -- understand sintel --known Sintel   # ~22 s a frame; resumable; Ctrl-C is safe
npm run pipeline -- understand sintel --cached-only    # build from what is done, no model calls
npm run pipeline -- understand sintel --replay         # rebuild from the committed run, no model
npm run pipeline -- export sintel --out content/timelines/sintel.json
npm run pipeline -- validate content/timelines/sintel.json
TIMELINE_REVIEW=candidate npm start  # answer from the generated (unreviewed) facts
```

With the default `TIMELINE_REVIEW=accepted`, Sintel keeps answering from its notes until a person
reviews the candidates (`npm run pipeline -- review sintel --list`, decisions in
`pipeline/reviews/sintel.review.json`), as for every other timeline.

## Evidence (Sintel, 17 Oct 2026)

- **Partial run, by choice.** The vision model ran on 106 of 247 frames (0 to 384 s, 43 % of the
  film) and was stopped there because it saturated the 8 GB Mac. Per frame: p50 22 s, p95 60 s,
  max 153 s; 47 minutes in all. 7 frames failed twice (timeouts) and count as unreadable. The
  timeline says so (`coveredUntilSec: 383.9`), and Pip says so past it. The rest resumes with the
  `understand` command above; the cache keeps what is done.
- **Speech**: 46 lines over the whole film in 29 s. The name check ("which character is Scales?")
  never ran, so no character is named on real data: names stay heard words guarded by their first
  line. Naming is covered by the synthetic tests (`scene-memory.test.ts`, `answer.test.ts`).
- **Timeline**: 155 candidate facts (73 captions, 46 dialogue lines, 30 settings, 5 first
  appearances, 1 return to an earlier place), 5 characters, all checks pass. A test rebuilds every fact
  (id, text, reveal time, characters, spoiler terms, evidence) from the recorded run without the
  model.
- **Tracking against hand labels** (`server/pipeline/truth/sintel.characters.json`: 54 frames I
  labelled by looking at them, not a person's review; 31 fall in the covered part): every frame
  with someone on screen where the model saw someone: 17 of 23 (6 missed: dark or blurred frames);
  0 characters invented in 8 empty frames; links 18 right, 4 wrong (precision 0.82); recall 0.72.
  The heroine is one track from 0:28 to 6:21 and the shaman one track. The baby dragon is a track
  from 4:39 ("small grey reptilian with large eyes"), but the model mostly put it in captions
  ("a small dragon lies on a roof") rather than in its character list, so "Who is that?" at 3:10
  names the heroine. The scorer counts the dragon track as "nobody" because its only labelled frame
  marks the dragon as uncertain, so precision is slightly understated.
- **Confidences are initial values, not calibrated** (`CONFIDENCE` in `scene-memory.ts`: 0.85 a
  dialogue line, 0.7 a caption, 0.75 to 0.85 a model link, 0.6 a link by look, 0.5 a first
  sighting). Pip hedges below 0.6. Calibrating them needs reviewed facts, which do not exist yet.
- **Tests** (server: 374 pass, typecheck and lint clean): `sintel-understanding.test.ts` (25, on the
  committed real run: reproducibility, tracking floors, identification, scene questions, grounding
  of every answer and prompt at 81 positions, uncertainty, 12 spoiler probes including the twist
  from a model that knows it, before and after the name, with and without citations, a citation of
  a line not heard yet, a rewind while thinking and a rewind past a cached answer);
  `lab/video-understanding.test.ts` (2, real sockets: the TV scrubs 50 s, 230 s, back to 200 s and
  600 s; no model call; the default policy keeps the notes path); unit tests for every new module.
- **Benchmark** (`npm run eval`, lab film): unchanged except the leaky model ("always tells the
  ending"), which now abstains correctly 83 of 83 times instead of 68 of 83, from the new
  `unsupported-term` check. 0 leaks in every row, as before.

## Not verified, and limits

- The second half of Sintel is not described (above). Nothing was run on Big Buck Bunny or Coffee
  Run.
- No live model answered questions here: the runtime tests use fake models; answer quality with
  Ollama `qwen2.5:3b` or Nova on these generated facts is unmeasured. Nova remains blocked on AWS
  credentials.
- The vision model sometimes carries a character into a frame where they are not (the shaman at
  3:26), and misses characters in dark frames; facts are candidates for review, not truth.
- Speaker identity is not known: dialogue facts say "Someone says" and list who is on screen.
- The ASR leftovers ("Mom!", "Scout!", "Lemon.") are in the candidates; a reviewer should reject
  them.
- The lab film cannot be rendered on this Mac (Homebrew ffmpeg has no `drawtext`), so the scene-cut
  comparison used Sintel and my judgement of 24 frame pairs, not ground truth.
- `video/.venv/` (PySceneDetect 0.7.2, from an earlier attempt today) is left in place, ignored and
  unused.
