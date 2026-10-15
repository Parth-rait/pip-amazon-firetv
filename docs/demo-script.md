# Demo script

The video, under 3 minutes (PROJECT.md section 16). Three people: Mom on the tablet (the host), Leo and Gran on their phones. Rehearse it three times in a row without a failure before recording the takes.

## Before every take

1. `npm run tunnel` (root), then `npm start` in `server/`, then `npm run preflight` (root). Every line must say PASS.
2. The TV app is open on the VVD or the Fire TV device and shows Pip asleep, the QR code and the code.
3. The tablet has the pad on its home screen, opened once from this tunnel's QR code. Phones start with no pad open.
4. `AI_ENABLED=true` and `LOG_TEXT=false` in `server/.env`.
5. Everyone filmed has agreed, and a parent has agreed for a child. Film hands and screens.

## Shots

| Time | What happens on screen | Exactly what each person does | Voice-over |
|---|---|---|---|
| 0:00 to 0:15 | A family on a sofa. The remote goes into a drawer. The TV shows Pip asleep, the QR code and the code. | Nothing. | "Pip turns Fire TV from a screen you control into an experience that responds to you. No remote, nothing to install, and no AI skills needed." |
| 0:15 to 0:35 | The names appear on the TV and Pip wakes up. | Mom scans first, so she is the host, and types "Mom". Leo scans and types "Leo". Gran scans and types "Gran". | "Everyone scans once and types a first name. The first one in is the host." |
| 0:35 to 1:05 | The film plays. Pip answers on the TV under "Leo asked". | Mom taps Big Buck Bunny, then Pause, Play and "+10 s". At the first scene time below, Leo taps the chip "Who is that?". When the next questions appear on his phone, he taps the first one. | "Anyone can ask Pip about the film. Pip only gets notes up to the moment you are watching, so it won't spoil what comes next, and it suggests what to ask next." |
| 1:05 to 1:25 | Gran's phone shows "Did you mean one of these?", then Pip answers. | At the second scene time below, Gran types "what was that" and taps Ask, then taps the first option. | "If a question is unclear, Pip offers clearer versions instead of guessing. You never need to know how to talk to an AI." |
| 1:25 to 2:05 | The end of the film, the quiz, the reveal, Pip cheering and the results. | Off camera, let the film play to the end; the TV says "The end. Ready for the quiz?". Mom taps "Start the quiz (5 ready)". Everyone answers each question on their own screen. Mom taps "Next question" after each reveal and "See results" after the last. | "Then the film becomes a game. Amazon Nova drafted the questions, and a person checked every one. Big, equal buttons and no buzzers, so a seven-year-old and a grandparent play as equals." |
| 2:05 to 2:30 | The architecture diagram from section 4.1, with two numbers from `docs/measurements.md`. | Nothing. | "A Vega OS app, a web pad on any phone, one small server, and Nova 2 Lite on Amazon Bedrock. Measured on this setup: answers in <median> seconds, and no spoilers in <n> probes." |
| 2:30 to 2:50 | The Pip Pad render, or the tablet in a minimal stand. | Nothing. | "Pip is the first of a product line: AI built into the screens people already have. Next come the real Pip Pad, Pip's voice and Alexa." |
| 2:50 to 2:55 | Pip on the TV. Title card. | Nothing. | "Pip for Fire TV." |

Fill in `<median>` and `<n>` from `docs/measurements.md` and never round them in Pip's favor. Use only Big Buck Bunny footage, credited, and our own shots.

## Scene times and questions

Taken from the notes in `server/content/big-buck-bunny.json`. Rehearse each question at its time: the answer must be right and must not mention anything later.

| Film time | Who | How | Question | What should happen |
|---|---|---|---|---|
| (from the notes: the big bunny is on screen) | Leo | Starter chip | Who is that? | Pip names the big bunny in one or two sentences, and 2 or 3 next questions appear on Leo's phone |
| Right after | Leo | First next chip | (whatever Pip suggested) | A second answer on the TV |
| (from the notes: something has just happened) | Gran | Typed | what was that | "Did you mean one of these?" with 2 or 3 options and "Something else"; her tap gets an answer |

## If something goes wrong during a take

| What you see | What to do |
|---|---|
| "I'm not sure right now. Ask me again in a moment." | Nova failed or took over 6 s. Ask again once; if it repeats, stop and run `npm run smoke:ai` in `server/`. |
| A "Reconnecting" pill | The tunnel or server dropped. Wait for "Online"; if it does not come back, restart the tunnel and the server and run preflight again. A new tunnel URL needs the TV app's `SERVER_URL` updated and the pads re-opened. |
| "TV offline" on the pads | The TV app closed. Open it again and scan the new code. |
| Pip answers with something that happens later | Stop. Check the note at that time in the film file; a note may describe something too early. |
