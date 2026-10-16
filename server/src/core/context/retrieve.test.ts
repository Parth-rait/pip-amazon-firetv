import { describe, expect, it } from 'vitest';
import { permittedEvidence } from './boundary.js';
import { lanternFoxTimeline } from './fixture.js';
import { entitiesNear, mentionedEntities, retrieve } from './retrieve.js';

const timeline = lanternFoxTimeline();

describe('retrieve', () => {
  it('never returns a fact outside the permitted evidence', () => {
    const evidence = permittedEvidence(timeline, 30, 'accepted');
    const found = retrieve(evidence, 'Does the lighthouse shine again because of Moss?', { limit: 10, recentCount: 2 });
    expect(found.every((f) => f.revealSec <= 30)).toBe(true);
    expect(found.map((f) => f.id)).not.toContain('f7');
  });

  it('finds an older fact by its words and keeps story order', () => {
    const evidence = permittedEvidence(timeline, 96, 'accepted');
    const found = retrieve(evidence, 'what did the owl say about the lantern?', { limit: 3, recentCount: 1 });
    expect(found.map((f) => f.id)).toContain('f4');
    const starts = found.map((f) => f.startSec);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('always includes the most recent facts', () => {
    const evidence = permittedEvidence(timeline, 65, 'accepted');
    const found = retrieve(evidence, 'hmm', { limit: 5, recentCount: 2 });
    expect(found.map((f) => f.id)).toEqual(['f5', 'f6']);
  });

  it('returns nothing when no evidence is permitted', () => {
    expect(retrieve(permittedEvidence(timeline, 1, 'accepted'), 'who?', { limit: 5, recentCount: 2 })).toEqual([]);
  });
});

describe('mentionedEntities and entitiesNear', () => {
  it('matches names and aliases as whole words', () => {
    const evidence = permittedEvidence(timeline, 96, 'accepted');
    expect([...mentionedEntities(evidence.entities, 'Who is the owl?')]).toEqual(['hoot']);
    expect([...mentionedEntities(evidence.entities, 'Where is Ember going')]).toEqual(['ember']);
  });

  it('lists who is on screen now, newest first, from permitted facts only', () => {
    const evidence = permittedEvidence(timeline, 41, 'accepted');
    expect(entitiesNear(evidence, 20).map((e) => e.id)).toEqual(['hoot', 'lantern', 'ember']);
  });
});
