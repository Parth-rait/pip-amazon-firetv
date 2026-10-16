// The spoiler boundary: the evidence that is allowed at a moment, and the words that are not.
// This is a hard filter in code, applied before any model call and again to every answer.
import { createHash } from 'node:crypto';
import { containsTerm } from './text.js';
import {
  isUsable,
  type Entity,
  type ReviewPolicy,
  type TimedFact,
  type Timeline,
} from './timeline.js';

/** Everything Pip may use at one moment, plus the terms it must not say. */
export interface EvidenceSet {
  contentId: string;
  timelineVersion: string;
  boundarySec: number;
  facts: TimedFact[]; // revealed by boundarySec and usable under the policy, in story order
  entities: Entity[]; // first seen by boundarySec and usable
  restrictedTerms: string[]; // names and spoiler words from later, minus any already revealed
  key: string; // stable id of exactly this evidence set; equal sets give equal keys
}

/**
 * The evidence revealed by `boundarySec`. A fact counts only when it is fully revealed
 * (`revealSec <= boundarySec`), so a scene that has started but not finished stays hidden.
 */
export function permittedEvidence(
  timeline: Timeline,
  boundarySec: number,
  policy: ReviewPolicy,
): EvidenceSet {
  const facts = timeline.facts.filter(
    (f) => f.revealSec <= boundarySec && isUsable(f.review, policy),
  );
  const entities = timeline.entities.filter(
    (e) => e.firstSeenSec <= boundarySec && isUsable(e.review, policy),
  );
  const restrictedTerms = laterTerms(timeline, facts, entities);
  const ids = [...facts.map((f) => f.id), ...entities.map((e) => `e:${e.id}`)].sort();
  const key = createHash('sha256')
    .update(`${timeline.contentId}\n${timeline.version}\n${ids.join(',')}`)
    .digest('hex')
    .slice(0, 32);
  return {
    contentId: timeline.contentId,
    timelineVersion: timeline.version,
    boundarySec,
    facts,
    entities,
    restrictedTerms,
    key,
  };
}

/**
 * Names of entities not seen yet and spoiler words of facts not revealed yet. Rejected facts count
 * too: a wrong fact is still about the film. A term already present in revealed text is allowed.
 */
function laterTerms(timeline: Timeline, facts: TimedFact[], entities: Entity[]): string[] {
  const shownFacts = new Set(facts.map((f) => f.id));
  const shownEntities = new Set(entities.map((e) => e.id));
  const revealedText = [
    ...facts.map((f) => f.text),
    ...entities.flatMap((e) => [e.name, ...e.aliases, e.intro]),
  ].join('\n');
  const candidates = [
    ...timeline.entities
      .filter((e) => !shownEntities.has(e.id))
      .flatMap((e) => [e.name, ...e.aliases]),
    ...timeline.facts.filter((f) => !shownFacts.has(f.id)).flatMap((f) => f.spoilerTerms),
  ];
  const unique = [...new Set(candidates.map((t) => t.trim()).filter((t) => t.length > 1))];
  return unique.filter((term) => !containsTerm(revealedText, term));
}
