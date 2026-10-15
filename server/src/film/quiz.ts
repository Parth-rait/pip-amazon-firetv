// The quiz run kept on a session. The rules (answers, reveals, scores) come in Step 9.
import type { QuizQuestion } from './content.js';

export interface QuizRun {
  questions: QuizQuestion[]; // the unlocked questions, in story order
  index: number;
  phase: 'question' | 'reveal';
  phaseStartedAt: number;
  answers: Map<string, number>; // playerId -> choice, for the current question
  correct: number; // right answers so far, from everyone together
  answered: number; // answers given so far, from everyone together
}

export function quizTimerKey(code: string): string {
  return `${code}:quiz`;
}
