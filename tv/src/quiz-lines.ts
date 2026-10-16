// The TV's quiz and results lines, in the words of PROJECT.md section 3.5 (the pad has the same).
export const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function letterOf(index: number): string {
  return LETTERS[index] ?? '?';
}

/** "Together you got <correct> of <answers> right.", or "No answers this time." */
export function familyLine(correct: number, answers: number): string {
  return answers === 0
    ? 'No answers this time.'
    : `Together you got ${correct} of ${answers} right.`;
}
