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
  const seen = timeline.entities.filter(
    (e) => e.firstSeenSec <= boundarySec && isUsable(e.review, policy),
  );
  const entities = seen.map((e) => entityAt(e, boundarySec));
  const unnamed = seen.filter((e) => !isNamed(e, boundarySec)).map((e) => e.name);
  const restrictedTerms = laterTerms(timeline, facts, entities, unnamed);
  // A naming changes what Pip may say without adding a fact id, so it is part of the key too.
  const ids = [
    ...facts.map((f) => f.id),
    ...seen.map((e) => `e:${e.id}${isNamed(e, boundarySec) ? '' : ':unnamed'}`),
  ].sort();
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

function isNamed(entity: Entity, boundarySec: number): boolean {
  return entity.namedSec === undefined || entity.namedSec <= boundarySec;
}

/**
 * The entity as a viewer knows it at `boundarySec`: before its name is heard it is its label
 * ("the baby dragon"), with no aliases, so nothing Pip builds from it carries the name.
 */
export function entityAt(entity: Entity, boundarySec: number): Entity {
  if (isNamed(entity, boundarySec)) return entity;
  return { ...entity, name: entity.label ?? 'someone', aliases: [] };
}

/**
 * Names of entities not seen yet, names not heard yet, and spoiler words of facts not revealed
 * yet. Rejected facts count too: a wrong fact is still about the film. A term already present in
 * revealed text is allowed.
 */
function laterTerms(
  timeline: Timeline,
  facts: TimedFact[],
  entities: Entity[],
  unheardNames: string[],
): string[] {
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
    ...unheardNames,
  ];
  const unique = [...new Set(candidates.map((t) => t.trim()).filter((t) => t.length > 1))];
  return unique.filter((term) => !containsTerm(revealedText, term));
}
