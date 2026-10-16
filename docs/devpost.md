# Devpost text (draft)

Draft for Step 12. Parth edits it before pasting into Devpost. Parts marked "after" wait for the TV app, the measurements or the usability test; never fill them with numbers we did not measure.

## Tagline

AI the whole family can use on Fire TV: no remote, no spoilers (even with a twist ending), no AI skills needed.

## Inspiration

Most AI lives in a chat window and works best for people who already know how to prompt it. We wanted AI in the hands of people who never would: a seven-year-old who asks "who is that?" in the middle of a film, or a grandparent who finds the remote hard to use. The TV is the one screen almost every home shares, yet watching together is still passive, and only one person holds the remote. Pip starts a product line of everyday AI built into the screens people already have, and Fire TV is product one.

## What it does

The TV shows Pip, a small round mascot, with a QR code. Everyone scans it with their own phone, types a first name and picks a color; the first one in is the host, who uses the Pip Pad, a tablet that replaces the remote. The host can make Pip theirs: a Chill, Playful or Sassy mood that changes how Pip talks, and a color that follows on the TV and every phone. Pip greets each person by name as they arrive. The host picks Big Buck Bunny or Sintel from the posters and gets a remote-style Play, Pause and skip control. While the film plays, anyone can tap a suggested question, type or speak, and Pip answers on the TV with their name. Pip only knows the film up to the moment you are watching, so it never spoils what comes next, not even Sintel's twist, and every answer comes with two or three next questions to tap. A vague question gets "Did you mean" options instead of a guess, so nobody needs to know how to talk to an AI. At the end, the film becomes a game: a five-question quiz everyone answers on their own screen, with equal buttons and no buzzers, then the scores and a family total.

## How we built it

- **TV:** a Vega OS app in React Native for Vega (RN 0.83). It plays the films with the W3C Media API in MP4 URL mode from our own server, through the same HTTPS tunnel as everything else; the remote's play and pause work through Vega Media Controls with no extra code. It draws the lobby with the QR code and posters, Pip's answers in a speech bubble over the film, the quiz with a 2 x 2 grid and a countdown bar, the reveal with everyone's picks, and the results. Pip's five states are native-driven animations. Remote focus uses Vega's `FocusManager`.
- **Pip Pad:** one React and Vite web app on every phone and the tablet, with no install. Minimal by default: the watch screen is a chat with Pip, the question bar sits at the bottom, and status appears only when something is wrong. "Make Pip yours" is one tap away. Voice input uses the browser's speech recognition.
- **Server:** one Node.js 22 process with Express and Socket.IO. It owns the session, the host, the quiz and the scores, and sends every screen the whole session after every change, so a screen that reconnects simply catches up.
- **AI:** Amazon Bedrock with Nova 2 Lite through the Converse API. One call per question returns the answer and the next questions, or "Did you mean" options, in a fixed format the server checks. The prompt holds only the notes up to the current position, and Pip's mood changes only its persona, never the rules. An answer memory keeps good answers per film and scene: repeats are instant, and when the model fails Pip answers from a scene already watched, never a later one. While our AWS account was being verified, the same code ran on a free local model (Ollama), so the build never waited. (After: say how the quizzes in the demo were drafted: by Nova with `draft:quiz`, or by hand, and checked by a person.)
- **Film notes:** timed notes for both films, written by reading a frame every 6 seconds and the subtitles, then checked by watching.
- **A reusable core:** joining, the host, Pip's states and the guidance loop live in `server/src/core/`, apart from everything film-specific, so the next Pip product starts from them. A test enforces the split.
- **Quality:** one shared contract file for every event, zod validation on every message, unit tests for every rule, smoke scripts over real sockets, spoiler and unknown-fact probes against Nova, and a preflight script that checks the whole demo setup.

## Challenges we ran into

- The public sample video links that many tutorials use stopped working, so we serve our own copy of the film through the same HTTPS tunnel as everything else.
- Keeping the AI spoiler-free: the model only ever sees notes up to the current position, and we probe it with questions about later scenes.
- A family on one home network shares one address, so the retry timing for reconnecting phones had to stay under our own join limit.
- A host double-tapping "Next" could skip a question; every quiz command now carries the question and phase it was tapped on, and the pad waits a moment before enabling the next tap.
- The Vega tools need Node 22, and the Mac's newest Node broke them.
- Our first TV screen rendered at twice the size: React Native 0.83 on Vega lays out on a 960 x 540 dp canvas, and our design was in 1080p pixels. Every TV size now goes through one `dp()` helper.
- Remote focus landed on the wrong film card until we focused the first one with `FocusManager` after the cards loaded.
- A formatter wrapped one line of the TV config, which silently stopped our tunnel script from updating the TV's server URL. The preflight check now compares the TV's URL with the tunnel's before every rehearsal.
- Our AWS account was still being verified when we needed Nova, so we built a local brain behind the same interface instead of waiting. See [docs/friction-log.md](friction-log.md).

## Accomplishments that we're proud of

- The whole family journey, from scanning to the results, runs on the Vega Virtual Device: real phones joined by QR code, and scripted players controlled the film (Pause and Play reach the TV and come back in under 250 ms), asked Pip, and played whole quizzes, with the reveal arriving the moment everyone had answered. (After: confirm with the family on the demo setup.)
- No spoilers in 30 probes across both films, including questions about Sintel's twist asked before it happens (on the local model; after: the same probes on Nova).
- Every failure we could think of, from a server restart mid-film to everyone leaving mid-quiz, recovers by itself, and we walked through each one.
- Guidance that makes AI usable without AI skills: suggested next questions and "Did you mean" options from the same single model call.

## What we learned

(After: written by Parth at the end of the build.)

## What's next for Pip

More moods and Pip's voice with Amazon Polly, voice questions through Transcribe or Nova 2 Sonic, and an Alexa skill ("Alexa, ask Pip who that is"); film notes drafted by Nova video understanding; notes for real catalog content; then the real Pip Pad, a Kindle-sized glass pad with a microphone, haptics and a charging stand, and the same core on the other shared screens in a home.

## Measurements and the usability test

(After: from `docs/measurements.md`, with their limits stated. With 3 to 5 people, the usability test is a signal, not proof.)

## Pre-existing project statement

Pip for Fire TV is a new project, started on October 15, 2026 for this hackathon. No sample code was reused; the TV's player follows the URL-mode pattern in Amazon's W3C Media API guide.

## Product feedback

From [docs/feedback.md](feedback.md), shortened. Vega SDK and CLI: generate, build and run worked first time, and the device log stream was our best debugging tool; we'd like a non-interactive first run and a device screenshot command. Vega Virtual Device: ran beside everything on an 8 GB laptop, and `inputd-cli` let scripts press remote buttons. React Native for Vega 0.83: native animations and `FocusManager` worked well; the 960 x 540 dp canvas should be in the template's README, and preferred focus misbehaved with two cards. W3C Media API: URL-mode MP4 over HTTPS just worked; error messages could say what failed. ADBT: the guides were exactly what our coding agent needed. Bedrock: account verification blocked our first Nova call, so a clear status in the console would help.

## Built with

Vega OS, React Native for Vega, W3C Media API, Vega Media Controls, Amazon Devices Builder Tools, Amazon Bedrock, Amazon Nova 2 Lite, Ollama (local fallback), Node.js, Express, Socket.IO, React, Vite, TypeScript, zod, Vitest, Cloudflare Tunnel

## Credits

Big Buck Bunny, (c) copyright 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0. Sintel, (c) copyright 2010 Blender Foundation, durian.blender.org, CC BY 3.0.
