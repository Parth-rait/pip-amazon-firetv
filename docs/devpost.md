# Devpost text (draft)

Rewritten 22 Oct for the local-first build (docs/vnext/PLAN.md section 0). Parth edits it before pasting into Devpost. Every number here was measured on this repository; see the links. Marked **(Parth)**: what only a person can do or say.

## Tagline

A quiet film companion for Fire TV that only knows what you've already seen, and keeps everything on your own machine.

## Inspiration

When someone asks "wait, who is that?" or comes back from the kitchen asking "what did I miss?", the film stops for everyone, or the question goes unanswered. A phone is no help: it knows the whole film, so it spoils the ending. We wanted an assistant that knows the film exactly up to the second the family is at. It stays invisible until someone needs it, and it runs in the living room, not in the cloud.

## What it does

- **Ask without spoilers.** Anyone can ask Pip from their Pip Pad (a phone or a tablet) by tapping, typing or speaking: "Who is that?", "What just happened?", "Why did she do that?". Pip answers in one or two sentences, on the TV and the asker's pad, from what the film has shown so far. Questions about what happens later ("Does she find the dragon?", "How does it end?") get "No spoilers from me".
- **While you were away.** If someone's pad goes to sleep or drops off during the film, or someone joins halfway, Pip catches up only that person when they're back. Their pad gets up to four moments they missed, with times, and nothing after the current second. The TV never pauses and nobody else is interrupted.
- **Quiet by default.** During the film, Pip is hidden on the TV. It appears only when someone asks, on pause, or when called with the Pip button. Quizzes, guesses and reactions for children are an opt-in "Kids games" switch, never the default.
- **One remote for everything, without the remote.** Play, pause, ±10 s, volume, brightness and (simulated) lights come from the host's pad, from voice ("pause", "back 10", "louder") or from the TV remote. They all go through one action router, and the TV confirms each command before the pad says it happened. None of them calls a model. As an experiment, we also plugged in **hand gestures from a webcam** through the same router (palm, fist, palm plays or pauses; pointing seeks); it works, but it's a playground for the input layer, not the product.
- **A Fire TV style TV.** The Vega OS app, and a browser version of the same TV client at `/tv` for laptops: a home screen with the featured film and rows, the Pip Pad QR code and code, and a player with a transport bar.

## How we built it

- **Pip only knows the film up to now, enforced in code.** Each film has a *timeline*: timed facts with evidence (a frame or a line of dialogue), the time each is revealed, and the words it reveals first. Before any model call, the server cuts the timeline at the TV's current position (`server/src/core/context/boundary.ts`). After the call, an answer gate rejects any reply that uses a word the film has not said or shown yet. "Who is that?" and "What just happened?" are answered straight from the facts, with no model at all. The model (a 3B local model) only words other answers, and when its words are withheld, a reviewed fact that matches answers instead.
- **The film is understood offline, on a laptop.** `npm run pipeline` finds scene cuts with ffmpeg, transcribes the dialogue with whisper.cpp, and describes frames with `qwen3-vl:4b-instruct` through Ollama, using a character roster. Characters are only named once the dialogue names them, so the twist in a name stays hidden. On Sintel, character tracking against 31 hand-labelled frames scored precision 0.82 and recall 0.72. The demo films use timelines built from notes that a person can check (`npm run timeline:notes`). Every note was checked against a frame from the film, and each fact counts only 10 s after its beat starts.
- **No cloud.** Pip's brain is `qwen2.5:3b` through Ollama on the same Mac as the server. Nothing about the family (names, questions, viewing) leaves the house. The event journal uses pseudonymous ids and never stores names or question text. Amazon Bedrock (Nova 2 Lite) is an adapter behind the same interface for when an AWS account is ready.
- **TV:** Vega OS app in React Native for Vega (RN 0.83, SDK 0.24): W3C Media API in MP4 URL mode, Vega Media Controls for the remote, `FocusManager` for the film cards.
- **Pip Pad:** a React and Vite web app with no install. On a tablet, Pip sits beside the remote; on a phone, it's one button.
- **Server:** one Node.js 22 process (Express 5, Socket.IO 4.8). It owns the session and sends every screen a full snapshot after each change, so a screen that reconnects simply catches up. One contract file (`shared/protocol.ts`, version 7) describes every event, with zod validation on each.
- **Gestures (experiment):** a vendored MIT webcam gesture pipeline plus a small Python bridge. Gestures join the session like a player and send the same semantic inputs as the pad, which showed that a new input device needs no new logic.

