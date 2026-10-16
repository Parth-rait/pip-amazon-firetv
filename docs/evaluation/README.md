# Evaluation

What Pip is measured on, how, and the latest real numbers. Results files are written by the benchmark itself (`results/<date>-<content>.{md,json}`); never edit them by hand or round them in Pip's favour.

## Run it

```bash
cd server
npm run eval                      # the lab film (The Lantern Fox)
npm run eval -- big-buck-bunny    # once a reviewed timeline exists
npm run eval -- --ollama          # adds the local model (free; needs Ollama with OLLAMA_MODEL)
npm run eval -- lantern-fox --nova   # adds real Bedrock calls (needs the AWS profile; costs a little)
npm test                          # unit and lab tests, including spoiler, rewind and failure cases
npm run lab                       # the Virtual Pip Lab scenarios on their own
```

## What is measured

| Metric | Meaning | Target |
|---|---|---|
| Spoiler leaks | A reply (text, next chips or "Did you mean" options) contains a term that is only revealed later | **0**, always |
| Abstains when it should | Spoiler, unseen-entity and unknown-fact probes get "not sure", a fallback or the no-spoiler line, with no leak | High; a non-abstaining reply without a leak is a miss, not a spoiler |
| Answers when it should | Grounded and recap questions get an answer that cites an expected fact and mentions the expected word | High |
| Cites the expected fact | Retrieval hit rate for questions with known supporting facts | High |
| Routing | Typed commands and questions go where they should (action, dismiss, ambiguous, question) | 100% |
| Ungrounded sources | Cited facts outside the facts permitted at that moment | **0**, always |
| Latency p50 / p95 | Time per answer through Pip's pipeline | With fake models this is Pip's own overhead; real-model rows (`--ollama`, `--nova`) include the model, and questions answered without it keep p50 low |
| Paraphrased commands | Of 12 paraphrased commands: run right, sent on as questions (safe), run wrong (unsafe) | Unsafe = 0; the rest is the task a typed judge would be measured on |

Strategies run on the same examples: **timeline only** (AI off: answers come straight from reviewed facts), **careful fake model** (answers with a fact it was given and cites it), **leaky fake model** (always tells the ending, citing a permitted fact to look grounded: the worst case for the gate), the **local model** with `--ollama`, and **Bedrock** with `--nova`. The fake models measure the plumbing (prompt, citations, gate, cache), not answer quality.

Every spoiler and unseen-entity probe runs twice: fresh, and again after the same question was asked at the very end of the film with a shared answer cache, which is what a rewind looks like to the cache.

## Datasets

- **Derived** (`server/evals/datasets/lantern-fox/v1/examples.jsonl`, 67 examples): made by `npm run pipeline -- dataset` from the accepted timeline. Each example records the facts allowed at its time and its provenance.
- **Golden** (`server/evals/lantern-fox.golden.json`, 24 examples): hand-written adversarial probes whose true answer is revealed later, unknown facts, and grounded questions with expected citations. Written by the agent from the film script; a person should review it.
- **Splits:** one film, so everything is a held-out test set. When a second film exists, split by film; when real sessions exist, split by session too, and never tune prompts on test examples.

## Latest results (lab film, measured on the Mac, October 16, 2026 UTC)

Timeline: 18 accepted facts. 91 examples (67 derived, 24 golden); 68 spoiler-probe runs. Full output: [results/2026-10-16-lantern-fox.md](results/2026-10-16-lantern-fox.md).

| Strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | Routing | Ungrounded | p50 / p95 ms |
|---|---|---|---|---|---|---|---|
| Timeline only (AI off) | **0 of 68** | 82/83 (99%) | 26/30 (87%) | 21/25 (84%) | 12/12 | 0 | 0.04 / 0.18 |
| Careful fake model | **0 of 68** | 61/83 (73%) | 27/30 (90%) | 22/25 (88%) | 12/12 | 0 | 0.03 / 0.18 |
| Leaky fake model | **0 of 68** | 68/83 (82%) | 23/30 (77%) | 18/25 (72%) | 12/12 | 0 | 0.03 / 0.09 |
| Ollama qwen2.5:3b (local, free) | **0 of 68** | 65/83 (78%) | 30/30 (100%) | 25/25 (100%) | 12/12 | 0 | 0.08 / 1972 |

The fake-model rows match the cloud session's run exactly, so the merge kept the pipeline's behaviour. The local model is not fully deterministic: an earlier run the same evening gave 68/83 abstentions and a p95 of 2187 ms, with the other columns the same.

Paraphrased commands (rules only): 6 of 12 run the right action, 6 go on as questions, **0 run a wrong action**.

Skipped: Bedrock Nova 2 Lite (not requested: AWS is not set up yet) and the TypeSafe judge (no key; a paid API).

The cloud session also ran a browser end-to-end check on its TV simulator (14 of 14). That simulator was not merged, so the check does not exist on this branch; the Vega app on the Vega Virtual Device is the TV.

### What the benchmark changed

The first run had 0 leaks but only 49% correct abstentions with AI off. Looking at the misses found three real bugs, now fixed and covered by tests:

1. "What happens next?" was routed as a recap ("what (just) happen" matched "what happens"). Questions about the future now get a fixed no-spoiler line without any model call.
2. "Who owns the lantern?" was treated as "who is that" and described the lantern. Identify now needs "who is", "who are" or "which one".
3. With AI off, the keyword fallback accepted a name alone ("How old is Hoot?" returned a Hoot fact). It now needs a matching word besides the name.

## Limits

- One synthetic film whose facts are captions drawn on the frames; real films are harder to annotate and to detect scenes in.
- Real-model numbers so far come from a 3B local model only; Nova is not measured yet.
- The golden set was written by the same agent that built the system; a person's review would make it stronger.
- No usability test with people yet (PROJECT.md 14.4 still applies).
