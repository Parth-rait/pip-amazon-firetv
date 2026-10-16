// Retrieval before reasoning: pick the few permitted facts that matter for a question.
// Keyword and entity matching plus recency; no embeddings until a benchmark shows the need.
import type { EvidenceSet } from './boundary.js';
import { contentWords } from './text.js';
import type { Entity, TimedFact } from './timeline.js';

export interface RetrieveOptions {
  limit: number; // most facts returned
  recentCount: number; // the latest facts always included, for "what just happened?"
}

const ENTITY_MATCH_SCORE = 3;
const RECENCY_HALF_LIFE_SEC = 60;
const RECENCY_WEIGHT = 1.5;

/** The facts most relevant to `query`, in story order. Never returns anything outside `evidence`. */
export function retrieve(evidence: EvidenceSet, query: string, options: RetrieveOptions): TimedFact[] {
  const facts = evidence.facts;
  if (facts.length === 0 || options.limit <= 0) return [];
  const queryWords = new Set(contentWords(query));
  const mentioned = mentionedEntities(evidence.entities, query);
  const df = documentFrequency(facts);
  const scored = facts.map((fact) => ({
    fact,
    score: scoreFact(fact, queryWords, mentioned, df, facts.length, evidence.boundarySec),
  }));
  const recent = facts.slice(-Math.min(options.recentCount, options.limit));
  const chosen = new Map<string, TimedFact>(recent.map((f) => [f.id, f]));
  for (const { fact, score } of [...scored].sort((a, b) => b.score - a.score)) {
    if (chosen.size >= options.limit) break;
    if (score > 0) chosen.set(fact.id, fact);
  }
  return [...chosen.values()].sort((a, b) => a.startSec - b.startSec);
}

function scoreFact(
  fact: TimedFact,
  queryWords: Set<string>,
  mentioned: Set<string>,
  df: Map<string, number>,
  total: number,
  boundarySec: number,
): number {
  let score = 0;
  for (const id of fact.entities) if (mentioned.has(id)) score += ENTITY_MATCH_SCORE;
  for (const word of new Set(contentWords(fact.text))) {
    if (queryWords.has(word)) score += Math.log(1 + total / (df.get(word) ?? 1));
  }
  const age = Math.max(0, boundarySec - fact.revealSec);
  return score + RECENCY_WEIGHT * Math.pow(0.5, age / RECENCY_HALF_LIFE_SEC) * (score > 0 ? 1 : 0);
}

function documentFrequency(facts: TimedFact[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const fact of facts) {
    for (const word of new Set(contentWords(fact.text))) df.set(word, (df.get(word) ?? 0) + 1);
  }
  return df;
}

/** Entity ids whose name or alias words appear in the text. */
export function mentionedEntities(entities: Entity[], text: string): Set<string> {
  const words = new Set(contentWords(text));
  const found = new Set<string>();
  for (const entity of entities) {
    const names = [entity.name, ...entity.aliases];
    if (names.some((n) => contentWords(n).every((w) => words.has(w)) && contentWords(n).length > 0)) {
      found.add(entity.id);
    }
  }
  return found;
}

/**
 * Who is on screen around now: entities of facts that started in the last `windowSec`, newest
 * first. Only permitted facts and entities are used.
 */
export function entitiesNear(evidence: EvidenceSet, windowSec: number): Entity[] {
  const byId = new Map(evidence.entities.map((e) => [e.id, e]));
  const result: Entity[] = [];
  const recent = evidence.facts
    .filter((f) => f.startSec >= evidence.boundarySec - windowSec)
    .sort((a, b) => b.startSec - a.startSec);
  for (const fact of recent) {
    for (const id of fact.entities) {
      const entity = byId.get(id);
      if (entity && !result.includes(entity)) result.push(entity);
    }
  }
  return result;
}
