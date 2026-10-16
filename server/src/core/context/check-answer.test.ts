import { describe, expect, it } from 'vitest';
import { permittedEvidence } from './boundary.js';
import { checkAnswer, isAbstention } from './check-answer.js';
import { lanternFoxTimeline } from './fixture.js';

const timeline = lanternFoxTimeline();
const lexicon = timeline.entities.flatMap((e) => [e.name, ...e.aliases]);
const at30 = permittedEvidence(timeline, 30, 'accepted');

describe('checkAnswer', () => {
  it('passes a cited answer that stays within what was seen', () => {
    expect(checkAnswer('Ember found an old lantern in the snow.', ['f3'], at30, lexicon)).toEqual({ ok: true });
  });

  it('rejects a name or spoiler word from later, even when cited', () => {
    expect(checkAnswer('The lantern belongs to Moss.', ['f3'], at30, lexicon)).toMatchObject({ ok: false, reason: 'restricted-term', detail: 'Moss' });
    expect(checkAnswer('Soon it will glow!', ['f3'], at30, lexicon)).toMatchObject({ ok: false, reason: 'restricted-term' });
    expect(checkAnswer('A badger owns it.', [], at30, lexicon)).toMatchObject({ ok: false, reason: 'restricted-term' });
  });

  it('rejects a citation of a fact that is not permitted', () => {
    expect(checkAnswer('Ember walks on.', ['f2', 'f7'], at30, lexicon)).toMatchObject({ ok: false, reason: 'unknown-source', detail: 'f7' });
  });

  it('rejects an uncited claim about the content but allows an honest abstention', () => {
    expect(checkAnswer('Ember is very brave.', [], at30, lexicon)).toMatchObject({ ok: false, reason: 'uncited-claim' });
    expect(checkAnswer("I'm not sure yet, we haven't seen that.", [], at30, lexicon)).toEqual({ ok: true });
    expect(checkAnswer('Foxes love snow days!', [], at30, [])).toEqual({ ok: true });
  });
});

describe('isAbstention', () => {
  it('recognises the ways Pip says it does not know', () => {
    expect(isAbstention("I don't know that yet.")).toBe(true);
    expect(isAbstention('Not sure yet!')).toBe(true);
    expect(isAbstention('It is a fox.')).toBe(false);
  });
});
