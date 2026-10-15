# Devpost text (draft)

Draft for Step 12. Parth edits it before pasting into Devpost. Parts marked "after" wait for the TV app, the measurements or the usability test; never fill them with numbers we did not measure.

## Tagline

AI the whole family can use on Fire TV: no remote, no spoilers, no AI skills needed.

## Inspiration

Most AI lives in a chat window and works best for people who already know how to prompt it. We wanted AI in the hands of people who never would: a seven-year-old who asks "who is that?" in the middle of a film, or a grandparent who finds the remote hard to use. The TV is the one screen almost every home shares, yet watching together is still passive, and only one person holds the remote. Pip starts a product line of everyday AI built into the screens people already have, and Fire TV is product one.

## What it does

The TV shows Pip, a small mint mascot, with a QR code. Everyone scans it with their own phone and types a first name; the first one in is the host, who uses the Pip Pad, a tablet that replaces the remote with big Play, Pause and skip buttons. While the film plays, anyone can tap a suggested question, type or speak, and Pip answers on the TV with their name. Pip only knows the film up to the moment you are watching, so it never spoils what comes next, and every answer comes with two or three next questions to tap. A vague question gets "Did you mean" options instead of a guess, so nobody needs to know how to talk to an AI. At the end, the film becomes a game: a five-question quiz everyone answers on their own screen, with equal buttons and no buzzers, then the scores and a family total.

## How we built it

- **TV:** a Vega OS app in React Native for Vega. It plays the film with the W3C Media API from our own server, and draws the lobby, the answers, the quiz and the results. (After: the TV details from Steps 3 and 6.)
- **Pip Pad:** one React and Vite web app on every phone and the tablet, with no install. Voice input uses the browser's speech recognition.
- **Server:** one Node.js 22 process with Express and Socket.IO. It owns the session, the host, the quiz and the scores, and sends every screen the whole session after every change, so a screen that reconnects simply catches up.
- **AI:** Amazon Bedrock with Nova 2 Lite through the Converse API. One call per question returns the answer and the next questions, or "Did you mean" options, in a fixed format the server checks. The prompt holds only the notes up to the current position. Before the demo, Nova drafts the quiz from the notes and a person checks every question.
- **A reusable core:** joining, the host, Pip's states and the guidance loop live in `server/src/core/`, apart from everything film-specific, so the next Pip product starts from them. A test enforces the split.
- **Quality:** one shared contract file for every event, zod validation on every message, unit tests for every rule, smoke scripts over real sockets, spoiler and unknown-fact probes against Nova, and a preflight script that checks the whole demo setup.

## Challenges we ran into

- The public sample video links that many tutorials use stopped working, so we serve our own copy of the film through the same HTTPS tunnel as everything else.
- Keeping the AI spoiler-free: the model only ever sees notes up to the current position, and we probe it with questions about later scenes.
- A family on one home network shares one address, so the retry timing for reconnecting phones had to stay under our own join limit.
- A host double-tapping "Next" could skip a question; every quiz command now carries the question and phase it was tapped on, and the pad waits a moment before enabling the next tap.
- The Vega tools need Node 22, and the Mac's newest Node broke them. (After: add the TV app's challenges and link the friction log.)

## Accomplishments that we're proud of

- The whole family journey, from scanning to the results, with any number of phones in sync. (After: confirm on the real setup.)
- Every failure we could think of, from a server restart mid-film to everyone leaving mid-quiz, recovers by itself, and we walked through each one.
- Guidance that makes AI usable without AI skills: suggested next questions and "Did you mean" options from the same single model call.

## What we learned

(After: written by Parth at the end of the build.)

## What's next for Pip

Pip's voice with Amazon Polly, voice questions through Transcribe or Nova 2 Sonic, and an Alexa skill ("Alexa, ask Pip who that is"); film notes drafted by Nova video understanding; notes for real catalog content; then the real Pip Pad, a Kindle-sized glass pad with a microphone, haptics and a charging stand, and the same core on the other shared screens in a home.

## Measurements and the usability test

(After: from `docs/measurements.md`, with their limits stated. With 3 to 5 people, the usability test is a signal, not proof.)

## Pre-existing project statement

Pip for Fire TV is a new project, started on October 15, 2026 for this hackathon. (After: list any reused sample code, for example from `AmazonAppDev/vega-video-sample` under MIT-0, if we use it.)

## Product feedback

(After: a summary of `docs/feedback.md`, one paragraph per Amazon tool.)

## Built with

Vega OS, React Native for Vega, W3C Media API, Amazon Bedrock, Amazon Nova 2 Lite, Node.js, Express, Socket.IO, React, Vite, TypeScript, zod, Vitest, Cloudflare Tunnel

## Credits

Big Buck Bunny, (c) copyright 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0.
