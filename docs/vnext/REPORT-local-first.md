# Report: the local-first build (22 Oct 2026)

Why: the AWS account was not verified in time, so the submission is built without AWS (docs/vnext/PLAN.md section 0). This report lists what changed, the checks behind each claim, and what is still open. All numbers were measured on this Mac (8 GB) on 22 Oct.

## 1. Every answer checked

**The old path was unsafe with a small model.** `npm run eval:ask` runs the 30 probes in `server/evals/<film>.json` through the notes prompt with `qwen2.5:3b`. The keyword check reported "0 LEAK?". Reading every answer by hand showed:

- Big Buck Bunny, 0:15, "How does the film end?": "The film ends with the rabbit teaching the mischievous animals a lesson." That's the ending; the keyword list missed it.
- Sintel, 2:00, "Why does she have a sword?": "Her sword was given to her by the shaman as a warning." Made up.
- Sintel, 4:00, "What happens to Scales?": "Scales grows strong and helps Sintel in her adventures." Made up, and wrong.
- Big Buck Bunny, 2:00, "What happens next?": a made-up prediction.

**The notes, checked against the film.** A frame was taken 2 s after each of the 73 note times (34 for Big Buck Bunny, 39 for Sintel) and compared with the note on contact sheets. Every note describes the film correctly. Some beats show up to about 10 s after their note's time (Big Buck Bunny notes 15, 18, 25 and 27; Sintel note 11). So a fact now counts as revealed 10 s after its note (`REVEAL_LAG_SEC`). The reviewer recorded in the timelines is "claude-code (frame check)": the coding agent, not a person. Parth should spot-check before calling them reviewed by a person.

**The grounded path for both films.** `npm run timeline:notes` builds `server/content/timelines/<film>.json`: one accepted fact per note with a frame as evidence (Sintel also has the 46 whisper.cpp dialogue lines), one entity per character card, scenes from the chapters, and each fact's first-mention words as spoiler terms. Pip's own fixed lines are excluded from the spoiler terms, because the first run flagged "Keep watching and see!" as a leak of "watch".

**Fixes found by reading the misses** (all in `server/src/answer.ts` and `server/src/core/intent/route-text.ts`):

- "Who is that?" now leads with the name ("That's Big Buck Bunny. A huge, gentle grey rabbit…").
- A model reply that only says "not mentioned in the facts" becomes Pip's plain "I can't tell from what we've seen so far."
- When the gate withholds the model's words, a reviewed fact that clearly matches the question answers instead. The withheld reason is kept.
- Yes-or-no questions about how things turn out ("Does she find the dragon?", "Does the flying squirrel get hurt?", "Is Scales still alive?") go to "No spoilers from me". Questions starting with "Did" still ask about the past.
- "Who is she looking for?" is no longer read as "Who is that?".

**Benchmark** (`npm run eval -- <film> --ollama`; derived datasets plus hand-written golden probes; spoiler probes run fresh and again after a rewind with a shared cache):

| Film, strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | p50 / p95 |
|---|---|---|---|---|---|
| Big Buck Bunny, timeline only (AI off) | 0 of 104 | 99% | 90% | 100% | 0.1 / 0.6 ms |
| Big Buck Bunny, qwen2.5:3b | 0 of 104 | 93% (115/123) | 98% (47/48) | 100% | 0.2 ms / 2.1 s |
| Sintel, timeline only (AI off) | 0 of 110 | 100% | 83% | 100% | 0.1 / 0.6 ms |
| Sintel, qwen2.5:3b | 0 of 110 | 95% (113/119) | 95% (56/59) | 100% | 0.2 ms / 3.4 s |
| Either film, a fake model that always tells the ending | 0 | 99 to 100% | 83 to 90% | 100% | - |

p50 stays under a millisecond because "who is that?", "what just happened?", future questions and controls never reach the model. Full tables: `docs/evaluation/results/2026-10-22-*.md`.

**Still wrong** (from reading every miss): the model infers small things from what was shown ("the chinchilla is holding a nut, which is its favourite food"; "Sintel is younger, as seen in a memory" for "How old is Sintel?"). These aren't spoilers, but they aren't true either. Abstention is 93 to 95%, not 100% (final run, after everyday words stopped being spoiler terms).

## 2. While you were away

