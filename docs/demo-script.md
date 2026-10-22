# Demo script

Under 3 minutes, on the local-first build (docs/vnext/PLAN.md section 0). Two people: Maya on a tablet (the host) and Leo on a phone. The TV is the browser TV at `/tv` on a laptop, or the Vega app on the VVD. Rehearse it three times in a row without a failure before recording.

## Before every take

1. `npm run tunnel` (root, keep it running), then `cd server && npm start`. With the Vega app: rebuild it if the tunnel URL changed (`tv/README.md`). Then `npm run preflight`: every line must say PASS.
2. `server/.env`: `AI_ENABLED=true`, `AI_PROVIDER=ollama`, `LOG_TEXT=false`. Warm the model once: `ollama run qwen2.5:3b "hi"` (the first answer after a cold start takes longer).
3. The TV shows the home screen with the QR code; nothing is half-watched (restart the server for a clean session).
4. Open `http://localhost:8787/hub` on the laptop in a second window, for the last shot.
5. Everyone filmed has agreed. Film hands and screens.

## Shots

| Time | On screen | What each person does | Voice-over |
|---|---|---|---|
| 0:00–0:15 | The TV home: Tears of Steel featured, the QR code. | Maya scans and joins; Leo scans and joins. Pip says hi on the TV. | "Pip is a film companion for Fire TV that knows the film only up to the second you've reached, and runs on your own machine." |
| 0:15–0:35 | Tears of Steel plays from 3:30. The pad's ring control. | Maya taps Tears of Steel, then uses ±10 s on the ring to land near 3:35. | "The Pip Pad replaces the remote. No model is involved in any of this, and the TV confirms every command." |
| 0:35–0:55 | At 3:40, Leo's phone: **Who is the old man?** Pip answers on the TV, labelled The film: a grey-haired old man in the church tower, and nothing more. At 3:46 the film itself reveals he is Thom. | Leo types **Who is the old man?** at about 3:40. | "Pip answers from what the film has shown, and nothing later. Six seconds before the film says who the old man is, Pip doesn't know either." |
| 0:55–1:35 | At about 4:10 Maya pauses on the ring and types **What if Thom had never left Celia?** Her tablet shows the story map: the film's solid lane up to 4:10, Pip's dotted Electric lane after it. The TV shows the comparison while paused. | Maya taps the centre of the ring (pause), then **What if…?**, edits the question, sends. Then **Continue this story**. | "This is Parallel Stories. Pip splits the film at the second you asked, and writes another version from there. Code decides what's real and what's made up. The model only writes." |
| 1:35–1:55 | Maya taps **Where did it split?** The answer names the split time, the film up to there, and "What the film does after that, you haven't seen yet." | Maya taps **Where did it split?** | "It always knows which lines are the film's and which are Pip's, and it never shows you the film's future, even inside a story." |
| 1:55–2:10 | Maya taps **Back to the film**; OK on the ring; the film plays on. Leo's phone was locked from 4:10 to 5:30; he unlocks it: "While you were away". | Maya taps **Back to the film** and play. Leo locks his phone at 4:10 and unlocks it at about 5:30. | "Back to the film is one tap. And if someone steps out, only their phone catches them up, while the room keeps watching." |
| 2:10–2:35 | The Command Center: Overview, then Library with "0/108 leaks". | Nothing (laptop window). | "Everything runs on this laptop: a local model, our own timelines, and a dashboard that only answers here. Measured: 0 spoiler leaks in 218 probes on two films, and the branch benchmark is in the repo." |
| 2:35–2:50 | The TV home, Pip in the corner. Title card. | Nothing. | "Pip. Know what's real, never what's next, and play with what could have been." |

## Lines to rehearse, and what must happen

| Film and time | Who | Ask | What must happen |
|---|---|---|---|
| Tears of Steel 3:40 | Leo | Who is the old man? | From the timeline, no model: "That's the old man. A grey-haired old man in the church tower…", with nothing about Thom or forty years. |
| Tears of Steel about 4:10, paused | Maya | What if Thom had never left Celia? | A story map with 3 to 5 made-up events, labelled "Pip's version"; the TV shows the comparison. If Pip says "That story got too close to what's coming", ask again (it's a fresh story each time). |
| Same branch | Maya | Continue this story | 2 or 3 more events, still labelled Pip's version, never "No spoilers". |
| Same branch | Maya | Where did it split? | "The stories split at 4:09 (or wherever she paused) … you haven't seen yet." |
| After Back to the film | Maya | What happens next? | "No spoilers from me." |

Use only Tears of Steel and Sintel footage (CC BY 3.0, credited) and our own shots. Every number in the voice-over must come from `docs/evaluation/results/`.

Verified in Chrome on 22 Oct with the local model at a 4:09 split: 5 events on creation, 3 more on Continue, the TV's comparison on pause with "After 4:09: you haven't seen this yet", the split answer, and "No spoilers from me" after Back to the film. A split before 6:33 near the giant robot, or before 3:56 about the old man, is more often withheld by the identity guard. That's the guard working, but it's slower on stage.
