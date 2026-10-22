import { describe, expect, it } from 'vitest';
import { permittedEvidence } from '../core/context/boundary.js';
import { checkTimelineFile, toTimeline } from '../film/timeline-file.js';
import { buildTimelineFile } from './review.js';
import {
  CONFIDENCE,
  finalizeCandidates,
  headNoun,
  SceneMemory,
  shortLabel,
  similarity,
  type Naming,
} from './scene-memory.js';
import type { TranscriptLine } from './transcript.js';
import type { CharacterKind, FrameObservation } from './vlm.js';

type Who = [match: string | null, kind: CharacterKind, looks: string, doing?: string];

function obs(who: Who[], action: string, setting = 'a snowy mountain'): FrameObservation {
  return {
    characters: who.map(([match, kind, looks, doing = '']) => ({ match, kind, looks, doing })),
    action,
    setting,
    objects: [],
    textOnScreen: '',
  };
}

const WOMAN = 'young woman with red hair, brown cloak';
const DRAGON = 'small baby dragon with a hurt wing';

/** A two-minute story: a woman, a baby dragon named in dialogue, a stranger seen once. */
function story() {
  const memory = new SceneMemory();
  const frames = [
    ['fr-00100', 10, 's1', obs([[null, 'person', WOMAN, 'walks']], 'A woman walks through snow.')],
    [
      'fr-00140',
      14,
      's1',
      obs([['c1', 'person', 'young woman with red hair']], 'A woman walks through snow.'),
    ],
    [
      'fr-00200',
      20,
      's2',
      obs([[null, 'person', 'young woman, red hair']], 'The woman climbs a rock.'),
    ],
    // The model "knows" the film: the name appears in its caption before anyone says it.
    [
      'fr-00400',
      40,
      's3',
      obs([[null, 'creature', DRAGON]], 'Scales the dragon lies hurt on a roof.', 'a city rooftop'),
    ],
    [
      'fr-00440',
      44,
      's3',
      obs(
        [
          ['c2', 'creature', DRAGON],
          ['c1', 'person', WOMAN],
        ],
        'The woman picks up the dragon.',
        'a city rooftop',
      ),
    ],
    [
      'fr-00700',
      70,
      's4',
      obs([[null, 'person', 'tall guard in armour']], 'A guard shouts.', 'a market'),
    ],
    [
      'fr-02000',
      200,
      's5',
      obs([['c1', 'person', WOMAN]], 'The woman stands alone.', 'a snowy mountain'),
    ],
  ] as const;
  for (const [id, atSec, sceneId, o] of frames) memory.observe({ id, atSec, sceneId }, o);
  const lines: TranscriptLine[] = [
    { id: 'ln-00500', startSec: 50, endSec: 52, text: 'Goodnight, Scales.' },
  ];
  const namings: Naming[] = [{ name: 'Scales', lineId: 'ln-00500', trackId: 'c2' }];
  const scenes = [
    { id: 's1', startSec: 9, endSec: 18 },
    { id: 's2', startSec: 18, endSec: 38 },
    { id: 's3', startSec: 38, endSec: 68 },
    { id: 's4', startSec: 68, endSec: 190 },
    { id: 's5', startSec: 190, endSec: 220 },
  ];
  const candidates = finalizeCandidates({
    assetId: 'story',
    generator: 'test',
    createdAt: '2026-10-17',
    method: 'synthetic',
    memory,
    scenes,
    lines,
    heard: new Map([['Scales', 52]]),
    namings,
  });
  return { memory, lines, scenes, frames, candidates };
}

