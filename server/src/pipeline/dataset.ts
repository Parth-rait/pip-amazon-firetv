// The dataset factory: evaluation examples derived from an accepted timeline, each with the
// evidence it may use, what a good reply must or must not contain, and where it came from.
import { permittedEvidence } from '../core/context/boundary.js';
import type { Timeline } from '../core/context/timeline.js';
import type { PlaybackIntent } from '../core/intent/route-text.js';

export type EvalTask =
  | 'recap'
  | 'identify'
  | 'grounded'
  | 'spoiler-probe'
  | 'unseen-entity'
  | 'unknown-fact'
  | 'routing';

export interface EvalExample {
  id: string;
  task: EvalTask;
  contentId: string;
  atSec: number;
  question: string;
  expect: {
    kind: 'answer' | 'abstain' | 'action' | 'dismiss' | 'ambiguous' | 'question';
    cites?: string[]; // at least one of these fact ids should be among the sources
    mention?: string[]; // at least one of these words should appear
    mustNotMention?: string[]; // none of these may appear (spoilers)
    intent?: PlaybackIntent;
  };
  allowedFacts: string[]; // the accepted facts revealed by atSec
  provenance: { timelineVersion: string; derivedFrom: string[]; generator: string };
  split: 'test' | 'dev';
}

export const DATASET_GENERATOR = 'pip-dataset-factory/1';

/** Spoiler probes ask about the future without naming it, so only the answer can leak. */
const SPOILER_QUESTIONS = [
  'What happens next?',
  'How does the film end?',
  'What is going to happen?',
];
const UNKNOWN_QUESTIONS = (name: string) => [
  `How old is ${name}?`,
  `What is ${name}'s favourite food?`,
];

/** Typed commands the router must keep away from any model. */
export const ROUTING_EXAMPLES: {
  question: string;
  kind: EvalExample['expect']['kind'];
  intent?: PlaybackIntent;
}[] = [
  { question: 'pause', kind: 'action', intent: { type: 'pause' } },
  { question: 'Pause the movie please', kind: 'action', intent: { type: 'pause' } },
  { question: 'play', kind: 'action', intent: { type: 'play' } },
  { question: 'keep going', kind: 'action', intent: { type: 'play' } },
  { question: 'go back 30 seconds', kind: 'action', intent: { type: 'seek', deltaSec: -30 } },
  { question: 'skip ahead', kind: 'action', intent: { type: 'seek', deltaSec: 10 } },
  { question: 'never mind', kind: 'dismiss' },
  { question: 'stop', kind: 'ambiguous' },
  { question: 'Why did the fox stop?', kind: 'question' },
  { question: 'Who is that?', kind: 'question' },
  { question: 'Can you go back to the part with the owl?', kind: 'question' },
  { question: 'What did she find in the snow?', kind: 'question' },
];

function round(sec: number): number {
  return Math.round(sec * 10) / 10;
}

/** Every example for one timeline. Uses accepted facts only. */
export function buildDataset(timeline: Timeline): EvalExample[] {
  const examples: EvalExample[] = [];
  const add = (
    example: Omit<EvalExample, 'id' | 'contentId' | 'allowedFacts' | 'provenance' | 'split'>,
    derivedFrom: string[],
  ) => {
    const allowed = permittedEvidence(timeline, example.atSec, 'accepted').facts.map((f) => f.id);
    examples.push({
      id: `${timeline.contentId}-${example.task}-${String(examples.length + 1).padStart(3, '0')}`,
      contentId: timeline.contentId,
      allowedFacts: allowed,
      provenance: { timelineVersion: timeline.version, derivedFrom, generator: DATASET_GENERATOR },
      split: 'test', // one film: everything is held out; nothing here is for training
      ...example,
    });
  };
  const accepted = timeline.facts.filter((f) => f.review === 'accepted');
  const end = timeline.durationSec;

  for (const fact of accepted) {
    const after = round(Math.min(fact.revealSec + 1, end));
    add(
      {
        task: 'recap',
        atSec: after,
        question: 'What just happened?',
        expect: { kind: 'answer', cites: [fact.id] },
      },
      [fact.id],
    );
    const restricted = permittedEvidence(
      timeline,
      round(Math.max(0, fact.startSec - 0.5)),
      'accepted',
    ).restrictedTerms;
    if (fact.startSec > 1 && restricted.length > 0) {
      const question =
        SPOILER_QUESTIONS[examples.length % SPOILER_QUESTIONS.length] ?? 'What happens next?';
      add(
        {
          task: 'spoiler-probe',
          atSec: round(Math.max(0, fact.startSec - 0.5)),
          question,
          expect: { kind: 'abstain', mustNotMention: restricted },
        },
        [fact.id],
      );
    }
  }
  for (const entity of timeline.entities.filter((e) => e.review === 'accepted')) {
    const intro = accepted.find((f) => f.entities.includes(entity.id));
    if (intro) {
      add(
        {
          task: 'identify',
          atSec: round(Math.min(intro.revealSec + 1, end)),
          question: `Who is ${entity.name}?`,
          expect: { kind: 'answer', mention: [entity.name] },
        },
        [intro.id],
      );
    }
    if (entity.firstSeenSec > 2) {
      const before = round(entity.firstSeenSec - 2);
      const restricted = permittedEvidence(timeline, before, 'accepted').restrictedTerms;
      add(
        {
          task: 'unseen-entity',
          atSec: before,
          question: `Who is ${entity.name}?`,
          expect: { kind: 'abstain', mustNotMention: restricted },
        },
        [],
      );
    }
    for (const question of UNKNOWN_QUESTIONS(entity.name)) {
      if (entity.firstSeenSec <= end)
        add({ task: 'unknown-fact', atSec: end, question, expect: { kind: 'abstain' } }, []);
    }
  }
  for (const r of ROUTING_EXAMPLES) {
    add(
      {
        task: 'routing',
        atSec: round(end / 2),
        question: r.question,
        expect: { kind: r.kind, ...(r.intent ? { intent: r.intent } : {}) },
      },
      [],
    );
  }
  return examples;
}

/** JSON Lines, one example per line, stable order. */
export function toJsonl(examples: EvalExample[]): string {
  return examples.map((e) => JSON.stringify(e)).join('\n') + '\n';
}
