# 0007: A semantic judgement may only offer choices, never act

Date: 2026-10-16. Status: accepted.

**Context.** The TypeSafe skill suggests typed judgements (choice, noul, score) for routing and ranking. Physical actions must stay deterministic and fail closed.

**Decision.** For text the rules tag as "other", an optional judge (`INTENT_JUDGE=typesafe`) may classify the intent. A confident `playback-command` (0.8 or more) only shows three explicit choices that route deterministically when tapped. The judge never runs an action, never answers questions and never replaces the answer gate. Without a key, the SDK or the network, the rules stand.

**Evidence still needed.** A live comparison against the rules on the paraphrase set (rules today: 6 of 12 right, 0 unsafe). Until that exists the SDK is not a dependency.
