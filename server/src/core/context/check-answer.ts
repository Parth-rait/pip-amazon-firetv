// The answer gate: a reply reaches people only if it cites permitted evidence and says nothing
// from later. Prompts ask the model to behave; this code makes sure it did.
import type { EvidenceSet } from './boundary.js';
import { containsTerm } from './text.js';

export type AnswerVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'restricted-term' | 'unknown-source' | 'uncited-claim' | 'unsupported-term';
      detail: string;
    };

const ABSTAIN =
  /\b(not sure|don'?t know|do not know|haven'?t seen|can'?t tell|cannot tell|no idea)\b/i;

/** True when the text admits it does not know. */
export function isAbstention(text: string): boolean {
  return ABSTAIN.test(text);
}

/**
 * Checks one reply text against the evidence it was allowed to use.
 * `lexicon` is every entity name and alias in the whole timeline: an uncited reply that names
 * anything from the content is treated as an unsupported claim.
 */
export function checkAnswer(
  text: string,
  cited: string[],
  evidence: EvidenceSet,
  lexicon: string[],
): AnswerVerdict {
  const term = evidence.restrictedTerms.find((t) => containsTerm(text, t));
  if (term !== undefined) return { ok: false, reason: 'restricted-term', detail: term };
  const allowed = new Set(evidence.facts.map((f) => f.id));
  const unknown = cited.find((id) => !allowed.has(id));
  if (unknown !== undefined) return { ok: false, reason: 'unknown-source', detail: unknown };
  if (cited.length === 0 && !isAbstention(text)) {
    const named = lexicon.find((t) => containsTerm(text, t));
    if (named !== undefined) return { ok: false, reason: 'uncited-claim', detail: named };
  }
  // Everything the answer names from the film must be in what it cites: "The big dragon is
  // Scales" citing a fact about a roof is the model's own knowledge of the film, not evidence.
  if (cited.length > 0) {
    const citedFacts = evidence.facts.filter((f) => cited.includes(f.id));
    const ids = new Set(citedFacts.flatMap((f) => f.entities));
    const support = [
      ...citedFacts.map((f) => f.text),
      ...evidence.entities
        .filter((e) => ids.has(e.id))
        .flatMap((e) => [e.name, ...e.aliases, e.intro]),
    ].join('\n');
    const unsupported = lexicon.find((t) => containsTerm(text, t) && !containsTerm(support, t));
    if (unsupported !== undefined)
      return { ok: false, reason: 'unsupported-term', detail: unsupported };
  }
  return { ok: true };
}
