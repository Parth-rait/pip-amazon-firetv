# Video data pipeline

How a film becomes a reviewed, timestamped, evidence-linked timeline that Pip can answer from, and how the same data becomes a benchmark. One reproducible command per stage; every stage checks its inputs; raw drafts never mix with accepted facts.

## Run it

From `server/` (Node 22, ffmpeg and ffprobe on the PATH):

```bash
# 1. Ingest: a licence and a rights note are required, and the file's sha256 is recorded.
npm run pipeline -- ingest big-buck-bunny --source media/big-buck-bunny.mp4 \
  --license "CC BY 3.0" --rights "Blender Foundation, www.bigbuckbunny.org; credited on screen"

# 2-5. Probe, scenes, frames and contact sheets (or run `all` instead of ingest + these four).
npm run pipeline -- probe big-buck-bunny
npm run pipeline -- scenes big-buck-bunny --threshold 3   # add --truth <file> to score against ground truth
npm run pipeline -- frames big-buck-bunny --every 2
npm run pipeline -- sheets big-buck-bunny

# 6. Candidates: write pipeline/annotations/<asset>.candidates.json by looking at data/<asset>/sheets/,
#    or draft them with Nova (unverified, needs the AWS profile) and copy what is right.
npm run pipeline -- annotate big-buck-bunny                    # checks every cited frame exists
npm run pipeline -- annotate big-buck-bunny --generator nova   # writes data/<asset>/candidates.nova.json

# 7. Review: decisions and corrections go in pipeline/reviews/<asset>.review.json.
npm run pipeline -- review big-buck-bunny --list

# 8-9. Export the canonical timeline and validate it.
npm run pipeline -- export big-buck-bunny --out content/timelines/big-buck-bunny.json
npm run pipeline -- validate content/timelines/big-buck-bunny.json

# 10. Dataset and benchmark.
npm run pipeline -- dataset big-buck-bunny --timeline content/timelines/big-buck-bunny.json
npm run eval -- big-buck-bunny
```

The lab film runs the same way: `npm run lab:film` renders it, then `npm run pipeline -- all lantern-fox --source media/lantern-fox.mp4 --license MIT --rights "..." --truth pipeline/truth/lantern-fox.truth.json`.

## Stages and files

| Stage | Writes | Notes |
|---|---|---|
| ingest | `data/<asset>/asset.json` | Source, local file, sha256, bytes, licence, rights note. Every later stage refuses a file whose sha256 changed. |
| probe | `probe.json` | Duration, container start time, codec, size, frame rate, audio streams. |
| scenes | `scenes.json`, `scenes.score.json` | One ffmpeg `scdet` pass at a low floor keeps every change with its score; cuts are chosen in code at `--threshold`; scenes shorter than `--min-scene` merge. A fixed-interval baseline (`--baseline 6`) is stored beside it. With `--truth`, precision, recall and F1 are reported for thresholds 1 to 10. |
| frames | `frames/*.jpg`, `thumbs/*.jpg`, `frames.json` | Shortly after each scene start, then every `--every` seconds, plus one frame after every smaller change (a caption, an object appearing). `-copyts` and `showinfo` record the decoded frame's own time; ids come from the planned time (`fr-00525` is 52.5 s), so annotations survive a re-run. |
| sheets | `sheets/sheet-NN.png`, `sheets/index.json` | Labelled thumbnails tiled 4x3 for people (or a model) to look at. |
| asr | `asr.json` | Adapter slot. Skipped with a reason: no speech recognition is installed, and both films have no dialogue. Subtitles or a separate ASR adapter go here when a film needs them. |
| annotate | `pipeline/annotations/<asset>.candidates.json` | Untrusted candidates: each fact has start and reveal times, entities, spoiler terms, evidence frame ids, confidence and the generator. `--generator nova` writes `data/<asset>/candidates.nova.json` for a person to copy from. |
| review | `pipeline/reviews/<asset>.review.json` | A person's decision per fact and entity (accepted, rejected, needs-change) with notes and corrections; reviewer and date are recorded. |
| export | `content/timelines/<film>.json` (or `lab/content/timelines/`) | Canonical timeline with frames, scenes, entities and facts, each with generator, evidence and review state. |
| validate | exit code | Schema plus cross-checks: unique ids, times inside the film, scenes in order without overlap, evidence that resolves and is not after the reveal, entities named only once seen, accepted facts with evidence and a reviewer. The server runs the same checks at start-up and refuses an invalid file. |
| dataset | `evals/datasets/<asset>/v1/examples.jsonl` | Recap, identify, spoiler-probe, unseen-entity, unknown-fact and routing examples, each with allowed evidence, expectations and provenance. One film: everything is held out (`split: test`); nothing is for training. |

Work files under `server/data/` and media under `server/media/` are gitignored. Annotations, reviews, truth files, timelines and datasets are small text files and are committed.

## Measured on the lab film (October 16, 2026)

The Lantern Fox is our own 96-second film rendered by `scripts/make-lab-film.ts` with known scene cuts and caption times (`pipeline/truth/lantern-fox.truth.json`).

| Scene detection (tolerance 0.5 s) | Precision | Recall | F1 |
|---|---|---|---|
| scdet, threshold 10 (ffmpeg's default) | 1.00 | 0.14 | 0.25 |
| scdet, threshold 3 (chosen by the sweep) | 1.00 | 1.00 | 1.00 |
| Fixed 6-second interval (the original idea) | | | 0.27 |

- True cuts scored 3.1 to 15.5 on this low-contrast film; caption and object appearances scored 0.5 to 3.0. The margin is thin (3.14 against 2.99), so the threshold must be checked per film. Real films usually have harder cuts.
- 51 frames, with 0.000 s between planned and decoded times, because every planned time falls on a frame at 24 fps.
- 18 candidate facts were written from the contact sheets; a test confirms each accepted fact is backed by a script caption already on screen at its reveal.
- Found and fixed by looking at the sheets: ffmpeg's `drawbox` treats `t` as thickness, not time (the fox box was off screen), and the labels covered the captions.

## Big Buck Bunny

Blocked in this environment: the network policy refuses `download.blender.org` (and the other mirrors tried). On the Mac with the film in `server/media/` (PROJECT.md 5.6), run the commands at the top. Expect to tune `--threshold` by eye on the contact sheets (there is no ground truth for a real film) and to spend about 30 to 45 minutes on candidates and review. Name characters the way a child would, and set each fact's reveal to the first frame where it is visible.

## Model and training gates

- **Candidate annotation models:** Nova 2 Lite through Bedrock is wired but unverified (image input, limits and cost were not checked against live docs here). Qwen3-VL is the local candidate behind the same slot when a GPU is available; check each model's licence on its model card. Every model output is a candidate for review, never truth.
- **Fine-tuning:** not opened. It would need a stable benchmark showing a repeated gap that better timelines, retrieval, prompts or routing cannot close, enough consented and reviewed data, a costed GPU plan, and the current model kept as the rollback. None of that exists yet.
