# vNext Phase 0: audit and baseline (16 Oct 2026)

Rollback point: tag `pre-vnext` on branch `mac/film-and-tv` (commit `1a6c584`), working tree clean, 20 commits ahead of `main`, nothing pushed.

## Baseline checks (run on the Mac, Node 22.23.3)

| Check | Result |
|---|---|
| `npm run check:shared` | pass (contract v4 copied into server, pad, tv) |
| `npm run typecheck`, `npm run lint` | pass in server, pad and tv (tv: 4 notices about system-distributed Vega libraries) |
| `npm test` | server 158, pad 20, tv 10, all passing |
| `npm run preflight` | all PASS, with the note that Pip is on the local model (`AI_PROVIDER=ollama`, qwen2.5:3b) |
| TV happy path on the Vega Virtual Device | QR join, film playback, host controls, quiz, results, reconnection all worked with scripted players today |

## What exists

- **Protocol** (`shared/protocol.ts`, v4). Client to server: `sys:ping`, `tv:hello`, `tv:playback`, `tv:watch`, `pad:join`, `pad:host`, `pad:ask`, `pad:answer`, `pad:react`, `pad:predict`. Server to client: `session:view`, `tv:command`, `pip:say`, `pip:hello`, `pip:react`. The server owns the session and sends a whole view after each change; the TV gets a slim view.
- **Model calls.** One per Ask Pip question (`runAsk`, Bedrock Nova 2 Lite or the local Ollama model, 6 s timeout), one warm-up call at start with the local model, and offline `draft:quiz`. Answers are not routed: every question, including "what just happened", goes to the model unless the answer memory has an exact repeat.
- **Persistence.** Sessions are in memory. The answer memory is one JSON file (`server/data/answer-memory.json`), set aside today because it was keyed to wrong times. There is no event journal, no user memory and no dataset.
- **Content.** Per film: premise, timed notes, quiz, chapters, character facts and predictions in `server/content/<id>.json`. All of it was drafted by the coding agent from contact sheets of frames and subtitles; none of it has been reviewed by a person; its times were found 6 s early today and corrected. It is candidate content, not evidence.
- **TV app (Vega).** W3C Media URL-mode playback through the tunnel, lobby with QR, the watch screen with Pip, quiz and results screens, reactions and the prediction panel. Learned today: the TV's WebSocket on Vega dropped every ~5 s once views reached ~5 KB (fixed with a slim TV view); the app must release its player in the background (done with AppState).
- **Pip Pad.** Join, lobby with posters and "Make Pip yours", watch with remote-style host controls, a chat-style Ask Pip, three tabs (Pip, Story, Who's who), reactions, predictions, quiz with confetti, results with stars.

## Inventory

| Feature | Verdict | Why |
|---|---|---|
| Pairing by QR and code, sessions, host hand-over, reconnection, slim TV view, background handling | Keep | Proven on the VVD today |
| TV playback (W3C Media, URL mode), host play/pause/seek | Keep | Proven; becomes the deterministic action path |
| Validation, rate limits, logging without names | Keep | Standards in PROJECT.md 10 |
| Model adapter (Bedrock or Ollama) and the timeout/fallback | Keep, behind the router | Reliable interface; the model is called far too often |
| Answer memory | Keep as a versioned cache | Must record which content version it was built from |
| Ask Pip as a chat for every question | Change | Phase 4: retrieval first, a model only when needed |
| Quiz, confetti and stars | Opt-in only (kids mode) | An interruption in the default viewing path |
| Predictions ("What happens next?") and floating reactions | Opt-in only (kids mode) | Unsolicited overlays |
| Story and Who's who tabs | Change | Become answers inside the Pip sheet ("Catch me up", "Who is that?") from time-bounded retrieval |
| Pip's mood selector, mood faces, sassy/playful lines | Remove | One consistent, quiet Pip (plan 3.1); "mood" becomes the viewer's intent for recommendations |
| Avatar shapes and colors | Simplify | Keep a name and one color for identity; no costumes |
| Greeting bubbles on the TV | Keep in the lobby only | Never during the film |
| Big Buck Bunny | Remove | Parth's call: a shorter film now, a longer one later |
| Sintel | Keep as the longer film, later | Has a reveal to test spoiler safety once the pipeline passes |
| Hand-drafted notes and companion text | Broken as evidence | Agent-drafted, unreviewed, times already wrong once; replace with scene records that carry evidence and review status |
| Local 3B model | Keep for rehearsal only | Makes up small facts; the demo uses Nova once AWS is verified |
| Event journal, user memory, datasets, recommendation, voice commands, volume/brightness, input contract, touch simulator | Missing | Phases 2 to 7 |

## Unknowns

- AWS account verification (blocks Nova).
- "JEV": not identified; possibly V-JEPA (Meta's video model) or an annotation tool. The annotation interface stays pluggable.
- Whether Vega lets an app change the TV's system volume or brightness. Known: the app can set its own player volume and dim its own picture; system-level control and real lights need a platform API or a connected service (to verify through ADBT).
- todbot touchpads hardware: no board or parts on hand; Phase 5 ships the contract and a simulator.
