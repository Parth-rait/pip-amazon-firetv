// The pad's quiz and results lines, in the words of PROJECT.md section 3.5.
import type { QuizView } from '../shared/protocol';

export const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function letterOf(index: number): string {
  return LETTERS[index] ?? '?';
}

/** "You got it.", "It was B: <choice>." or "No answer this time. It was B: <choice>." */
export function revealLine(quiz: QuizView, myId: string): string {
  const correct = quiz.correct ?? 0;
  const right = `${letterOf(correct)}: ${quiz.choices[correct] ?? ''}`;
  const mine = quiz.picks?.[myId];
  if (mine === correct) return 'You got it.';
  if (mine === undefined) return `No answer this time. It was ${right}.`;
  return `It was ${right}.`;
}

/** "Together you got <correct> of <answers> right.", or "No answers this time." */
export function familyLine(correct: number, answers: number): string {
  return answers === 0
    ? 'No answers this time.'
    : `Together you got ${correct} of ${answers} right.`;
}
