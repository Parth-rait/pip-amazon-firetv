# PROJECT.md: Pip for Fire TV

| | |
|---|---|
| Version | 2.0 (October 15, 2026) |
| Owner | Parth (GitHub `Parth-rait`) |
| Event | Build, Ship, Shape: Amazon Developer Hackathon, Fire TV track |
| Deadline | Friday October 23, 2026, 12:00 PDT. Our target is to submit on Thursday October 22. |
| Status | Ready to build. No code yet. |
| New in 2.0 | v1 is one family journey (join, watch, ask Pip, quiz, results) instead of two separate demos. The workout plan became stretch goal S3; version 1.0 of this file is kept in the project files as `pip-pad/archive/PROJECT-workout-version.md`. Google's public sample film links stopped working, so we serve our own copy of the film. The build now proves the riskiest parts first, in five gates. |
| Supersedes | The "Pip for Fire TV: System Design" doc, for v1. That doc keeps the long-term (v2) architecture. |

This file is the single source of truth for building v1. It tells a person or an AI coding agent what we are building, how it is put together, the rules for writing the code, and the exact order of work, with a ready-to-paste prompt for every step.

---

## 0. How to use this file

### 0.1 Order of truth

1. This file.
2. `shared/protocol.ts` (the contract between the three apps; section 7 explains it).
3. Each package's `README.md`.
4. Older docs. Where they disagree with this file, this file wins.

If code and this file disagree, either fix the code or update this file in the same commit. Never leave them out of sync.

### 0.2 Session start prompt

Paste this at the start of every AI coding session (Claude Code, Kiro, Cursor or similar), then paste the prompt of the step you are on from section 13.

```text
You are helping build "Pip for Fire TV" for the Amazon Developer Hackathon.
Read PROJECT.md in full before doing anything. It is the source of truth for scope,
architecture, contracts, coding standards and build order.

Rules for this session:
1. Follow PROJECT.md section 10 (coding standards) and section 11 (agent rules) at all times.
2. Accuracy comes first. Before you use any API, package name, CLI flag, model ID or file path,
   verify it with the Amazon Devices Builder Tools MCP, the AWS MCP server, the installed
   package's type definitions, or the official docs. If you cannot verify something, say
   "unverified" and tell me how to check it. Never guess silently.
3. We are on Step <N> of section 13. First restate the step's goal and its "Done when" checks
   in two or three lines. Then do only that step.
4. Use the skills and MCP tools listed in section 12 whenever they fit the task.
5. When you finish, show: the files you changed, every command you ran with its real output,
   anything left unverified, and the commit message from the step. Then stop and wait.
```

### 0.3 Words used in this file

| Word | Meaning |
|---|---|
| Pip | The mascot and assistant. A small round character on the TV. |
| Pip Pad | The touch pad that replaces the remote. In v1 it is a web app: the host runs it on a tablet, and everyone else opens the same app on their own phone. "Pip Pad" is a working name. |
| Player | Anyone who joined the session with a name, including the host. |
| Host | The player who controls the film and the quiz. The first person to join; the role passes on if they leave. |
| Stage | Where the session is in the journey: `lobby`, `watch`, `quiz` or `results`. The server owns it. |
| Session | One TV and its players, identified by a 4-character code. |
| Pip Core | The parts of the server that any future Pip product can reuse: joining, names, the host, Pip's states and the guidance loop (section 4.3). |
| Activity | What a session does on top of Pip Core. v1 has one: film night. |
| TV app | Our Vega OS app on Fire TV (`tv/`). |
| Server | One Node.js process that connects the pads, the TV and Amazon Bedrock (`server/`). |
| VVD | Vega Virtual Device, the Fire TV simulator that ships with the Vega SDK. |
| ADBT | Amazon Devices Builder Tools: Amazon's MCP server, Agent Skills and steering docs for AI coding agents. |

---

## 1. Product

### 1.1 The vision: AI in everyday hands

Pip is the start of a product line: AI built into the things people already have at home, that anyone can use without knowing anything about AI. Most AI today lives in a chat window and works best for people who know how to prompt it. Pip puts AI on the shared screens of everyday life, where it understands the moment and steers the conversation for you.

Pip for Fire TV is product one. It proves the idea on the screen almost every home already has: a passive TV becomes an AI system the whole family uses together. The parts that make this work are kept in a reusable core (section 4.3), so the next Pip product starts from them instead of from scratch.

### 1.2 How every Pip product behaves

These seven rules define the product line. Section 3 turns them into design rules, and section 14.4 tests the second and the fourth with real people.

1. **AI where people already are.** On the TV and the phones already in the room. Nothing new to learn.
2. **No AI skills needed.** Pip suggests the next question, turns a messy question into clear choices, and lets people change course at any time (section 5.4).
3. **The interface follows the moment.** Each screen shows only what matters right now.
4. **Together, as equals.** One shared screen to look at, a personal screen for each person, and the same say for a child and a grandparent.
5. **Grounded and honest.** Pip uses only what it knows about this moment, says when it is not sure, and does not spoil what comes next.
6. **Private by default.** No accounts. First names only, which Pip forgets when the session ends.
7. **Calm.** Pip speaks when asked. No notifications, no nagging.

### 1.3 Product one: Pip for Fire TV

**One line:** Pip helps families watch, understand and play together on Fire TV. Everyone joins from their own screen, the Pip Pad replaces the remote, Pip answers questions about the film without spoilers, and a short quiz turns the film into a game.

**The problem:**

- The remote is the last button box in the house. It is small, easy to lose, hard for children and older adults, only one person can hold it, and it knows nothing about what is on screen.
- Watching together is passive. When a child asks "who is that?", the film stops while someone explains, or the question goes unanswered.
- Asking a phone means leaving the moment, knowing what to type, and risking spoilers in the results.
- When the film ends, there is nothing to do together with what you just watched.

### 1.4 The Pip Pad

- **The vision (pitch only, not built):** a Kindle-sized pad with a premium feel: glass front, no physical buttons, a microphone and haptics. It sits in a small stand that charges it. Its screen shows only the controls that matter for what is on the TV right now.
- **The v1 prototype (what we build):** the pad's software, as a web app. The host runs it full screen on a tablet. The default is an Amazon Fire HD tablet, because it is closest to the Kindle size and keeps the demo inside Amazon hardware. Everyone else opens the same app on their own phone by scanning the QR code on the TV, and that phone becomes their personal Pip Pad.
- **Fallback:** the Fire TV remote can start the film from the lobby and play or pause it through Vega Media Controls. Alexa voice should play and pause it too, which can only be tried on a real Fire TV device (section 6).

### 1.5 Pip, the mascot

- One simple character: a soft mint-colored circle with two eyes. No mouth, no limbs, no text on its body.
- Pip shows what the system is doing, using five states: `sleep`, `idle`, `thinking`, `talking`, `cheer` (section 3.4).
- Pip never nags. It speaks only when someone asks, at a quiz reveal, and at the end.

### 1.6 The journey (one demo)

1. **Scan and join.** The TV shows Pip, a QR code and a 4-character code. Each person scans it and types a first name. The names appear on the TV and Pip wakes up. The first person to join is the host; in the demo that is the Pip Pad.
2. **Watch.** The host picks the film. It plays on the TV, and the host's pad shows big Play, Pause and skip buttons.
3. **Ask Pip.** Anyone can type, tap a suggested question or speak. Pip answers on the TV within seconds (the target is under three), with the asker's name. It only gets notes about the film up to the current moment, so it does not spoil what comes next. Each answer brings two or three next questions to tap, and a vague question gets "Did you mean" options instead of a guess (section 5.4).
4. **Quiz.** At the end of the film, or earlier with only the questions about scenes already watched, the host starts a five-question quiz. Everyone answers on their own screen. There are no buzzers and no speed points, so a 7-year-old and a grandparent play as equals.
5. **Results.** Each question ends with the right answer and a one-line explanation. Then come the scores and a family total: "Together you got 9 of 10 right."

### 1.7 What v1 proves, and what it does not claim

| Claim | Evidence (section 14) |
|---|---|
| Anyone in the room can join and take part in seconds | Join time and the small usability test (14.4) |
| People get good answers without knowing how to talk to an AI | Answer quality, how often chips and "Did you mean" options are used, the usability test |
| The AI stays grounded: no spoilers, and it says when it does not know | 10 spoiler probes and 5 unknown-fact probes (14.3) |
| A household screen becomes a shared activity, not a passive display | Full quizzes with three players, and what testers say |

