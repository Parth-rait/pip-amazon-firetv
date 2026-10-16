# 0001: Pip is a context-and-action system; the quiz becomes an opt-in mode

Date: 2026-10-16. Status: accepted.

**Context.** PROJECT.md v2.0 planned one family journey ending in a five-question quiz. The vNext brief redefines Pip as a context-and-action system: understand the moment, answer from what is established, act through permitted devices and verify the result. It asks for a quiet default with no unrequested prompts.

**Decision.** The default watch path is: join, play, ask, reply, dismiss, keep watching. The TV shows nothing but the film until someone asks. The quiz stays in the protocol and the plan as an opt-in mode behind `QUIZ_ENABLED` (default off); the disabled "The quiz unlocks as you watch" button is gone from the default screen. The quiz was never implemented (Step 9 was not started), so nothing working was removed.

**Consequences.** PROJECT.md is reconciled: the quiz-first sections are kept as history and marked. Steps 8 and 9 become optional. If the hackathon judges reward the quiz, it can be built behind the flag without touching the default path.
