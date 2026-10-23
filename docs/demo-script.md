# Demo script

Under 3 minutes, public on YouTube or Vimeo, in English. Two people: Maya on a tablet (the host) and Leo on a phone.

**A rule from the hackathon that shapes the video:** for the Fire TV track, the video must show the project running on a Fire TV device or the Fire TV or Vega simulator. So every TV shot comes from the **Vega app on the Vega Virtual Device** (or a Vega Fire TV). The browser TV client appears once, labelled as such, for the paused two-lane comparison it adds.

Only use footage from Tears of Steel and Sintel (Blender Foundation, CC BY 3.0, credit on screen at the end) and our own shots. Don't use music we don't have rights to.

## Before every take

1. `npm run tunnel` at the root, and keep it running. The tunnel URL changes every time, so rebuild and reinstall the Vega app after it (`tv/README.md`). Then `cd server && npm start`.
2. Run `npm run preflight` at the root. Every line must say PASS.
3. `server/.env` should have `AI_ENABLED=true`, `AI_PROVIDER=ollama` and `LOG_TEXT=false`. Warm the model once with `ollama run qwen2.5:3b "hi"`.
4. The Vega app is open on the VVD with the QR code showing, and nothing is half-watched (restart the server for a clean session).
5. Open `http://localhost:8787/hub` in a browser window for the last shot.
6. Everyone filmed has agreed. Film hands and screens.

## Shots

| Time | On screen | What each person does | Voice-over |
|---|---|---|---|
| 0:00 to 0:15 | The Vega app on the VVD: Pip, the QR code, the posters. | Maya scans and joins, then Leo. Pip says hi on the TV. | "Every movie night has the same three moments: who is that, what did I miss, and I'd have ended it differently. Pip is built for all three." |
| 0:15 to 0:35 | Tears of Steel plays on the VVD from about 3:30. Maya's tablet shows the ring control. | Maya picks Tears of Steel on her tablet, then uses the ring: pause, play, back 10. | "Maya's tablet is her Hail Mary pad. It's the remote now, and none of this touches a language model. The TV confirms every press." |
| 0:35 to 0:55 | At about 3:40, Pip's answer appears on the TV under "Leo asked: Who is the old man?". | Leo types **Who is the old man?** at about 3:40. | "Pip only knows the film up to this second. The film reveals who the old man is at 3:46, so Pip can't spoil it. It doesn't know yet either." |
| 0:55 to 1:35 | At about 4:10 the film is paused. Maya's tablet shows the story map: the film's solid lane up to the split, then Pip's dotted blue lane. The TV shows Pip's story in a small bubble labelled "Maya's what if, made up by Pip". | Maya pauses with the ring and types **What if Thom had never left Celia?**, then taps **Continue this story**. | "This is Parallel Stories. Pip splits the film at the second you asked and writes its own version from there. Code decides what's real and what's made up. The model only writes." |
| 1:35 to 1:50 | Cutaway, labelled "browser TV client": the same branch paused, both stories side by side, and "After 4:09: you haven't seen this yet." | Recorded on the laptop's `/tv` with the same session. | "Paused, you see both stories side by side. The film's side stops where you are. Even inside a made-up story, Pip doesn't show the film's future." |
| 1:50 to 2:05 | Maya taps **Where did it split?**, then **Back to the film**. The VVD plays on. Leo unlocks his phone and gets "While you were away". | Maya taps both buttons, then OK on the ring. Leo locked his phone at about 4:10 and unlocks it at about 5:30. | "Back to the film is one tap. And if someone steps out, only their phone catches them up while the room keeps watching." |
| 2:05 to 2:35 | The Command Center: Overview, then Library showing "0/108 leaks". | Nothing (laptop window). | "All of it runs on this laptop: a 3B model, our own timelines, nothing in the cloud. We tested it hard: no spoilers in 218 questions on two films. And we publish every story that slipped, because we read them all." |
| 2:35 to 2:50 | The VVD home screen, Pip in the corner, then a title card with the film credits. | Nothing. | "Pip. It knows what's real, never tells you what's next, and lets you play with what could have been." |

## Lines to rehearse, and what must happen

| Film and time | Who | Ask | What must happen |
|---|---|---|---|
| Tears of Steel 3:40 | Leo | Who is the old man? | Straight from the timeline, with no model: "That's the old man. A grey-haired old man in the church tower…", and nothing about Thom or forty years. |
| Tears of Steel about 4:10, paused | Maya | What if Thom had never left Celia? | A story map with 3 to 5 made-up events, labelled "Pip's version". If Pip says "That story got too close to what's coming", ask again; each try is a fresh story. |
| Same branch | Maya | Continue this story | 2 or 3 more events, still labelled Pip's version. Never "No spoilers". |
| Same branch | Maya | Where did it split? | "The stories split at 4:09 (or wherever she paused) … you haven't seen yet." |
| After Back to the film | Maya | What happens next? | "No spoilers from me." |

Verified in Chrome on 22 Oct with the local model at a 4:09 split: 5 events on creation and 3 more on Continue, the comparison on pause with "After 4:09: you haven't seen this yet", the split answer, and "No spoilers from me" after Back to the film. **Not yet verified on the VVD with this build:** do one full rehearsal there before recording. A split shortly before 6:33 (the giant robot) or before 3:56 (the old man) is more often refused by the twist guard. That's the guard doing its job, but it's slower on stage.

Every number in the voice-over comes from `docs/evaluation/results/`.
