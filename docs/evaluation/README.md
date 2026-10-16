# Evaluation

What Pip is measured on, how, and the latest real numbers. Results files are written by the benchmark itself (`results/<date>-<content>.{md,json}`); never edit them by hand or round them in Pip's favour.

## Run it

```bash
cd server
npm run eval                      # the lab film (The Lantern Fox)
npm run eval -- big-buck-bunny    # once a reviewed timeline exists
npm run eval -- lantern-fox --nova   # adds real Bedrock calls (needs the AWS profile; costs a little)
npm test                          # unit and lab tests, including spoiler, rewind and failure cases
npm run lab                       # the Virtual Pip Lab scenarios on their own
node ../scripts/e2e-browser.mjs http://localhost:8787 <folder>   # browser run, see below
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
| Latency p50 / p95 | Time per answer through Pip's pipeline | With fake models this is Pip's own overhead; real-model latency comes from `--nova` or the server log `ask.done` |
| Paraphrased commands | Of 12 paraphrased commands: run right, sent on as questions (safe), run wrong (unsafe) | Unsafe = 0; the rest is the task a typed judge would be measured on |

Strategies run on the same examples: **timeline only** (AI off: answers come straight from reviewed facts), **careful fake model** (answers with a fact it was given and cites it), **leaky fake model** (always tells the ending, citing a permitted fact to look grounded: the worst case for the gate), and **Bedrock** with `--nova`. The fake models measure the plumbing (prompt, citations, gate, cache), not answer quality.

Every spoiler and unseen-entity probe runs twice: fresh, and again after the same question was asked at the very end of the film with a shared answer cache, which is what a rewind looks like to the cache.

## Datasets

- **Derived** (`server/evals/datasets/lantern-fox/v1/examples.jsonl`, 67 examples): made by `npm run pipeline -- dataset` from the accepted timeline. Each example records the facts allowed at its time and its provenance.
- **Golden** (`server/evals/lantern-fox.golden.json`, 24 examples): hand-written adversarial probes whose true answer is revealed later, unknown facts, and grounded questions with expected citations. Written by the agent from the film script; a person should review it.
- **Splits:** one film, so everything is a held-out test set. When a second film exists, split by film; when real sessions exist, split by session too, and never tune prompts on test examples.

## Latest results (lab film, October 16, 2026)

Timeline: 18 accepted facts. 91 examples (67 derived, 24 golden); 68 spoiler-probe runs.

| Strategy | Spoiler leaks | Abstains when it should | Answers when it should | Cites the expected fact | Routing | Ungrounded | p50 / p95 ms |
|---|---|---|---|---|---|---|---|
| Timeline only (AI off) | **0 of 68** | 82/83 (99%) | 26/30 (87%) | 21/25 (84%) | 12/12 | 0 | 0.08 / 0.31 |
| Careful fake model | **0 of 68** | 61/83 (73%) | 27/30 (90%) | 22/25 (88%) | 12/12 | 0 | 0.06 / 0.58 |
| Leaky fake model | **0 of 68** | 68/83 (82%) | 23/30 (77%) | 18/25 (72%) | 12/12 | 0 | 0.05 / 0.24 |

Paraphrased commands (rules only): 6 of 12 run the right action, 6 go on as questions, **0 run a wrong action**.

Skipped: Bedrock Nova 2 Lite (no AWS credentials in this environment) and the TypeSafe judge (no key; the API host is unreachable here).

Browser run (`scripts/e2e-browser.mjs`, Chromium, TV at 1920x1080, phone at 390 px, tablet at 820 px, phone at 360 px): 14 of 14 checks passed with no console errors.

### What the benchmark changed

The first run had 0 leaks but only 49% correct abstentions with AI off. Looking at the misses found three real bugs, now fixed and covered by tests:

1. "What happens next?" was routed as a recap ("what (just) happen" matched "what happens"). Questions about the future now get a fixed no-spoiler line without any model call.
2. "Who owns the lantern?" was treated as "who is that" and described the lantern. Identify now needs "who is", "who are" or "which one".
3. With AI off, the keyword fallback accepted a name alone ("How old is Hoot?" returned a Hoot fact). It now needs a matching word besides the name.

## Limits

- One synthetic film whose facts are captions drawn on the frames; real films are harder to annotate and to detect scenes in.
- No real-model numbers yet; the fake models cannot tell us answer quality.
- The golden set was written by the same agent that built the system; a person's review would make it stronger.
- No usability test with people yet (PROJECT.md 14.4 still applies).
