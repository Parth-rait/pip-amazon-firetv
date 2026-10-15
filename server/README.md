# Pip server

## What it is

One Node.js 22 process that connects the Pip Pads, the TV app and Amazon Bedrock. It serves the film list, the film files from `media/` and a Socket.IO endpoint typed with `src/shared/protocol.ts`. TypeScript runs directly with `tsx`; there is no build step.

- `src/core/`: Pip Core, reusable by any Pip product. Never imports from `src/film/`.
- `src/film/`: film night (film files, and later the Ask Pip prompt and the quiz).
- `content/`: one JSON file per film, checked at startup (PROJECT.md section 5.6).
- `media/`: the film files (gitignored). Convert the film with the commands in PROJECT.md section 5.6.

Dependencies and why: `express` (HTTP and static files with Range support), `socket.io` (realtime with reconnection), `zod` (validation), `dotenv` (reads `.env`), `qrcode` (the join QR code, used from Step 4), `@aws-sdk/client-bedrock-runtime` (Nova 2 Lite). Dev: `typescript`, `tsx`, `vitest`, `eslint` with `typescript-eslint`, `prettier`, `socket.io-client` (smoke scripts and tests).

## How to run

```bash
cp .env.example .env   # once
npm install
npm run dev            # http://localhost:8787, restarts on change
npm start              # same, without watching (demo)
npm run smoke:ai       # one real Nova call: prints the reply and latency (needs the AWS profile)
```

Quick checks while it runs:

```bash
curl -s localhost:8787/health
curl -s localhost:8787/api/films
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

| Variable           | Default                      | Meaning                                      |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `PORT`             | `8787`                       | HTTP port                                    |
| `PUBLIC_URL`       | `http://localhost:8787`      | Public base URL; written by `npm run tunnel` |
| `AWS_PROFILE`      | `pip`                        | AWS credentials profile                      |
| `AWS_REGION`       | `us-east-1`                  | Bedrock region                               |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-2-lite-v1:0` | Inference profile ID                         |
| `AI_ENABLED`       | `true`                       | `false` uses the fixed lines only            |
| `LOG_TEXT`         | `false`                      | `true` logs question text (development only) |
