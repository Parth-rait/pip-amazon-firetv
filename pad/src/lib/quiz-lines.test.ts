import { describe, expect, it } from 'vitest';
import type { QuizView } from '../shared/protocol';
import { familyLine, revealLine } from './quiz-lines';

const ME = 'a'.repeat(32);

function reveal(picks: Record<string, number>): QuizView {
  return {
    index: 0,
    total: 5,
    phase: 'reveal',
    question: 'What did the bunny find?',
    choices: ['A flower', 'An apple', 'A bird', 'A rock'],
    secondsLeft: 0,
    answeredIds: Object.keys(picks),
    correct: 1,
    explanation: 'He picked it up.',
    picks,
  };
}

describe('revealLine', () => {
  it('says "You got it." for a right answer', () => {
    expect(revealLine(reveal({ [ME]: 1 }), ME)).toBe('You got it.');
  });

  it('names the right choice after a wrong answer, never "Wrong"', () => {
    expect(revealLine(reveal({ [ME]: 3 }), ME)).toBe('It was B: An apple.');
  });

  it('names the right choice when I did not answer', () => {
    expect(revealLine(reveal({}), ME)).toBe('No answer this time. It was B: An apple.');
  });
});

describe('familyLine', () => {
  it('gives the family total, or says nobody answered', () => {
    expect(familyLine(9, 10)).toBe('Together you got 9 of 10 right.');
    expect(familyLine(0, 0)).toBe('No answers this time.');
  });
});