## Challenges we ran into

- **Our AWS account was not verified in time.** We had built the model behind one interface from day one, so we made the local brain the product: it costs nothing to run, works offline, and keeps everything private. A 3B model gets facts wrong far more than a large one, which pushed the safety into code rather than the prompt.
- **A small model will tell the ending if it can.** Before the grounded path, the same local model, given our notes in a prompt, answered "How does the film end?" at 0:15 with the ending. It also made up that the shaman gave Sintel her sword. Now nothing after the current second reaches the prompt, and the gate catches what the model guesses.
- **Our first spoiler check flagged Pip's own words.** "Keep watching and see!" contains "watch", which a later scene uses first. Spoiler terms now skip Pip's fixed lines.
- **Notes run ahead of the picture.** Checked against frames, some story beats appear up to 10 s after their note. Facts now count as revealed only once the beat is over.
- **Vega:** the TV's WebSocket dropped every ~5 s once session snapshots grew past ~5 KB, so the TV gets a slim view. RN 0.83 lays out on a 960 x 540 dp canvas. After the first background cycle on SDK 0.24, the AppState 'change' event can stop arriving, so the TV reconnects on 'focus' too. The tools need Node 22.

## Accomplishments that we're proud of

- **Zero spoiler leaks across 214 probes on two real films with the local model.** Big Buck Bunny: 0 of 104, with the expected answer given 98% of the time and every expected fact cited. Sintel, which has a twist: 0 of 110, answered 93%. Pip also correctly declines to answer the questions it should 96 to 97% of the time ([docs/evaluation/results/](evaluation/results/)). Even a fake model that always tells the ending leaks nothing.
- **A catch-up nobody else has to sit through.** "While you were away" is spoiler-safe and private to one viewer, needs no model call, and is tested end to end over real sockets.
- **Five ways to control the film with zero model calls**, all through one router, with the TV confirming each command (6 to 12 ms on the browser TV, 177 to 239 ms on the Vega Virtual Device through the tunnel).
- **388 server tests**, including a Virtual Pip Lab that runs the real server over real sockets with a fake TV and fake pads, and injects faults (server restarts, a TV that leaves mid-film, a pad that drops and rejoins).

## What we learned

**(Parth)**

## What we were reaching for, and what's next

The router that takes the pad, voice, the remote and gestures alike was built so that Pip isn't tied to one screen. What we were aiming at, and didn't get to by the deadline:

- **The room as an input.** The camera already sees hands. Next it would notice people: when everyone gets up, the film pauses itself. When someone comes back, it carries on and Pip offers "While you were away". This would run on the device, be off by default, and count people without recognizing who they are.
- **Alexa.** On a Fire TV device, Vega Media Controls already let Alexa play, pause and seek the film in our app. Next: "Alexa, ask Pip who that is", answered by the same spoiler-safe path.
- **Glasses.** Smart glasses as one more Pip Pad: look at the screen and ask quietly, and the answer comes to you alone, like "While you were away". The same contract, a new input and output, no new logic.
- **Any title, not just two films.** The offline pipeline drafts a timeline from the video and dialogue, and a person approves the facts. A service that already keeps per-title metadata could do this for its catalogue, so story questions get the same spoiler boundary that cast information doesn't need.
- **Also on the list:** recommendations from the mood the family picks (PLAN.md section 9), the capacitive touch-wheel Pip Pad (the input contract and simulator exist), and Nova as an optional brain once an AWS account is verified, measured on the same benchmark first.

## Measurements and the usability test

The benchmark is reproducible: `cd server && npm run eval -- sintel --ollama`. **(Parth)**: a 10-minute viewing test with a family member, and a VVD walk-through of the vNext build before recording.

## Built with

Vega OS, React Native for Vega, W3C Media API, Vega Media Controls, Amazon Devices Builder Tools (MCP), Node.js, Express, Socket.IO, React, Vite, TypeScript, zod, Vitest, Ollama (qwen2.5:3b, qwen3-vl:4b-instruct), whisper.cpp, ffmpeg, MediaPipe (via gesture-tv-remote), Cloudflare Tunnel.

## Pre-existing project statement

Pip for Fire TV is a new project, started on October 15, 2026 for this hackathon. Vendored: gesture-tv-remote (MIT, unchanged, in `gesture/vendor`). The TV's player follows the URL-mode pattern in Amazon's W3C Media API guide.
