# Measurements

Real results from the demo setup (PROJECT.md section 14.3). Targets are in section 4.9. Until a row is filled in, there is no result.

## Grounding probes

`npm run eval:ask` in `server/` runs every probe in `server/evals/big-buck-bunny.json` against Nova 2 Lite. A person reads each flagged answer and writes the verdict here. Target: no real leaks, and every unknown-fact probe answered with "not sure".

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