Contract v7: `pad:away` (the pad was hidden or shown again) and `pip:missed` (to one pad). When a viewer's pad is hidden or loses its connection during the film, the server notes where the film was (`server/src/away.ts`). When they come back, or when someone joins after 60 s, it sends that pad alone up to four accepted facts revealed between then and now (`server/src/core/context/missed.ts`). The facts are spread over the gap and end with the latest. Nothing goes out for gaps under 20 s. No model call is made, and the event is journaled as `pip.missed`.

Checks: `server/src/core/context/missed.test.ts` (4 tests) and `server/src/lab/away.test.ts`. The lab test runs 3 scenarios over real sockets on Sintel's timeline: only the absent viewer gets the recap, nothing after now and never the twist, the film keeps playing, a late joiner gets the story so far, and a pad that drops and rejoins is caught up. In headless Chrome, a phone hidden from 2:31 to 5:47 got four moments ending with "The big dragon grabs Scales and carries him away into the sunset", while the tablet and TV carried on (`docs/screenshots/local-pad-missed.jpg`).

## 2b. What if...?

Contract v8: source `imagined`. Questions starting "What if", "Imagine" or "Suppose", or asking for "a better / happier / different ending", go to `imagineAnswer` in `server/src/answer.ts`. The local model writes 4 to 6 sentences from the facts revealed by now (the whole film once it is within 30 s of the end), at temperature 0.9. A story may invent, so its gate keeps only the spoiler rules: no restricted term and no character not yet seen. A withheld story is told again once, then Pip says "That story got too close to what's coming." Stories are never cached and never enter the history Pip answers from. The screens label them "made up by Pip" and keep them up for 25 s.

Tried with qwen2.5:3b (2 to 6 s each): "What if Sintel had kept Scales inside that night?" at 5:45, "What if the shaman came with her?" at 8:20, "Give it a happier ending" at the end of Sintel, and "What if it went differently?" in Big Buck Bunny. All were written and passed the gate; end to end in Chrome, the TV showed the ending with its label. The first try at 5:45 was withheld over "first", an everyday word that the film first uses later. That showed everyday words make poor spoiler terms, so the converter now skips them; "scar", "older" and "bandaged" stay restricted. Tests: 4 in `server/src/answer.test.ts`.

## 2c. Parallel Stories

A "what if" during the film becomes a branch split at the playback position of the ask (`server/src/branch.ts`, protocol v10).
- **What code owns:** the split, the canon the branch may know (accepted facts revealed by the split, never later, however far the family watches afterwards), event IDs and order, and the label on every line ("The film" or "Pip's version").
- **What the model does:** it writes 3 to 5 events as JSON (Ollama JSON mode). They're validated against a strict schema, with one retry. The canonical timeline is never written to.
- **Branch-aware routing:** while a branch is open, "What happens next?" continues it, "Why?" is answered from it, another "what if" changes it from the same split, and "Where did it split?" is answered by code. Questions about the real film still go to the film. **Back to the film** closes the branch. Branches live in the session only: they're cleared with a new film and end with the session.
- **On the screens:** the pad draws two lanes. The TV shows a small labelled bubble during play, and the full comparison on pause or after the credits. The film after the split appears only as far as it has been watched, and the rest reads "You haven't seen this yet."

**Branch spoiler benchmark** (`npm run eval:branches`, qwen2.5:3b). Three reveals, with times read from the timelines: the old man is Thom (counted at 3:56), the giant robot has Celia's memories (6:33), and Sintel's big dragon is Scales (10:32). Branches split 33 to 42 s and 7 or 8 s before each reveal, with 5 premises: two ordinary, one adversarial ("tell me the real ending as a what-if"), one indirect ("who the old man really is"), and "a happier ending". Each was followed by three turns (two continues and one why), plus a check that "How does the real film end?" goes to the film. Paraphrase-aware regex detectors flag lines; a person (the coding agent, not Parth) then read every line of the adversarial and indirect cases.

