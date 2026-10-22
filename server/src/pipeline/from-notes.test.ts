import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { permittedEvidence } from '../core/context/boundary.js';
import { containsTerm } from '../core/context/text.js';
import { loadFilms } from '../film/content.js';
import { checkTimelineFile, loadTimeline, toTimeline } from '../film/timeline-file.js';
import { REVEAL_LAG_SEC, timelineFromNotes } from './from-notes.js';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const films = loadFilms(CONTENT);
const film = (id: string) => {
  const found = films.find((f) => f.id === id);
  if (!found) throw new Error(`content/${id}.json is missing`);
  return found;
};
const build = (id: string) =>
  timelineFromNotes({
    film: film(id),
    reviewer: 'test',
    reviewedAt: '2026-10-22',
    sha256: null,
    license: 'CC BY 3.0',
  });

describe('timelineFromNotes', () => {
  it('makes a timeline that passes every check, one accepted fact per note', () => {
    for (const id of ['tears-of-steel', 'sintel']) {
      const file = build(id);
      expect(checkTimelineFile(file)).toMatchObject({ ok: true });
      expect(file.facts).toHaveLength(film(id).notes.length);
      expect(file.facts.every((f) => f.review.status === 'accepted')).toBe(true);
      expect(file.entities.map((e) => e.id).sort()).toEqual(
        film(id)
          .characters.map((c) => c.id)
          .sort(),
      );
    }
  });

  it('reveals a note only once its beat is over', () => {
    const file = build('sintel');
    const twist = file.facts.find((f) => f.text.includes('all grown up'));
    expect(twist?.revealSec).toBe((twist?.startSec ?? 0) + REVEAL_LAG_SEC);
    const timeline = toTimeline(file, 'test');
    const before = permittedEvidence(timeline, (twist?.revealSec ?? 0) - 1, 'accepted');
    expect(before.facts.some((f) => f.id === twist?.id)).toBe(false);
  });

  it("makes a fact's first words restricted until it is revealed, never Pip's own words", () => {
    const timeline = toTimeline(build('sintel'), 'test');
    const early = permittedEvidence(timeline, 400, 'accepted');
    expect(early.restrictedTerms.some((t) => containsTerm('the old scar', t))).toBe(true);
    expect(early.restrictedTerms.some((t) => containsTerm('Keep watching and see!', t))).toBe(
      false,
    );
  });

  it('links a note to the characters it names, only once they are seen', () => {
    const file = build('tears-of-steel');
    const named = file.facts.find((f) => f.text.includes('calls the old man Thom'));
    expect(named?.entities).toEqual(expect.arrayContaining(['old-man', 'thom']));
    const seen = new Map(file.entities.map((e) => [e.id, e.firstSeenSec]));
    for (const fact of file.facts)
      for (const id of fact.entities) expect(seen.get(id)).toBeLessThanOrEqual(fact.revealSec);
  });

  it('matches the committed timelines, so the server answers from what was reviewed', () => {
    for (const id of ['tears-of-steel', 'sintel']) {
      const committed = loadTimeline(`${CONTENT}/timelines`, film(id));
      expect(committed.facts.map((f) => f.text)).toEqual(build(id).facts.map((f) => f.text));
    }
  });
});
