Read PROJECT.md before any task. It is the source of truth for scope, architecture, contracts, standards and build order, and it overrides general guidance where they differ.

# Pip for Fire TV: agent notes

Hackathon project (Amazon Developer Hackathon, Fire TV track). Deadline: Fri Oct 23 2026, 12:00 PDT; target submit Thu Oct 22.

## Where things are

| Path | What | Status |
|---|---|---|
| `PROJECT.md` | Plan, architecture, contracts, standards, step-by-step build prompts (section 13) | Done |
| `shared/protocol.ts` | The only definition of socket events and payloads | Done (verbatim from PROJECT.md 7.1) |
| `scripts/sync-shared.mjs` | Copies the contract into `server/src/shared`, `pad/src/shared`, `tv/src/shared` | Done |
| `scripts/run-all.mjs` | Runs `typecheck`, `lint` or `test` in each package that has a `package.json` | Done |
| `scripts/tunnel.mjs` | Cloudflare quick tunnel; writes `PUBLIC_URL` and `SERVER_URL` | Done (used from Step 3) |
| `server/` | Node 22 + Express 5 + Socket.IO 4.8 + Bedrock. `src/core/` = Pip Core, `src/film/` = film night | Step 2 done in code: config, log, film files, /health, /api/films, /media, model wrapper, smoke:ai |
| `server/.env` | Local config (gitignored), copied from `server/.env.example` | Done |
| `pad/` | React + Vite web app (the Pip Pad) | Not created on purpose: Step 5 runs `npm create vite@latest pad` |
| `tv/` | Vega OS app (React Native for Vega) | Not created on purpose: Step 3 runs `vega project generate ... --outputDir tv` |
| `docs/` | Friction log, product feedback; later measurements, demo script, devpost | Templates done |
| `.claude/skills/ship-step/` | Definition-of-done and commit routine | Done; `run-pip` comes in Step 6 |

`pad/` and `tv/` must not be created by hand: their generators expect an empty or missing folder, and `sync-shared` would otherwise write into them early.

## Progress

- Step 0 (Parth): Mac setup and the film. Open.
- Step 1: root skeleton, contract, docs templates, ship-step skill. Done, except the ADBT `init-context` run (Parth runs it; re-check this file afterwards, since it may rewrite CLAUDE.md) and the first commit.
- Step 2: server skeleton, film file, first Nova call. Code and tests done in the cloud. Open for Parth on the Mac: convert the film into `server/media/` (PROJECT.md 5.6), set `durationSec` from ffprobe, run `npm run smoke:ai`.
- Next: Step 4 (sessions, players and the host). Step 3 (TV spike) is Mac-only.

Update this list when a step is committed.

## Commands (repo root)

```bash
npm run sync:shared    # copy shared/protocol.ts into each package
npm run check:shared   # fail if a copy is stale
npm run typecheck      # in server/ and pad/
npm run lint
npm test
npm run tunnel         # Step 3 onward
```

## Rules that bite

- Node 22 only (`.nvmrc`). ADBT fails on Node 26.
- Edit `shared/protocol.ts`, never the generated copies; then `npm run sync:shared` and update `server/src/validate.ts` in the same commit.
- `server/src/core/` never imports from `server/src/film/`; a test enforces it.
- Every socket handler validates with zod and checks the ack is a function; one throw stops the server.
- Logs never contain player names or question text (unless `LOG_TEXT=true`).
- Verify Vega, AWS and package APIs with the ADBT MCP, the AWS MCP or installed types before using them; say "unverified" otherwise.
- One step at a time, Conventional Commits, never commit `.env`, keys, the film or build output.
