# Pip server

## What it is

One Node.js 22 process that connects the Pip Pads, the TV app and Amazon Bedrock. It holds the sessions (a TV, its code, the players and the host) in memory, relays the host's commands to the TV, draws the join QR codes, and serves the film list and the film files from `media/`. Socket.IO events are typed with `src/shared/protocol.ts`. TypeScript runs directly with `tsx`; there is no build step.

- `src/core/`: Pip Core, reusable by any Pip product. Never imports from `src/film/`.
- `src/film/`: film night (film files, the playback estimate, the Ask Pip prompt, and later the quiz).
- `src/core/ai/`: the model wrapper and the guidance loop (`runAsk`, `parseReply`, `cleanText`), reusable by any Pip product.
- `src/realtime.ts`: thin socket handlers; `src/flow.ts`: stage changes; `src/view.ts`: the snapshot; `src/validate.ts`: zod schemas for every incoming payload.
- `content/`: one JSON file per film, checked at startup (PROJECT.md section 5.6).
- `media/`: the film files (gitignored). Convert the film with the commands in PROJECT.md section 5.6.

Dependencies and why: `express` (HTTP and static files with Range support), `socket.io` (realtime with reconnection), `zod` (validation), `dotenv` (reads `.env`), `qrcode` (the join QR code, used from Step 4), `@aws-sdk/client-bedrock-runtime` (Nova 2 Lite). Dev: `typescript`, `tsx`, `vitest`, `eslint` with `typescript-eslint`, `prettier`, `socket.io-client` (smoke scripts and tests).

## How to run

```bash
cp .env.example .env   # once
npm install
npm run dev            # http://localhost:8787, restarts on change
npm start              # same, without watching (demo)
npm run fake:tv        # acts like a TV: prints the code and pad URL, logs views and commands
npm run smoke:join     # with the server running: a fake TV and two pads join; prints JOIN OK
npm run smoke:quiz     # with the server running and a film with quiz questions: plays a whole quiz; prints QUIZ OK
npm run sim:touch -- evening ABCD   # replays sim/traces/evening.json as touch-button and touchwheel inputs into session ABCD
npm run sim:touch -- wheel-seek --dry   # prints the inputs a trace makes, without a server
npm run gesture -- ABCD --preview   # webcam hand gestures into session ABCD (setup: gesture/README.md; join "Gestures" first so it is the host)
npm run gesture -- --replay evening --dry   # a recorded trace of hand poses through the gesture pipeline; prints the inputs
npm run lab            # Virtual Pip Lab: real-socket scenarios with injected faults (the gesture scenario needs gesture/.venv)
npm run eval -- --ollama   # benchmark on the lab film, plus the local model (free)
npm run pipeline -- asr sintel   # whisper.cpp dialogue with timestamps (setup: ../video/setup.sh)
npm run pipeline -- understand sintel --known Sintel   # local vision model over the frames: characters, actions, names from dialogue (docs/extractions/video-understanding.md)
npm run pipeline -- understand sintel --replay   # rebuild the candidates from the committed run, without the model
npm run smoke:ai       # one real Nova call: prints the reply and latency (needs the AWS profile)
npm run draft:quiz -- big-buck-bunny   # Nova drafts 5 quiz questions into content/drafts/ for review
npm run eval:ask       # runs the probes in evals/<film>.json against Nova; flags LEAK? and CHECK
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
npm test          # vitest; never calls AWS (uses the fake model)
npm run typecheck
npm run lint
npm run format
```

## Environment

`.env` (gitignored), copied from `.env.example`. Parsed by `src/config.ts`; the server exits with one message if a value is invalid.

| Variable           | Default                                             | Meaning                                                                                        |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `PORT`             | `8787`                                              | HTTP port                                                                                      |
| `PUBLIC_URL`       | `http://localhost:8787`                             | Public base URL; written by `npm run tunnel`                                                   |
| `AWS_PROFILE`      | `pip`                                               | AWS credentials profile                                                                        |
| `AWS_REGION`       | `us-east-1`                                         | Bedrock region                                                                                 |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-2-lite-v1:0`                        | Inference profile ID                                                                           |
| `AI_ENABLED`       | `true`                                              | `false` uses the fixed lines only                                                              |
| `LOG_TEXT`         | `false`                                             | `true` logs question text (development only)                                                   |
| `JOURNAL`          | `true`                                              | Writes events to `data/events/` (gitignored), with pseudonymous ids                            |
| `TIMELINE_REVIEW`  | `accepted`                                          | `candidate` also answers from unreviewed facts (Sintel's generated timeline is all candidates) |
| `WHISPER_CLI`      | `../video/.tools/whisper.cpp/build/bin/whisper-cli` | Pipeline only: the speech recognizer built by `video/setup.sh`                                 |
| `WHISPER_MODEL`    | `../video/models/ggml-small.en.bin`                 | Pipeline only: its model                                                                       |
