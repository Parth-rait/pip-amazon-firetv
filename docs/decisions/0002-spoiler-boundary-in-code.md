# 0002: The spoiler boundary is enforced in code, before and after the model

Date: 2026-10-16. Status: accepted.

**Context.** The v2.0 plan relied on sending only earlier notes and a prompt rule. A model may know a famous film's ending anyway, so a prompt cannot be the only guard.

**Decision.** Before any model call, Pip abstains when there is no timeline or no permitted evidence, when the question is about the future, or when it names something not seen yet. After the call, an answer gate withholds any reply that uses a later term, cites a fact that is not permitted, or names content without citing anything; unsafe chips are dropped. A rewind during the call triggers a re-check. The answer cache is keyed by the exact permitted evidence set.

**Evidence.** Lab benchmark: 0 leaks in 68 probe runs for every strategy, including a fake model that always tells the ending (docs/evaluation/README.md).

**Consequences.** Some honest questions get "not sure" (a cost we accept). Spoiler terms must be written well during review; the validator checks that facts do not name entities before they appear.