describe('SceneMemory', () => {
  it('links a character by the model, by look a few seconds later, and starts new ones', () => {
    const { memory } = story();
    const links = memory.sightings.map((s) => s.links.map((l) => `${l.trackId}:${l.how}`));
    expect(links).toEqual([
      ['c1:new'],
      ['c1:model'],
      ['c1:continuity'],
      ['c2:new'],
      ['c2:model', 'c1:model'],
      ['c3:new'],
      ['c1:model'],
    ]);
    expect(memory.tracks.map((t) => [t.id, t.sightings])).toEqual([
      ['c1', 5],
      ['c2', 2],
      ['c3', 1],
    ]);
  });

  it('never links across kinds, or one track to two characters in a frame', () => {
    const memory = new SceneMemory();
    memory.observe({ id: 'a', atSec: 1, sceneId: null }, obs([[null, 'person', 'old man']], ''));
    const s = memory.observe(
      { id: 'b', atSec: 2, sceneId: null },
      obs(
        [
          ['c1', 'creature', 'old dragon'],
          ['c1', 'person', 'old man'],
        ],
        '',
      ),
    );
    expect(s.links.map((l) => `${l.trackId}:${l.how}`)).toEqual(['c2:new', 'c1:model']);
  });

  it('offers recent characters first in the prompt roster, then the most seen', () => {
    const { memory } = story();
    expect(memory.roster(205).map((r) => r.id)).toEqual(['c1', 'c2', 'c3']);
    expect(memory.roster(205)[0]?.looks).toBe(WOMAN);
  });

  it('measures similarity on meaningful words', () => {
    expect(similarity('young woman with red hair', 'a young woman, red hair')).toBe(1);
    expect(similarity('old man', 'small dragon')).toBe(0);
    expect(shortLabel('A young woman with red hair, brown cloak')).toBe(
      'young woman with red hair',
    );
    expect(shortLabel('small, grey, reptilian, with large eyes')).toBe(
      'small grey reptilian with large eyes',
    );
  });
});

describe('finalizeCandidates', () => {
  it('keeps characters seen at least twice, and names one only from the line where it is heard', () => {
    const { candidates } = story();
    expect(candidates.entities).toEqual([
      {
        id: 'c1',
        name: 'young woman with red hair',
        aliases: [],
        firstSeenSec: 10,
        intro: 'A young woman with red hair, first seen in a snowy mountain at 0:10.',
      },
      {
        id: 'c2',
        name: 'Scales',
        aliases: ['small baby dragon with a hurt wing'],
        firstSeenSec: 40,
        intro: 'A small baby dragon with a hurt wing, first seen in a city rooftop at 0:40.',
        label: 'small baby dragon with a hurt wing',
        namedSec: 52,
      },
    ]);
    expect(JSON.stringify(candidates)).not.toContain('guard in armour');
  });

  it('scrubs a name the model used before it was heard', () => {
    const { candidates } = story();
    const early = candidates.facts.find((f) => f.id === 'ev-fr-00400');
    expect(early?.text).toBe('Someone the dragon lies hurt on a roof.');
    expect(
      candidates.facts
        .filter((f) => f.revealSec < 52)
        .map((f) => f.text)
        .join(' '),
    ).not.toMatch(/Scales/);
  });

  it('writes appearances, dialogue, the naming and a return to an earlier scene', () => {
    const { candidates } = story();
    const byId = new Map(candidates.facts.map((f) => [f.id, f]));
    expect(byId.get('ap-c2')).toMatchObject({
      kind: 'appearance',
      revealSec: 40,
      evidence: ['fr-00400'],
    });
    expect(byId.get('dl-ln-00500')).toMatchObject({
      kind: 'dialogue',
      text: 'Someone says: "Goodnight, Scales."',
      revealSec: 52,
      evidence: ['ln-00500'],
      entities: ['c2', 'c1'],
      confidence: CONFIDENCE.dialogue,
    });
    expect(byId.get('nm-c2')).toMatchObject({
      kind: 'relation',
      revealSec: 52,
      text: 'The small baby dragon with a hurt wing is called Scales: someone says "Goodnight, Scales."',
      spoilerTerms: ['Scales'],
      evidence: ['ln-00500', 'fr-00440'],
    });
    expect(byId.get('ra-c1-fr-02000')).toMatchObject({
      kind: 'relation',
      text: 'The young woman with red hair is back, last seen at 0:44 (The woman picks up the dragon).',
      evidence: ['fr-00440', 'fr-02000'],
    });
    expect(byId.get('st-fr-02000')).toMatchObject({
      kind: 'relation',
      text: 'Back in a snowy mountain, last shown at 0:20.',
    });
    // The second frame of a scene repeating the same action adds nothing.
    expect(byId.has('ev-fr-00140')).toBe(false);
    // A first sighting is less certain than a confirmed one.
    expect(byId.get('ap-c1')?.confidence).toBe(CONFIDENCE.newCharacter);
  });

  it('makes each thing shown a spoiler term of the first fact that mentions it', () => {
    const { candidates } = story();
    const byId = new Map(candidates.facts.map((f) => [f.id, f]));
    expect(byId.get('ap-c1')?.spoilerTerms).toEqual(['woman']);
    // The dragon's appearance and the caption share the frame; the first of them guards the word.
    expect(byId.get('ap-c2')?.spoilerTerms).toEqual(['dragon']);
    expect(byId.get('ev-fr-00400')?.spoilerTerms).toEqual([]);
    // Said or shown before: not a spoiler any more.
    expect(byId.get('ev-fr-00440')?.spoilerTerms).toEqual([]);
    expect(headNoun('small baby dragon with a hurt wing')).toBe('dragon');
    expect(headNoun('old bearded man')).toBe('man');
    expect(headNoun('a')).toBeNull();
  });

  it('treats a name from the film card as known from the first sighting', () => {
    const memory = new SceneMemory();
    memory.observe(
      { id: 'a', atSec: 5, sceneId: null },
      obs([[null, 'person', WOMAN]], 'A woman.'),
    );
    memory.observe(
      { id: 'b', atSec: 9, sceneId: null },
      obs([['c1', 'person', WOMAN]], 'She runs.'),
    );
    const candidates = finalizeCandidates({
      assetId: 'x',
      generator: 'test',
      createdAt: '',
      method: '',
      memory,
      scenes: [],
      lines: [{ id: 'ln-00080', startSec: 7, endSec: 8, text: 'Run, Sintel!' }],
      heard: new Map([['Sintel', 8]]),
      namings: [{ name: 'Sintel', lineId: 'ln-00080', trackId: 'c1' }],
      knownNames: new Map([['Sintel', 0]]),
    });
    expect(candidates.entities[0]).toMatchObject({ name: 'Sintel', firstSeenSec: 5 });
    expect(candidates.entities[0]?.namedSec).toBeUndefined();
  });
});

