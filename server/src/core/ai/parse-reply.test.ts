import { describe, expect, it } from 'vitest';
import { parseReply, toChips } from './parse-reply.js';

const Q = 'Who is the big bunny?';
const allow = { allowClarify: true };

describe('parseReply', () => {
  it('reads an ANSWER with NEXT chips', () => {
    const reply = parseReply(
      'ANSWER: He is a gentle giant rabbit.\nNEXT: Where does he live? | Who are his friends?',
      Q,
      allow,
    );
    expect(reply).toEqual({
      kind: 'answer',
      text: 'He is a gentle giant rabbit.',
      next: ['Where does he live?', 'Who are his friends?'],
    });
  });

  it('reads a CLARIFY with 2 options', () => {
    expect(parseReply('CLARIFY: The bird? | The squirrel?', 'what was that', allow)).toEqual({
      kind: 'clarify',
      options: ['The bird?', 'The squirrel?'],
    });
  });

  it('lets ANSWER win over CLARIFY', () => {
    const reply = parseReply('CLARIFY: A? | B?\nANSWER: It was a bird.', Q, allow);
    expect(reply?.kind).toBe('answer');
  });

  it('ignores CLARIFY when allowClarify is false', () => {
    expect(parseReply('CLARIFY: A? | B?', Q, { allowClarify: false })).toBeNull();
  });

  it('needs 2 options for a CLARIFY', () => {
    expect(parseReply('CLARIFY: Only one?', Q, allow)).toBeNull();
  });

  it('turns unlabelled text into an answer with no chips', () => {
    expect(parseReply('He is a rabbit.', Q, allow)).toEqual({
      kind: 'answer',
      text: 'He is a rabbit.',
      next: [],
    });
  });

  it('reads lowercase and bold labels, and fields that continue on the next line', () => {
    const reply = parseReply('**answer:** He is\na rabbit.\n**next:** Why is he sad?', Q, allow);
    expect(reply).toEqual({ kind: 'answer', text: 'He is a rabbit.', next: ['Why is he sad?'] });
  });

  it('returns null for an empty reply', () => {
    expect(parseReply('   ', Q, allow)).toBeNull();
  });
});

describe('toChips', () => {
  it('drops long chips, duplicates and a chip that repeats the question', () => {
    const long = 'x'.repeat(61);
    const chips = toChips(`${long} | Where is he? | where is he | who is the BIG bunny`, Q);
    expect(chips).toEqual(['Where is he?']);
  });

  it('keeps at most 3 chips, each ending with "?" and without quotes', () => {
    expect(toChips('"One." | Two! | Three | Four', Q)).toEqual(['One?', 'Two?', 'Three?']);
  });
});
