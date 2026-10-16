# Decisions

Short records of decisions that shape Pip's architecture, newest last. Each says what was decided, why, and what would change it. PROJECT.md section 19 holds the original v1 product decisions.

| # | Decision | Status |
|---|---|---|
| [0001](0001-vnext-context-and-action.md) | Pip is a context-and-action system; the quiz becomes an opt-in mode | Accepted |
| [0002](0002-spoiler-boundary-in-code.md) | The spoiler boundary is enforced in code, before and after the model | Accepted |
| [0003](0003-timeline-with-evidence-and-review.md) | Answers come from a reviewed, evidence-linked timeline | Accepted |
| [0004](0004-commands-confirmed-by-device.md) | A command is done only when the TV's report shows it | Accepted |
| [0005](0005-one-input-envelope.md) | All devices send one input envelope; the server decides meaning | Accepted |
| [0006](0006-stay-one-process-in-memory.md) | Stay one process with in-memory state and JSON files | Accepted |
| [0007](0007-typed-judgement-only-offers-choices.md) | A semantic judgement may only offer choices, never act | Accepted |
