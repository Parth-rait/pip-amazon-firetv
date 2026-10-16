import { describe, expect, it } from 'vitest';
import { permittedEvidence } from './boundary.js';
import { lanternFoxTimeline } from './fixture.js';

const timeline = lanternFoxTimeline();
const ids = (set: ReturnType<typeof permittedEvidence>) => set.facts.map((f) => f.id);

describe('permittedEvidence', () => {
  it('permits only facts fully revealed by the boundary', () => {
    expect(ids(permittedEvidence(timeline, 13, 'accepted'))).toEqual(['f1']);
    expect(ids(permittedEvidence(timeline, 14, 'accepted'))).toEqual(['f1', 'f2']);
    // f5 starts at 46 but is only fully revealed at 54.
    expect(ids(permittedEvidence(timeline, 50, 'accepted'))).not.toContain('f5');
  });

  it('uses only accepted facts by default, and drafts only when asked', () => {
    expect(ids(permittedEvidence(timeline, 60, 'accepted'))).not.toContain('d1');
    expect(ids(permittedEvidence(timeline, 60, 'candidate'))).toContain('d1');
    expect(ids(permittedEvidence(timeline, 60, 'candidate'))).not.toContain('x1');
  });

  it('restricts names not seen yet and spoiler words of facts not revealed yet', () => {
    const early = permittedEvidence(timeline, 20, 'accepted');
    expect(early.restrictedTerms).toEqual(expect.arrayContaining(['Moss', 'badger', 'lighthouse', 'glow', 'Hoot']));
    expect(early.restrictedTerms).not.toContain('Ember');
  });

  it('keeps spoiler words of rejected facts restricted', () => {
    expect(permittedEvidence(timeline, 40, 'accepted').restrictedTerms).toContain('cracks');
  });

  it('stops restricting a word once revealed text uses it', () => {
    const afterLighthouse = permittedEvidence(timeline, 64, 'accepted');
    expect(afterLighthouse.restrictedTerms).not.toContain('lighthouse');
    expect(afterLighthouse.restrictedTerms).toContain('lighthouse keeper');
    expect(afterLighthouse.restrictedTerms).toContain('keeper');
  });

  it('gives equal keys for equal evidence and different keys otherwise', () => {
    const a = permittedEvidence(timeline, 27, 'accepted');
    const b = permittedEvidence(timeline, 33, 'accepted');
    const c = permittedEvidence(timeline, 41, 'accepted');
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(permittedEvidence({ ...timeline, version: 'other' }, 27, 'accepted').key).not.toBe(a.key);
  });
});
