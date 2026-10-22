import { describe, expect, it } from 'vitest';
import { framePrompt, namingPrompt, parseNaming, parseObservation } from './vlm.js';

describe('framePrompt', () => {
  it('lists the characters seen so far by look and id, never by name', () => {
    const prompt = framePrompt([{ id: 'c1', kind: 'person', looks: 'young woman with red hair' }]);
    expect(prompt).toContain('c1: young woman with red hair (person)');
    expect(prompt).toContain('Never use names');
    expect(framePrompt([])).toContain('none yet');
  });

  it('asks who a heard name belongs to among the visible characters only', () => {
    const prompt = namingPrompt('Goodnight, Scales.', 'Scales', [
      { id: 'c3', kind: 'creature', looks: 'small dragon' },
    ]);
    expect(prompt).toContain('"Goodnight, Scales."');
    expect(prompt).toContain('c3: small dragon (creature)');
  });
});

describe('parseObservation', () => {
  it('reads a clean reply', () => {
    const raw = JSON.stringify({
      characters: [
        { match: 'c1', kind: 'person', looks: 'young woman with red hair', doing: 'holds a sword' },
      ],
      action: 'A woman stands in the snow.',
      setting: 'snowy mountain',
      objects: ['sword'],
      text_on_screen: '',
    });
    expect(parseObservation(raw, ['c1'])).toEqual({
      characters: [
        { match: 'c1', kind: 'person', looks: 'young woman with red hair', doing: 'holds a sword' },
      ],
      action: 'A woman stands in the snow.',
      setting: 'snowy mountain',
      objects: ['sword'],
      textOnScreen: '',
    });
  });

  it('treats an id the prompt did not offer, a name or "new" as a new character', () => {
    const raw = JSON.stringify({
      characters: [
        { match: 'c9', kind: 'person', looks: 'old man' },
        { match: 'Scales', kind: 'dragon', looks: 'small dragon' },
        { match: 'new', kind: 'animal', looks: 'grey cat' },
      ],
    });
    const obs = parseObservation(raw, ['c1']);
    expect(obs?.characters.map((c) => [c.match, c.kind])).toEqual([
      [null, 'person'],
      [null, 'creature'],
      [null, 'animal'],
    ]);
  });

  it('copes with prose around the JSON, nested descriptions and missing fields', () => {
    const raw =
      'Here you go:\n```json\n{"characters":[{"description":"a tall knight"}],"setting":{"description":"a castle"}}\n```';
    const obs = parseObservation(raw, []);
    expect(obs?.characters[0]).toMatchObject({
      looks: 'a tall knight',
      kind: 'other',
      match: null,
    });
    expect(obs?.setting).toBe('a castle');
    expect(obs?.action).toBe('');
  });

  it('returns null for a reply without JSON, and drops characters with no description', () => {
    expect(parseObservation('I cannot see anything.', [])).toBeNull();
    expect(parseObservation('{"characters":[{"match":"new"}]}', [])?.characters).toEqual([]);
  });

  it('keeps at most four characters', () => {
    const characters = Array.from({ length: 6 }, (_, i) => ({ looks: `figure ${i}` }));
    expect(parseObservation(JSON.stringify({ characters }), [])?.characters).toHaveLength(4);
  });
});

describe('parseNaming', () => {
  it('accepts only an offered id', () => {
    expect(parseNaming('{"who":"c3","sure":true}', ['c1', 'c3'])).toEqual({
      who: 'c3',
      sure: true,
    });
    expect(parseNaming('{"who":"c7"}', ['c1'])).toEqual({ who: null, sure: false });
    expect(parseNaming('{"who":"unknown"}', ['c1']).who).toBeNull();
    expect(parseNaming('no idea', ['c1']).who).toBeNull();
  });
});
