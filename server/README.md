# Pip server

## What it is

One Node.js 22 process that connects the Pip Pads, the TV app and Amazon Bedrock. It holds the sessions (a TV, its code, the players and the host) in memory, relays the host's commands to the TV, draws the join QR codes, and serves the film list and the film files from `media/`. Socket.IO events are typed with `src/shared/protocol.ts`. TypeScript runs directly with `tsx`; there is no build step.

- `src/core/`: Pip Core, reusable by any Pip product. Never imports from `src/film/` (a test enforces it).
  - `context/`: timelines, the spoiler boundary, retrieval, the answer gate, the answer cache.
  - `intent/`: text routing (commands never reach a model) and the optional typed judge interface.
  - `actions/`, `input/`, `events/`: tracked commands, device input adapters and dedupe, the session journal.
  - `ai/`: the `TextModel` interface (Bedrock and fake), reply parsing and cleaning, `runAsk`.
- `src/film/`: film night: film files, timeline files, the playback estimate, the Ask Pip prompt.
- `src/answer.ts`: boundary, retrieval, model and gate for one question. `src/assist-flow.ts`: asking and dismissing Pip. `src/playback-flow.ts`: commands and device inputs.
- `src/realtime.ts`: thin socket handlers; `src/flow.ts`: stage changes; `src/view.ts`: the snapshot; `src/validate.ts`: zod schemas; `src/server.ts`: the composition shared by `index.ts` and the lab.
- `src/lab/`: the Virtual Pip Lab (fake TV, fake pads, fake models, scenarios). `src/pipeline/`, `scripts/pipeline.ts`: the video data pipeline. `src/eval/`, `scripts/eval.ts`: the benchmark.
- `content/`: one JSON file per film, checked at startup (PROJECT.md section 5.6); `content/timelines/`: reviewed timelines. `lab/content/`: the lab film, loaded with `LAB_CONTENT=true`.
- `pipeline/`: annotations, reviews and ground truth (committed). `data/`: pipeline work files (gitignored). `evals/`: datasets and golden probes.
- `media/`: the film files (gitignored). Convert the film with the commands in PROJECT.md section 5.6; `npm run lab:film` makes the lab film.

Dependencies and why: `express` (HTTP and static files with Range support), `socket.io` (realtime with reconnection), `zod` (validation), `dotenv` (reads `.env`), `qrcode` (the join QR code), `@aws-sdk/client-bedrock-runtime` (Nova 2 Lite). Dev: `typescript`, `tsx`, `vitest`, `eslint` with `typescript-eslint`, `prettier`, `socket.io-client` (smoke scripts, the lab and tests). No new dependencies in vNext; the pipeline uses ffmpeg and ffprobe as programs, and the optional TypeSafe SDK is loaded at runtime only.

## How to run

```bash
cp .env.example .env   # once
npm install
npm run dev            # http://localhost:8787, restarts on change
npm start              # same, without watching (demo)
npm run fake:tv        # acts like a TV: prints the code and pad URL, logs views and commands
npm run smoke:join     # with the server running: a fake TV and two pads join; prints JOIN OK
npm run smoke:ai       # one real Nova call: prints the reply and latency (needs the AWS profile)
npm run lab:film       # renders the lab film (The Lantern Fox) into media/
LAB_CONTENT=true npm start   # adds the lab film and its timeline to the films
npm run pipeline -- <stage> <asset>   # the video data pipeline (docs/architecture/video-data-pipeline.md)
```

Quick checks while it runs:

```bash
curl -s localhost:8787/health
curl -s localhost:8787/api/films
curl -s -o qr.png localhost:8787/qr/<code>   # PNG for a live session's code, 404 otherwise
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' -H 'Range: bytes=0-99' localhost:8787/media/big-buck-bunny.mp4
```

## How to test

```bash
npm test          # vitest; never calls AWS (uses fake models); includes the lab scenarios
npm run lab       # the Virtual Pip Lab scenarios on their own, verbose
npm run eval      # the benchmark; writes docs/evaluation/results/
npm run typecheck
npm run lint
npm run format
```

## Environment

`.env` (gitignored), copied from `.env.example`. Parsed by `src/config.ts`; the server exits with one message if a value is invalid.

| Variable           | Default                      | Meaning                                      |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `PORT`             | `8787`                       | HTTP port                                    |
| `PUBLIC_URL`       | `http://localhost:8787`      | Public base URL; written by `npm run tunnel` |
| `AWS_PROFILE`      | `pip`                        | AWS credentials profile                      |
| `AWS_REGION`       | `us-east-1`                  | Bedrock region                               |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-2-lite-v1:0` | Inference profile ID                         |
| `AI_ENABLED`       | `true`                       | `false` uses the fixed lines only            |
| `LOG_TEXT`         | `false`                      | `true` logs question text (development only) |
| `TIMELINE_REVIEW`  | `accepted`                   | `candidate` also uses unreviewed facts (development only) |
| `QUIZ_ENABLED`     | `false`                      | The opt-in quiz mode (not built yet)         |
| `INTENT_JUDGE`     | `rules`                      | `typesafe` adds a typed judge for unclear text (needs `TYPESAFE_API_KEY` and the SDK) |
| `LAB_CONTENT`      | `false`                      | `true` adds the lab film from `lab/content/` |
