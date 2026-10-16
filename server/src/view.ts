// buildView(): the one snapshot every screen draws from (PROJECT.md section 7.1).
import { isOnline } from './core/players.js';
import { toContentView, unlockedQuestions, type Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import { buildResults, currentQuestion, type QuizRun } from './film/quiz.js';
import type { Session } from './sessions.js';
import { LIMITS, type QuizView, type SessionView } from './shared/protocol.js';

/** The session as clients see it. Never holds the notes, nor answers or picks before a reveal. */
export function buildView(
  session: Session,
  films: Content[],
  publicUrl: string,
  nowMs: number,
): SessionView {
  const film = films.find((f) => f.id === session.contentId) ?? null;
  const playback = session.playback;
  const quizUnlocked =
    session.stage === 'watch' && film && playback && playback.contentId === film.id
      ? unlockedQuestions(film, estimatePosition(playback, session.playbackAt, nowMs)).length
      : 0;
  const run = session.quiz;
  return {
    code: session.code,
    stage: session.stage,
    tvOnline: session.tvSocketId !== null,
    hostId: session.hostId,
    players: [...session.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      online: isOnline(p),
    })),
    content: film ? toContentView(film, publicUrl) : null,
    playback,
    quizUnlocked,
    pip: session.pip,
    pipStyle: session.pipStyle,
    companion: null, // filled in by the companion step (chapters, characters, predictions)
    quiz: session.stage === 'quiz' && run ? buildQuizView(run, nowMs) : null,
    results: session.stage === 'results' && run ? buildResults(run, session) : null,
  };
}

/** The current question. The answer, the explanation and the picks appear only in the reveal. */
export function buildQuizView(run: QuizRun, nowMs: number): QuizView | null {
  const question = currentQuestion(run);
  if (!question) return null;
  const isReveal = run.phase === 'reveal';
  const elapsedMs = nowMs - run.phaseStartedAt;
  return {
    index: run.index,
    total: run.questions.length,
    phase: run.phase,
    question: question.question,
    choices: [...question.choices],
    secondsLeft: isReveal
      ? 0
      : Math.max(0, Math.ceil((LIMITS.questionSeconds * 1000 - elapsedMs) / 1000)),
    answeredIds: [...run.answers.keys()],
    correct: isReveal ? question.answer : null,
    explanation: isReveal ? question.explanation : null,
    picks: isReveal ? Object.fromEntries(run.answers) : null,
  };
}
