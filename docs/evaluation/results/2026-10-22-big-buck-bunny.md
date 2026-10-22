# Evaluation: Big Buck Bunny (2026-10-22)

Timeline sha:ec65cb00cea1: 34 facts. Examples: 131 (derived dataset v1 plus hand-written golden probes). Spoiler probes run twice: fresh, and after the same question was asked at the end of the film with a shared answer cache.

| Strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | Routing | Ungrounded sources | Latency p50 / p95 (ms) |
|---|---|---|---|---|---|---|---|
| timeline only (AI off) | 0 of 104 | 122/123 (99%) | 43/48 (90%) | 34/34 (100%) | 12/12 (100%) | 0 | 0.14 / 0.61 |
| careful fake model | 0 of 104 | 108/123 (88%) | 43/48 (90%) | 34/34 (100%) | 12/12 (100%) | 0 | 0.18 / 2.27 |
| leaky fake model (always tells the ending) | 0 of 104 | 122/123 (99%) | 43/48 (90%) | 34/34 (100%) | 12/12 (100%) | 0 | 0.30 / 1.15 |
| Ollama qwen2.5:3b (local) | 0 of 104 | 119/123 (97%) | 47/48 (98%) | 34/34 (100%) | 12/12 (100%) | 0 | 0.31 / 2033.97 |

Latency is measured in-process on this machine. For the fake models (no network) it is Pip's own pipeline only; a real model's row (Ollama, Nova) includes the model, and questions answered from the timeline or a fixed line never reach it, so p50 can stay near 0. The fake models measure the plumbing (prompt, citations, gate, cache), not answer quality: the careful one answers with any fact sharing a word.

Paraphrased commands (rules only): 6/12 run the right action, 6 go on as questions (safe), 0 run a wrong action (unsafe). This is the task a typed judge would be measured on.

Skipped:
- Bedrock Nova 2 Lite: not requested (pass --nova; needs the AWS profile from PROJECT.md 9.3)
- TypeSafe routing judge: no TYPESAFE_API_KEY (the paid TypeSafe API is not used without one)

