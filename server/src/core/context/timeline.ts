// Timed facts about a piece of content: what is known, when it is revealed, and the evidence for it.
// Generic on purpose: a film, a show or a recipe video all fit. Loaded and checked by film/timeline-file.ts.

/** How far a fact has been checked. Only `accepted` facts reach people by default. */
export type ReviewStatus = 'candidate' | 'accepted' | 'rejected' | 'needs-change';

/** A pointer to the source moment that supports a fact (a sampled frame, a subtitle line...). */
export interface EvidenceRef {
  ref: string; // id of a frame or line in the pipeline's manifest
  atSec: number; // its exact source timestamp
}

export interface TimedFact {
  id: string;
  startSec: number; // when the moment it describes begins
  revealSec: number; // the earliest time someone watching knows the whole fact; never before startSec
  kind: 'event' | 'appearance' | 'setting' | 'dialogue' | 'relation';
  text: string; // one or two plain sentences, written so they reveal nothing after revealSec
  entities: string[]; // entity ids
  spoilerTerms: string[]; // distinctive words that must not appear in answers before revealSec
  evidence: EvidenceRef[];
  confidence: number; // 0..1, from the generator or the reviewer
  review: ReviewStatus;
}

export interface Entity {
  id: string;
  name: string; // what a child would call it
  aliases: string[];
  firstSeenSec: number;
  intro: string; // a short description that is safe at firstSeenSec
  // Set when the name is learned later than the character is seen (from dialogue): until
  // namedSec the character is called `label`, and its name is a restricted term.
  label?: string;
  namedSec?: number;
  review: ReviewStatus;
}

export interface Timeline {
  contentId: string;
  version: string; // changes whenever any fact changes; part of every cache key
  durationSec: number;
  facts: TimedFact[]; // sorted by startSec
  entities: Entity[];
  coveredUntilSec?: number; // what is on screen is described only up to here (partial annotation)
}

/** Which review states the runtime may use. Production uses `accepted` only. */
export type ReviewPolicy = 'accepted' | 'candidate';

export function isUsable(review: ReviewStatus, policy: ReviewPolicy): boolean {
  if (review === 'accepted') return true;
  return policy === 'candidate' && review === 'candidate';
}

/** An empty timeline: Pip knows nothing about this content and abstains. */
export function emptyTimeline(contentId: string, durationSec: number): Timeline {
  return { contentId, version: 'empty', durationSec, facts: [], entities: [] };
}