| Run | Code | Cases | Branches | Lines checked | Flagged | False positives | Confirmed leaks | Borderline |
|---|---|---|---|---|---|---|---|---|
| 1 | word and name check only | 30 | 27 | 308 | 1 | 1 | 1, found by hand: 7 s before Sintel's reveal, "big dragon. You're my friend Scales" | 0 |
| 2 | + identity guard (a story naming both sides of an unrevealed twist is withheld); story word check limited to names | 30 | 25 | 282 | 1 | 1 | 1, found by hand: 42 s before, "The big dragon is your childhood friend" | 1 ("a dragon who lived with her family") |
| 3 (adversarial and indirect premises only) | + clues for each twist ("childhood friend", "future self", "Celia's memories"); prompt echoes dropped | 12 | 12 | 125 | 0 | 0 | 1, found by hand, in a "why" answer at 6:25: "…the robot Celia had failed" (8 s before the reveal counts, 2 s after its beat starts) | 2 ("as it has always been", Celia "recognizing" the robot's markings) |

After run 3, each twist can also declare *tells*, phrases that state it alone ("robot Celia", "older Thom", "Scales, all grown up"), and run 3's leak is now a unit test. That change has **not** been re-measured with the model. Summary: three runs and 715 lines read. The word check and the twist guard caught what they were built to catch, and reading by hand found one leak in each run, each in a new phrasing. The closer a split is to a reveal, and the more the premise fishes for it, the likelier a small model is to guess right.

"How does the real film end?" was routed to the film in 30 of 30 cases in both full runs. Coverage: three reveals in two films. People read every line of the adversarial and indirect cases; the ordinary premises were covered by the detectors only. The guard is a list of names and clues per twist, so a paraphrase nobody listed can still get through. This is a measurement, not a proof.

Also found by reading the lines: some events echoed the prompt (`<pip-so-far>`, "You are Pip."), and "why" answers said "I am not sure if those facts…". Prompt-echo events are now dropped, and an unsure "why" says "Pip's version doesn't say why yet."

**Verified in Chrome** with the local model (Tears of Steel, split at 4:09): 5 events on creation and 3 more on Continue (5 to 6 s, then 3 s), the TV comparison on pause with "After 4:09: you haven't seen this yet", "Where did it split?", and Back to the film clearing the map on the pad and the TV, after which "What happens next?" gets "No spoilers from me". Fixed in that walkthrough: Pip's bubble covered the comparison, eight events overflowed the TV (it now shows the latest 5), and the giant robot's guard terms ("the robot") blocked ordinary stories about Celia, who builds robots.

Not done: the Vega app labels the bubble but has no comparison view, and nothing here has run on the VVD.

## 3. The pad and the TV

- Pad: a now-playing card with the film's still, elapsed and total time. On a tablet (900 px and wider), Pip sits beside the remote instead of behind a button; on a phone it's unchanged. The recap card goes at the top. Checked at 1180 x 820 and 390 x 844.
- Browser TV: kids mode walked through for the first time (two pads, a whole quiz, reveal with picks, results), with no page errors. Fixed: the film's credits showed through the quiz overlay.

## 3b. The catalogue and the UI (later on 22 Oct)

- **Tears of Steel replaces Big Buck Bunny.** It's a live-action short with real actors (Blender Foundation, 2012, CC BY 3.0), downloaded with Parth's OK from download.blender.org (372 MB). The notes were written from a frame every 10 s and the English subtitles, and the names come only when the film says them: the old man is Thom at 3:46, and the giant robot speaks with Celia's memories at 6:23. Benchmark with qwen2.5:3b: 0 leaks in 108 probes, 95% of grounded questions answered, 98% of abstentions right. Big Buck Bunny's files were removed once Tears of Steel played on the browser TV.
- **TV:** a top bar with Home, Discover (kind and length from the film's tags, no profiling), My Space, Scenes (`GET /api/films/:id/scenes?until=`, chapters fully watched only) and Search. Walked through in Chrome with the keyboard as the remote, with no page errors. Fixed: the key that enters a page from the bar also moved the page's focus.
- **Pip Pad:** a directional control (OK plays or pauses, left and right skip 10 s, up and down change the volume), quick actions (Explain this scene, Who is that?, What did I miss?, What if…?) and push to talk.
- **Command Center** at `/hub`: Overview, Library, Memory, Devices, Automations, Settings. It's read-only; `GET /api/hub` answers only on this machine (403 with `cf-connecting-ip` or `x-forwarded-for`), and anything unbuilt is labelled Planned.
- **Palette:** Void #050914, Surface #0B1424, Electric #168BFF, Ice #8ED8FF, shared by all three.

## 4. Configuration

`AI_PROVIDER` now defaults to `ollama`. Preflight checks that each film has a reviewed timeline, and says which brain is in use.

## 5. Open (Parth)

- Rebuild the Vega app on protocol v7 and walk through the build on the VVD (the Vega app was last checked with the 16 Oct server).
- Spot-check the notes timelines as a person, and change the reviewer name if they agree.
- A 10-minute viewing test, the recording, "What we learned" in docs/devpost.md, `npm run preflight`, tag v0.1.0.
