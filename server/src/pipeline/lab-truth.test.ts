// The lab film's committed annotations and timeline, checked against the film's own script.
// This is what stands behind the lab review record ("lab script check; not a person").
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentWords } from '../core/context/text.js';
import { checkTimelineFile } from '../film/timeline-file.js';

const root = new URL('../../', import.meta.url);
const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const truth = json('pipeline/truth/lantern-fox.truth.json') as {
  sceneCutsSec: number[];
  captions: { atSec: number; text: string }[];
};
const checked = checkTimelineFile(json('lab/content/timelines/lantern-fox.json'));

describe('lab film timeline', () => {
  it('is a valid timeline file', () => {
    expect(checked.ok).toBe(true);
  });

  it('supports every accepted fact with a script caption already on screen at its reveal', () => {
    if (!checked.ok) return;
    const frames = new Map(checked.file.frames.map((f) => [f.id, f.atSec]));
    const unsupported = checked.file.facts
      .filter((f) => f.review.status === 'accepted')
      .filter((fact) => {
        const seenBy = Math.max(...fact.evidence.map((ref) => frames.get(ref) ?? -1));
        const visible = truth.captions.filter(
          (c) => c.atSec <= seenBy && c.atSec <= fact.revealSec,
        );
        const words = new Set(contentWords(fact.text));
        return !visible.some((c) => {
          const overlap = contentWords(c.text).filter((w) => words.has(w)).length;
          return overlap >= Math.ceil(words.size / 2);
        });
      })
      .map((f) => f.id);
    expect(unsupported).toEqual([]);
  });

  it('never reveals a fact before its supporting caption appears', () => {
    if (!checked.ok) return;
    for (const fact of checked.file.facts) {
      const firstCaption = truth.captions.find((c) =>
        contentWords(c.text).some((w) => contentWords(fact.text).includes(w)),
      );
      expect(fact.revealSec).toBeGreaterThanOrEqual(firstCaption?.atSec ?? 0);
    }
  });
});