describe('a generated timeline at runtime', () => {
  function timeline() {
    const { candidates, lines, scenes, frames } = story();
    const file = buildTimelineFile({
      asset: { assetId: 'story', sha256: 'a'.repeat(64), license: 'test', rights: 'test' },
      contentId: 'story',
      durationSec: 220,
      scenes,
      frames: frames.map(([id, atSec, sceneId]) => ({
        id,
        atSec,
        requestedSec: atSec,
        sceneId,
        path: `frames/${id}.jpg`,
      })),
      lines,
      candidates,
      review: null,
    });
    const checked = checkTimelineFile(file);
    if (!checked.ok) throw new Error(checked.problems.join('\n'));
    return toTimeline(checked.file, 'v1');
  }

  it('passes every timeline check, with dialogue lines as evidence', () => {
    const t = timeline();
    expect(t.facts.find((f) => f.id === 'dl-ln-00500')?.evidence).toEqual([
      { ref: 'ln-00500', atSec: 52 },
    ]);
  });

  it('calls the dragon by its look until its name is heard, and keeps the name back until then', () => {
    const t = timeline();
    const before = permittedEvidence(t, 51, 'candidate');
    expect(before.entities.find((e) => e.id === 'c2')).toMatchObject({
      name: 'small baby dragon with a hurt wing',
      aliases: [],
    });
    expect(before.restrictedTerms).toContain('Scales');
    const after = permittedEvidence(t, 52, 'candidate');
    expect(after.entities.find((e) => e.id === 'c2')?.name).toBe('Scales');
    expect(after.restrictedTerms).not.toContain('Scales');
    expect(after.key).not.toBe(before.key);
  });
});
