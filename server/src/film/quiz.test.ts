import { describe, expect, it } from 'vitest';
import { joinPlayer, leaveSocket, type Roster } from '../core/players.js';
import type { QuizQuestion } from './content.js';
import {
  buildResults,
  everyoneAnswered,
  nextQuestion,
  recordAnswer,
  revealQuestion,
  standings,
  startQuiz,
} from './quiz.js';

const A = 'a'.repeat(32);
const B = 'b'.repeat(32);
const C = 'c'.repeat(32);

const questions: QuizQuestion[] = [10, 20].map((atSec) => ({
  atSec,
  question: `Q${atSec}?`,
  choices: ['A', 'B', 'C', 'D'],
  answer: 2,
  explanation: 'E.',
}));

function roster(): Roster {
  const r: Roster = { players: new Map(), hostId: null };
  joinPlayer(r, { playerId: A, name: 'Sam', socketId: 'sa' }, 0);
  joinPlayer(r, { playerId: B, name: 'Mia', socketId: 'sb' }, 1);
  return r;
}

describe('quiz', () => {
  it('resets every score at the start', () => {
    const r = roster();
    (r.players.get(A) as { score: number }).score = 7;
    startQuiz(r, questions, 0);
    expect([...r.players.values()].map((p) => p.score)).toEqual([0, 0]);
  });

  it('counts only the current question in its question phase, from players in the session', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    expect(recordAnswer(run, r, { playerId: A, index: 1, choice: 2 })).toBe(false);
    expect(recordAnswer(run, r, { playerId: C, index: 0, choice: 2 })).toBe(false);
    expect(recordAnswer(run, r, { playerId: A, index: 0, choice: 2 })).toBe(true);
    revealQuestion(run, r, 1);
    expect(recordAnswer(run, r, { playerId: B, index: 0, choice: 2 })).toBe(false);
  });

  it('lets a new tap replace the old one', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    recordAnswer(run, r, { playerId: A, index: 0, choice: 1 });
    recordAnswer(run, r, { playerId: A, index: 0, choice: 2 });
    expect(run.answers.get(A)).toBe(2);
  });

  it('knows when every online player has answered, and is false when nobody is online', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    recordAnswer(run, r, { playerId: A, index: 0, choice: 2 });
    expect(everyoneAnswered(run, r)).toBe(false);
    leaveSocket(r, B, 'sb', 5);
    expect(everyoneAnswered(run, r)).toBe(true);
    leaveSocket(r, A, 'sa', 5);
    expect(everyoneAnswered(run, r)).toBe(false);
  });

  it('scores right answers in the reveal and keeps the family tally', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    recordAnswer(run, r, { playerId: A, index: 0, choice: 2 });
    recordAnswer(run, r, { playerId: B, index: 0, choice: 0 });
    expect(revealQuestion(run, r, 5)).toEqual({ right: 1, answered: 2 });
    expect(r.players.get(A)?.score).toBe(1);
    expect(r.players.get(B)?.score).toBe(0);
    expect(run).toMatchObject({ phase: 'reveal', correct: 1, answered: 2 });
  });

  it('ends after the last question', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    expect(nextQuestion(run, 1)).toBe(true);
    expect(run).toMatchObject({ index: 1, phase: 'question', phaseStartedAt: 1 });
    expect(run.answers.size).toBe(0);
    expect(nextQuestion(run, 2)).toBe(false);
  });

  it('gives equal scores a shared place (1, 2, 2, 4)', () => {
    const r = roster();
    joinPlayer(r, { playerId: C, name: 'Leo', socketId: 'sc' }, 2);
    joinPlayer(r, { playerId: 'd'.repeat(32), name: 'Gran', socketId: 'sd' }, 3);
    const scores = [3, 2, 2, 0];
    [...r.players.values()].forEach((p, i) => (p.score = scores[i] ?? 0));
    expect(standings(r).map((s) => [s.name, s.place])).toEqual([
      ['Sam', 1],
      ['Mia', 2],
      ['Leo', 2],
      ['Gran', 4],
    ]);
  });

  it('builds the results with the family total', () => {
    const r = roster();
    const run = startQuiz(r, questions, 0);
    recordAnswer(run, r, { playerId: A, index: 0, choice: 2 });
    revealQuestion(run, r, 1);
    expect(buildResults(run, r)).toMatchObject({ questions: 2, correct: 1, answers: 1 });
  });
});
