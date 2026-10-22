import { describe, expect, it } from 'vitest';
import { SceneMemory } from './scene-memory.js';
import { scoreTracking, type CharacterTruth } from './tracking-score.js';
import type { CharacterKind } from './vlm.js';

function see(
  memory: SceneMemory,
  id: string,
  atSec: number,
  who: [string | null, CharacterKind, string][],
) {
  memory.observe(
    { id, atSec, sceneId: null },
    {
      characters: who.map(([match, kind, looks]) => ({ match, kind, looks, doing: '' })),
      action: '',
      setting: '',
      objects: [],
      textOnScreen: '',
    },
  );
}

const truth = (frames: CharacterTruth['frames']): CharacterTruth => ({
  schemaVersion: 1,
  assetId: 'x',
  labelledBy: 'test',
  characters: { girl: '', dragon: '' },
  frames,
});

describe('scoreTracking', () => {
  it('labels tracks by majority, and counts right, wrong, missed and invented', () => {
    const memory = new SceneMemory();
    see(memory, 'f1', 1, [[null, 'person', 'girl with red hair']]); // c1
    see(memory, 'f2', 2, [
      ['c1', 'person', 'girl with red hair'],
      [null, 'creature', 'dragon'],
    ]); // c2
    see(memory, 'f3', 3, []); // the girl is there, the model saw nobody
    see(memory, 'f4', 4, [[null, 'person', 'shadow']]); // c3 in an empty frame
    see(memory, 'f5', 100, [[null, 'person', 'woman with red hair']]); // c4: the girl again, a new track
    const score = scoreTracking(
      memory,
      truth([
        { id: 'f1', atSec: 1, present: ['girl'] },
        { id: 'f2', atSec: 2, present: ['girl', 'dragon'] },
        { id: 'f3', atSec: 3, present: ['girl'] },
        { id: 'f4', atSec: 4, present: [] },
        { id: 'f5', atSec: 100, present: ['girl'] },
      ]),
      new Map([['Scales', 'c2']]),
    );
    expect(score.presence).toEqual({ seen: 3, missed: 1, invented: 1, emptyKept: 0 });
    expect(score.trackLabels).toMatchObject({ c1: 'girl', c4: 'girl', c3: 'nobody' });
    expect(score.fragments.girl).toEqual(['c1', 'c4']);
    expect(score.links).toEqual({ right: 4, wrong: 1, precision: 0.8 });
    expect(score.recall).toBe(0.8);
    expect(score.names).toEqual({ Scales: score.trackLabels.c2 });
  });
});
