# Measurements

Real results from the demo setup (PROJECT.md section 14.3). Targets are in section 4.9. Until a row is filled in, there is no result.

## Baseline before the demo setup (Oct 16 2026)

Not the demo setup: Pip ran on the local brain (`AI_PROVIDER=ollama`, `qwen2.5:3b` on an 8 GB M2 MacBook Air beside the Vega Virtual Device), and players were scripts or one real phone. These numbers show the build works; the tables below are for the demo setup with Nova and real devices.

| What | How | Result |
|---|---|---|
| TV `sys:ping` round trip, VVD through the tunnel | Diagnostics screen (Step 3) | 28 to 104 ms |
| Host tap to TV and back (Pause, Play) | Two scripted pads timing the TV's playback report (Step 6) | 177 and 239 ms |
| Skip to the TV's new position | Same | 1.1 and 1.6 s (the player re-buffers) |
| Question to answer, local model | `ask.done` `ms` in the server log, 11 real answers | median 2.3 s, worst 4.8 s |
| A repeated question at the same scene | Answer memory (PROJECT.md 5.9) | 18 ms |
| Grounding probes, local model | `eval:ask`, 15 per film | 0 leaks on both films; the 3B model still made up small facts, for example "Her sword was given to her by the shaman" |
| Quiz run, three scripted players on the VVD | `quiz-sim` script, Big Buck Bunny | 0 wrong scores, no answer visible before a reveal, no stuck screen; results Mom 4, Gran 2, Leo 0, family 6 of 12 |
| Keep watching after the results | Same session | resumed at 6:29, where the quiz started |

## Grounding probes

`npm run eval:ask` in `server/` (add `-- sintel` for the second film) runs every probe in `server/evals/<film>.json` against the configured model; for the demo that is Nova 2 Lite. A person reads each flagged answer and writes the verdict here. Target: no real leaks, and every unknown-fact probe answered with "not sure".

Run on: (date, model ID)

| Time | Question | Answer | Flag | Verdict |
|---|---|---|---|---|

## Latency

Section 14.3, part 1. Targets from section 4.9: host tap to TV 300 ms or less (median), question to answer 3 s or less (median, 6 s hard timeout), TV cold start to QR code 5 s or less.

Measured on: (date, network, TV device or VVD)

| Path | How | Samples | Median | Worst | Target met? |
|---|---|---|---|---|---|
| `sys:ping` round trip, tablet | Debug overlay (`?debug=1`) | 20 | | | |
| `sys:ping` round trip, phone | Debug overlay (`?debug=1`) | 20 | | | |
| Question to answer (`ask.done` `ms`) | Server log | 20 | | | |
| TV cold start to QR code | Stopwatch | 5 | | | |
| Scan to joined, name typed | Stopwatch, in the usability test | | | | |

## Answer quality

Section 14.3, part 2. 20 real questions at four points in the film. Target: at least 17 right and no spoilers.

| # | Time | Question | Answer | Right, partly or wrong | Spoiler? |
|---|---|---|---|---|---|

Total: right, partly right, wrong, spoilers.

## Guidance use

Section 14.3, part 4. From the server log of the rehearsals and the usability test (`ask.start` carries `via`). No target; report what happened.

| Source | Count |
|---|---|
| Typed | |
| Voice | |
| Starter chip | |
| Next chip | |
| "Did you mean" option | |
| Replies that were "Did you mean" | |
| ...followed by a tapped option from the same player | |

## Quiz runs

Section 14.3, part 5. Three full quizzes with three players on the demo setup. Target: none of each.

| Run | Players | Wrong scores | Answers visible before a reveal | Stuck screens | Notes |
|---|---|---|---|---|---|
| 1 | 3 | | | | |
| 2 | 3 | | | | |
| 3 | 3 | | | | |

## Usability test

Section 14.4. 3 to 5 people who do not work in tech, consent first, no names. Round A is the usual way (remote and own phone); round B is Pip. Half start with each. Times in seconds; ease from 1 (very hard) to 5 (very easy). With this few people it is a signal, not proof.

| Person | Age group | Order | A1 start and pause | A2 find the answer | B1 scan and join | B2 start and pause | B3 find the answer | B4 answer a quiz question | Prefers |
|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | |
| P2 | | | | | | | | | |
| P3 | | | | | | | | | |
| P4 | | | | | | | | | |
| P5 | | | | | | | | | |

Each cell: time, mistakes or help needed, ease. Medians:

Quotes that surprised us, including every place where the remote or the phone did better:

- (none yet)
