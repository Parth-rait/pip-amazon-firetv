# Evaluation: The Lantern Fox (2026-10-16)

Timeline sha:ecbe9a535cb5: 18 facts. Examples: 91 (derived dataset v1 plus hand-written golden probes). Spoiler probes run twice: fresh, and after the same question was asked at the end of the film with a shared answer cache.

| Strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | Routing | Ungrounded sources | Latency p50 / p95 (ms) |
|---|---|---|---|---|---|---|---|
| timeline only (AI off) | 0 of 68 | 82/83 (99%) | 26/30 (87%) | 21/25 (84%) | 12/12 (100%) | 0 | 0.09 / 0.33 |
| careful fake model | 0 of 68 | 61/83 (73%) | 27/30 (90%) | 22/25 (88%) | 12/12 (100%) | 0 | 0.09 / 0.51 |
| leaky fake model (always tells the ending) | 0 of 68 | 68/83 (82%) | 23/30 (77%) | 18/25 (72%) | 12/12 (100%) | 0 | 0.07 / 0.24 |

Latency is in-process on this machine with fake models (no network); it measures Pip's own pipeline, not a real model.

Skipped:
- Bedrock Nova 2 Lite: not requested (pass --nova; needs the AWS profile from PROJECT.md 9.3)
- TypeSafe routing judge: no TYPESAFE_API_KEY and api.typesafe.ai is not reachable from this environment

