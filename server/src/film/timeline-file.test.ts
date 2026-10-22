import { describe, expect, it } from 'vitest';
import { lanternFoxTimeline } from '../core/context/fixture.js';
import { checkTimelineFile, toTimeline, type TimelineFile } from './timeline-file.js';

const reviewed = { status: 'accepted' as const, by: 'test', at: '2026-10-16', note: undefined };

/** The fixture story as a timeline file, the shape the pipeline writes. */
function fixtureFile(): TimelineFile {
  const t = lanternFoxTimeline();
  return {
    schemaVersion: 1,
    contentId: t.contentId,
    durationSec: t.durationSec,
    source: {
      assetId: 'lantern-fox',
      sha256: null,
      license: 'MIT',
      rights: 'Original test story.',
    },
    frames: t.facts.flatMap((f) => f.evidence.map((e) => ({ id: e.ref, atSec: e.atSec }))),
    lines: [],
    scenes: [
      { id: 's1', startSec: 0, endSec: 48 },
      { id: 's2', startSec: 48, endSec: 96 },
    ],
    entities: t.entities.map((e) => ({ ...e, review: { ...reviewed, status: e.review } })),
    facts: t.facts.map((f) => ({
      id: f.id,
      startSec: f.startSec,
      revealSec: f.revealSec,
      kind: f.kind,
      text: f.text,
      entities: f.entities,
      spoilerTerms: f.spoilerTerms,
      evidence: f.evidence.map((e) => e.ref),
      confidence: f.confidence,
      generator: 'fixture',
      review: { ...reviewed, status: f.review, by: f.review === 'candidate' ? null : 'test' },
    })),
  };
}

function problems(change: (file: TimelineFile) => void): string[] {
  const file = structuredClone(fixtureFile());
  change(file);
  const result = checkTimelineFile(file);
  return result.ok ? [] : result.problems;
}

describe('checkTimelineFile', () => {
  it('accepts the fixture and converts it to the runtime timeline', () => {
    const result = checkTimelineFile(fixtureFile());
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(toTimeline(result.file, 'v1').facts).toHaveLength(lanternFoxTimeline().facts.length);
  });

  it('rejects a reveal outside the film or before its start', () => {
    expect(problems((f) => void (f.facts[0]!.revealSec = 500))).toContain(
      'fact f1: revealSec is after the end',
    );
    expect(problems((f) => void (f.facts[1]!.revealSec = 1))).toContain(
      'fact f2: revealSec is before startSec',
    );
  });

  it('rejects unresolved evidence and evidence from after the reveal', () => {
    expect(problems((f) => void (f.facts[0]!.evidence = ['nope']))).toContain(
      'fact f1: unresolved evidence nope',
    );
    expect(problems((f) => void (f.frames[0]!.atSec = 50))).toEqual(
      expect.arrayContaining([expect.stringContaining('is after its reveal')]),
    );
  });

  it('rejects a fact naming an entity before that entity is first seen', () => {
    expect(problems((f) => void f.facts[0]!.entities.push('moss'))).toContain(
      'fact f1: names moss before it is first seen',
    );
  });

  it('rejects an accepted fact without evidence or without a reviewer', () => {
    expect(problems((f) => void (f.facts[0]!.evidence = []))).toContain(
      'fact f1: accepted without evidence',
    );
    expect(problems((f) => void (f.facts[0]!.review.by = null))).toContain(
      'fact f1: accepted without a reviewer',
    );
  });

  it('rejects duplicate ids, overlapping scenes and unordered facts', () => {
    expect(problems((f) => void (f.facts[1]!.id = 'f1'))).toContain('duplicate fact id f1');
    expect(problems((f) => void (f.scenes[1]!.startSec = 40))).toContain('scene s2 overlaps s1');
    expect(problems((f) => f.facts.reverse())).toEqual(
      expect.arrayContaining([expect.stringContaining('order of startSec')]),
    );
  });

  it('resolves a dialogue line as evidence at the time it has been heard', () => {
    const file = fixtureFile();
    // f4 is revealed at 40 s: a line heard by then can support it, one still going on cannot.
    file.lines = [{ id: 'ln-00370', startSec: 37, endSec: 39.5, text: 'It belongs to someone.' }];
    file.facts[4]!.evidence = ['ln-00370'];
    const checked = checkTimelineFile(file);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(toTimeline(checked.file, 'v').facts[4]?.evidence).toEqual([
        { ref: 'ln-00370', atSec: 39.5 },
      ]);
    }
    file.lines[0]!.endSec = 45;
    expect(checkTimelineFile(file)).toMatchObject({ ok: false });
  });

  it('needs a label, and an intro without the name, for a character named after it is seen', () => {
    const named = (change: (e: TimelineFile['entities'][number]) => void) =>
      problems((f) => {
        const ember = f.entities.find((e) => e.id === 'ember')!;
        ember.intro = 'A small orange fox in the snow.';
        ember.label = 'small orange fox';
        ember.namedSec = ember.firstSeenSec + 5;
        change(ember);
      });
    expect(named(() => {})).toEqual([]);
    expect(named((e) => void (e.label = undefined))).toContain(
      'entity ember needs a label until it is named',
    );
    expect(named((e) => void (e.intro = 'Ember, a small fox.'))).toContain(
      'entity ember: intro gives away the name',
    );
    expect(named((e) => void (e.namedSec = e.firstSeenSec - 1))).toContain(
      'entity ember is named before it is seen',
    );
  });

  it('rejects a malformed file with the field path', () => {
    expect(checkTimelineFile({ schemaVersion: 2 })).toMatchObject({ ok: false });
  });
});
