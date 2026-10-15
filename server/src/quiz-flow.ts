// Quiz stage changes: start, answers, the reveal, next and the results (PROJECT.md 4.5, Quiz).
// Kept apart from flow.ts so each file stays short; the rules themselves live in film/quiz.ts.
import { setPip } from './core/pip.js';
import { unlockedQuestions } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import {
  everyoneAnswered,
  nextQuestion,
  quizTimerKey,
  recordAnswer,
  revealQuestion,
  startQuiz,
} from './film/quiz.js';
import { broadcast, coreDeps, type FlowDeps } from './flow.js';
import type { Session } from './sessions.js';
import { LIMITS } from './shared/protocol.js';

const CHEER_MS = 1500;
const REVEAL_TALK_MS = 4000;

function startQuestionTimer(session: Session, deps: FlowDeps): void {
  deps.timers.set(quizTimerKey(session.code), LIMITS.questionSeconds * 1000, () =>
    revealNow(session, deps),
  );
}

/**
 * Starts the quiz with the questions about scenes already watched, and keeps where the film was
 * as a paused resume point. Returns false when no question is unlocked yet.
 */
export function startQuizFlow(session: Session, deps: FlowDeps): boolean {
  const film = deps.films.find((f) => f.id === session.contentId);
  if (session.stage !== 'watch' || !film) return false;
  const now = deps.now();
  const playback = session.playback?.contentId === film.id ? session.playback : null;
  const position = playback ? estimatePosition(playback, session.playbackAt, now) : 0;
  const questions = unlockedQuestions(film, position);
  if (questions.length === 0) return false;
  if (playback && !playback.ended) {
    session.playback = { ...playback, positionSec: position, paused: true };
    session.playbackAt = now;
  }
  session.quiz = startQuiz(session, questions, now);
  session.stage = 'quiz';
  startQuestionTimer(session, deps);
  broadcast(session, deps);
  return true;
}

/** A player's tap. The reveal comes as soon as every online player has answered. */
export function answerQuestion(
  session: Session,
  answer: { playerId: string; index: number; choice: number },
  deps: FlowDeps,
): boolean {
  const run = session.quiz;
  if (session.stage !== 'quiz' || !run || !recordAnswer(run, session, answer)) return false;
  if (everyoneAnswered(run, session)) revealNow(session, deps);
  else broadcast(session, deps);
  return true;
}

/** After a player leaves: the ones still here may all have answered already. */
export function checkEveryoneAnswered(session: Session, deps: FlowDeps): void {
  const run = session.quiz;
  if (session.stage === 'quiz' && run?.phase === 'question' && everyoneAnswered(run, session)) {
    revealNow(session, deps);
  }
}

/** Shows the right answer and scores it. Pip cheers when at least half the answers were right. */
export function revealNow(session: Session, deps: FlowDeps): void {
  const run = session.quiz;
  if (session.stage !== 'quiz' || !run || run.phase !== 'question') return;
  deps.timers.clear(quizTimerKey(session.code));
  const { right, answered } = revealQuestion(run, session, deps.now());
  const isCheer = answered > 0 && right * 2 >= answered;
  setPip(
    session,
    isCheer ? 'cheer' : 'talking',
    coreDeps(session, deps),
    isCheer ? CHEER_MS : REVEAL_TALK_MS,
  );
}

/**
 * The host's next, applied only when its index and phase match the screen, so a double tap
 * cannot skip a question: a question goes to its reveal, a reveal to the next question or the results.
 */
export function nextStep(
  session: Session,
  seen: { index: number; phase: 'question' | 'reveal' },
  deps: FlowDeps,
): boolean {
  const run = session.quiz;
  if (session.stage !== 'quiz' || !run) return false;
  if (seen.index !== run.index || seen.phase !== run.phase) return false;
  if (run.phase === 'question') {
    revealNow(session, deps);
    return true;
  }
  if (nextQuestion(run, deps.now())) {
    startQuestionTimer(session, deps);
    broadcast(session, deps);
    return true;
  }
  session.stage = 'results';
  setPip(session, 'cheer', coreDeps(session, deps), CHEER_MS);
  return true;
}
