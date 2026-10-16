// The quiz rules: answers, reveals, scores and standings (PROJECT.md section 4.5, Quiz).
// Logic only: the caller passes the time and owns the timer.
import { isOnline, type Roster } from '../core/players.js';
import type { ResultsView } from '../shared/protocol.js';
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

/** A new run on the first question. Every score starts again at 0. */
export function startQuiz(roster: Roster, questions: QuizQuestion[], nowMs: number): QuizRun {
  for (const player of roster.players.values()) player.score = 0;
  return {
    questions,
    index: 0,
    phase: 'question',
    phaseStartedAt: nowMs,
    answers: new Map(),
    correct: 0,
    answered: 0,
  };
}

export function currentQuestion(run: QuizRun): QuizQuestion | undefined {
  return run.questions[run.index];
}

/** Counts only a player's answer to the current question in its question phase; a new tap replaces the old one. */
export function recordAnswer(
  run: QuizRun,
  roster: Roster,
  answer: { playerId: string; index: number; choice: number },
): boolean {
  if (run.phase !== 'question' || answer.index !== run.index) return false;
  if (!roster.players.has(answer.playerId)) return false;
  run.answers.set(answer.playerId, answer.choice);
  return true;
}

/** True when every online player has answered. False when nobody is online, so the timer reveals. */
export function everyoneAnswered(run: QuizRun, roster: Roster): boolean {
  const online = [...roster.players.values()].filter(isOnline);
  return online.length > 0 && online.every((player) => run.answers.has(player.id));
}

/** Moves to the reveal and scores 1 point per right answer. Returns this question's tally. */
export function revealQuestion(
  run: QuizRun,
  roster: Roster,
  nowMs: number,
): { right: number; answered: number } {
  const question = currentQuestion(run);
  let right = 0;
  for (const [playerId, choice] of run.answers) {
    const player = roster.players.get(playerId);
    if (!player || !question) continue;
    if (choice === question.answer) {
      player.score += 1;
      right += 1;
    }
  }
  run.phase = 'reveal';
  run.phaseStartedAt = nowMs;
  run.correct += right;
  run.answered += run.answers.size;
  return { right, answered: run.answers.size };
}

/** Goes to the next question. Returns false after the last one (time for the results). */
export function nextQuestion(run: QuizRun, nowMs: number): boolean {
  if (run.index + 1 >= run.questions.length) return false;
  run.index += 1;
  run.phase = 'question';
  run.phaseStartedAt = nowMs;
  run.answers = new Map();
  return true;
}

/** Everyone by score, in join order on a tie; equal scores share a place (1, 2, 2, 4). */
export function standings(roster: Roster): ResultsView['ranking'] {
  const sorted = [...roster.players.values()].sort((a, b) => b.score - a.score);
  return sorted.map((player) => {
    const firstWithScore = sorted.findIndex((p) => p.score === player.score);
    return {
      playerId: player.id,
      name: player.name,
      score: player.score,
      place: firstWithScore + 1,
    };
  });
}

export function buildResults(run: QuizRun, roster: Roster): ResultsView {
  return {
    ranking: standings(roster),
    questions: run.questions.length,
    correct: run.correct,
    answers: run.answered,
    moment: null, // the most reacted-to scene, filled in with reactions
  };
}
