import { describe, expect, it } from 'vitest';
import { cleanText } from './clean-text.js';
import { parseReply, toChips } from './parse-reply.js';

const ask = (raw: string, allowClarify = true) => parseReply(raw, 'Who is that?', { allowClarify });

describe('parseReply', () => {
  it('reads an ANSWER with NEXT chips and SOURCES', () => {
    expect(
      ask('ANSWER: That is Ember.\nNEXT: Where is she going? | What did she find\nSOURCES: f2, f3'),
    ).toEqual({
      kind: 'answer',
      text: 'That is Ember.',
      next: ['Where is she going?', 'What did she find?'],
      sources: ['f2', 'f3'],
    });
  });

  it('reads a CLARIFY with two options', () => {
    expect(ask('CLARIFY: The fox? | The owl?')).toEqual({
      kind: 'clarify',
      options: ['The fox?', 'The owl?'],
    });
  });

  it('prefers ANSWER when the model wrote both', () => {
    expect(ask('CLARIFY: a | b\nANSWER: It is a fox.')).toMatchObject({
      kind: 'answer',
      text: 'It is a fox.',
    });
  });

  it('ignores CLARIFY after a "Did you mean" pick, so the reply is unusable', () => {
    expect(ask('CLARIFY: The fox? | The owl?', false)).toBeNull();
  });

  it('turns unlabelled text into an answer with no chips', () => {
    expect(ask('It is a small fox.')).toEqual({
      kind: 'answer',
      text: 'It is a small fox.',
      next: [],
      sources: [],
    });
  });

  it('accepts lowercase and bold labels and continuation lines', () => {
    expect(ask('**answer:** It is\na fox.\nsources: none')).toMatchObject({
      kind: 'answer',
      text: 'It is a fox.',
      sources: [],
    });
  });

  it('returns null for an empty or label-only reply', () => {
    expect(ask('')).toBeNull();
    expect(ask('NEXT: a | b')).toBeNull();
  });

  it('drops source ids that are not ids', () => {
    expect(ask('ANSWER: Yes.\nSOURCES: f1; <script>, f2 f2')).toMatchObject({
      sources: ['f1', 'f2'],
    });
  });
});

describe('toChips', () => {
  it('drops long chips, duplicates and repeats of the question; keeps 3, each with "?"', () => {
    const long = 'x'.repeat(61);
    expect(
      toChips(`Who is that | ${long} | Why! | why | "Where" | What now. | Extra`, 'Who is that?'),
    ).toEqual(['Why?', 'Where?', 'What now?']);
  });
});

describe('cleanText', () => {
  it('removes markdown and keeps at most two sentences', () => {
    expect(cleanText('**Hi** there. Second one! Third one.')).toBe('Hi there. Second one!');
  });

  it('keeps within 240 characters and cuts one long sentence at a word with an ellipsis', () => {
    const long = `${'word '.repeat(80)}end.`;
    const cleaned = cleanText(long);
    expect(cleaned.length).toBeLessThanOrEqual(240);
    expect(cleaned.endsWith('…')).toBe(true);
    expect(cleaned).not.toMatch(/wor…$/);
  });

  it('strips wrapping quotes', () => {
    expect(cleanText('"It is a fox."')).toBe('It is a fox.');
  });
});