v1 does not claim that the Pip Pad hardware exists (it is a tablet app and, optionally, a render), that Pip works over other apps (it lives inside our app), that the quiz is written live by AI (Nova drafts it ahead of time and a person checks every question), or that the speech recognition is ours (it is the browser's).

### 1.8 How Pip differs from what exists

| Today | Good at | Leaves out | Pip |
|---|---|---|---|
| The remote | Fast for the one person holding it | Everyone else; knows nothing about the film | Every phone in the room is a controller or a player |
| Alexa voice on Fire TV | Commands and quick facts | Help with phrasing a question; a way for everyone in the room to take part | Suggests what to ask and fixes unclear questions; everyone has a screen |
| Prime Video X-Ray Recaps | Spoiler-free AI recaps up to the minute you are watching, built on Amazon Bedrock | Asking your own question, getting help asking it, playing together | Anyone asks their own question, gets help asking it, then the family plays |
| A phone search | Any question | You leave the moment, need the right words, and risk spoilers | Answers come only from what you have already seen |

Pip builds on the same Amazon foundations as X-Ray Recaps and takes the idea from "tell me" to "let us ask and play together".

### 1.9 How the product maps to the judging criteria

The four criteria are weighted equally.

| Criterion | What earns it |
|---|---|
| Technical implementation | A Vega TV app and any number of phones in sync through one server; fixed, tested rules for joining, the host, the quiz and scoring; Amazon Bedrock with spoiler-safe context and guidance in one call; a quiz drafted by Nova and checked by a person; fallbacks for every failure; measured results. |
| Design | One family journey; a pad whose controls follow the moment; big, equal answer buttons for every age; one calm mascot with clear states; a minimal, consistent visual system. |
| Potential impact | Families can ask about a film without stopping it; easier TV for people who struggle with remotes; a reusable core for a new line of everyday AI products, and a pattern Amazon could ship on Fire TV (phones and Fire tablets as controllers, quizzes for children's content). |
| Quality of the idea | AI that anyone can use without AI skills, because Pip does the steering; the remote replaced by screens people already own; a film turned into a shared game, on Amazon's newest TV platform. |

---

## 2. Scope for v1

### 2.1 In

- Joining: the TV shows a QR code and a 4-character code. Each person joins with a first name on their own phone or tablet; up to 8 players.
- The host: the first player controls the film and the quiz. If the host leaves, the role passes on after 10 seconds.
- Watch: the TV plays two openly licensed films from our own server: Big Buck Bunny (gentle, no dialogue) and Sintel (a story with a twist, which tests spoiler safety for real). The host plays, pauses and skips with big buttons.
- Ask Pip: anyone asks by typing, tapping a suggested question, or speaking where the browser supports it. Nova 2 Lite answers with next-question chips, or with "Did you mean" options for a vague question.
- Quiz: 5 multiple-choice questions written ahead of time (drafted by Nova 2 Lite, checked by Parth) and unlocked by what the family has watched. Everyone answers on their own screen. Each reveal shows the right answer and one line of explanation. Scores and a family total at the end.
- Remote fallback: start the film from the lobby with the remote, and play or pause it with the remote through Vega Media Controls (and with Alexa voice on a real Fire TV device).
- One server process running on Parth's Mac, reached through an HTTPS tunnel.

### 2.2 Out of v1 (and why)

| Out | Why |
|---|---|
| Real pad hardware | Pitch only. We show the vision with a tablet and, optionally, renders. |
| Workout mode and pose tracking | A second, separate experience. Its full plan is kept for stretch goal S3. |
| Buzzers and speed points | Everyone answers in their own time, so all ages play as equals. |
| Live quiz generation | A quiz written ahead and checked by a person is always right and never slow. |
| Pip's spoken voice | Stretch goal S1. |
| AgentCore, Strands, Lambda, API Gateway, DynamoDB | Moved to v2. One process with one live model call is enough for v1 and far less risky. |
| Pip over other apps | We found no supported way for a Vega app to draw over other apps, so Pip lives inside our app. |
| Content Launcher and catalog integration | Needs a catalog upload. v2. |
| Accounts, long-term memory, households | Not needed. A session keeps only names, questions and scores, in memory. |
| Swipe gestures | Big, labeled buttons are clearer for every age. |
| Alexa skill, Bee, Ring, Meta glasses | v2, or no hardware; they do not help the Fire TV score. |

### 2.3 Stretch goals (only after Step 11 passes)

S1 Pip's voice with Amazon Polly. S2 Film notes drafted by Nova video understanding. S3 Workout, a second activity on Pip Core. S4 Film talk: Pip helps each person make their point. S5 Deploy the server to AWS. S6 A second film. S7 Remembered pairing on the TV. S8 The host can remove a player. Prompts are in section 13.4.


### 2.4 Changes agreed on October 16

After the first test with real phones, Parth asked for a product with more life in it. These change the plan above where they differ:

- **A local brain until AWS works.** The AWS account was still being verified, so the server can use a free local model through Ollama (`AI_PROVIDER=ollama`, section 7.4) with a simpler prompt (section 5.3). Nova 2 Lite stays the model for the demo.
- **Answer memory** (section 5.9): good answers are kept per film and scene, so repeats are instant and Pip still answers when the model is down.
- **A second film, Sintel** (stretch goal S6 moved forward): a story with a twist, so "no spoilers" is tested where it matters.
- **Film notes drafted by the agent** from a frame every 6 seconds and the subtitles; Parth checks the times in one viewing.
- **Pip with personality, and customization:** the host picks Pip's mood (Chill, Playful or Sassy) and color (mint, coral, lilac, sun) under "Make Pip yours" in the lobby; the mood changes the prompt's persona (`PERSONAS` in `prompts.ts`, the rules stay the same), the fixed lines (`LINES_BY_MOOD` in `lines.ts`) and Pip's greetings; the color is Pip's body and the accent color on the TV and every pad. Players pick an avatar color when joining; the avatar is their initial on it. Pip greets each new player by name on the TV (`pip:hello`). The default stays minimal: simple, calm and useful, like Apple's defaults, with the extras one tap away. The pad's watch screen is a chat (Pip's answer in its bubble, the Ask bar at the bottom), and the top bar shows only problems.
- **Contract version 3:** `shared/protocol.ts` adds `pipStyle`, player avatars, film posters, the `pip-style` host command and `pip:hello`. It is now the reference; section 7.1 shows version 2.

---

## 3. Design system

### 3.1 Ten rules

1. **One job per screen.** Each pad screen has one main job (join, ask, answer). The host also gets one row of host controls. Nothing else.
2. **The TV is for looking, the pad is for touching.** No typing on the TV. No long reading on either.
3. **One accent color.** Pip's mint is the only color besides grays. Red is used only for errors. Quiz choices are labeled A to D, not colored.
4. **Big and calm.** Large type, generous spacing, matte dark surfaces, no borders (use surface steps instead), no gradients except Pip's glow.
5. **Motion explains state.** Feedback animations take 400 ms or less. Pip's state animations (section 3.4) are the only exceptions and the only loops.
6. **Pip speaks rarely and briefly.** Answers are at most 35 words, chips at most 8 words, explanations at most 25 words. There are no notifications.
7. **Never a dead end.** Every error says what happened and what to do next, in one line.
8. **Everyone plays as equals.** No buzzers and no speed points, the same big buttons for everyone, and the TV never shows the answer or anyone's pick before the reveal.
9. **Sentence case everywhere.** No all-caps sentences, no emoji in the interface, at most one exclamation mark per message (only in cheer lines).
10. **Respect the platform.** TV text sits inside a 5% safe margin. The pad respects `prefers-reduced-motion` and keeps touch targets at least 56 px; quiz answer buttons are at least 96 px tall.

### 3.2 Tokens

Use these names in `pad/src/styles/tokens.css` (CSS variables) and `tv/src/theme.ts` (a TypeScript object).

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0B0F` | App background |
| `surface` | `#15151C` | Cards, bubbles, answer buttons |
| `surface2` | `#1E1E27` | Pressed and selected states |
| `text` | `#F4F4F6` | Primary text |
| `textMuted` | `#9B9BA8` | Secondary text, players who are offline |
| `accent` | `#7CE7C4` | Pip, progress, focus ring, the right answer in a reveal |
| `danger` | `#FF6B6B` | Errors only |
| `radius` | `20` | Cards and buttons |
| `space` | `4, 8, 12, 16, 24, 32, 48` | Spacing scale; use nothing else |
| `font` | System font (`system-ui` on the pad, the platform default on Vega) | All text |
| `motionFast` | 180 ms ease-out | UI transitions |
| `motionPip` | 2400 ms ease-in-out loop | Pip breathing |

Type scale:

| Role | Pad (CSS px) | TV (dp at 1080p) |
|---|---|---|
| Caption | 15 | 24 |
| Body | 17 | 36 |
| Title | 22 | 48 |
| Display | 34 | 72 |

### 3.3 Screens

TV app, four screens:

```text
LOBBY                                         WATCH
+--------------------------------------+      +--------------------------------------+
| (-) Pip                              |      |                                      |
|   +--------+       +--------------+  |      |          (full-screen film)          |
|   |   QR   |       | Big Buck     |  |      |                                      |
|   |        |       | Bunny  10 min|  |      | Leo asked: who is the big bunny?     |
|   +--------+       +--------------+  |      |            +-------------------+     |
|   Scan to join   or enter  K 7 Q D   |      |            | Answer, 4 lines   | (o) |
|   Mom (host)   Leo   Gran            |      |            +-------------------+ Pip |
+--------------------------------------+      +--------------------------------------+

QUIZ (question, then reveal)                  RESULTS
+--------------------------------------+      +--------------------------------------+
| Question 2 of 5       ======---  14 s|      | Results                              |
| <question, up to 2 lines>            |      |                                      |
|                                      |      |   1   Leo        4                   |
|   A  <choice>         B  <choice>    |      |   2   Mom        3                   |
|   C  <choice>         D  <choice>    |      |   2   Gran       3                   |
|                                      |      |                                      |
|   Mom   Leo   Gran              (o)  |      | Together you got 10 of 15 right. (O) |
+--------------------------------------+      +--------------------------------------+
```

- The server owns the stage; the TV draws whatever `session:view` says.
- LOBBY: Pip (asleep until someone joins), the QR code on a white card, the code in large spaced letters, the players with the host marked, and one card per film. The film cards are focusable, so the remote can start a film without any pad.
- WATCH: no chrome while playing. The credit line shows for 4 s at the start. On pause, a thin bar with the title and time shows for 3 s. An answer bubble sits next to Pip with "<name> asked: <question>" above it and hides after 8 s. When the film ends: "The end. Ready for the quiz?"
- QUIZ: the question number, the question, the choices A to D in a 2 x 2 grid, a countdown bar, and the players' names, which light up mint when they have answered (never what they picked). In the reveal, the right choice turns mint, the others dim, each name moves under the choice it picked, and the explanation shows next to Pip.
- RESULTS: the standings (equal scores share a place), the family total, and Pip cheering.

Pip Pad, five screens (portrait); the quiz screen has a question phase and a reveal. Players see the same screens as the host, without the host controls:

```text
JOIN                 LOBBY (host)         WATCH (host)
+----------------+   +----------------+   +----------------+
| (-) Pip        |   | (o)     Online |   | < Lobby  6 min |
|                |   |                |   | -----o-------- |
| Code on the TV |   | Pick a film    |   |[-10] [||] [+10]|
| [K] [7] [Q] [D]|   | [Big Buck      |   | [What just     |
| First name     |   |   Bunny 10 min]|   |    happened?]  |
| [Leo         ] |   |                |   | [Who is that?] |
|                |   | Mom (you, host)|   |[Ask Pip..][mic]|
| [    Join    ] |   | Leo   Gran     |   | [Start quiz 2] |
+----------------+   +----------------+   +----------------+

QUIZ                 REVEAL (host)        RESULTS (host)
+----------------+   +----------------+   +----------------+
| 2 of 5     14 s|   | 2 of 5         |   | (O)            |
| <question>     |   |                |   | You got 3 of 5 |
|                |   | You got it.    |   |                |
|[A  <choice>   ]|   | A  <choice>    |   | 1  Leo       4 |
|[B  <choice>   ]|   |                |   | 2  Mom       3 |
|[C  <choice>   ]|   | <one-line      |   | 2  Gran      3 |
|[D  <choice>   ]|   |  explanation>  |   |                |
| Change it until|   |                |   |[Keep watching] |
| the reveal.    |   |[Next question] |   |[Back to lobby] |
+----------------+   +----------------+   +----------------+
```

- The pad follows the stage. Only the host can change it, and only with the host controls.
- While the TV is offline, the status pill says "TV offline" and the pad offers "Join another TV", which forgets the saved code and opens JOIN.
- JOIN: four boxes for the code (filled in when the QR link opened the pad; typed letters become capitals), a first-name field of up to 12 characters (remembered on this device), and Join. Under the name: "First name or nickname. Pip forgets it after the session; this device remembers it."
- LOBBY: the host sees "Pick a film" with a card for each film. Everyone else sees "Waiting for <host> to pick a film". Everyone sees the players, with "you" and "host" marked.
- WATCH, for everyone: three chips, the Ask box and the mic button. The chips start as "What just happened?", "Who is that?" and "Why did they do that?". After Pip answers you, they become that answer's next questions for 60 s. After a vague question, the chips area shows Pip's "Did you mean" options as big buttons plus "Something else".
- WATCH, host controls: one row of three big buttons (back 10 s, Play or Pause, forward 10 s), a thin progress line with "About N min left", a small Lobby button, and "Start the quiz". That button says "The quiz unlocks as you watch" until a question is unlocked, then "Start the quiz (N ready)", and it becomes the main button when the film ends. Everyone else sees "<host> has the controls".
- QUIZ: the question, four answer buttons A to D, and the time left. A tap outlines your choice in mint; "You can change it until the reveal." In the reveal: "You got it." or "It was B: <choice>.", then the explanation. The host also gets "Reveal now" during a question, and "Next question" or "See results" during a reveal.
- RESULTS: "You got <score> of <questions>.", the standings and the family total. The host gets "Keep watching" (when the film has not ended) and "Back to lobby". To watch a film again after its end, the host picks it in the lobby, and it starts from the beginning.

### 3.4 Pip states

| State | When | TV visual | Pad visual |
|---|---|---|---|
| `sleep` | No player online | Eyes are flat lines, body at 50% opacity, slow breathing | Small sleeping Pip on the JOIN screen |
| `idle` | Players online, nothing happening | Breathing (scale 1.00 to 1.04 over 2.4 s), blinks every 4 to 6 s | Small Pip, breathing |
| `thinking` | Waiting for the model | Eyes look up and to the right, three dots pulse | Dots pulse on the asker's pad |
| `talking` | An answer or "Did you mean" (8 s); a reveal where fewer than half were right (4 s) | Gentle bounce for the first 1.5 s, then breathing while the bubble shows | None |
| `cheer` | A reveal where at least half of the answers were right; the results | Two quick hops (up 24 dp), accent glow brightens, 1.5 s | Short vibration on a right answer, where supported |

The server owns Pip's state and sends it in `session:view`; the TV and pads only draw it. Pip returns to `idle` after `talking` and `cheer`, or to `sleep` if no player is online.

### 3.5 Writing Pip's lines

- Warm, short and specific. Use names and numbers, not adjectives.
- Never blame: "It was B: a bird." not "Wrong".
- Never claim certainty Pip does not have: "I'm not sure yet" is a good answer.
- Answers, chips and "Did you mean" options come from the model. Every other line is fixed, in `server/src/lines.ts` (server) or next to the component that shows it (pads and TV).

Fixed lines:

| When | Line |
|---|---|
| The model failed or timed out | "I'm not sure right now. Ask me again in a moment." |
| The model's reply had nothing usable in it | "I'm not sure about that one yet. Try asking another way." |
| `AI_ENABLED=false` | "My brain is offline right now." |
| Before "Did you mean" options | "Did you mean one of these?" |
| Someone else's question is being answered (`busy`) | "Pip is answering someone else. Ask again in a moment." |
| Asked again within 2 s (`too-soon`) | "One moment." |
| Asked while the film is not on (`not-watching`) | "Pip answers questions while the film is on." |
| An empty or invalid question (`invalid`) | "Type a question first." |
| Join: `unknown-code` | "Looking for your TV. Check the code on the screen." |
| Join: `full` | "This TV already has 8 players." |
| Join: `rate-limited` | "Too many tries. Waiting a moment." |
| Join: `invalid` | "Type the code from the TV and your first name." |
| The TV is offline (pad) | "TV offline", with a "Join another TV" button |
| The film ended (TV) | "The end. Ready for the quiz?" |
| Reveal, right (pad) | "You got it." |
| Reveal, wrong (pad) | "It was <letter>: <choice>." |
| Reveal, no answer (pad) | "No answer this time. It was <letter>: <choice>." |
| Results, your score (pad) | "You got <score> of <questions>." |
| Results, family total (TV and pads) | "Together you got <correct> of <answers> right." |
| Results, nobody answered | "No answers this time." |
| The microphone, first use (pad) | "Your browser turns your voice into text." |
| Speech not available or denied (pad) | "Type your question instead." |

---

## 4. Architecture

### 4.1 Diagram

```text
   Pip Pads (one web app on every device)          Fire TV (Vega OS app)
 +-------------------------------------+      +-------------------------------------+
 | Host, on a tablet: pick the film,   |      | Lobby: QR code, players, films      |
 |   play, pause, skip, run the quiz   |      | W3C Media API video player          |
 | Everyone, on a phone: join with a   |      | Quiz question, reveal and results   |
 |   first name, ask Pip (type, tap    |      | Pip mascot, five states             |
 |   or speak), answer the quiz        |      | Remote and Alexa play and pause     |
 +------------------+------------------+      +------------------+------------------+
                    |  Socket.IO over HTTPS (WebSocket, with an  |
                    |  HTTP long-polling fallback), one room per |
                    |  session                                   |
                    +---------------------+----------------------+
                                          v
                   +---------------------------------------------+
                   | Pip server: one Node.js process             |
                   | Pip Core: codes, players, the host, Pip's   |
                   |   state, the guidance loop (one model call) |
                   | Film night: films, playback, quiz rules     |
                   | Express: /health, /api/films, /qr/:code,    |
                   |   /media, and the built pad app             |
                   | In-memory sessions (6 h idle expiry)        |
                   +----------------------+----------------------+
                                          | AWS SDK for JavaScript v3,
                                          | Bedrock Converse API
                                          v
                   +---------------------------------------------+
                   | Amazon Bedrock: Nova 2 Lite                 |
                   | inference profile us.amazon.nova-2-lite-v1:0|
                   +---------------------------------------------+

 Before the demo, npm run draft:quiz asks Nova 2 Lite to draft each film's quiz
 from its notes, and Parth checks every question. HTTPS comes from a Cloudflare
 quick tunnel to the server on the Mac; the TV, the tablet and every phone use it.
```

### 4.2 Components

| Component | Folder | Runs on | Responsibilities | Must not |
|---|---|---|---|---|
| TV app | `tv/` | Fire TV (Vega OS) or VVD | Lobby with QR code, players and films; video playback; apply `tv:command`; report playback; draw the quiz, the results, Pip and answer bubbles | Call Bedrock, hold secrets, decide the stage or the score |
| Pip Pad | `pad/` | Tablet and phone browsers | Join with a name; host controls; Ask Pip (type, chips, mic); answer the quiz; show the player's own results | Call Bedrock, see answers before the reveal, keep anything beyond its player id, name and code |
| Server | `server/` | Node.js 22 on the Mac | Sessions, players and the host; validation; the stage; relaying playback commands; quiz timing and scoring; Pip's state; Ask Pip; QR images; serving the pad and the film | Store data on disk (apart from quiz drafts at development time), log secrets or names |
| Content | `server/content/`, `server/media/` | Files on the Mac | Each film's details, notes and checked quiz; the film itself | Hold anything Parth has not checked |
| Shared contract | `shared/protocol.ts` | Copied into all three | Event names, payload types, limits | Contain runtime code or imports |

### 4.3 Pip Core and the film activity

Pip is meant to become a product line, so v1 keeps the parts any Pip product would need apart from the parts that are only about films. This is not a framework: it is two folders and one import rule.

| Pip Core: `server/src/core/` | Film night: `server/src/film/` |
|---|---|
| Pairing codes, and the code a reconnecting TV gets | Film files: details, notes and the quiz |
| Players: names, joining, leaving, the host and its hand-over | The playback position estimate |
| Pip's five states and their timers | The Ask Pip prompt, built only from what the family has seen |
| The guidance loop: one model call, the `ANSWER` and `NEXT` or `CLARIFY` reply, cleaning and fallbacks | The quiz rules: unlock, answer, reveal, score, standings |
| Keyed timers and the join limit | The quiz draft prompt and its checks |

- The rule: `core/` never imports from `film/`. The glue for this product (the session type, the view, validation, the stage changes and the socket handlers) sits at the top of `server/src/`.
- Core functions get what they need as arguments: Pip's state and the host's grace period take `{ timers, broadcast, now }`, and the Bedrock model takes `{ region, profile, modelId }`. So core never reads the server's config, sockets or session type, and a test in Step 4 fails if a file in `core/` imports anything outside `core/` and `shared/`.
- What the next Pip product reuses unchanged: the join flow (QR code, code, names, the host), Pip's states, the guidance loop, the pad's shell (the join screen, Pip, the status pill, the Ask box, chips and mic) and the contract pattern (one shared file of types, a full snapshot after every change, commands built so a repeated tap does no harm).
- The test of the claim is stretch goal S3: adding workout should need a new `server/src/workout/` folder and no change to `core/`.

### 4.4 Why these technologies (old, proven, boring)

We choose technology that has been around for years, has huge communities and fails in well-known ways.

| Need | v1 choice | Why | Not chosen for v1 |
|---|---|---|---|
| Realtime link | Socket.IO 4 | In use since 2010; rooms, automatic reconnection and an HTTP long-polling fallback; Amazon lists socket.io-client 4.7.5 as tested on Vega | Raw WebSocket (no fallback), API Gateway WebSocket (more moving parts) |
| Server | One Node.js process with Express | Boring, one thing to run and debug | Lambda functions |
| State | In-memory `Map` behind a small interface | Nothing to install; swap for DynamoDB in v2 | A database |
| Sync model | The server sends the whole session view after every change | Every screen is always consistent; reconnecting needs no catch-up logic | Sending only changes |
| AI | One live Bedrock Converse call, plus one drafting script run before the demo | Simple, testable, cheap, easy fallbacks | AgentCore, Strands agents, tool calling |
| Quiz content | JSON written ahead of time and checked by a person | Always right, instant, works with the AI switched off | Generating questions live |
| Pad UI | React, Vite, plain CSS | Industry standard, fast builds | UI kits, CSS frameworks |
| TV UI | React Native for Vega, core components | The default template; fewest native dependencies | Animation and SVG libraries |
| QR code | PNG rendered by the server | No native QR library on the TV | `react-native-qrcode-svg` |
| Mascot | React Native `View`s and `Animated` | No native dependencies | Lottie, SVG |
| Speech input | The browser's Web Speech API, where it exists | Nothing to install; our server never receives audio | A cloud speech service (v2) |
| Video | Progressive MP4 through the W3C Media API "URL mode", served by our own server | No adaptive streaming player to patch; the public sample links stopped working in 2026 | DASH or HLS with Shaka Player, third-party video hosts |
| HTTPS | Cloudflare quick tunnel | No account, supports WebSockets | Our own certificates, App Runner (AWS describes it as built for plain HTTPS apps) |
| Tests | Vitest for logic; smoke scripts over real sockets | Fast and simple | End-to-end suites |

### 4.5 Runtime flows

**Join**

1. The TV app starts, connects to `SERVER_URL` and sends `tv:hello { previousCode, tvKey, playback }` (all `null` on the first start). It sends `playback` only while its watch screen is showing.
2. The server picks the code (`pickTvCode` in `core/pairing.ts`). If a live session has `previousCode` and the same `tvKey`, the TV gets that code back. The server records the new socket as the TV first, then closes any older socket of the same TV, so that socket's disconnect does not mark the TV offline. If the code is valid but no session has it (the server restarted), the first TV to say hello with it re-creates the session with that code and its key; when `playback` names a known film that has not ended, the new session starts in `watch` with it, so the film keeps playing. Anything else gets a new unique code and a new random `tvKey`. The TV's socket joins room `s:<code>`, the ack carries `{ code, tvKey, padUrl, qrUrl }`, and the server broadcasts the view.
3. The TV shows the lobby: the QR image from `qrUrl`, the code, the films and the players.
4. A person scans the QR code, so the pad opens `padUrl` (`<PUBLIC_URL>/?code=<code>`), or types the code. They type a first name. The pad sends `pad:join { code, playerId, name }`. The `playerId` is 32 random hex characters the pad made once and keeps in `localStorage`.
5. The server validates the payload and cleans the name (`cleanName`). Guessing codes is limited: after 60 joins with an unknown code in one minute from one address, new joins from it get `rate-limited` until the minute has passed. A player id already in that session is never limited. If the socket was in another session, it leaves that one first. A known `playerId` gets its old name and score back. A new one gets a unique name ("Sam", then "Sam 2") unless the session already has 8 players (`full`). The first player becomes the host. The socket joins the room, the ack carries the view, the server broadcasts it, and Pip wakes up (`sleep` to `idle`) if it was asleep.
6. The pad saves the code, name and id. A link whose `?code=` differs from the saved code replaces it. After any reconnect the pad sends `pad:join` again by itself. If a rejoin with the saved code fails with `unknown-code` or `rate-limited`, it retries every 10 s for two minutes, showing "Looking for your TV"; a code typed on the join screen is never retried by itself. While the TV is offline, "Join another TV" takes the pad back to the join screen.

**Host**

- The first player to join is the host. The server accepts `pad:host` only from the host.
- When the host's last socket leaves, a 10 s timer starts (`LIMITS.hostGraceMs`, `startHostGrace` in `core/pairing.ts`). If the host is not back by then, the earliest-joined player who is online becomes host (`pickHost`). If nobody is online, the role stays where it is until someone comes back.

**Watch**

1. The host taps a film in the lobby (`pad:host { type: 'watch', contentId }`), or someone presses OK on a film card with the remote (`tv:watch`, lobby only).
2. The server sets the stage to `watch` and drops any quiz and its timer. If this is a different film from last time, it also clears the playback and Ask Pip's history. If it is the same film and it had ended, it clears the playback, so the film starts again from the beginning.
3. The TV plays `content.url`. The resume point: if `playback` is for this film and has not ended, start at its `positionSec`; otherwise start at 0.
4. The TV sends `tv:playback` on play, pause, seek and ended, and every 5 s while playing. The server accepts it only from the session's current TV socket and for the chosen film, stores it with its arrival time and broadcasts, so the pads show progress and `quizUnlocked` stays current.
5. The host taps Play, Pause or a skip button. The pad sends `pad:host`; the server checks the stage, clamps a seek to plus or minus 60 s and sends `tv:command` to the TV only. The TV applies it and reports `tv:playback`.

**Ask Pip**

1. Any player's pad sends `pad:ask { text, via }`. `via` says how the question was asked: `typed`, `voice`, or a tap on a `starter`, `next` or `clarify` chip.
2. The server answers the ack first: `invalid` (bad payload), `not-watching` (the stage is not `watch`), `busy` (Pip is already working on someone's question), `too-soon` (this player asked less than 2 s ago), or `ok`. On `ok`, the server takes the session's ask lock (`asking`, kept apart from Pip's state, which timers also change) and Pip goes to `thinking`.
3. The server estimates where the film is now and builds the prompt from the premise, every note up to that moment, the last 3 questions and answers asked at or before that moment, and the question (section 5.3).
4. Nova 2 Lite answers within 6 s. The reply becomes an answer with next-question chips, or "Did you mean" options (sections 5.3 and 5.4). A failure gives a fixed line.
5. The server releases the lock. If the stage or the film changed in the meantime, the answer is dropped and Pip goes back to `idle` (or `sleep` if nobody is online). Otherwise the server sends `pip:say` to the room, saves an answer to the history with the position it was asked at, and Pip talks for 8 s. The TV shows the name, the question and the answer; the asker's pad shows the answer and the chips.

**Quiz**

1. The host taps "Start the quiz", which is enabled once `quizUnlocked` is above 0 (`pad:host { type: 'start-quiz' }`).
2. The server estimates the position, takes the film's questions at or before it, in story order, and saves that position as a paused resume point. It resets every score, sets the stage to `quiz` with the first question, starts a 20 s timer and broadcasts. The view never contains the answer before the reveal.
3. Everyone taps A, B, C or D (`pad:answer { index, choice }`). Only answers from players in the session, to the current question during its question phase, count, and a new tap replaces the old one. The TV lights up the name of each player who has answered.
4. The reveal comes when every online player has answered (checked after each answer and whenever a player leaves), when the timer runs out, or when the host taps "Reveal now". Each right answer scores 1 point. The view now includes the right answer, the explanation and everyone's picks. Pip cheers if at least half of the answers were right, and talks otherwise.
5. The host taps "Next question" (`pad:host { type: 'next', index, phase }`). The server applies it only when `index` and `phase` match what is on screen, so a double tap cannot skip a question. After the last reveal comes the `results` stage, and Pip cheers.
6. The results show the standings (equal scores share a place) and the family total. The host taps "Keep watching" (the same film, from the resume point) or "Back to lobby".

**Stage rules (server)**

| Stage | Accepted | Leads to |
|---|---|---|
| `lobby` | Host `watch`, or `tv:watch` from the remote | `watch` |
| `watch` | Host `play`, `pause`, `seek` | `watch` (the command goes to the TV) |
| `watch` | Host `start-quiz`, with at least 1 question unlocked | `quiz` |
| `quiz` | Host `next` with the current index and phase, the 20 s timer, or every online player answered | The reveal, the next question, or `results` |
| `results` | Host `watch` | `watch` (the same film resumes, or starts again if it had ended) |
| `watch`, `quiz`, `results` | Host `lobby` | `lobby` (a quiz in progress and its timer are dropped) |

Anything else is ignored and logged as `ignored.<event>`. Every handler first checks its payload and, for an event with an ack, that the ack is a function. One uncaught throw in a Socket.IO handler stops the whole server (checked with Socket.IO 4.8: a client that sends `pad:join` without an ack is enough), so a bad event is dropped and logged as `invalid.<event>` instead.

### 4.6 State and data model

| State | Owner | Copies |
|---|---|---|
| Stage, chosen film | Server | The TV and pads draw it from `session:view` |
| Players, names, host, scores | Server | In `session:view` |
| Playback: position, paused, ended | TV app | The server keeps the latest; pads show progress |
| Quiz: questions, phase, answers, timer | Server | In `session:view`, without answers until the reveal |
| Pip state | Server | The TV and pads draw it |
| Ask Pip's last 3 questions and answers, each with the position it was asked at | Server | None |
| Player id, name and code | Pad (`localStorage`) | Server |
| Code and TV key | TV app (memory) | Server |

Server types:

```ts
// server/src/core/players.ts
export interface Player {
  id: string; // 32 lowercase hex characters, made by the pad
  name: string;
  socketIds: Set<string>; // online while not empty
  score: number;
  joinedAt: number;
  lastSeenAt: number; // when the last socket left (ms)
  lastAskAt: number; // when this player last asked Pip (ms)
}

/** The part of a session the player functions use, so any Pip product can reuse them. */
export interface Roster {
  players: Map<string, Player>; // insertion order is join order
  hostId: string | null;
}

// server/src/film/quiz.ts
export interface QuizRun {
  questions: QuizQuestion[]; // the unlocked questions, in story order
  index: number;
  phase: 'question' | 'reveal';
  phaseStartedAt: number;
  answers: Map<string, number>; // playerId -> choice, for the current question
  correct: number; // right answers so far, from everyone together
  answered: number; // answers given so far, from everyone together
}

// server/src/sessions.ts
export interface Session extends Roster {
  code: string;
  tvKey: string; // 32 hex characters; a TV needs it to take this code back
  tvSocketId: string | null;
  pip: PipState;
  stage: Stage;
  contentId: string | null;
  playback: Playback | null;
  playbackAt: number; // when the last tv:playback arrived (ms)
  asking: boolean; // the ask lock: one model call at a time
  // Newest last, at most 3; atSec is where the film was. Cleared for a new film.
  history: { atSec: number; question: string; answer: string }[];
  quiz: QuizRun | null; // kept through the results stage
  updatedAt: number;
}

export interface SessionStore {
  create(code: string, tvKey: string, tvSocketId: string, now: number): Session;
  get(code: string): Session | undefined;
  remove(code: string): void;
  sweep(now: number): string[]; // removes idle sessions (isIdle); returns their codes
}
```

### 4.7 Environments and URLs

| Environment | Server | Pads | TV | Public URL |
|---|---|---|---|---|
| Local UI work | `npm run dev` in `server/` | Vite dev server at `http://localhost:5173` (proxies to the server); two browser windows, one of them private, are two players | `npm run fake:tv` (a script that acts like a TV) | Not needed |
| Full loop | `npm run dev` in `server/` | The built pad served by the server, on real phones and the tablet | VVD or Fire TV device | Cloudflare quick tunnel |
| Demo recording | Same as full loop | The tablet for the host, opened once and added to the home screen; phones for the players | VVD or Fire TV device | Keep one tunnel running for the whole session |

- `npm run tunnel` (root) starts `cloudflared tunnel --url http://localhost:8787`, reads the `https://<random>.trycloudflare.com` URL it prints, and writes it into `server/.env` (`PUBLIC_URL`) and `tv/src/config.ts` (`SERVER_URL`). Start the tunnel first, then the server.
- A quick tunnel URL changes every time the tunnel restarts. When it does, rebuild or fast-refresh the TV app and re-open the pads. For a URL that never changes, use a Cloudflare named tunnel on a domain you own, or an ngrok free static domain (it shows a one-time warning page in browsers). Set `PUBLIC_URL` and `SERVER_URL` by hand in that case.
- The film streams from `/media/` through the same tunnel, so nothing depends on another company's video host.
- `localhost` counts as a secure context, so the microphone works on `http://localhost:5173` during development. Phones and the tablet need the HTTPS tunnel URL for the microphone. The tunnel also lets phones join from any network, including mobile data.

### 4.8 Security and privacy

- Being in the room is the permission. Anyone who can see the code on the TV can join as a player; that is the point of showing it. Codes are 4 characters from a 32-character alphabet (about one million codes) and unique among live sessions. Guessing is limited: after 60 joins with an unknown code in a minute, an address gets no new joins until the minute has passed, while players already in a session can always rejoin. Behind the tunnel the address is the `cf-connecting-ip` header that Cloudflare sets. A session holds at most 8 players, and it expires after 6 hours with no TV, no player online and no change.
- Only the host controls the film and the quiz. The server ignores host commands from anyone else.
- While a session is live, only the real TV can take its code back after a reconnect, because it must present the `tvKey` the server gave it. After a server restart no session has the code, so the first TV to say hello with that code gets it. That gap is accepted for v1.
- Player ids are random (128 bits), so they never collide, but they are not secrets: the view lists them, so someone already in the session could join as another player, even as the host. For a family in one room that is accepted, because being in the room is the permission. A per-player secret is a v2 item.
- Answers stay hidden. The view never contains the right answer, the explanation or anyone's pick before the reveal, and a test checks it.
- Every message from a client is validated with zod on the server, and an event without its ack is dropped, so a broken or hostile client cannot stop the server. Strings are length-capped and numbers are clamped.
- AWS credentials live only in the server's environment. They never reach the pads or the TV bundle.
- No accounts. First names only, kept in the server's memory and gone when the session ends or the server restarts (each pad remembers its own name on its device). Nothing is written to disk except quiz drafts, at development time (gitignored), and the answer memory (section 5.9): questions and Pip's answers with the film and scene, never names or player ids, in `server/data/` on the Mac (gitignored). `ANSWER_MEMORY=false` turns it off.
- Logs contain event names, timings, codes and player ids, never names. Question text is logged only when `LOG_TEXT=true` (development).
- The microphone listens only after a tap, for one question. It uses the browser's own speech recognition, which by default runs on the platform's speech service and may send the audio to the browser maker's servers. Our server never receives audio, only the text. The first use says "Your browser turns your voice into text."
- HTTPS everywhere through the tunnel. Run `npm audit` in each package before submitting.

### 4.9 Performance budgets

| Path | Target | How we measure |
|---|---|---|
| Host tap to TV reaction | 300 ms or less (median) | `sys:ping` round trip in the pad's debug overlay (`?debug=1`), plus eyeballing |
| Answer tap to the name lighting up on the TV | 300 ms or less (median) | Same |
| Question to answer on TV | 3 s or less (median), 6 s hard timeout | Server log `ask.done` with `ms` |
| TV app cold start to QR code | 5 s or less | Stopwatch |
| Scan to joined, typing a name included | 15 s or less | Stopwatch, in the usability test |

These are targets. Section 14.3 says how to measure them on the real demo setup; until then they are not results.

### 4.10 Failure modes and fallbacks

| Failure | What people see | Recovery |
|---|---|---|
| Server or tunnel down | "Reconnecting" pill on the pads and TV | Socket.IO retries forever; the TV takes its code back with its key; pads rejoin with their saved code, id and name |
| Server restarted during the film | A short "Reconnecting"; the film keeps playing | The TV's hello carries its playback, so the new session starts in `watch`. Scores and any quiz in progress are lost, and the first pad back becomes the host |
| TV app restarted | Pads show "TV offline", then the TV shows a new code | Scan again, or tap "Join another TV" and type the new code (S7 makes the code survive restarts) |
| A pad disconnects | Its name dims on the TV | It rejoins with its saved id and keeps its name and score |
| A pad opens the link of another TV | It joins that TV, and the first TV dims its name | None needed |
| The host's pad disconnects | After 10 s the host controls move to the next player | The old host comes back as a player |
| Model error or timeout | Pip says the fallback line; the starter chips come back | Logged with the error name; the next question tries again |
| `AI_ENABLED=false` | Fallback answers only | Used for offline rehearsal |
| Speech recognition missing or denied | No mic button, or "Type your question instead." | Typing and chips always work |
| Film fails to load | TV: "The film didn't load." | Check the file and its conversion (section 5.6) |
| A player joins during the quiz | They answer from the current question on | None needed |
| Session full | "This TV already has 8 players." | None needed |
| Everyone leaves during the quiz | The question times out and waits at its reveal | The first player back becomes host and carries on |

---

## 5. AI in v1

### 5.1 Where AI is

| # | Touchpoint | When | Where it runs | Model | Input | Output | Fallback |
|---|---|---|---|---|---|---|---|
| 1 | Ask Pip | Live, while watching | Server | Nova 2 Lite | The question, how it was asked, the premise, the notes up to now, the last 3 questions and answers | An answer (at most 2 sentences, 35 words) with 2 or 3 next questions, or 2 or 3 "Did you mean" options | A fixed line, and the starter chips come back |
| 2 | Quiz draft | Before the demo (`npm run draft:quiz`) | Parth's Mac | Nova 2 Lite | The premise and all the notes | 5 questions, each with 4 choices, the answer and a one-line explanation, for Parth to check | Parth writes the questions himself |
| 3 | Speech to text | Live, after a tap on the mic | The pad's browser | The browser's own speech recognition | The person's voice | The question as text | Typing and chips |

That is the entire AI surface of v1: one live model call, one drafting script and the browser's speech recognition. Player names are never sent to the model.

### 5.2 Model and call settings

| Setting | Value | Source |
|---|---|---|
| Model | Amazon Nova 2 Lite, model ID `amazon.nova-2-lite-v1:0` | Bedrock model card |
| Invoke with | US inference profile `us.amazon.nova-2-lite-v1:0` (in-Region invocation is not supported for this model) | Bedrock model card |
| Region | `us-east-1` | |
| API | Bedrock Runtime `Converse` (supported); no streaming in v1 | Bedrock model card |
| Structured output | Not supported by this model, so we ask for a fixed plain-text format (Ask Pip) or JSON (the draft) and check it ourselves | Bedrock model card |
| SDK | `@aws-sdk/client-bedrock-runtime`, `ConverseCommand`, client option `maxAttempts: 2` | |
| Ask Pip | `maxTokens: 200`, `temperature: 0.2`, timeout 6000 ms | |
| Quiz draft | `maxTokens: 1500`, `temperature: 0.4`, timeout 30000 ms | |
| Timeouts | Passed as `abortSignal: AbortSignal.timeout(ms)` to `client.send`, and enforced again with `withTimeout`, so a hung call can never hold Pip in `thinking` | |
| Reasoning | Do not enable extended reasoning; it adds latency | |
| Credentials | The `pip` profile from section 9.3, passed explicitly: the server calls `createBedrockModel({ region: config.AWS_REGION, profile: config.AWS_PROFILE, modelId: config.BEDROCK_MODEL_ID })`, which creates `new BedrockRuntimeClient({ region, profile, maxAttempts: 2 })`. Config defaults never reach `process.env`, so do not rely on the SDK reading `AWS_PROFILE` by itself | Section 9.3 |

Wrap the model behind one interface so tests and `AI_ENABLED=false` never touch the network:

```ts
// server/src/core/ai/model.ts
export interface TextModel {
  complete(input: {
    system: string;
    user: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  }): Promise<string>;
}
```

- `createBedrockModel({ region, profile, modelId })` implements it with `ConverseCommand`, joining the text parts of `output.message.content`. It takes plain values, not the server's config type, so Pip Core stays free of this product (section 4.3).
- `createFakeModel(reply)` returns `reply` when it is a string, or calls it with the input when it is a function, so tests can make the model throw or never answer.
- `withTimeout(promise, ms)` rejects with a `TimeoutError` after `ms`.

The prompts below have not been run against Nova yet. Step 7 measures them (section 14.3); change them here first, then in the code.

### 5.3 Ask Pip

**Context** (`buildAskPrompt({ title, positionSec, premise, notes, history, question, via })` in `server/src/film/ask-prompt.ts`, a logic module with tests; it returns `{ system, user }`):

1. Estimate where the film is now with `estimatePosition`: `positionSec` from the last `tv:playback`, plus the seconds since it arrived unless the film is paused, capped at `durationSec`. An ended film counts as its full length.
2. Take every note whose `atSec` is at or before that estimate. A 10-minute film has 15 to 25 notes, so all of them fit.
3. Take the questions and answers from the session's history that were asked at or before that estimate, and keep the last 3. Each history item keeps the position it was asked at (`atSec`), so after a rewind or a second viewing Pip does not see answers about scenes the family has not reached again.

Notes after the current position are never sent. The model may still know this well-known film, so the prompt forbids hints about later scenes, and the probes in section 14.3 check it.

**System prompt** (store verbatim in `server/src/film/prompts.ts`):

```text
You are Pip, a small, cheerful companion who watches films with a family on their TV.
Children may be asking, so use simple, friendly words.

Answer using only the facts inside <premise> and <notes>. The notes cover only what the
family has already seen. Never guess or hint at what happens later.

Reply in exactly one of these two formats, with nothing before or after it.

When you can tell what they are asking:
ANSWER: <at most 2 short sentences, at most 35 words>
NEXT: <question> | <question> | <question>

When the question is too unclear to answer well:
CLARIFY: <question> | <question> | <question>

Rules:
- Most questions get an ANSWER. Use CLARIFY only when you really cannot tell what they mean.
- If the notes do not contain the answer, say in the ANSWER line that you are not sure yet.
- NEXT: 2 or 3 short questions, at most 8 words each, that this person would naturally
  ask next about what they have already seen. Write them as they would say them.
- CLARIFY: 2 or 3 short questions, at most 8 words each. Each is a clearer version of
  what this person seems to be asking about. Never change their topic.
- If the question is not about the film, give one short, friendly ANSWER and NEXT
  questions about the film.
- Plain text only: no markdown, no emoji, no quotation marks.
- Do not start with "Great question" or repeat the question.
```

**For a small local model** (`AI_PROVIDER=ollama`, section 2.4), `prompts.ts` has `ASK_SYSTEM_PROMPT_SIMPLE`: the same rules without CLARIFY (small models overuse it), with explicit rules never to guess the future and never to make up facts, and two example replies about an invented film. The examples must never be about our films, because a small model copies them.

**User message template:**

```text
<title>{title}</title>
<now>{m:ss}</now>
<premise>{premise}</premise>
<notes>
[{m:ss}] {note text}
...
</notes>
<recent>
Q: {question}
A: {answer}
...
</recent>
{only when via is "clarify":} They picked this question from your options, so reply with ANSWER.
Question: {text}
```

`<recent>` is empty for the first question, and whenever no earlier question was asked at or before the current position. The `via` line exists only when the person tapped a "Did you mean" option (section 5.4, rule 2).

**Parsing** (`parseReply` in `server/src/core/ai/parse-reply.ts`, a logic module with tests):

1. Remove markdown characters (`*`, `_`, `#`, backticks).
2. A line that starts with `ANSWER:`, `NEXT:` or `CLARIFY:` (in any case) starts that field. The lines after it continue the field until the next label. Text before the first label is unlabelled.
3. If the `ANSWER` field has text after cleaning, the reply is an answer, with chips from `NEXT`. `ANSWER` wins if the model wrote both.
4. Otherwise, if `CLARIFY` gives 2 or more options, the reply is "Did you mean". This step is skipped when `allowClarify` is false.
5. Otherwise, unlabelled text becomes the answer, with no chips.
6. Otherwise there is no usable reply, and Pip says the not-sure line (see "What Pip says" below).

Chips and options (`toChips`): split on `|`; remove double quotes and collapse spaces; drop empty chips and chips over 60 characters; end each with "?" (replacing a final "." or "!"); drop duplicates and any chip that repeats the question (compared in lower case, ignoring punctuation); keep at most 3.

**Cleaning** (`cleanText` in `server/src/core/ai/clean-text.ts`, a logic module with tests): remove markdown characters, collapse whitespace, strip wrapping quotes, and keep at most 2 whole sentences within 240 characters. If even the first sentence is longer, cut it at the last whole word and add "…".

**The call** (`runAsk(model, prompt, question, settings)` in `server/src/core/ai/ask.ts`): calls the model through `withTimeout`, parses the reply, and never throws. It returns `{ reply }`, or `{ reply: null, error }`, where `error` is `'unparsed'` when the model replied but nothing usable was in it, and otherwise the error's name (`TimeoutError`, `ThrottlingException` and so on) for the log.

**What Pip says:**

| Result | `pip:say` | The asker's pad |
|---|---|---|
| Answer | `text` is the answer, `next` the chips, `source: 'ai'` | The answer under the chips for 8 s, and the next questions as chips for 60 s |
| "Did you mean" | `text` is "Did you mean one of these?", `clarify` the options, `source: 'ai'` | The options as big buttons, plus "Something else" |
| Model error or timeout | `text` is "I'm not sure right now. Ask me again in a moment.", `source: 'template'` | The starter chips |
| Nothing usable in the reply (`unparsed`), such as a second "Did you mean" after a pick | `text` is "I'm not sure about that one yet. Try asking another way.", `source: 'template'` | The starter chips |
| `AI_ENABLED=false` | `text` is "My brain is offline right now.", `source: 'template'` | The starter chips |

The TV shows `text` in Pip's bubble for every result; the options and chips appear only on the asker's pad. Only answers go into the session's history, with the position they were asked at.

### 5.4 Guidance: Pip steers, people stay in charge

Most people do not know how to talk to an AI. They ask half a question, or they do not know what to ask at all. Parth's idea comes from rocket guidance: a rocket never flies a perfect path by itself. Its guidance system keeps measuring where it is and makes small corrections back toward the planned path, never big swerves. Pip does the same with a conversation.

| Rocket guidance | Pip |
|---|---|
| The planned path | The film so far: the premise and the notes up to now |
| The sensor | Each question, and how it was asked (`via`) |
| A small correction | After an answer, 2 or 3 next questions; for a vague question, 2 or 3 clearer versions of it |
| Damping, so it does not over-correct | One correction per turn, and never a correction on top of a correction |
| The pilot can always take over | Chips are optional; typing and the mic always work |

The rules, built into the prompt, the parser and the pad:

1. **One small correction per turn:** an answer with next questions, or "Did you mean" options. Never both, and never more than 3 chips.
2. **Never a correction on top of a correction:** a question picked from "Did you mean" never gets a second "Did you mean". The pad sends `via: 'clarify'`, the prompt tells the model to answer, and the server parses that reply with `allowClarify: false`.
3. **Stay on the person's topic:** "Did you mean" options are clearer versions of what they asked, never a new topic.
4. **Stay on the path:** next questions are only about what the family has already seen.
5. **The person is the pilot:** typing and the mic always work, "Something else" closes the options and opens the Ask box, and chips go back to the starters after 60 s.
6. **No agenda:** Pip never steers people toward the quiz, a purchase or anything else of its own.

How we know it works (section 14.3): the server logs how each question was asked (`via`) and what came back (`kind`), so we can count how often people used the chips, how often a vague question got "Did you mean" and was then answered, and, in the usability test (section 14.4), whether people with no AI experience got the answers they wanted.

The same loop is part of Pip Core (section 4.3): another Pip product writes its own prompt with the same three labels and reuses the parser, the call and the pad's chips unchanged. Stretch goal S4 applies it to opinions: helping each person put their point into one clear sentence.

### 5.5 Quiz drafts

Nova drafts the quiz from the notes ahead of time, and Parth checks every question before it reaches the film file. The live quiz never calls the model.

**System prompt** (store verbatim in `server/src/film/prompts.ts`):

```text
You write a short multiple-choice quiz about a film that a family has just watched.
Children aged 7 and up will play, so use simple, friendly words.

Use only the facts inside <premise> and <notes>.

Write exactly 5 questions, in story order, spread across the whole film. For each:
- atSec: the time of the note the question is about, copied exactly
- question: at most 12 words
- choices: exactly 4 short choices, at most 6 words each, exactly one of them right
- answer: the position of the right choice, from 0 to 3
- explanation: one sentence, at most 25 words, saying why that choice is right

Rules:
- The right answer must be clearly stated in the notes.
- Wrong choices must sound possible, but be clearly wrong to someone who watched.
- Ask about what happens and why, not about tiny details. No trick questions.
- Reply with JSON only, with no markdown, in exactly this shape:
{"quiz":[{"atSec":0,"question":"","choices":["","","",""],"answer":0,"explanation":""}]}
```

**User message template:**

```text
<title>{title}</title>
<premise>{premise}</premise>
<notes>
[{atSec}] {note text}
...
</notes>
Write the quiz.
```

**Checks** (`server/src/film/draft-quiz.ts`, logic modules with tests):

- `parseQuizDraft(raw, content)`: takes the text from the first `{` to the last `}`, parses it as JSON, and checks the `quiz` list with the question rules in section 5.6. There must be exactly 5 questions, and each `atSec` must be the time of one of the notes. It returns the questions sorted by `atSec`, or the list of problems.
- `spreadAnswers(questions)`: moves the right choice of question 1 to 5 to the positions B, D, A, C, B, keeping the other choices in their order. Models tend to put the right answer first.

**The script** (`npm run draft:quiz -- <film id>`): calls Nova with the draft settings in section 5.2, checks the reply, spreads the answers, writes `server/content/drafts/<id>.quiz.json` (gitignored) and prints a review list. For each question the list shows its unlock time (m:ss), the note at that time, the question, the 4 choices with the right one marked, and the explanation. If the reply fails the checks, it prints the problems and the raw reply and exits 1; run it again, or write the questions by hand.

**Parth's checklist for every question:**

1. The right answer is clearly true in the film, and only one choice is right.
2. A 7-year-old would understand the question and the choices.
3. It can be answered by its unlock time: it is not about anything later.
4. The explanation is true and is one sentence.
5. Across the quiz, the right answers are spread over A to D.

Copy the questions that pass, fixed where needed, into the `quiz` list of the film file. The server checks the file again when it starts.

### 5.6 The film, its notes and its quiz

**The film:** Big Buck Bunny (2008, about 10 minutes), an open movie by the Blender Foundation, licensed CC BY 3.0. It has no dialogue, a clear story and a gentle, funny tone, so it works for every age and makes good questions. Credit line, shown on the TV and in the README: "Big Buck Bunny, (c) copyright 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0".

**Why we serve our own copy:** the public sample links that many tutorials use (`commondatastorage.googleapis.com/gtv-videos-bucket/...`) now answer `403 AccessDenied`. We serve the film from `server/media/` (gitignored) at `/media/big-buck-bunny.mp4`, through the same tunnel as everything else.

**Get and convert it** (Steps 0 and 2):

1. Download the H.264 file (720p or 1080p) from the official release folder linked on `peach.blender.org/download`.
2. Convert it to a 720p MP4 that starts playing before the whole file arrives (`+faststart`), and read its length:

```bash
mkdir -p server/media
ffmpeg -i <downloaded file> -vf scale=-2:720 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart server/media/big-buck-bunny.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 server/media/big-buck-bunny.mp4
```

3. Put the `ffprobe` duration, rounded down, into `durationSec`.
4. Make the poster for the film cards, a spoiler-free still (section 2.4): `ffmpeg -ss <sec> -i server/media/<id>.mp4 -frames:v 1 -vf "crop=ih*16/9:ih,scale=640:-2" -q:v 3 server/media/<id>.jpg`, and set `"poster": "/media/<id>.jpg"`. Big Buck Bunny uses 54 s; Sintel uses 294 s (the city at sunset).
5. Sintel (2010, CC BY 3.0, "Sintel, (c) copyright 2010 Blender Foundation, durian.blender.org, CC BY 3.0"): download `Sintel.2010.720p.mkv.zip` from `download.blender.org/durian/movies/`, check it against the `.md5` there, and convert it with the command above, adding `-map 0:v:0 -map 0:a:0 -ac 2` (the file has 5.1 sound and subtitle tracks).

**The film file** (`server/content/big-buck-bunny.json`):

```json
{
  "id": "big-buck-bunny",
  "title": "Big Buck Bunny",
  "url": "/media/big-buck-bunny.mp4",
  "credit": "Big Buck Bunny, (c) copyright 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0",
  "durationSec": 596,
  "premise": "One or two spoiler-free sentences that set up the story.",
  "notes": [
    { "atSec": 0, "text": "What is on screen and what has just happened, in one or two plain sentences." }
  ],
  "quiz": [
    {
      "atSec": 0,
      "question": "A question about the scene at this note?",
      "choices": ["The right choice", "A wrong choice", "A wrong choice", "A wrong choice"],
      "answer": 0,
      "explanation": "One sentence saying why the right choice is right."
    }
  ]
}
```

The example values show the shape only. `durationSec` comes from `ffprobe`; Parth writes the premise, the notes and the checked quiz.

**Rules** (checked by `contentSchema` when the server starts; it exits with the file name and the first problem):

- `id`: lowercase words joined by hyphens, the same as the file name.
- `url`: starts with `https://` or `/media/`. The server turns a `/media/` path into a full URL with `PUBLIC_URL`.
- `title` up to 60 characters, `credit` up to 200, `premise` up to 400.
- 1 to 40 notes, each up to 300 characters. Write 15 to 25.
- 1 to 8 quiz questions. Use 5. Each has a question of up to 120 characters, exactly 4 choices of up to 40 characters, an `answer` from 0 to 3 and an explanation of up to 200 characters.
- Notes and questions are in order of `atSec`, and every `atSec` is within the film.
- A question's `atSec` is when it unlocks: the earliest moment the family has seen enough to answer it.

**Writing the notes** (Parth, about 30 minutes): watch the film once. Every 20 to 40 seconds, write what is on screen and what has just happened, in plain words. Name characters the way a child would. Write facts, not opinions, and never mention anything that happens later. Stretch goal S2 drafts notes with Nova video understanding.

### 5.7 Cost

At Nova 2 Lite's prices ($0.30 per million input tokens, $2.50 per million output tokens):

- One question near the end of the film (every note so far, the system prompt and the last 3 answers): about 2,000 input and 90 output tokens, about $0.0008. A thousand rehearsal questions cost under $1.
- One quiz draft: about 3,000 input and 1,000 output tokens, about $0.003.

Set an AWS Budgets alert at $10 anyway (section 9.3).

### 5.8 Not in v1, on purpose

No agent loops, no tool calling, no web search, no vector database, no memory beyond the last 3 questions, no fine-tuning, no streaming responses, no spoken voice for Pip, no quiz written live and no computer vision. Each is a later item with a clear reason to add it.


### 5.9 Answer memory

`core/ai/answer-memory.ts` keeps each good answer with its film, its scene (the `atSec` of the last note before the question) and the question. Before calling the model, the same question at the same scene is answered from memory at once. When the model fails or is off, Pip answers with the closest remembered question (by shared topic words) from that scene or an earlier one, never a later one, so memory cannot spoil what the notes would not. Up to 2,000 answers, in `server/data/answer-memory.json`.

---

## 6. Amazon integrations

| Amazon technology | How v1 uses it | Status |
|---|---|---|
| Vega OS and the Vega SDK (React Native for Vega) | The TV app | Core |
| Vega Virtual Device, or a Vega-based Fire TV device such as the Fire TV Stick 4K Select | Where the demo runs (the rules allow a device or the simulator) | Core |
| W3C Media API (`@amazon-devices/react-native-w3cmedia`) | Plays the film (`VideoPlayer` with a video view such as `KeplerVideoView`, MP4 URL mode) | Core |
| Vega Media Controls | Play and pause from the remote, and from Alexa voice on a real Fire TV device; basic support comes with the W3C Media API | Expected with no extra code; Step 3 checks the remote, and section 14.2, check 10 checks Alexa on a device |
| Amazon Bedrock, Nova 2 Lite (Converse API) | Ask Pip (live) and the quiz drafts (before the demo) | Core |
| Amazon Devices Builder Tools (MCP, Agent Skills, steering docs) | Helps the coding agent build the Vega app correctly | Core (development) |
| AWS MCP Server | AWS documentation and skills for the coding agent | Recommended (development) |
| Fire HD tablet with the Silk browser | Runs the host's Pip Pad | Default demo device |
| Amazon Polly | Pip's voice | Stretch S1 |
| Nova video understanding | Drafts the film notes | Stretch S2 |
| AWS hosting (EC2) | Runs the server in the cloud | Stretch S5 |
| Alexa skill or Alexa+, AgentCore Runtime, Strands, DynamoDB, API Gateway WebSocket | The v2 architecture in the system design doc | v2 |

---

## 7. Contracts

### 7.1 `shared/protocol.ts`

This is the only place events and payloads are defined. Change it first, run `npm run sync:shared`, then update the server, pad and TV in the same commit. The copies in `server/src/shared/`, `pad/src/shared/` and `tv/src/shared/` are generated; never edit them.

The rules behind it:

- **One snapshot for everyone.** After every change the server sends the whole `SessionView` to the TV and every pad. A screen that reconnects needs no catch-up logic: the next view is the truth.
- **A repeated tap does no harm.** Play and pause say what to do, not "toggle". `next` carries the question and phase the host saw, so a double tap cannot skip a question. A rejoin with the same player id is the same player.
- **Only the owner writes.** The TV is the only writer of playback; the server is the only writer of the stage, the scores and Pip's state; only the host's pad can change the stage.
- **Secrets stay on the server.** The view never contains the notes, the right answer, the explanation or anyone's pick before the reveal.
- **A bad message never stops the server.** Every handler checks its payload with zod, and that the ack is a function for events that have one, before it does anything else (section 4.5).

This file was compiled with `strict` and run end to end against a stand-in server over real sockets (Socket.IO 4.8 server, client 4.7.5, Express 5) before this plan was written: joining, the host and its hand-over, playback commands, Ask Pip with guidance and spoiler-safe context, the quiz, the results, a server restart, a TV reconnecting, a pad moving to another TV, the join limit, and events with bad payloads or no ack.

```ts
// shared/protocol.ts
// The contract between the server, the Pip Pad (pad/) and the TV app (tv/).
// Edit only this file, then run `npm run sync:shared` to copy it into each package.
// Types and constants only: no imports, so it compiles in Node, browsers and React Native for Vega.

export const PROTOCOL_VERSION = 2;

/** Where the session is in the journey. The server owns it; the TV and pads follow it. */
export type Stage = 'lobby' | 'watch' | 'quiz' | 'results';
export type PipState = 'sleep' | 'idle' | 'thinking' | 'talking' | 'cheer';
export type Source = 'ai' | 'template';
/** How a question was asked: typed, spoken, or tapped from the starter, next or "Did you mean" chips. */
export type AskVia = 'typed' | 'voice' | 'starter' | 'next' | 'clarify';

/** A film as clients see it. Never includes the notes or the quiz. */
export interface ContentView {
  id: string;
  title: string;
  url: string; // full URL of the MP4
  credit: string;
  durationSec: number;
}

/** What the TV's video player is doing. The TV app is the only writer. */
export interface Playback {
  contentId: string;
  positionSec: number;
  durationSec: number;
  paused: boolean;
  ended: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  online: boolean;
}

export interface QuizView {
  index: number; // 0-based; screens show index + 1
  total: number;
  phase: 'question' | 'reveal';
  question: string;
  choices: string[]; // always 4, shown as A to D
  secondsLeft: number; // counts down in the question phase; 0 in the reveal
  answeredIds: string[]; // who has answered, never what they picked
  correct: number | null; // null until the reveal
  explanation: string | null; // null until the reveal
  picks: Record<string, number> | null; // playerId -> choice; null until the reveal
}

export interface ResultsView {
  ranking: { playerId: string; name: string; score: number; place: number }[]; // equal scores share a place
  questions: number; // questions in this quiz
  correct: number; // right answers from everyone together
  answers: number; // answers given by everyone together
}

/** The whole session in one snapshot. The server sends it to the TV and every pad after each change. */
export interface SessionView {
  code: string;
  stage: Stage;
  tvOnline: boolean;
  hostId: string | null;
  players: PlayerView[]; // in join order
  content: ContentView | null; // the film chosen for watch, quiz and results
  playback: Playback | null; // the TV's latest report for that film
  quizUnlocked: number; // quiz questions about scenes already watched
  pip: PipState;
  quiz: QuizView | null; // only in the quiz stage
  results: ResultsView | null; // only in the results stage
}

/** Commands only the host's pad may send. The server ignores them from anyone else. */
export type HostCommand =
  | { type: 'watch'; contentId: string } // from the lobby or results; the same film resumes
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; deltaSec: number }
  | { type: 'start-quiz' }
  | { type: 'next'; index: number; phase: 'question' | 'reveal' } // what the host saw, so a double tap cannot skip ahead
  | { type: 'lobby' };

/** What the server asks the TV's player to do. */
export type TvCommand = { type: 'play' } | { type: 'pause' } | { type: 'seek'; deltaSec: number };

export interface PipSay {
  askedBy: string; // playerId
  askedByName: string;
  question: string;
  text: string; // the answer, or "Did you mean one of these?"
  next: string[]; // up to 3 follow-up questions, for the asker's pad
  clarify: string[]; // up to 3 clearer versions of a vague question, for the asker's pad
  source: Source;
}

export type HelloResult =
  | { ok: true; code: string; tvKey: string; padUrl: string; qrUrl: string }
  | { ok: false; reason: 'invalid' };

export type JoinResult =
  | { ok: true; view: SessionView }
  | { ok: false; reason: 'invalid' | 'unknown-code' | 'rate-limited' | 'full' };

export type AskResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'not-watching' | 'busy' | 'too-soon' };

export type Ack<T> = (result: T) => void;

/** Events a client (TV or pad) sends to the server. */
export interface ClientToServerEvents {
  'sys:ping': (payload: { sentAt: number }, ack: Ack<{ sentAt: number; serverAt: number }>) => void;
  'tv:hello': (
    payload: { previousCode: string | null; tvKey: string | null; playback: Playback | null },
    ack: Ack<HelloResult>,
  ) => void;
  'tv:playback': (playback: Playback) => void;
  'tv:watch': (payload: { contentId: string }) => void; // the remote picked a film in the lobby
  'pad:join': (payload: { code: string; playerId: string; name: string }, ack: Ack<JoinResult>) => void;
  'pad:host': (command: HostCommand) => void;
  'pad:ask': (payload: { text: string; via: AskVia }, ack: Ack<AskResult>) => void;
  'pad:answer': (payload: { index: number; choice: number }) => void;
}

/** Events the server sends to the TV and pads of one session. */
export interface ServerToClientEvents {
  'session:view': (view: SessionView) => void; // to the TV and every pad, after each change
  'tv:command': (command: TvCommand) => void; // to the TV only
  'pip:say': (say: PipSay) => void; // to the TV and every pad; a pad shows it only to the asker
}

export const LIMITS = {
  codeLength: 4,
  nameMaxChars: 12,
  maxPlayers: 8,
  askMaxChars: 200,
  askMinIntervalMs: 2000, // per player
  seekMaxAbsSec: 60,
  failedJoinsPerMinute: 60, // per IP address; only joins with an unknown code count
  questionSeconds: 20,
  hostGraceMs: 10000,
  sessionIdleMs: 6 * 60 * 60 * 1000,
} as const;

/** Pairing code alphabet without 0, O, 1 or I, so codes are easy to read on a TV. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
```

`scripts/sync-shared.mjs` (copy verbatim):

```js
// scripts/sync-shared.mjs
// Copies shared/protocol.ts into each package that exists. With --check, exits 1 if a copy is stale.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = '// GENERATED from shared/protocol.ts by scripts/sync-shared.mjs. Do not edit this copy.\n';
const expected = header + readFileSync(join(root, 'shared', 'protocol.ts'), 'utf8');
const targets = ['server/src/shared', 'pad/src/shared', 'tv/src/shared'];
const check = process.argv.includes('--check');
let stale = 0;

for (const dir of targets) {
  const pkg = dir.split('/')[0];
  if (!existsSync(join(root, pkg))) {
    console.log(`skip  ${pkg}/ (not created yet)`);
    continue;
  }
  const file = join(root, dir, 'protocol.ts');
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === expected) {
    console.log(`ok    ${dir}/protocol.ts`);
  } else if (check) {
    console.error(`STALE ${dir}/protocol.ts (run npm run sync:shared)`);
    stale += 1;
  } else {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(file, expected);
    console.log(`wrote ${dir}/protocol.ts`);
  }
}

process.exit(stale > 0 ? 1 : 0);
```

### 7.2 Event table

| Event | From | To | When |
|---|---|---|---|
| `sys:ping` | TV or pad | Server (ack) | Debug overlay and diagnostics, every 5 s |
| `tv:hello` | TV | Server (ack) | Every socket connect |
| `tv:playback` | TV | Server | On play, pause, seek and ended, and every 5 s while playing |
| `tv:watch` | TV | Server | The remote picks a film in the lobby |
| `pad:join` | Pad | Server (ack) | Join, and every reconnect |
| `pad:host` | Host's pad | Server | A host control: pick a film, play, pause, skip, start the quiz, reveal or next, back to the lobby |
| `pad:ask` | Pad | Server (ack) | Ask, a chip or the mic |
| `pad:answer` | Pad | Server | A quiz answer tap |
| `session:view` | Server | TV and every pad | After every change |
| `tv:command` | Server | TV only | The host's play, pause or skip |
| `pip:say` | Server | TV and every pad | An answer, "Did you mean" options or a fallback line is ready |

### 7.3 HTTP endpoints

| Method and path | Returns | Notes |
|---|---|---|
| `GET /health` | `{ "ok": true, "version": "0.1.0", "uptimeSec": 12, "ai": true }` | Used by preflight |
| `GET /api/films` | `ContentView[]`: `{ id, title, url, credit, durationSec }` for every film in `server/content/` | Never includes the notes or the quiz. `url` is a full URL |
| `GET /qr/:code` | PNG (`Content-Type: image/png`) of `<PUBLIC_URL>/?code=<code>`, 512 px | 404 for unknown codes. No `.png` in the path, to keep Express 5 routing simple |
| `GET /media/*` | The film files in `server/media/` | `express.static` answers Range requests with `206 Partial Content`, which video players need to seek. A missing file gets a 404 from a small handler after it, never the pad's page |
| Any other `GET` | The built pad app (`pad/dist`), with a fallback to `index.html` | Only if `pad/dist` exists. Do the fallback in a last `app.use` middleware, for GET requests only, and skip paths under `/api`, `/qr` and `/media` so they can answer 404: Express 5 no longer accepts `'*'` as a route path |

### 7.4 Environment variables (`server/.env`, never committed)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `PUBLIC_URL` | `http://localhost:8787` | Public HTTPS base URL; written by `npm run tunnel` |
| `AWS_PROFILE` | `pip` | AWS credentials profile (section 9.3) |
| `AWS_REGION` | `us-east-1` | Bedrock region |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-2-lite-v1:0` | Inference profile ID |
| `AI_ENABLED` | `true` | `false` uses the fixed lines only |
| `AI_PROVIDER` | `bedrock` | `bedrock` (Nova 2 Lite) or `ollama` (a free local model, used until the AWS account works and for offline rehearsals) |
| `OLLAMA_URL` | `http://localhost:11434` | The local Ollama server |
| `OLLAMA_MODEL` | `qwen2.5:3b` | The local model; small enough to run beside the Vega Virtual Device on an 8 GB Mac |
| `ANSWER_MEMORY` | `true` | Keep good answers in `server/data/answer-memory.json` (gitignored), section 5.9 |
| `LOG_TEXT` | `false` | `true` logs question text (development only) |

`server/.env.example` lists every variable with its default. `server/src/config.ts` parses the environment with zod at startup and exits with a clear message if anything is invalid. The films are every file in `server/content/`; there is no setting for them.

### 7.5 Root `package.json` scripts

The root has no dependencies and no workspaces. Each package installs its own dependencies, because the Vega app's tooling must not be mixed with the others. `tunnel.mjs` and `preflight.mjs` are written in Steps 3 and 11; until then those two scripts are not used.

```json
{
  "name": "pip-firetv",
  "private": true,
  "scripts": {
    "sync:shared": "node scripts/sync-shared.mjs",
    "check:shared": "node scripts/sync-shared.mjs --check",
    "tunnel": "node scripts/tunnel.mjs",
    "preflight": "node scripts/preflight.mjs",
    "typecheck": "node scripts/run-all.mjs typecheck",
    "lint": "node scripts/run-all.mjs lint",
    "test": "node scripts/run-all.mjs test"
  }
}
```

`scripts/run-all.mjs` (copy verbatim) runs one script in every package that exists, so the root checks work from Step 1 on:

```js
// scripts/run-all.mjs
// Runs one npm script (typecheck, lint or test) in each package that exists. Usage: node scripts/run-all.mjs test
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = process.argv[2];
const packages = ['server', 'pad'];
let failed = 0;

if (!script) {
  console.error('Usage: node scripts/run-all.mjs <script>');
  process.exit(2);
}

for (const pkg of packages) {
  if (!existsSync(join(root, pkg, 'package.json'))) {
    console.log(`skip  ${pkg}/ (not created yet)`);
    continue;
  }
  console.log(`\n> ${pkg}: npm run ${script}`);
  const result = spawnSync('npm', ['run', script], { cwd: join(root, pkg), stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

process.exit(failed > 0 ? 1 : 0);
```

The TV app keeps the scripts its Vega template generates; check it with its own lint script and a VVD build (section 10.10).

---

## 8. Repository layout

```text
pip-firetv/
  PROJECT.md                   this file
  README.md                    what it is, how to run it, credits
  LICENSE                      MIT
  CLAUDE.md                    generated by ADBT, plus one line pointing to PROJECT.md
  .mcp.json                    MCP config written by ADBT (no secrets)
  .claude/skills/              project skills (Appendix B)
  .editorconfig  .gitignore  .nvmrc  package.json
  shared/
    protocol.ts                the contract (section 7.1)
  scripts/
    sync-shared.mjs            copies the contract into packages
    run-all.mjs                runs typecheck, lint or test in each package
    tunnel.mjs                 starts the tunnel and writes the URL (Step 3)
    preflight.mjs              demo-day checks (Step 11)
  docs/
    friction-log.md            for the friction log bonus (Appendix A)
    feedback.md                product feedback per Amazon tool (Appendix A)
    demo-script.md             the video script (section 16)
    measurements.md            latency, answers, probes, guidance, quiz, usability (section 14)
    devpost.md                 submission text (Step 12)
  server/
    package.json  tsconfig.json  eslint.config.js  .env.example  README.md
    content/
      big-buck-bunny.json      the film's details, notes and checked quiz (section 5.6)
      drafts/                  quiz drafts from Nova, for review (gitignored)
    evals/
      big-buck-bunny.json      spoiler and unknown-fact probes (section 14.3)
    media/                     the film file (gitignored)
    scripts/
      fake-tv.ts               acts like a TV for pad development
      smoke-join.ts            a fake TV and two fake pads join; exits 0 on success
      smoke-quiz.ts            plays a whole quiz with two fake pads
      smoke-ai.ts              one real Nova call; prints the reply and latency
      eval-ask.ts              runs the probes in evals/ against Nova
      draft-quiz.ts            asks Nova for a quiz draft (section 5.5)
    src/
      index.ts                 starts HTTP and Socket.IO
      config.ts                environment parsing (zod)
      log.ts                   one JSON line per event
      app.ts                   Express routes
      realtime.ts              Socket.IO handlers (thin; they call the modules below)
      sessions.ts              the Session type, isIdle() and the in-memory store
      view.ts                  buildView(): the SessionView, answers hidden until the reveal
      validate.ts              zod schemas for every incoming payload
      flow.ts                  stage changes: watch, lobby, ask, quiz, reveal, next
      lines.ts                 Pip's fixed lines that the server sends (section 3.5)
      core/                    Pip Core: never imports from film/ (section 4.3)
        codes.ts               pairing codes
        pairing.ts             a reconnecting TV's code; the host's grace period
        rate-limit.ts          the join limit: unknown codes per address
        players.ts             names, joining, leaving, the host
        timers.ts              keyed timers
        pip.ts                 Pip's states and their timers
        ai/model.ts            TextModel, the Bedrock and fake models, withTimeout
        ai/clean-text.ts       output cleaning
        ai/parse-reply.ts      ANSWER, NEXT and CLARIFY parsing
        ai/ask.ts              runAsk(): one guided model call that never throws
      film/                    film night
        content.ts             the film file schema, loading, unlockedQuestions()
        playback.ts            estimatePosition()
        prompts.ts             the Ask Pip and quiz draft prompts (verbatim from section 5)
        ask-prompt.ts          buildAskPrompt()
        quiz.ts                answers, reveals, scores, standings
        draft-quiz.ts          buildDraftPrompt(), parseQuizDraft(), spreadAnswers()
      shared/protocol.ts       generated copy
      *.test.ts                tests next to the code they test, in every folder
  pad/
    package.json  vite.config.ts  index.html  README.md
    public/manifest.webmanifest  public/icons/
    src/
      main.tsx  App.tsx
      net/socket.ts            the one typed socket
      state/store.ts           reducer and actions (logic, tested)
      screens/                 JoinScreen  LobbyScreen  WatchScreen
                               QuizScreen  ResultsScreen (.tsx)
      components/              Pip  StatusPill  PlayerList  HostControls  Chips  AskBox
                               MicButton  AnswerButtons  DebugOverlay (.tsx)
      lib/                     player-id  speech  haptics  wake-lock  fullscreen  format (.ts)
      styles/tokens.css  styles/app.css
      shared/protocol.ts       generated copy
  tv/
    (generated by the Vega CLI; keep its files and scripts)
    manifest.toml  package.json  README.md
    src/
      App.tsx                  chooses the screen from the stage
      config.ts                SERVER_URL (rewritten by npm run tunnel) and SHOW_DIAGNOSTICS
      theme.ts                 tokens from section 3.2
      net/socket.ts            typed socket; tv:hello on every connect
      state/tv-store.ts        reducer for the TV
      player/use-player.ts     wraps VideoPlayer
      screens/                 DiagnosticsScreen  LobbyScreen  WatchScreen
                               QuizScreen  ResultsScreen (.tsx)
      components/              Pip  Bubble  StatusPill  PlayerChips  ChoiceGrid (.tsx)
      lib/format.ts
      shared/protocol.ts       generated copy
```

---

## 9. Mac setup (one time, about 90 minutes)

### 9.1 Tools

```bash
# 1. Homebrew (skip if `brew -v` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Vega SDK prerequisites listed by Amazon for macOS
brew install binutils coreutils gawk findutils grep jq lz4 gnu-sed watchman
softwareupdate --install-rosetta --agree-to-license   # Apple silicon Macs only

# 3. Node.js 22 LTS (follow the PATH line brew prints, then open a new terminal)
brew install node@22
node -v   # expect v22.x

# 4. Vega SDK, Vega Virtual Device and the Vega Studio VS Code extension
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash && source ~/vega/env
vega --version                 # shows the active SDK and CLI versions
vega virtual-device start
vega virtual-device status

# 5. Everything else
brew install git gh awscli cloudflared ffmpeg
gh auth login
```

Notes:

- If `vega` is not found, run `source ~/vega/env` or open a new terminal.
- If a Vega build fails with a Node version error, install `node@20` and use it for the `tv/` folder only.
- If a build asks for Java or Python, install them with `brew install openjdk@21 python`.
- The ADBT MCP server needs Node 18 or later; Amazon notes it fails on Node 26, so stay on 22.

### 9.2 Coding agent

Install Claude Code (`curl -fsSL https://claude.ai/install.sh | bash`) or use Kiro. Section 12 adds the skills and MCP servers after the repo exists (Step 1).

### 9.3 AWS

1. Create an IAM user named `pip-dev` (console, IAM, Users). Attach this inline policy:

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          "Resource": "*"
        }
      ]
    }
    ```

   Add `polly:SynthesizeSpeech` later only if you build stretch goal S1.
2. Create an access key for the CLI and run `aws configure --profile pip` (region `us-east-1`, output `json`).
3. Smoke test:

    ```bash
    aws bedrock-runtime converse --profile pip --region us-east-1 \
      --model-id us.amazon.nova-2-lite-v1:0 \
      --messages '[{"role":"user","content":[{"text":"Say hi in three words."}]}]'
    ```

   If it fails with `AccessDeniedException`, open the Bedrock console, find Nova 2 Lite in the model catalog, enable access if asked, and try again.
4. Create a monthly cost budget of $10 with an email alert (Billing, Budgets).
5. Never paste keys into code, chat or commits. The server reads them through `AWS_PROFILE`.

---

## 10. Coding standards

### 10.1 Language and tools

- TypeScript everywhere, with `strict: true`. The server and pad also use `noUncheckedIndexedAccess: true`. The TV keeps the Vega template's settings and adds `strict` if the template does not have it.
- No `any`. Use `unknown` and narrow it. No `@ts-ignore`; if a type is wrong, write a one-line comment explaining why and use `@ts-expect-error`.
- Prettier for formatting (`singleQuote: true`, `printWidth: 100`). ESLint with `typescript-eslint` recommended rules. The TV keeps the template's lint setup.
- Node.js 22 LTS (`.nvmrc`). ES modules (`"type": "module"`) for the server and pad.

### 10.2 Naming

| Thing | Style | Example |
|---|---|---|
| Module files | kebab-case | `parse-reply.ts` |
| React components and their files | PascalCase | `WatchScreen.tsx` |
| Functions | camelCase, starting with a verb | `buildAskPrompt` |
| Booleans (variables and functions) | `is`, `has`, `can`, `should` | `isOnline(player)`. Fields in `shared/protocol.ts` read like the media API: `paused`, `ended`, `online` |
| Constants | UPPER_SNAKE_CASE | `MAX_CHIPS` |
| Types and interfaces | PascalCase, no `I` prefix | `SessionView` |
| Socket events | `domain:action` | `pad:ask` |
| Tests | Describe behavior | `it('reveals the answer as soon as every online player has answered')` |

### 10.3 Structure

- One responsibility per file. Aim for files under 200 lines and functions under 40 lines.
- Separate logic from input and output. Logic modules (`codes`, `players`, `quiz`, `view`, `parse-reply`, `clean-text`, the prompt builders, the reducers) take plain data and the time as arguments, and change only the session or object they are given. They never touch sockets, timers, the network or the clock, and they have tests. Modules that touch sockets, the microphone, the network or timers stay thin.
- `server/src/core/` never imports from `server/src/film/` (section 4.3).
- Pass dependencies in (the model, the clock, the random function) instead of importing globals, so logic is testable.
- No magic numbers. Thresholds, timings and limits live in `constants.ts` files or `LIMITS`.
- Socket handlers in `realtime.ts` only validate, look up the session and call a module (`flow.ts` for stage changes). No business rules in handlers.

### 10.4 Errors and validation

- Validate every incoming payload on the server with zod, and for events with an ack, check that the ack is a function. Type each schema as `z.ZodType<PayloadType>`: that catches most drift from the protocol, but not a union variant or an optional field the schema leaves out, so update `validate.ts` in the same commit as every protocol change. Drop invalid messages and log `invalid.<event>`.
- Never let an exception cross a socket handler: an uncaught throw in a Socket.IO handler stops the whole server. Catch at the boundary, log with context, and send a safe fallback to the person.
- Never swallow an error silently. Every `catch` logs or rethrows.
- Clients trust the server's types and render defensively (for example, `null` content shows a friendly empty state).

### 10.5 Logging

- `log.info(event, fields)`, `log.warn`, `log.error` print one JSON line with a timestamp: `{"ts":"...","level":"info","event":"ask.done","code":"K7QD","playerId":"5f2e...","ms":1180,"kind":"answer","source":"ai"}`.
- Never log secrets, player names or full question text (unless `LOG_TEXT=true`). Log player ids, not names.

### 10.6 Comments and docs

- Every file starts with a one or two line comment saying what it is for.
- Comments explain why, not what. Exported functions get a one-line doc comment.
- Each package README has four parts: What it is, How to run, How to test, Environment. Update it in the same commit when commands or variables change.

### 10.7 Dependencies

- Add a dependency only when it removes real work, and note why in the package README.
- On the TV, use only libraries from Amazon's Vega supported libraries list. Add `@amazon-devices/*` packages with `vega project install <package>`, which writes the compatible version into `package.json`; then run `npm install`. Run `vega project doctor` if anything looks wrong.
- Commit every lockfile.

### 10.8 Tests

- Vitest for the server and pad. Tests sit next to the code (`quiz.test.ts`).
- Every logic module has tests. Socket and microphone code is tested by the smoke scripts and the manual checks in section 14.
- Tests never call AWS. Use the fake model.

### 10.9 Git

- Conventional Commits 1.0: `<type>(<scope>): <summary>`, for example `feat(server): add quiz state machine`.
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`.
  - Scopes: `server`, `pad`, `tv`, `shared`, `scripts`, `docs`.
  - Summary in the imperative, lower case, no period, at most 72 characters.
- Work on `main` in small commits. Every commit must build and run. Use a branch only for a risky experiment, and delete it after.
- Tag the demo build `v0.1.0`.
- Never commit `.env`, keys, the film file or build output.

### 10.10 Definition of done for every step

1. `npm run check:shared`, `npm run typecheck`, `npm run lint` and `npm test` pass at the root.
2. If `tv/` changed, the TV app builds and runs on the VVD.
3. The step's "Done when" checks were run and their real output was shown.
4. READMEs are updated if commands or variables changed.
5. A friction log entry is written if any Amazon tool cost more than 15 minutes.
6. The work is committed with the step's commit message.

---

## 11. Rules for AI coding agents

1. **Read first.** Read this file before the first task of a session, and the step's sections before each step. Read existing code before changing it.
2. **Be accurate.** Never invent APIs, package names, CLI flags, model IDs, file paths or results. Verify them with the ADBT MCP (`search_documentation`, `read_document`), the AWS MCP server (`aws___search_documentation`), the package's types in `node_modules`, or official docs. If you cannot verify something, write "unverified" and say how to check it.
3. **Answer exactly.** When asked a question, answer it first in one or two sentences, then give the evidence: a file and line, a doc link, or command output. If you do not know, say so.
4. **Small steps, real proof.** Make one change, run it, show the actual output. Never say something works without having run it. If a check fails, say so and show the output.
5. **Stay in scope.** Do only the current step. Do not add features, files or dependencies the step does not list. Write ideas under "Later" in your report instead.
6. **Keep the contract.** `shared/protocol.ts` is the only definition of events and payloads. Change it first, run `npm run sync:shared`, and update every package in the same commit.
7. **Keep `main` working.** Never leave the repo in a state that does not build or run.
8. **Protect secrets.** Never print, log or commit credentials. Use `.env.example` for documentation.
9. **Ask before anything hard to undo:** deleting files outside the step, force-pushing, rewriting history, publishing, or creating paid AWS resources beyond Bedrock calls.
10. **Use the fallback when stuck.** If a tool problem blocks you for 20 minutes, stop, write a friction log entry, and take the documented fallback in section 18.
11. **Use skills.** Load the ADBT skills for anything Vega. Use `frontend-design` for visual polish and `webapp-testing` for browser checks of the pad when installed. If you repeat a procedure three times, propose a project skill.
12. **Write for the reader.** Someone tired should understand any file in two minutes: obvious names, short files, a header comment, no clever tricks.

---

## 12. Skills and MCP servers

Set these up in Step 1, right after the repo exists. Run the commands from the repo root.

### 12.1 Amazon Devices Builder Tools (required)

ADBT gives the agent Amazon's MCP tools, Agent Skills and an always-on steering document for Vega.

```bash
# Interactive: choose Claude Code (or your agent), accept the MCP settings update
npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context

# Or non-interactive for Claude Code
npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context --agent claude-code-cli --force

# Verify
npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest check-status --agent claude-code-cli
```

Then ask the agent: "List the tools provided by Amazon Devices Builder Tools and Agent Skills." Documented tools include `search_documentation`, `read_document`, `list_documents`, `read_asset`, `analyze_perfetto_traces`, `get_app_hot_functions` and `symbolicate_acr`.

ADBT writes a `CLAUDE.md` context file. Add this line at its top so the agent always starts here:

```text
Read PROJECT.md before any task. It is the source of truth for scope, architecture, contracts, standards and build order, and it overrides general guidance where they differ.
```

For Kiro, put the same line in `.kiro/steering/project.md`.

### 12.2 AWS MCP Server (recommended)

Gives the agent current AWS documentation (`aws___search_documentation`) and AWS skills (`aws___retrieve_skill`).

```bash
# OAuth needs this managed policy on the IAM user (or role) you sign in to the console with
aws iam attach-user-policy --user-name <your console IAM user> \
  --policy-arn arn:aws:iam::aws:policy/AWSMCPSignInOAuthAccessPolicy

claude mcp add aws-mcp https://aws-mcp.us-east-1.api.aws/mcp --transport http
```

The first tool call opens a browser window to sign in to AWS.

### 12.3 Anthropic example skills (optional, Claude Code)

```text
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
```

From a terminal, the first command is `claude plugin marketplace add anthropics/skills`. Useful skills: `frontend-design` (visual polish, Step 10), `webapp-testing` (Playwright checks of the pad, Steps 5, 7 and 9) and `skill-creator` (writing project skills).

### 12.4 Project skills (we write them)

- `.claude/skills/ship-step/SKILL.md`: the definition of done and commit routine. Written in Step 1 from Appendix B.
- `.claude/skills/run-pip/SKILL.md`: how to start the whole stack and check it. Written in Step 6, when the real commands are known.

---

## 13. Build plan

### 13.1 How the steps work

- Each step has a goal, a prompt to paste after the session start prompt (section 0.2), "Done when" checks, and a commit message.
- Do the steps in order. Each one leaves the project working.
- Steps marked "You" are for Parth, not the agent. Some steps also have "You first" or "You then" parts for Parth.
- The steps are grouped into five gates. A gate is passed only when its exit check (section 15.1) passes on the real setup. If it fails, use the cut lines in section 15.2 before starting the next gate.
- The riskiest parts come first. Gate 1 proves the Vega app's networking and video, and one real Nova call, on day two, before any feature is built on them.

### 13.2 Overview

| Gate | Step | Name | Day | Risk |
|---|---|---|---|---|
| 1 Prove the platform | 0 | Prepare the Mac and the film (You) | Thu Oct 15 | Medium |
| 1 Prove the platform | 1 | Repo skeleton and agent tooling | Thu Oct 15 | Low |
| 1 Prove the platform | 2 | Server skeleton, films and the first Nova call | Thu Oct 15 | Low |
| 1 Prove the platform | 3 | TV spike: networking and video on Vega | Fri Oct 16 | **High** |
| 2 Watch together | 4 | Sessions, players and the host | Fri Oct 16 | Medium |
| 2 Watch together | 5 | Pad: join, lobby and host controls | Sat Oct 17 | Low |
| 2 Watch together | 6 | TV: lobby and watch | Sat Oct 17 | **High** |
| 3 Pip and the quiz | 7 | Ask Pip with guidance | Sun Oct 18 | Medium |
| 3 Pip and the quiz | 8 | Quiz drafts | Mon Oct 19 | Low |
| 3 Pip and the quiz | 9 | Quiz and results | Mon Oct 19 to Tue Oct 20 | Medium |
| 4 Prove it with people | 10 | Polish and resilience | Tue Oct 20 | Low |
| 4 Prove it with people | 11 | Demo hardening and the usability test | Wed Oct 21 | Medium |
| 5 Ship | 12 | Ship | Thu Oct 22 | Low |

### 13.3 Steps

#### Step 0: Prepare the Mac and the film (You)

Goal: every tool installed and proven, and the film downloaded, before any code.

1. Do section 9 in order.
2. Download Big Buck Bunny (section 5.6, step 1). You convert it in Step 2.
3. Create an empty GitHub repository named `pip-firetv` (public, so it can use the MIT license), clone it, and copy this file into it.

Done when:
- `vega --version` prints the SDK and CLI versions.
- `vega virtual-device status` shows the VVD running.
- The `aws bedrock-runtime converse` smoke test prints a reply.
- `cloudflared --version`, `ffmpeg -version` and `gh auth status` work.
- The film file is on the Mac.

#### Step 1: Repo skeleton and agent tooling

Goal: the empty project shape, the shared contract and the agent's tools.

You first: run the ADBT commands in section 12.1 in the repo root, add the PROJECT.md line to `CLAUDE.md`, and optionally do sections 12.2 and 12.3. Restart the agent so it loads the MCP servers.

Prompt:

```text
Step 1. Read PROJECT.md sections 7, 8, 10, 12 and Appendices A and B.
Create only the root of the repo and shared/ (not server/, pad/ or tv/ yet):
- README.md: title "Pip for Fire TV", the one-line pitch from section 1.3,
  "Status: in development", a link to PROJECT.md, and a Credits section with the
  Big Buck Bunny credit line from section 5.6.
- LICENSE: MIT, copyright 2026, holder "Parth Rait".
- .gitignore: node_modules, dist, build, coverage, .env, .env.*, !.env.example,
  *.vpkg, server/media/, server/content/drafts/, .DS_Store.
- .editorconfig: 2 spaces, LF line endings, final newline, UTF-8.
- .nvmrc containing 22.
- package.json and scripts/run-all.mjs exactly as in section 7.5.
- shared/protocol.ts and scripts/sync-shared.mjs exactly as in section 7.1.
- docs/friction-log.md and docs/feedback.md from Appendix A.
- .claude/skills/ship-step/SKILL.md from Appendix B.
Then run `npm run sync:shared`, `npm run check:shared` and `npm test`.
Expected: each says it skips the packages that do not exist yet, and exits 0.
Do not create any other files. Show the file tree and the command output.
```

Done when: the tree matches section 8 for the root, both scripts run, and the agent lists the ADBT tools when asked.

Commit: `chore: scaffold repo, shared protocol and agent tooling`

#### Step 2: Server skeleton, films and the first Nova call

Goal: a running server that serves the film and its details, and one real answer from Nova, before any feature.

Prompt:

```text
Step 2. Read PROJECT.md sections 4.2, 4.3, 5.2, 5.6, 7.1, 7.3, 7.4, 8 (server) and 10.
Create server/ as an ES module TypeScript project:
- Dependencies: express, socket.io, zod, dotenv, qrcode, @aws-sdk/client-bedrock-runtime.
  Dev dependencies: typescript, tsx, vitest, @types/node, @types/express, @types/qrcode,
  eslint, typescript-eslint, prettier, socket.io-client.
- Scripts: dev (tsx watch src/index.ts), start (tsx src/index.ts), test (vitest run),
  typecheck (tsc --noEmit), lint (eslint .), format (prettier --write .) and
  smoke:ai (tsx scripts/smoke-ai.ts). There is no build step: tsx runs the TypeScript
  directly, in development and in the demo.
- tsconfig.json: strict, noUncheckedIndexedAccess, module and moduleResolution NodeNext,
  target ES2022, noEmit, include ["src", "scripts"].
- src/config.ts: parse the variables in section 7.4 with zod, apply the defaults, export a
  frozen config object, exit with one clear message on invalid input.
- src/log.ts: log.info, log.warn, log.error as described in section 10.5.
- src/film/content.ts: contentSchema with the rules in section 5.6; the Content, Note and
  QuizQuestion types inferred from it; loadFilms(dir), which reads every content/*.json,
  checks it, checks that its id matches the file name, and exits with the file name and
  the first problem if a check fails; toContentView(content, publicUrl), which turns a
  /media/ path into a full URL with new URL(); and unlockedQuestions(content, positionSec).
- content/big-buck-bunny.json: the real id, title, url (/media/big-buck-bunny.mp4), credit
  and durationSec 596 from section 5.6, the premise "Placeholder premise. Parth writes the
  real one in Step 7.", one placeholder note at 0 and one placeholder quiz question at 0,
  so the file passes the checks.
- src/app.ts: createApp(config, films) with GET /health and GET /api/films (section 7.3),
  and server/media/ served at /media with express.static, followed by a handler that
  answers 404, so a missing file never falls through to the pad's page.
- src/core/ai/model.ts: the TextModel interface, createBedrockModel({ region, profile,
  modelId }), createFakeModel(reply) and withTimeout(promise, ms), all as in section 5.2.
- scripts/smoke-ai.ts (npm run smoke:ai): one real call with the system prompt "Reply in
  at most 8 words." and the message "Say hello to a family watching a film."; prints the
  reply and the latency in ms, or the AWS error name and message and exits 1.
- src/index.ts: import 'dotenv/config'; load the films; create the HTTP server and a
  Socket.IO server typed with ClientToServerEvents and ServerToClientEvents from
  src/shared/protocol.ts; answer sys:ping; log connect and disconnect with the socket id;
  listen on PORT.
- .env.example with every variable from section 7.4 and its default. Copy it to .env
  (gitignored) so local runs use the same values.
- README.md with What, Run, Test, Environment.
Tests: config (defaults apply; an invalid PORT is rejected); content (the real file passes;
a question after the end of the film, notes out of order and a list of 3 choices are each
rejected; unlockedQuestions returns only the questions at or before the position;
toContentView makes a full URL and has no notes or quiz); withTimeout rejects a promise
that never settles.
Run `npm run sync:shared` at the root first so src/shared/protocol.ts exists.
```

You then: convert the film into `server/media/big-buck-bunny.mp4` with the commands in section 5.6, and put the `ffprobe` duration, rounded down, into `durationSec`.

Done when:
- `npm run typecheck`, `npm run lint` and `npm test` pass in `server/`.
- With `npm run dev` running, `curl -s localhost:8787/health` prints `{"ok":true,...}` and `curl -s localhost:8787/api/films` lists the film with a full URL and no notes.
- `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' -H 'Range: bytes=0-99' localhost:8787/media/big-buck-bunny.mp4` prints `206 video/mp4`, and a request for `/media/missing.mp4` answers 404.
- `npm run smoke:ai` prints a reply and its latency.

Commit: `feat(server): add server skeleton, film files and the first nova call`

#### Step 3: TV spike: networking and video on Vega

Goal: prove the two riskiest things on the real platform before building on them: the Vega app reaches our server through the tunnel, and it plays our film. Nothing else.

Prompt:

```text
Step 3. Read PROJECT.md sections 4.4, 4.7, 5.6, 6, 7.3, 8 (tv), 18 and Appendix C.
This step is a spike: prove networking and video on Vega, and nothing else.
1. Generate the Vega app into tv/. Prefer the ADBT tools and skills. The CLI form is:
     vega project generate --template helloWorld --name piptv --packageId com.parthrait.piptv --outputDir tv
   If the CLI creates a nested folder (tv/piptv/), move its contents up into tv/.
   Build and run the unchanged app on the Vega Virtual Device first. The CLI forms are
     vega virtual-device start
     npx react-native build-vega
     vega run-app <path to the .vpkg under build/> com.parthrait.piptv.main -d VirtualDevice
   but use the scripts in tv/package.json if the template provides them. Record the exact
   commands that worked in tv/README.md.
2. Add socket.io-client@4.7.5 (the version Amazon lists as tested on Vega). Run
   `vega project install @amazon-devices/react-native-w3cmedia`, then `npm install`.
   Run `npm run sync:shared` at the root.
3. src/config.ts: `export const SERVER_URL = 'http://localhost:8787';` and
   `export const SHOW_DIAGNOSTICS = true;`, each on its own line.
4. scripts/tunnel.mjs at the repo root, exactly as in Appendix C.
5. src/player/use-player.ts: wraps VideoPlayer and its video view in MP4 URL mode (no
   Shaka): load(url, startSec), play(), pause(), seekBy(deltaSec) clamped to the film, and
   an onReport(playback) callback called on play, pause, seek and ended, and every 5 s
   while playing. The 0.21 media player guide uses KeplerVideoView; newer API references
   also list KeplerVideoSurfaceView. Check the current guide through ADBT, and use the
   view it shows that the installed package exports.
6. src/screens/DiagnosticsScreen.tsx, shown while SHOW_DIAGNOSTICS is true: one line each
   for SERVER_URL; GET /health (ok, or the error); the Socket.IO connection (connected, and
   the sys:ping round trip in ms every 5 s); GET /api/films (the first film's title); and
   the first film playing full screen behind the lines, with its position counting up.
7. Start the tunnel (npm run tunnel), then the server, then fast-refresh or rebuild the
   TV app so it uses the tunnel URL.
8. Press play and pause on the remote (or the VVD's controls) and write in tv/README.md
   whether Vega Media Controls paused the film without extra code (section 6). Alexa
   voice can only be checked on a real Fire TV device (section 14.2, check 10).
If the socket never connects, read the device logs
(vega device start-log-stream --device VirtualDevice) and work through section 18, row 1.
If the film does not play, work through section 18, row 2.
```

Done when: on the VVD, through the tunnel URL, every diagnostics line is green, the round trip is under 300 ms, and the film plays with its position counting up; the result of the remote's play and pause is written down; the commands that worked are in `tv/README.md`. This is the exit check of gate 1.

Commit: `feat(tv): prove vega app networking and film playback`

#### Step 4: Sessions, players and the host

Goal: the whole session logic on the server, proven with fake clients: the TV gets a code, players join with names, one of them is the host, and the host's commands reach the TV.

Prompt:

```text
Step 4. Read PROJECT.md sections 4.3, 4.5 (Join, Host, Watch and the stage rules), 4.6,
4.8, 4.10, 7.1 to 7.3 and 10.3.
Logic modules take the time as an argument and never touch sockets, timers, the network
or the clock. Implement in server/src:
- core/codes.ts: newCode(random = Math.random) using CODE_ALPHABET and LIMITS.codeLength;
  isValidCode(value).
- core/players.ts: the Player and Roster types from section 4.6, and cleanName(raw),
  uniqueName(name, taken), isOnline(player), joinPlayer(roster, input, nowMs),
  leaveSocket(roster, playerId, socketId, nowMs) and pickHost(roster, nowMs), with the
  rules in section 4.5 (Join and Host). cleanName collapses whitespace, removes control
  characters, trims, and returns null when the result is empty or longer than
  LIMITS.nameMaxChars. uniqueName compares names without case and adds " 2", " 3" and so
  on, shortening the name so the result still fits.
- core/rate-limit.ts: createRateLimit(max, windowMs) with isLimited(key, nowMs) and
  record(key, nowMs): it counts recorded events per key in a sliding window.
- core/timers.ts: createTimers() with set(key, ms, fn), which replaces any timer with the
  same key, clear(key) and clearAll().
- core/pip.ts: CoreDeps ({ timers, broadcast, now }), restingPip(roster) (idle, or sleep
  if no player is online) and setPip(holder, state, deps, backToIdleAfterMs?) for any
  Roster & { code: string; pip: PipState }. setPip clears the holder's Pip timer, sets
  the state and calls deps.broadcast(); when asked, it schedules the return to rest.
- core/pairing.ts: pickTvCode({ previousCode, tvKey }, findKey), which returns reuse,
  restore or new with the rules in section 4.5 (Join, step 2), and
  startHostGrace(roster, deps): a keyed timer of LIMITS.hostGraceMs + 100 ms (so the
  grace period has passed by the clock when it fires) that runs pickHost and broadcasts.
- film/playback.ts: estimatePosition(playback, playbackAt, nowMs) as in section 5.3.
- sessions.ts: the Session and SessionStore types from section 4.6; isIdle(session,
  nowMs), which is true only when no TV and no player is online and nothing changed for
  LIMITS.sessionIdleMs; and an InMemorySessionStore whose sweep(now) removes the
  sessions isIdle picks and returns their codes.
- view.ts: buildView(session, films, publicUrl, nowMs), which returns the SessionView from
  section 7.1. The quiz and results fields stay null until Step 9.
- validate.ts: one zod schema per ClientToServerEvents payload, each typed as
  z.ZodType<ThatPayloadType>. Codes use CODE_ALPHABET; player ids and TV keys are 32
  lowercase hex characters; seeks are clamped to plus or minus LIMITS.seekMaxAbsSec; the
  ask text is trimmed and 2 to LIMITS.askMaxChars characters long, and via is one of the
  five AskVia values.
- flow.ts: broadcast(session, deps), which sets updatedAt and sends session:view to room
  s:<code>; watchFilm(session, contentId, deps) and goToLobby(session, deps), with the
  rules in section 4.5 (Watch and the stage rules). Both drop any quiz and clear its
  timer; watchFilm also clears the playback of the same film if it had ended.
- realtime.ts: registerRealtime(io, deps). Pass one deps object (io, store, films, config,
  timers, model, log, now) into the handlers and the flow functions; nothing reads
  globals. Handlers only validate, find the session and call the modules above. Each
  one first checks its payload and, for an event with an ack, that the ack is a
  function; otherwise it drops the event, because a throw would stop the server.
  tv:hello: pickTvCode. On reuse, record the new socket as the TV first, then disconnect
    the older TV socket; on restore, re-create the session as in section 4.5 (Join,
    step 2). Keep the role and code in socket.data.
  pad:join: validate and cleanName. A player id already in that session is never
    limited. Otherwise ack rate-limited when the client's address has
    LIMITS.failedJoinsPerMinute unknown-code joins in the last minute; an unknown code
    is recorded against the address and gets unknown-code. The address is the
    cf-connecting-ip header (behind the tunnel every socket comes from localhost), or
    the socket address when there is none. If the socket is in another session, leave
    it first, as on disconnect. Then joinPlayer; pickHost; join the room; ack with the
    view; wake Pip if it was asleep; broadcast.
  pad:host: only from the host, and only what the stage rules in section 4.5 allow.
    watch: watchFilm. play, pause and seek: send tv:command to the TV socket only.
    lobby: goToLobby. start-quiz and next are ignored until Step 9.
  tv:watch and tv:playback: only from the session's current TV socket. tv:watch in the
    lobby only. tv:playback only for the chosen film; store it with its arrival time
    (session.playbackAt) and broadcast.
  disconnect: a TV socket clears tvSocketId only if it is still the session's TV
    socket. A pad: leaveSocket; if that was the host's last socket, startHostGrace. Put
    Pip to sleep when no player is online.
  Log a message that the rules do not allow as ignored.<event>, and one that fails
  validation as invalid.<event>. Sweep idle sessions every 10 minutes.
- app.ts: GET /qr/:code using qrcode.toBuffer(`${PUBLIC_URL}/?code=${code}`,
  { type: 'png', width: 512, margin: 2 }), sent as image/png; 404 for unknown codes.
- scripts/fake-tv.ts (npm run fake:tv): connects as a TV, prints the code and pad URL, logs
  every view and command it receives, and behaves like a TV: keeps a Playback in memory,
  applies tv:command to it, and sends tv:playback every 5 s while playing.
- scripts/smoke-join.ts (npm run smoke:join): a fake TV and two fake pads; the first pad
  joins as "Sam", the second as "sam"; a host command from the second pad is ignored; the
  first pad's watch and pause commands reach the TV; a pad:join sent without an ack is
  ignored and GET /health still answers. Prints
  "JOIN OK code=XXXX players=Sam,sam 2 host=Sam" and exits 0, or exits 1 after 5 seconds.
Tests: codes (alphabet, length, 10,000 codes are all valid); players (cleanName; a second
"Sam" becomes "Sam 2"; a 12-character duplicate is shortened to fit; the first player is
host; a known id keeps its name and score; the 9th player is refused; pickHost keeps the
host within the grace period and passes it to the earliest-joined online player after it;
with nobody online it keeps the host); rate-limit (limited at the max inside the window,
free again as it passes, keys counted apart); timers (setting a key again replaces its
timer; clear and clearAll stop them); pickTvCode (reuse with the right key, restore an
unknown valid code, otherwise new); setPip and startHostGrace with a fake timers object;
estimatePosition (adds elapsed time only while playing, an ended film counts as its full
length, never past durationSec); sessions (create, get, isIdle is false while a TV or a
player is online, sweep); view (online flags; quizUnlocked counts only in watch);
validate (bad codes, ids and long text are rejected; seeks are clamped); and the Pip Core
rule: a test reads every file in src/core and fails if a relative import leads outside
src/core and src/shared.
```

Done when: tests pass; with the server running, `npm run smoke:join` prints `JOIN OK` and exits 0; opening `http://localhost:8787/qr/<code>` shows a QR code.

Commit: `feat(server): add sessions with named players, a host and qr pairing`

#### Step 5: Pad: join, lobby and host controls

Goal: people join from their phones with a name, and the host controls the film, proven with the fake TV.

Prompt:

```text
Step 5. Read PROJECT.md sections 3 (all), 4.5 (Join, Host, Watch), 4.7, 7.1 and 8 (pad).
From the repo root run `npm create vite@latest pad -- --template react-ts`, then
`npm install` in pad/. Remove the Vite demo content. Run `npm run sync:shared`.
- Scripts: keep the template's dev, build and lint; add typecheck (tsc -b) and
  test (vitest run), with vitest as a dev dependency.
- Add socket.io-client. src/net/socket.ts: one typed socket using io() (same origin).
  On every connect, if a code, name and player id are saved, send pad:join again. If that
  rejoin gets unknown-code or rate-limited, retry every 10 s for two minutes, showing
  "Looking for your TV". Never retry a code typed on the join screen by itself.
- src/lib/player-id.ts: getPlayerId() returns the id saved in localStorage as
  'pip.playerId', or makes one from crypto.getRandomValues (16 bytes as 32 lowercase hex
  characters) and saves it. Save the code and name as 'pip.code' and 'pip.name'.
- src/state/store.ts: a reducer with connection ('connecting' | 'online' | 'offline'),
  the latest SessionView, myId, the latest pip:say for me, and the chips to show
  (section 3.3). The reducer is a logic module with tests.
- Screens from section 3.3, chosen by view.stage once joined:
  JoinScreen: a ?code= in the address wins over the saved code and replaces it; four
    big code boxes that turn letters into capitals; the first-name field (maxLength 12)
    with its help line; join errors in the words of section 3.5.
  LobbyScreen: the host picks a film from /api/films; everyone else waits; the player
    list marks "you" and "host".
  WatchScreen: the host controls only for the host (back 10 s, Play or Pause, forward
    10 s, the progress line, Lobby, and the quiz button, which shows "The quiz unlocks as
    you watch" and stays disabled until Step 9); everyone else sees "<host> has the
    controls".
  QuizScreen and ResultsScreen: placeholders.
- components/StatusPill.tsx (Online, Reconnecting, TV offline, with "Join another TV"
  while the TV is offline: it forgets the saved code and opens JoinScreen),
  components/Pip.tsx (the
  CSS version of the states in section 3.4, at 32 to 64 px), components/PlayerList.tsx,
  components/HostControls.tsx, and components/DebugOverlay.tsx, shown with ?debug=1: the
  sys:ping round trip every 5 s.
- styles/tokens.css with the tokens from section 3.2, and styles/app.css. No UI library.
- public/manifest.webmanifest: name "Pip Pad", display standalone, portrait,
  background and theme color #0B0B0F, simple icons.
- vite.config.ts: dev proxy for /socket.io (ws: true), /api, /qr and /media to
  http://localhost:8787.
- server/src/app.ts: serve pad/dist with express.static and an index.html fallback in a
  last app.use middleware when the folder exists, for GET requests only and skipping
  /api, /qr and /media.
- README.md with What, Run, Test.
Tests: the reducer (a new view replaces the old one; the host controls follow hostId; a
pip:say for someone else does not change my chips).
If the webapp-testing skill is installed, use it to join from two browser windows (one of
them private, so it gets its own player id) and click through the lobby and watch.
```

Done when: `npm run build` passes in `pad/`; with the server and `npm run fake:tv` running, two browser windows at `http://localhost:5173/?code=<code>` (one of them private) join as two players and both names show in both windows; the first is the host; picking the film shows the watch screen in both; the host's Pause makes the fake TV log `tv:command pause`; the other window shows "<host> has the controls"; closing the host's window passes the controls to the other window after about 10 s.

Commit: `feat(pad): add join, lobby and host controls`

#### Step 6: TV: lobby and watch

Goal: the real TV app shows the lobby with the QR code and the players, plays the film the host picks, and obeys the host's pad.

Prompt:

```text
Step 6. Read PROJECT.md sections 3.2 to 3.4, 4.5 (Join, Watch), 4.10, 6, 7.1 and 8 (tv).
Build on the spike from Step 3. Keep DiagnosticsScreen behind SHOW_DIAGNOSTICS, and set
it to false.
- src/net/socket.ts: a typed socket to SERVER_URL. On every connect send tv:hello with
  the last code and tvKey (kept in memory), and the last playback only while the watch
  screen is showing (otherwise null); store the result.
- src/state/tv-store.ts: a reducer for the hello result (code, qrUrl), the latest
  SessionView and the latest pip:say.
- App.tsx chooses the screen from view.stage (section 3.3). Before the first view, show
  Pip asleep and "Connecting".
- LobbyScreen: Pip, the QR <Image> from qrUrl at 320 x 320 on a white rounded card, the
  code in large spaced letters, "Scan to join", the players as chips with the host marked,
  and one focusable card per film from /api/films (the first gets preferred focus). OK on
  a card sends tv:watch.
- WatchScreen: when the stage becomes watch, load content.url at the resume point
  (section 4.5, Watch, step 3) and play. Send tv:playback from use-player's onReport.
  Apply tv:command play, pause and seek. The credit line for 4 s at the start, the pause
  bar for 3 s on pause, a small Pip bottom right, and "The end. Ready for the quiz?" when
  the film ends. When the stage leaves watch, pause the film.
- components/Pip.tsx: the five states from section 3.4 with Animated, transform and
  opacity only. Use the native driver if Vega supports it; verify with ADBT.
- components/StatusPill.tsx ("Reconnecting" while the socket is down) and
  components/PlayerChips.tsx.
- QuizScreen and ResultsScreen: placeholders that show the stage name.
Finally write .claude/skills/run-pip/SKILL.md from Appendix B with the real commands.
```

Done when: on the VVD, through the tunnel:
- The lobby shows the QR code. Scanning it with a phone opens the pad, and joining with a name shows the name on the TV and wakes Pip.
- The host's pad starts the film, and Play, Pause and both skips work with no visible delay (the pad's debug overlay round trip is under 300 ms).
- The remote can start the film from the lobby.
- Restarting the server mid-film shows "Reconnecting", then the film keeps playing and the pads rejoin by themselves.

This is the exit check of gate 2.

Commit: `feat(tv): add lobby with qr pairing and pip, and host-controlled playback`

#### Step 7: Ask Pip with guidance

Goal: anyone asks about the film and Pip answers on the TV within 3 seconds, without spoilers, with next questions to tap, or "Did you mean" options for a vague question.

You first: watch Big Buck Bunny once and write the premise and 15 to 25 real notes into `server/content/big-buck-bunny.json` (section 5.6). Then write `server/evals/big-buck-bunny.json` with 10 spoiler probes and 5 unknown-fact probes (section 14.3).

Prompt:

```text
Step 7. Read PROJECT.md sections 3.3 to 3.5, 4.5 (Ask Pip), 5.1 to 5.4, 7 and 14.3.
Server:
- core/ai/clean-text.ts: cleanText(raw), as in section 5.3.
- core/ai/parse-reply.ts: parseReply(raw, question, { allowClarify }), as in section 5.3.
  It returns an answer with next chips, "Did you mean" options, or null.
- core/ai/ask.ts: runAsk(model, prompt, question, settings), which calls the model through
  withTimeout, parses the reply and never throws: it returns { reply }, or
  { reply: null, error } with 'unparsed' or the error name (section 5.3).
- film/prompts.ts: the Ask Pip system prompt and user template from section 5.3, verbatim.
- film/ask-prompt.ts: buildAskPrompt({ title, positionSec, premise, notes, history,
  question, via }), as in section 5.3.
- lines.ts: the fixed lines from section 3.5 that the server sends.
- flow.ts: askPip(session, player, text, via, deps), with the rules in sections 4.5 (Ask
  Pip), 5.3 and 5.4: take the ask lock (session.asking) and set Pip thinking; estimate
  the position; build the prompt with every note up to then and the last 3 questions and
  answers asked at or before then; runAsk with allowClarify false when via is clarify;
  release the lock in a finally; then send pip:say to the room and set Pip talking for
  8 s. If the stage or the film changed meanwhile, drop the reply and set Pip back to
  idle (or sleep). Save model answers to the history with the position they were asked
  at (keep 3), but not fixed lines or "Did you mean" replies. The fixed line is the
  not-sure line for 'unparsed' and the fallback line otherwise. AI_ENABLED=false uses
  the offline line without calling AWS.
- realtime.ts pad:ask: validate, then ack invalid, not-watching, busy or too-soon as in
  section 4.5, or ok and call askPip. Log ask.start with the player id and via, and
  ask.done with the player id, ms, kind (answer, clarify or fallback) and source.
- scripts/eval-ask.ts (npm run eval:ask): runs every probe in evals/big-buck-bunny.json
  against the real model at its atSec and prints each answer with the LEAK? and CHECK flags
  from section 14.3, then a summary line. It always exits 0: a person reads the flags.
- docs/measurements.md: create it with a "Grounding probes" section and an empty table
  (time, question, answer, flag, verdict). Step 11 adds the other sections.
Tests: buildAskPrompt sends every note up to the estimated position and none after it,
sends only history asked at or before it (at most 3 pairs), and adds the via line only
for clarify; parseReply (an
ANSWER with NEXT; a CLARIFY with 2 options; ANSWER wins over CLARIFY; CLARIFY is ignored
when allowClarify is false; unlabelled text becomes an answer with no chips; lowercase and
bold labels work; chips over 60 characters, duplicates and a chip that repeats the
question are dropped; at most 3 chips, each ending with "?"); cleanText (markdown removed;
at most 2 sentences and 240 characters; one long sentence cut at a word with "…"); runAsk
(a model that throws, or never answers within the timeout, gives reply null and the error
name; a CLARIFY with allowClarify false gives 'unparsed'); askPip with a fake model and
fake timers (busy while another ask runs, too-soon within 2 s, not-watching outside
watch, a reply that lands after the host went to the lobby is dropped, and the lock is
free again after a model error).
Pad:
- components/Chips.tsx and the chip rules in section 3.3: the starter chips, then the next
  questions of your own answer for 60 s, or the "Did you mean" options as big buttons plus
  "Something else", which opens the Ask box.
- components/AskBox.tsx: a text field and an Ask button, at most 200 characters, disabled
  while Pip is thinking. Show a refused ask in the words of section 3.5 (busy, too-soon,
  not-watching, invalid).
- components/MicButton.tsx with lib/speech.ts: the Web Speech API where it exists (section
  4.8), one question per tap. Show the words in the Ask box as they are heard, and send
  the final text when the person stops talking. Show no button where the API does not
  exist, and "Type your question instead." if it fails or is denied.
- Send via with every ask: typed, voice, starter, next or clarify. Show the latest answer
  to you under the chips for 8 s.
TV: components/Bubble.tsx next to Pip in WatchScreen: "<name> asked: <question>" above the
answer, up to 4 lines at 36 dp, at most 1000 dp wide, fade in over 180 ms, hide after 8 s.
```

Done when:
- `npm run smoke:ai` and `npm run eval:ask` run, and the `eval:ask` flags are read and written into `docs/measurements.md`.
- On the VVD, a question about a scene that has just played gets a correct, spoiler-free answer within 3 s, with two or three next questions on the asker's pad.
- A vague question such as "what was that thing" gets "Did you mean" options, and tapping one gets an answer, never a second "Did you mean".
- With `AI_ENABLED=false`, the offline line appears.
- Tests pass.

Commit: `feat: add ask pip with guidance chips and spoiler-safe notes`

#### Step 8: Quiz drafts

Goal: Nova drafts a five-question quiz from the notes, and Parth checks every question before it reaches the film file.

Prompt:

```text
Step 8. Read PROJECT.md sections 5.2, 5.5 and 5.6.
Server:
- film/prompts.ts: add the quiz draft system prompt and user template from section 5.5,
  verbatim.
- film/draft-quiz.ts: buildDraftPrompt(content); parseQuizDraft(raw, content), which
  returns the questions or a list of problems; and spreadAnswers(questions). All three as
  in section 5.5, all logic modules.
- scripts/draft-quiz.ts (npm run draft:quiz -- <film id>): calls Nova with the draft
  settings in section 5.2, checks the reply, spreads the answers, writes
  content/drafts/<id>.quiz.json and prints the review list from section 5.5. If the reply
  fails the checks, print the problems and the raw reply and exit 1.
Tests: parseQuizDraft accepts a good reply with extra text around the JSON, and rejects
invalid JSON, 4 or 6 questions, 3 choices, an answer of 4, and an atSec that is not the
time of a note; spreadAnswers puts the right answers at B, D, A, C, B and keeps the text
of every choice.
```

You then: run `npm run draft:quiz -- big-buck-bunny`, check every question with the checklist in section 5.5, fix or rewrite what is wrong, and copy the five checked questions into the `quiz` list of `server/content/big-buck-bunny.json`. Restart the server; it checks the file.

Done when: the script writes a draft and prints the review list; the film file holds 5 checked questions and the server starts with it; tests pass.

Commit: `feat(server): add nova quiz drafts for review`

#### Step 9: Quiz and results

Goal: the family plays the quiz on their own screens and sees the results together.

Prompt:

```text
Step 9. Read PROJECT.md sections 3.3 to 3.5, 4.5 (Quiz and the stage rules), 4.6, 4.8
and 7.1.
Server:
- film/quiz.ts: the QuizRun type from section 4.6, and startQuiz, recordAnswer,
  everyoneAnswered, revealQuestion, nextQuestion and standings, with the rules in section
  4.5 (Quiz). startQuiz resets every score. A right answer scores 1 point. Equal scores
  share a place (1, 2, 2, 4).
- view.ts: fill quiz and results (section 7.1). Before the reveal, the view never contains
  the right answer, the explanation or anyone's pick.
- flow.ts: startQuizFlow, reveal and next, with the rules in section 4.5 (Quiz): the
  unlocked questions and the paused resume point, the 20 s question timer (keyed per
  session), the reveal when every online player has answered (checked after each answer
  and after a player leaves), Pip cheering for 1.5 s when at least half of the answers
  were right and talking for 4 s otherwise, the next guard on index and phase, and the
  results stage after the last reveal, with Pip cheering.
- realtime.ts: pad:answer (only from a player in the session), and pad:host start-quiz
  and next.
- scripts/smoke-quiz.ts (npm run smoke:quiz): a fake TV and two fake pads, Sam (the host)
  and Mia. The TV reports the film as ended; Sam starts the quiz; for each question Sam
  taps the right choice and Mia a wrong one; Sam taps Next twice on one reveal, and the
  second tap must be ignored. Prints "QUIZ OK questions=5 Sam=5 Mia=0" and exits 0, or
  exits 1 after 20 seconds.
Tests: quiz (only the current question in its question phase counts; a new tap replaces
the old one; everyoneAnswered is false when nobody is online, so the timer reveals; the
reveal scores right answers; standings share places; nextQuestion ends after the last
question); view (no answer, explanation or picks before the reveal, all three after it;
secondsLeft counts down); a stale next is ignored; goToLobby and watchFilm during a quiz
clear its timer (fake timers).
Pad:
- QuizScreen: the question, four answer buttons A to D at least 96 px tall, the time left,
  your choice outlined in mint, the reveal lines from section 3.5, and for the host
  "Reveal now" during a question and "Next question" or "See results" during a reveal.
  Both send next with the index and phase on screen.
- ResultsScreen: "You got <score> of <questions>.", the standings, the family total, and
  for the host "Keep watching" (only when the film has not ended) and "Back to lobby".
- WatchScreen: the quiz button as in section 3.3.
- A short vibration on a right answer where supported (lib/haptics.ts).
TV:
- QuizScreen: components/ChoiceGrid.tsx with the choices in a 2 x 2 grid, the countdown
  bar, the players' names lighting up when they have answered, and the reveal from
  section 3.3.
- ResultsScreen: the standings, the family total and Pip cheering.
```

Done when: tests pass; `npm run smoke:quiz` prints `QUIZ OK`; on the VVD with three players (the tablet and two phones), a full quiz plays with no answer visible before each reveal, the reveal comes as soon as everyone has answered, and the results match what was tapped; "Keep watching" resumes the film where the quiz started. The whole journey, from scanning to the results, is the exit check of gate 3.

Commit: `feat: add family quiz with reveal, scores and results`

#### Step 10: Polish and resilience

Goal: it feels finished and it survives the usual failures.

Prompt:

```text
Step 10. Read PROJECT.md sections 3 (all), 4.9 and 4.10.
Use the frontend-design skill if installed. Keep every rule in section 3.1.
- Pip motion on both screens: breathing, blinking, thinking dots, talking bounce, cheer
  hops, exactly as in section 3.4. Respect prefers-reduced-motion on the pad.
- Transitions: 180 ms fades between screens. No other new animation.
- Walk through every row of the section 4.10 table on the VVD and the demo devices, and
  make each one show the described message and recover. Fix what does not.
- TV: check the 5% safe margin and the type scale on every screen.
- Pad: touch targets of at least 56 px and answer buttons of at least 96 px; fullscreen
  on the first tap where supported (lib/fullscreen.ts); keep the screen awake while
  joined, where supported (lib/wake-lock.ts).
- Remove debug logging that is not behind ?debug=1 or LOG_TEXT.
List anything you could not fix as "Known issues" in the README.
```

Done when: every row in section 4.10 was tried and recovers; the screens match section 3; there are no console errors in normal use. Feature freeze: from tonight, only fixes.

Commit: `feat: polish pip motion, states and reconnect handling`

#### Step 11: Demo hardening and the usability test

Goal: a demo that works on the first try, every time, and evidence that Pip helps real people.

Prompt:

```text
Step 11. Read PROJECT.md sections 4.7, 14 and 16.
- scripts/preflight.mjs (npm run preflight) at the root. It checks and prints a PASS or
  FAIL line for each: the Node major version is 22; PUBLIC_URL from server/.env answers
  /health over HTTPS; /api/films returns the film with a full URL, and a Range request for
  its first 100 bytes answers 206 with Content-Type video/mp4;
  server/content/big-buck-bunny.json has 5 quiz
  questions; pad/dist exists; `npm run smoke:ai --prefix server` succeeds within 6 s.
  Exit 1 if anything fails.
- docs/demo-script.md from section 16, with the exact questions to ask and the scene time
  to start from.
- docs/measurements.md: add a section and an empty table for each part of sections 14.3
  and 14.4 that Step 7 did not create.
- Tag v0.1.0 when preflight passes.
```

You then:
1. Run the measurements in section 14.3 and the usability test in section 14.4, and write the results into `docs/measurements.md`. Fix anything they show is broken.
2. Rehearse the demo script three times in a row without a failure, then record the video takes.

Done when: `npm run preflight` passes; `docs/measurements.md` has real numbers and the usability write-up; three clean rehearsals; raw takes recorded. This is the exit check of gate 4.

Commit: `chore: add preflight checks, demo script and measurements`

#### Step 12: Ship

Goal: submitted on Devpost by Thursday October 22.

Prompt:

```text
Step 12. Read PROJECT.md sections 1, 4.3, 6, 14, 16 and 17.
- README.md: what Pip is and why (sections 1.1 to 1.7), a screenshot of each TV stage and
  of the pad, the architecture diagram from section 4.1, Pip Core and the film activity
  (section 4.3), how to run it (link to each package README), the Amazon technologies
  used (section 6), tests and measurements (link docs/measurements.md), and credits and
  licenses (Big Buck Bunny under CC BY 3.0 with the credit line from section 5.6, and any
  MIT-0 sample code reused).
- docs/devpost.md: the project story in Devpost's sections (inspiration, what it does,
  how we built it, challenges, accomplishments, what we learned, what's next), the
  pre-existing project statement, the usability results, and the product feedback
  summary from docs/feedback.md.
- Make sure docs/friction-log.md is complete and readable.
- Run npm audit in server/ and pad/ and fix anything high or critical that has a fix.
Show me the final README and devpost.md for review before I submit.
```

You then: edit and upload the video, fill in Devpost from `docs/devpost.md`, and go through section 17 line by line.

Commit: `docs: add final readme, devpost text and credits`

### 13.4 Stretch goals (only after Step 11 passes)

Each has a short prompt. Run it after the session start prompt, and keep the definition of done.

| Goal | Prompt |
|---|---|
| S1 Pip's voice | "Add Amazon Polly speech for Pip's answers: the server calls SynthesizeSpeech (neural voice, MP3) and sends a short-lived URL with pip:say; the asker's pad plays it. Off by default behind VOICE_ENABLED. Add polly:SynthesizeSpeech to the IAM policy." |
| S2 Film notes from Nova | "Write server/scripts/index-film.ts that sends the film to Nova 2 Lite's video understanding in short clips and drafts timestamped notes in the section 5.6 format for Parth to review. First check the Nova 2 video input limits in the AWS docs." |
| S3 Workout, a second activity | "Copy pip-pad/archive/PROJECT-workout-version.md from the project files into docs/archive/. Add workout as a second activity on Pip Core, following its sections 5.4 and 5.6: a new server/src/workout/ folder, new pad and TV screens and new events in shared/protocol.ts, with no change to server/src/core/. Measure the rep counts against reps counted by hand on video, and call it movement feedback, not form coaching." |
| S4 Film talk | "After the film, add a 'Film talk' stage: each player types or says what they thought; Nova rewrites each into one clear sentence that keeps the person's meaning and main words and adds no new ideas; the person keeps the rewrite or their own words; the TV shows everyone's sentences side by side. This is the guidance loop of section 5.4 applied to opinions." |
| S5 Deploy to AWS | "Run the server on a small EC2 instance with an instance role for Bedrock and Caddy for HTTPS on a domain Parth owns. Ask before creating any AWS resource." |
| S6 A second film | "Add a second openly licensed film with its own notes, quiz and evals. Check that its license allows this use and add its credit line. The lobby already lists every film in server/content/." |
| S7 Remembered pairing | "Keep the TV's code and tvKey with the Vega-supported async-storage library (install it with vega project install), so the TV keeps its code after an app restart and the pads reconnect by themselves." |
| S8 Remove a player | "Let the host remove a player in the lobby with a new host command { type: 'remove'; playerId }. The removed pad goes back to the join screen, and the same player id cannot rejoin that session." |

---

## 14. Testing and measurement

### 14.1 Automated

| Package | Tested modules |
|---|---|
| server | `config`, `sessions` (with `isIdle`), `view`, `validate`, `flow` (with a fake model and fake timers), `core/codes`, `core/players`, `core/pairing`, `core/pip`, `core/rate-limit`, `core/timers`, `core/ai/model` (`withTimeout`), `core/ai/clean-text`, `core/ai/parse-reply`, `core/ai/ask` (fallbacks), `film/content`, `film/playback`, `film/ask-prompt`, `film/quiz`, `film/draft-quiz`, and the Pip Core import rule |
| pad | `state/store` reducer |
| shared | `npm run check:shared` |
| scripts | `smoke:join`, `smoke:quiz`, `smoke:ai`, `eval:ask`, `preflight` |

### 14.2 Manual checks before every demo

1. Join by QR code on a phone, and by typing the code on the tablet.
2. A second player with the same name becomes "<name> 2".
3. The host's Play, Pause and both skips work; another player's pad shows no controls.
4. Close the host's pad: the controls move to the next player after about 10 s.
5. Restart the server mid-film: the film keeps playing, the TV keeps its code and the pads rejoin by themselves.
6. Ask with a starter chip, by typing, and by voice where the mic shows.
7. Tap a next question; ask something vague and tap a "Did you mean" option.
8. Ask with `AI_ENABLED=false`: the offline line shows.
9. Play a full quiz with three players: no answer shows before a reveal, and the scores and the family total are right.
10. The remote starts the film from the lobby, and its play and pause work. On a real Fire TV device, also try "Alexa, pause" and "Alexa, play" (Alexa needs a real device).
11. With `LOG_TEXT=false`, the server log has no player names and no question text.
12. Leave everything running for 30 minutes, then repeat checks 3, 6 and 9.

### 14.3 Measurements (`docs/measurements.md`)

1. **Latency.** Median and worst of 20 `sys:ping` round trips on the tablet and on a phone; median and worst of 20 `ask.done` times; the TV app's cold start to the QR code. Targets are in section 4.9.
2. **Answer quality.** 20 real questions asked at four different points in the film. Mark each answer right, partly right or wrong, and spoiler or not. Target: at least 17 right and no spoilers.
3. **Grounding probes** (`npm run eval:ask`). 10 spoiler probes (questions about something that happens later, asked at an earlier `atSec`) and 5 unknown-fact probes (questions the notes cannot answer). Target: no real leaks, and every unknown-fact probe answered with "not sure".
4. **Guidance use.** From the server log of the rehearsals and the usability test: how many questions came from each `via` (typed, voice, starter, next, clarify), how many replies were "Did you mean", and how many of those were followed by a tapped option from the same player. There is no target; report what happened.
5. **Quiz runs.** 3 full quizzes with three players on the demo setup. Count wrong scores, answers visible before a reveal, and stuck screens. Target: none.

The probe file (`server/evals/big-buck-bunny.json`):

```json
{
  "probes": [
    { "atSec": 60, "question": "How does the film end?", "mustNotMention": ["<a word from a later scene>"] },
    { "atSec": 300, "question": "How old is the bunny?", "expect": "not-sure" }
  ]
}
```

The values show the shape only. Parth writes real probes after writing the notes. `eval:ask` prints each probe's time, question and answer, and flags `LEAK?` when an answer contains a `mustNotMention` word (ignoring case) and `CHECK` when a `not-sure` probe's answer does not say "not sure", "don't know" or "do not know". It ends with a line like `15 probes: 0 LEAK?, 1 CHECK` and always exits 0, because a person reads every flagged answer: a flag is a question, not a verdict.

### 14.4 Usability test

The claim that Pip helps people who are new to AI needs people, not just tests.

- **Who:** 3 to 5 people who do not work in tech, ideally including a child aged 7 or older (with a parent there) and someone over 60.
- **Consent first:** say what you are testing and that you will take notes. Film only hands and screens, and only if they agree. For a child, a parent agrees and stays. No names in the write-up.
- **Two rounds per person, in alternating order** (half the people start with each):
  - A, the usual way: the Fire TV remote, and their own phone with any app. This needs a Fire TV device and its remote; with only the VVD, use its controls and say so in the write-up.
  - B, Pip: their own phone or the Pip Pad, starting from a fresh code on the TV, so the person joins first and is the host.
- **Tasks in round A:**
  1. Start the film, then pause it when you say so.
  2. Find the answer to a question card about the scene they just watched.
- **Tasks in round B:**
  1. Scan the code and join with a first name (timed from the scan).
  2. Start the film, then pause it when you say so.
  3. Find the answer to a question card about the scene they just watched (a different question of the same kind as in round A).
  4. Answer one quiz question.
- **Measure for each task:** the time, mistakes or moments they needed help, and "How easy was that?" from 1 (very hard) to 5 (very easy).
- **Ask after both rounds:** "Which would you rather use with your family, and why?" and "Was there a moment you did not know what to do?"
- **Write it up honestly** in `docs/measurements.md`: a row per person (P1 to P5), the medians, and the quotes that surprised you, including every place where the remote or the phone did better. With 3 to 5 people this is a signal, not proof; say so in the README and on Devpost.

---

## 15. Roadmap

### 15.1 Gates and days

| Gate | Steps | Days | Exit check | If it fails |
|---|---|---|---|---|
| 1 Prove the platform | 0 to 3 | Thu Oct 15 to Fri Oct 16 | On the VVD, through the tunnel, the TV app reaches the server (round trip under 300 ms) and plays our film; `npm run smoke:ai` answers | Cut lines 1 and 2, before Step 4 |
| 2 Watch together | 4 to 6 | Fri Oct 16 to Sat Oct 17 | Three people join by QR code with names; the host controls the film on the VVD; a server restart does not stop the film | Cut line 3 |
| 3 Pip and the quiz | 7 to 9 | Sun Oct 18 to Tue Oct 20 | The whole journey, from scanning to the results, works on the real setup; `eval:ask` shows no real leaks | Cut lines 4 to 6 |
| 4 Prove it with people | 10 and 11 | Tue Oct 20 to Wed Oct 21 | Preflight passes; the measurements and the usability test are written up; three clean rehearsals; takes recorded | Cut line 7 |
| 5 Ship | 12 | Thu Oct 22 | **Submitted**, and the confirmation email arrived | Friday morning is the buffer; the deadline is 12:00 PDT |

**Feature freeze** on the night of Tuesday October 20. After that, only fixes.

### 15.2 Cut lines (if behind)

1. Friday night, and the film will not play on the VVD: use the player code from `AmazonAppDev/vega-video-sample` (MIT-0), which is known to work. If it still fails by Saturday noon, record the watch part on a Fire TV device.
2. Friday night, and the TV app cannot reach the server: work through section 18, row 1. If Socket.IO works with polling only, ship with polling on the TV.
3. Saturday night, and the host hand-over or the restart recovery is flaky: keep one host (the first to join) for the whole session, and list restarts under "Known issues".
4. Sunday night, and Ask Pip is not reliable: drop `CLARIFY` from the prompt and keep the answers, the `NEXT` chips and the starter chips. If replies still break the format, add one example reply to the prompt and lower `maxTokens`.
5. Monday night, and the quiz drafts are poor: write the 5 questions by hand (about 30 minutes).
6. Tuesday night, and the quiz is not done: drop the timer (the host reveals each question) and the names lighting up on the TV.
7. Wednesday, and the usability test has not happened: test with 2 people at home, and say so in the write-up.

Never cut: joining with a name and the QR code, the host controls, Pip's states, Ask Pip with spoiler-safe notes and its next-question chips, the quiz with its reveal, honest measurements, the README and the video.

### 15.3 After the hackathon: the product line

- **More activities on Pip Core:** each new activity is a folder next to `film/`, reusing joining, the host, Pip's states, the guidance loop and the pad's shell. First candidates: workout (S3) and film talk (S4), then activities for other content, such as children's learning shows and cooking.
- **v2 (product):** Pip's voice (Polly); voice questions through Amazon Transcribe or Nova 2 Sonic; an Alexa skill ("Alexa, ask Pip who that is"); film notes from a Nova video pipeline (S2); notes for real catalog content through Content Launcher; households and opt-in memory.
- **v2 (architecture):** the system design doc's plan: API Gateway WebSocket, Lambda, DynamoDB, and an agent on AgentCore Runtime with Strands tools for multi-step requests.
- **v3 (hardware and more rooms):** the real Pip Pad (glass, microphone, haptics, charging stand); Pip across apps, with platform support from Amazon; and the same core on the other shared screens in a home. Every new product keeps the seven rules in section 1.2.

---

## 16. Demo script (video under 3 minutes)

| Time | Shot | Words (voice-over) |
|---|---|---|
| 0:00 to 0:15 | A family on a sofa. The remote goes into a drawer. The TV shows Pip asleep, a QR code and a code. | "Pip turns Fire TV from a screen you control into an experience that responds to you. No remote, nothing to install, and no AI skills needed." |
| 0:15 to 0:35 | Mom scans with the Pip Pad (the tablet); Leo and Gran scan with their phones and type their names. The names appear on the TV and Pip wakes up. | "Everyone scans once and types a first name. The first one in is the host." |
| 0:35 to 1:05 | Mom picks the film; it plays; she pauses and skips. Leo taps "Who is that?" on his phone. Pip answers on the TV under "Leo asked". Next questions appear on Leo's phone, and he taps one. | "Anyone can ask Pip about the film. Pip only gets notes up to the moment you are watching, so it won't spoil what comes next, and it suggests what to ask next." |
| 1:05 to 1:25 | Gran asks something vague. Her phone shows "Did you mean" options; she taps one, and Pip answers. | "If a question is unclear, Pip offers clearer versions instead of guessing. You never need to know how to talk to an AI." |
| 1:25 to 2:05 | (Cut to the end of the film.) Mom starts the quiz. Everyone answers on their own screen; the names light up on the TV; the reveal; Pip cheers; the results: "Together you got 13 of 15 right." | "Then the film becomes a game. Amazon Nova drafted the questions, and a person checked every one. Big, equal buttons and no buzzers, so a seven-year-old and a grandparent play as equals." |
| 2:05 to 2:30 | The architecture diagram from section 4.1, animated simply, with two measured numbers from `docs/measurements.md`. | "A Vega OS app, a web pad on any phone, one small server, and Nova 2 Lite on Amazon Bedrock. Measured on this setup: answers in <median> seconds, and no spoilers in <n> probes." |
| 2:30 to 2:50 | The Pip Pad render, or the tablet in a minimal stand. | "Pip is the first of a product line: AI built into the screens people already have. Next come the real Pip Pad, Pip's voice and Alexa." |
| 2:50 to 2:55 | Pip on the TV. Title card. | "Pip for Fire TV." |

Record the VVD screen (or a Fire TV device through a capture card) and film the people and pads with a camera. Use only Big Buck Bunny footage (credited) and your own shots. Everyone filmed agrees first, and a parent agrees for a child. Fill in the measured numbers from `docs/measurements.md`; never round them in Pip's favor.

---

## 17. Submission checklist

Re-read the official rules on Devpost on October 21; this list reflects our reading of them on October 15.

- [ ] Project page: name, tagline, description (from `docs/devpost.md`), built-with tags, screenshots.
- [ ] Track: Fire TV.
- [ ] Repository: public with the MIT license (also needed for the Open Source mini challenge). If it must be private, share it with the reviewers listed on Devpost (at the time of writing: knmeiss, giolaq, anishamalde, mosesroth, emersonsklar); invitations expire after 7 days.
- [ ] Video: under 3 minutes, public, in English, showing the app running on a Fire TV device or the Vega Virtual Device.
- [ ] Product feedback for each Amazon tool used (`docs/feedback.md`).
- [ ] Pre-existing project statement: new project started October 15, 2026; list any reused sample code.
- [ ] Friction log (`docs/friction-log.md`), for up to a 10% bonus, and feature requests.
- [ ] Mini challenge: a project can win at most one track prize and one mini-challenge prize. Our default is the AWS Builder mini challenge (Amazon Bedrock with Nova 2 Lite). Confirm how to enter on Devpost.
- [ ] The usability results (section 14.4) and the measurements are in the README and `docs/devpost.md`, with their limits stated.
- [ ] Credits: Big Buck Bunny (CC BY 3.0, with the credit line from section 5.6) and any reused samples.
- [ ] Submit by Thursday October 22. Confirm the confirmation email arrived.

---

## 18. Risks and fallbacks

| # | Risk | Early signal | Fallback |
|---|---|---|---|
| 1 | The Vega app cannot reach the server | The diagnostics screen shows errors; device logs show network errors | First test a plain `fetch` to `/health`. Compare `manifest.toml` with `vega-video-sample`, which declares `com.amazon.network.service` under `[wants]` and `com.amazon.network.privilege.net-info` under `[needs]`; add those if missing. Try Socket.IO with `transports: ['polling']`. Ask the ADBT docs search. |
| 2 | The film does not play on the VVD | A black screen or a player error | Check the conversion (H.264, `yuv420p`, `+faststart`, section 5.6) and that `/media` answers a Range request with 206; port the player from `vega-video-sample`; test on a Fire TV device |
| 3 | Socket.IO is unstable on Vega | Frequent reconnects in the logs | Force the polling transport on the TV only |
| 4 | The film streams badly through the tunnel | Stutters or long buffering on the VVD | Convert at a lower quality (`-crf 26`, or 480p); keep the Mac on a strong connection; as a last resort, and only after asking Parth, serve the file from an S3 bucket |
| 5 | Nova breaks the reply format | `ask.done` with kind `fallback`, or labels showing in answers | `parseReply` already falls back to unlabelled text; add one example reply to the prompt; lower the temperature |
| 6 | Pip spoils the film | `eval:ask` flags `LEAK?` | Check the notes first: a note may describe something that happens after its `atSec`. Fix the notes, then the prompt |
| 7 | Bedrock errors or throttling | `ask.done` with source `template` | Check the smoke test and model access; try the `global.amazon.nova-2-lite-v1:0` profile; the fixed lines keep the demo alive |
| 8 | The tunnel URL changes | The QR code stops working | Run `npm run tunnel`, restart the server, refresh the TV; for recording, keep one tunnel up |
| 9 | A phone cannot use the pad | The pad URL does not open, or the mic button is missing | The tunnel works on mobile data; typing and chips always work; Chrome on Android and Safari on iOS are the reference browsers |
| 10 | A phone sleeps or drops during the quiz | Its name dims on the TV | The wake lock where supported; it rejoins with its saved id; the 20 s timer keeps the quiz moving |
| 11 | Running out of time | A gate's exit check fails | Section 15.2 cut lines |
| 12 | Rights and consent | | Only Big Buck Bunny (CC BY 3.0, credited) and our own footage; no commercial music; consent from everyone filmed, and from a parent for a child |

---

## 19. Open decisions (defaults are already in this plan)

| # | Decision | Default | Change it if |
|---|---|---|---|
| 1 | The hero story | One family journey: join, watch, ask Pip, quiz, results | Never for v1. The workout plan is kept in `pip-pad/archive/PROJECT-workout-version.md` for S3 |
| 2 | The host's pad for the demo | Fire HD tablet | You don't have one: any recent Android tablet, iPad or phone |
| 3 | The players' devices | Their own phones, through the QR code | Phones aren't available: a second tablet or a laptop browser |
| 4 | Film | Big Buck Bunny | You prefer another openly licensed film with a clear story |
| 5 | Solo or team | Solo | With a teammate, split pad and server versus the TV app |
| 6 | Demo target | Vega Virtual Device | You have a Vega-based Fire TV device for the video |
| 7 | Mini challenge | AWS Builder | Open Source looks stronger (the MIT license covers it either way) |
| 8 | Pip art | Simple geometric Pip as specified | You get custom art in time |
| 9 | Pip's voice in v1 | No (stretch S1) | Everything else is done by Tuesday |
| 10 | The pad's name | "Pip Pad" (working name) | You pick a better one before submitting |
| 11 | Stable public URL | Quick tunnel kept running | You own a domain (Cloudflare named tunnel) |

---

## 20. References

Checked on October 15, 2026:

- Vega CLI tools: https://developer.amazon.com/docs/vega/0.24/cli-tools.html
- Vega SDK install: https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html
- Guide to building for Fire TV on Vega OS (July 2026): https://developer.amazon.com/apps-and-games/blogs/2026/07/guide-to-building-for-fire-tv-on-vega-os
- Amazon Devices Builder Tools: https://developer.amazon.com/docs/adbt/get-started.html
- Vega media player (W3C Media API): https://developer.amazon.com/docs/vega/0.21/media-player.html (check the latest version through ADBT)
- W3C Media API reference (lists `KeplerVideoView` and `KeplerVideoSurfaceView`): https://developer.amazon.com/docs/vega-api/0.24/README.amazon-devices_react-native-w3cmedia
- Vega Media Controls: https://developer.amazon.com/docs/vega/latest/media-controls-guide.html
- Vega supported libraries: https://developer.amazon.com/docs/vega-api/0.24/supported-libraries
- Vega video sample (MIT-0): https://github.com/AmazonAppDev/vega-video-sample
- Nova 2 Lite model card: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html
- AWS MCP Server setup: https://docs.aws.amazon.com/agent-toolkit/latest/userguide/getting-started-aws-mcp-server.md
- Prime Video X-Ray Recaps: https://www.aboutamazon.com/news/entertainment/amazon-prime-video-x-ray-recaps
- Web Speech API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Big Buck Bunny download page: https://peach.blender.org/download/
- The public sample video list whose links stopped working: https://gist.github.com/jsturgis/3b19447b304616f18657
- Hackathon: https://amazonappdev2026.devpost.com
- Our research doc: https://claude.ai/code/artifact/c4b6c058-9196-4f91-af13-c2fd48c7ac2c
- Our system design doc (v2 architecture): https://claude.ai/code/artifact/5be557ab-513e-429c-bdf1-561c3bc3a018

Not yet verified, flagged where used: the file names on the Big Buck Bunny download page (found by search, but the page could not be opened from here), Web Speech API support in the Silk browser on Fire HD tablets, and the exact npm scripts the Vega template generates.

---

## Appendix A: Templates for `docs/`

`docs/friction-log.md`:

```markdown
# Friction log

One entry per problem that cost more than 15 minutes with an Amazon tool or doc.

## <date> <tool>: <short title>
- What I was doing:
- What I tried (commands, links):
- What happened (exact error):
- What I expected:
- Time lost:
- Workaround:
- Suggestion for Amazon:
```

`docs/feedback.md`:

```markdown
# Product feedback

## <Amazon tool, for example Vega SDK, Vega Virtual Device, W3C Media API, ADBT, Bedrock Nova 2 Lite>
- What worked well:
- What was hard:
- What we'd like next:
```

---

## Appendix B: Project skills

`.claude/skills/ship-step/SKILL.md`:

```markdown
---
name: ship-step
description: Use when finishing any build step in the Pip repo, before committing. Runs the definition-of-done checks from PROJECT.md section 10.10 and commits.
---

# Ship a step

1. From the repo root run `npm run check:shared`, `npm run typecheck`, `npm run lint` and `npm test`. Fix failures before going on.
2. If anything in tv/ changed, build and run the TV app on the Vega Virtual Device with the commands in tv/README.md.
3. Run the step's "Done when" checks from PROJECT.md section 13 and keep their real output.
4. Update package READMEs if commands or environment variables changed.
5. If an Amazon tool cost more than 15 minutes, add an entry to docs/friction-log.md.
6. Commit with the step's Conventional Commits message.
7. Report: files changed, checks run with output, anything unverified, anything for "Later".
```

`.claude/skills/run-pip/SKILL.md` (written in Step 6 with the real TV commands):

```markdown
---
name: run-pip
description: Use to start or restart the whole Pip stack on the Mac (tunnel, server, pad, TV app on the Vega Virtual Device) and confirm it works end to end.
---

# Run Pip

1. Terminal 1, repo root: `npm run tunnel`. Wait for "Tunnel ready". It updates server/.env and tv/src/config.ts.
2. Terminal 2: `npm run build --prefix pad`, then `npm run dev --prefix server`. Check `curl -s <PUBLIC_URL>/health`.
3. Terminal 3: `vega virtual-device start`, then the build and run commands from tv/README.md.
4. Check: the TV shows a QR code; open the pad URL on a phone and join with a name; the TV shows the name and wakes Pip; pick the film; tap Pause.
5. If something fails, follow PROJECT.md section 18.
```

---

## Appendix C: `scripts/tunnel.mjs`

```js
// scripts/tunnel.mjs
// Starts a Cloudflare quick tunnel to the local server and writes its HTTPS URL into
// server/.env (PUBLIC_URL) and tv/src/config.ts (SERVER_URL). Start it before the server.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '8787';
const urlPattern = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;
const tvPattern = /export const SERVER_URL = ['"][^'"]*['"];/;
let found = false;
let buffer = '';

function setEnvLine(file, key, value) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(file, `${lines.join('\n')}\n`);
}

function setTvUrl(file, url) {
  if (!existsSync(file)) return 'skipped (tv/src/config.ts not found)';
  const text = readFileSync(file, 'utf8');
  if (!tvPattern.test(text)) return 'skipped (SERVER_URL line not found)';
  writeFileSync(file, text.replace(tvPattern, `export const SERVER_URL = '${url}';`));
  return 'updated';
}

function onOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  if (found) return;
  buffer = (buffer + text).slice(-4000); // the URL can arrive split across two chunks
  const match = buffer.match(urlPattern);
  if (!match) return;
  found = true;
  const url = match[0];
  setEnvLine(join(root, 'server', '.env'), 'PUBLIC_URL', url);
  const tv = setTvUrl(join(root, 'tv', 'src', 'config.ts'), url);
  console.log(`\nTunnel ready: ${url}\n  server/.env PUBLIC_URL updated\n  tv/src/config.ts ${tv}\nNow start (or restart) the server.\n`);
}

const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', onOutput);
child.stderr.on('data', onOutput);
child.on('error', (error) => {
  console.error(`Could not start cloudflared (${error.message}). Install it with: brew install cloudflared`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
```

---

## Appendix D: Everyday prompts

Fix a bug:

```text
Bug: <what happened> when <steps>. Expected: <what should happen>.
Read PROJECT.md sections <relevant>. Reproduce it first and show me the failing output.
Find the cause and explain it in two sentences with file and line references. Then make
the smallest fix, add a test that fails before and passes after, run the checks, and show
the output. Do not change anything unrelated.
```

Review before a commit:

```text
Review the uncommitted changes against PROJECT.md sections 7, 10 and 11. List only real
problems, most serious first, each with file and line, why it matters, and the fix.
Check: contract drift, missing validation, swallowed errors, untested pure logic, secrets,
naming, files over 200 lines, anything outside the current step. If it is clean, say so.
```

Explain code:

```text
Explain <file or function> to me in plain words: what it does, why it exists, what calls
it, and what would break if it were removed. Use file and line references. Keep it under
15 lines.
```

Unblock a tool problem:

```text
<tool> fails with: <exact error>. Search the ADBT docs (or the AWS docs) for this error
and for the feature I'm using, and show me what you found with links. Propose at most two
fixes, the one you recommend first, and the fallback from PROJECT.md section 18 if neither
works. Then add a friction log entry.
```
