import { describe, expect, it } from 'vitest';
import { missedFacts, MISSED_MIN_SEC } from './missed.js';
import type { TimedFact, Timeline } from './timeline.js';

const fact = (
  id: string,
  revealSec: number,
  review: TimedFact['review'] = 'accepted',
): TimedFact => ({
  id,
  startSec: Math.max(0, revealSec - 5),
  revealSec,
  kind: 'event',
  text: `fact ${id}`,
  entities: [],
  spoilerTerms: [],
  evidence: [{ ref: `fr-${id}`, atSec: revealSec }],
  confidence: 0.9,
  review,
});

const timeline: Timeline = {
  contentId: 'film',
  version: 't1',
  durationSec: 600,
  facts: [10, 40, 70, 100, 130, 160, 190, 220, 250].map((t) => fact(`f${t}`, t)),
  entities: [],
};

describe('missedFacts', () => {
  it('returns only facts revealed inside the gap, never after now', () => {
    const ids = missedFacts(timeline, 'accepted', 50, 135).map((f) => f.id);
    expect(ids).toEqual(['f70', 'f100', 'f130']);
  });

  it('spreads a long gap over at most four facts and ends with the latest', () => {
    const ids = missedFacts(timeline, 'accepted', 0, 600).map((f) => f.id);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe('f10');
    expect(ids.at(-1)).toBe('f250');
  });

  it('says nothing for a short gap', () => {
    expect(missedFacts(timeline, 'accepted', 100, 100 + MISSED_MIN_SEC - 1)).toEqual([]);
  });

  it('skips facts that are not reviewed under the policy', () => {
    const withDraft: Timeline = {
      ...timeline,
      facts: [...timeline.facts, fact('draft', 255, 'candidate')],
    };
    expect(missedFacts(withDraft, 'accepted', 240, 300).map((f) => f.id)).toEqual(['f250']);
    expect(missedFacts(withDraft, 'candidate', 240, 300).map((f) => f.id)).toEqual([
      'f250',
      'draft',
    ]);
  });
});
