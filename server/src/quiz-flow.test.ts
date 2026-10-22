import { describe, expect, it, vi } from 'vitest';
import { createFakeModel } from './core/ai/model.js';
import { createFakeTimers } from './core/fake-timers.js';
import { joinPlayer, leaveSocket } from './core/players.js';
import type { Content } from './film/content.js';
import { quizTimerKey } from './film/quiz.js';
import { goToLobby, watchFilm, type FlowDeps, type PipServer } from './flow.js';
import {
  answerQuestion,
  checkEveryoneAnswered,
  nextStep,
  revealNow,
  startQuizFlow,
} from './quiz-flow.js';
import { createSession } from './sessions.js';
import { LIMITS } from './shared/protocol.js';

const SAM = '1'.repeat(32);
const MIA = '2'.repeat(32);
const film: Content = {
  id: 'test-film',
  title: 'Test',
  url: '/media/test.mp4',
  credit: 'Credit',
  durationSec: 100,
  premise: 'Premise.',
  tags: [],
  chapters: [],
  characters: [],
  predictions: [],
  notes: [{ atSec: 0, text: 'Start.' }],
  quiz: [10, 20, 90].map((atSec) => ({
    atSec,
    question: `Q${atSec}?`,
    choices: ['A', 'B', 'C', 'D'],
    answer: 1,
    explanation: 'E.',
  })),
};

function setup(positionSec = 30) {
  const timers = createFakeTimers();
  const deps: FlowDeps = {
    io: {
      to: () => ({ emit: () => {}, except: () => ({ emit: () => {} }) }),
    } as unknown as PipServer,
    films: [film],
    publicUrl: 'http://x',
    timers,
    now: () => 5000,
    model: createFakeModel(''),
    aiEnabled: false,
    logText: false,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  const session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
  session.stage = 'watch';
  session.contentId = film.id;
  session.playback = {
    contentId: film.id,
    positionSec,
    durationSec: 100,
    paused: false,
    ended: false,
  };
  session.playbackAt = 5000;
  joinPlayer(session, { playerId: SAM, name: 'Sam', socketId: 's1' }, 0);
  joinPlayer(session, { playerId: MIA, name: 'Mia', socketId: 's2' }, 1);
  return { deps, session, timers };
}

describe('the quiz flow', () => {
  it('starts with only the unlocked questions and keeps a paused resume point', () => {
    const { deps, session, timers } = setup(30);
    expect(startQuizFlow(session, deps)).toBe(true);
    expect(session.stage).toBe('quiz');
    expect(session.quiz?.questions.map((q) => q.atSec)).toEqual([10, 20]);
    expect(session.playback).toMatchObject({ positionSec: 30, paused: true });
    expect(timers.pending.get(quizTimerKey('ABCD'))?.ms).toBe(LIMITS.questionSeconds * 1000);
  });

  it('does not start before a question is unlocked', () => {
    const { deps, session } = setup(5);
    expect(startQuizFlow(session, deps)).toBe(false);
    expect(session.stage).toBe('watch');
  });

  it('reveals as soon as every online player has answered, and Pip cheers at half right', () => {
    const { deps, session, timers } = setup();
    startQuizFlow(session, deps);
    answerQuestion(session, { playerId: SAM, index: 0, choice: 1 }, deps);
    expect(session.quiz?.phase).toBe('question');
    answerQuestion(session, { playerId: MIA, index: 0, choice: 0 }, deps);
    expect(session.quiz?.phase).toBe('reveal');
    expect(session.pip).toBe('cheer');
    expect(timers.pending.has(quizTimerKey('ABCD'))).toBe(false);
  });

  it('reveals when the timer runs out, and Pip talks when fewer than half were right', () => {
    const { deps, session, timers } = setup();
    startQuizFlow(session, deps);
    answerQuestion(session, { playerId: SAM, index: 0, choice: 0 }, deps);
    timers.fire(quizTimerKey('ABCD'));
    expect(session.quiz?.phase).toBe('reveal');
    expect(session.pip).toBe('talking');
  });

  it('reveals when the last player who had not answered leaves', () => {
    const { deps, session } = setup();
    startQuizFlow(session, deps);
    answerQuestion(session, { playerId: SAM, index: 0, choice: 1 }, deps);
    leaveSocket(session, MIA, 's2', 6000);
    checkEveryoneAnswered(session, deps);
    expect(session.quiz?.phase).toBe('reveal');
  });

  it('ignores a stale next, so a double tap cannot skip a question', () => {
    const { deps, session } = setup();
    startQuizFlow(session, deps);
    revealNow(session, deps);
    expect(nextStep(session, { index: 0, phase: 'reveal' }, deps)).toBe(true);
    expect(nextStep(session, { index: 0, phase: 'reveal' }, deps)).toBe(false);
    expect(session.quiz).toMatchObject({ index: 1, phase: 'question' });
  });

  it('goes to the results after the last reveal, with Pip cheering', () => {
    const { deps, session } = setup();
    startQuizFlow(session, deps);
    nextStep(session, { index: 0, phase: 'question' }, deps);
    nextStep(session, { index: 0, phase: 'reveal' }, deps);
    nextStep(session, { index: 1, phase: 'question' }, deps);
    nextStep(session, { index: 1, phase: 'reveal' }, deps);
    expect(session.stage).toBe('results');
    expect(session.pip).toBe('cheer');
  });

  it('clears the question timer when the host goes to the lobby', () => {
    const { deps, session, timers } = setup();
    startQuizFlow(session, deps);
    goToLobby(session, deps);
    expect(timers.pending.has(quizTimerKey('ABCD'))).toBe(false);
    expect(session.quiz).toBeNull();
  });

  it('clears the question timer and the quiz when the film starts again', () => {
    const { deps, session, timers } = setup();
    startQuizFlow(session, deps);
    watchFilm(session, film.id, deps);
    expect(timers.pending.has(quizTimerKey('ABCD'))).toBe(false);
    expect(session.quiz).toBeNull();
    expect(session.playback).toMatchObject({ positionSec: 30, paused: true });
  });
});
