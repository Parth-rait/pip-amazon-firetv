# Demo script

The video, under 3 minutes (PROJECT.md section 16, with the additions agreed on October 16 in section 2.4). Three people: Mom on the tablet (the host), Leo and Gran on their phones. Rehearse it three times in a row without a failure before recording the takes.

## Before every take

1. `npm run tunnel` (root), then `npm start` in `server/`. If the tunnel URL changed, rebuild and reinstall the TV app (`tv/README.md`). Then `npm run preflight` (root): every line must say PASS, including "The TV app uses this tunnel URL".
2. `AI_ENABLED=true`, `AI_PROVIDER=bedrock` and `LOG_TEXT=false` in `server/.env`. Preflight prints a NOTE when Pip is on the local model: fine for rehearsals, not for takes.
3. The TV app is open on the VVD or the Fire TV device and shows Pip asleep, the QR code, the code and the two film posters.
4. The tablet has the pad on its home screen, opened once from this tunnel's QR code. Phones start with no pad open.
5. Pip's mood is back to Playful and its color to mint (a new TV session starts that way).
6. Everyone filmed has agreed, and a parent has agreed for a child. Film hands and screens.

## Shots

| Time | What happens on screen | Exactly what each person does | Voice-over |
|---|---|---|---|
| 0:00 to 0:12 | A family on a sofa. The remote goes into a drawer. The TV shows Pip asleep, the QR code and the films. | Nothing. | "Pip turns Fire TV from a screen you control into an experience that responds to you. No remote, nothing to install, and no AI skills needed." |
| 0:12 to 0:40 | Mom's name appears and Pip wakes up. On her tablet she opens "Make Pip yours" and taps Sassy. Leo and Gran join; Pip greets each of them by name on the TV, in its sassy voice. | Mom scans first, types "Mom", picks a color and taps Join; she is the host. She taps "Make Pip yours", then Sassy, then Done. Leo scans and joins; then Gran. | "Everyone scans once and types a first name. The first one in is the host, and the host can make Pip theirs: calm, playful or sassy." |
| 0:40 to 1:05 | Big Buck Bunny plays. Pip answers on the TV under "Leo asked". | Mom taps the Big Buck Bunny poster, then Pause, Play and the forward button. At 0:54 in the film Leo taps the chip "Who is that?"; when the next questions appear on his phone, he taps the first one. | "Anyone can ask Pip about the film. Pip only reads notes up to the moment you are watching, and it suggests what to ask next." |
| 1:05 to 1:20 | Gran's phone shows Pip's "Did you mean" line with options, then Pip answers. | At 2:50 in the film Gran types "what was that" and taps send, then taps the first option. | "If a question is unclear, Pip offers clearer versions instead of guessing. You never need to know how to talk to an AI." |
| 1:20 to 1:35 | Cutaway: Sintel at 8:20, the dragon's cave. Leo asks "Is the big dragon Scales?" and Pip will not say. The Sintel credit line is on screen. | Recorded separately: the host picks Sintel and skips to 8:20; Leo types the question. | "Even when a film has a twist, Pip never spoils it." |
| 1:35 to 2:10 | The end of Big Buck Bunny, the quiz, the reveal with everyone's picks, Pip cheering and the results. | Off camera, let the film play to the end; the TV says "The end. Ready for the quiz?". Mom taps "Start the quiz (5 ready)". Everyone answers on their own screen. Mom taps "Next question" after each reveal and "See results" after the last. | "Then the film becomes a game. The questions were written ahead and checked by a person. Big, equal buttons and no buzzers, so a seven-year-old and a grandparent play as equals." |
| 2:10 to 2:35 | The architecture diagram from section 4.1, with two numbers from `docs/measurements.md`. | Nothing. | "A Vega OS app, a web pad on any phone, one small server, and Nova 2 Lite on Amazon Bedrock. Measured on this setup: answers in <median> seconds, and no spoilers in <n> probes." |
| 2:35 to 2:52 | The Pip Pad render, or the tablet in a minimal stand. | Nothing. | "Pip is the first of a product line: AI built into the screens people already have. Next come the real Pip Pad, Pip's voice and Alexa." |
| 2:52 to 2:57 | Pip on the TV. Title card. | Nothing. | "Pip for Fire TV." |

Fill in `<median>` and `<n>` from the demo-setup tables in `docs/measurements.md` (not the local-model baseline) and never round them in Pip's favor. The quiz line says how the questions were really made: today the agent drafted them from the film and Parth checks them. Say "Amazon Nova drafted the questions, and a person checked every one" only if the quizzes in the takes come from `npm run draft:quiz` with Nova. Use only Big Buck Bunny and Sintel footage, credited, and our own shots.

## Scene times and questions

Taken from the notes in `server/content/`. Rehearse each question at its time: the answer must be right and must not mention anything later.

| Film and time | Who | How | Question | What should happen |
|---|---|---|---|---|
| Big Buck Bunny 0:54 (he stretches in the sunshine) | Leo | Starter chip | Who is that? | Pip names the big bunny, Big Buck Bunny, in one or two sentences; 2 or 3 next questions appear on Leo's phone |
| Right after | Leo | First next chip | (whatever Pip suggested) | A second answer on the TV, still about what has been seen |
| Big Buck Bunny 2:50 (fruit hits the bunny on the head) | Gran | Typed | what was that | Pip's "Did you mean" line with 2 or 3 options and "Something else"; her tap gets an answer. Needs Nova: the local model never asks "Did you mean" |
| Sintel 8:20 (the cave, before the fight) | Leo | Typed | Is the big dragon Scales? | Pip does not say yes, and mentions no scar, no growing up and nothing after 8:20 |

## If something goes wrong during a take

| What you see | What to do |
|---|---|
| Pip's "my thoughts got tangled" or "brain freeze" line | Nova failed or took over 6 s. Ask again once; the answer memory may answer a repeated question at once. If it repeats, stop and run `npm run smoke:ai` in `server/`. |
| A "Reconnecting" pill on the pads or the TV | The tunnel or server dropped. Wait for the pill to go; if it does not, restart the tunnel and the server, rebuild the TV app if the URL changed, and run preflight again. |
| "TV offline" on the pads | The TV app closed (or Home was pressed). Open it again and scan the new code. |
| Pip answers with something that happens later | Stop. Check the note at that time in the film file; a note may describe something too early. |
| Pip says something slightly wrong but harmless | Check `AI_PROVIDER`: the local model makes up small facts; the takes use Nova. |
