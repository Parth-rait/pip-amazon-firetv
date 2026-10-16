// Stage changes and Ask Pip for film night (PROJECT.md section 4.5).
import type { Server } from 'socket.io';
import { runAsk, type AskOutcome } from './core/ai/ask.js';
import type { AnswerMemory } from './core/ai/answer-memory.js';
import type { Journal } from './core/journal.js';
import type { TextModel } from './core/ai/model.js';
import { restingPip, setPip, type CoreDeps } from './core/pip.js';
import type { Player } from './core/players.js';
import type { Timers } from './core/timers.js';
import { buildAskPrompt, sceneAt } from './film/ask-prompt.js';
import { currentPrediction } from './film/companion.js';
import type { Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import { ASK_SETTINGS } from './film/prompts.js';
import { quizTimerKey } from './film/quiz.js';
import { LINES, type PipLines } from './lines.js';
import type { log as Log } from './log.js';
import type { Session } from './sessions.js';
import {
  LIMITS,
  type AskResult,
  type AskVia,
  type ClientToServerEvents,
  type PipSay,
  type ServerToClientEvents,
} from './shared/protocol.js';
import { buildView, tvView } from './view.js';

export type PipServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** What the flow functions need; realtime.ts builds one and passes it in. */
export interface FlowDeps {
  io: PipServer;
  films: Content[];
  publicUrl: string;
  timers: Timers;
  now: () => number;
  model: TextModel;
  aiEnabled: boolean;
  simpleFormat?: boolean; // a small local model: no "Did you mean"
  memory?: AnswerMemory; // good answers by film and scene (core/ai/answer-memory.ts)
  journal?: Journal; // the append-only event journal (core/journal.ts)
  logText: boolean; // LOG_TEXT: question text in logs, development only
  log: typeof Log;
}

const TALKING_MS = 8000;
const CHEER_MS = 1500;
const REVEAL_TALK_MS = 4000;
const MAX_HISTORY = 3;

export function roomOf(code: string): string {
  return `s:${code}`;
}

/** Marks the session changed and sends the whole view to its TV and pads. */
export function broadcast(session: Session, deps: FlowDeps): void {
  const now = deps.now();
  session.updatedAt = now;
  const view = buildView(session, deps.films, deps.publicUrl, now);
  const room = deps.io.to(roomOf(session.code));
  if (!session.tvSocketId) {
    room.emit('session:view', view);
    return;
  }
  // The TV gets a slim view: on Vega its WebSocket dropped every few seconds once the view
  // carried the chapters and character cards (about 5 KB), which only the pads show.
  room.except(session.tvSocketId).emit('session:view', view);
  deps.io.to(session.tvSocketId).emit('session:view', tvView(view));
}

function dropQuiz(session: Session, deps: FlowDeps): void {
  deps.timers.clear(quizTimerKey(session.code));
  session.quiz = null;
}

/** Goes to watch with a film. A new film clears playback and history; an ended one restarts. */
export function watchFilm(session: Session, contentId: string, deps: FlowDeps): boolean {
  if (!deps.films.some((f) => f.id === contentId)) return false;
  dropQuiz(session, deps);
  if (session.contentId !== contentId) {
    session.playback = null;
    session.history = [];
    session.predictionVotes = {};
    session.revealedPredictions = [];
    session.reactions = {};
  } else if (session.playback?.ended) {
    session.playback = null;
  }
  session.contentId = contentId;
  session.stage = 'watch';
  session.assistant = { open: false, byId: null }; // Pip starts hidden with every film
  broadcast(session, deps);
  return true;
}

/** Where the film is now, or null when nothing of this session's film is playing. */
export function positionNow(
  session: Session,
  deps: FlowDeps,
): { film: Content; positionSec: number } | null {
  const film = deps.films.find((f) => f.id === session.contentId);
  if (!film || !session.playback || session.playback.contentId !== film.id) return null;
  return { film, positionSec: estimatePosition(session.playback, session.playbackAt, deps.now()) };
}

/**
 * When a "What happens next?" vote has just been revealed, Pip reacts once: a cheer when at
 * least half of the votes were right, talking otherwise (the quiz's rule).
 */
export function checkPredictionReveal(session: Session, deps: FlowDeps): void {
  const now = positionNow(session, deps);
  if (!now || session.stage !== 'watch' || session.asking) return;
  const current = currentPrediction(now.film, now.positionSec);
  if (current?.status !== 'revealed') return;
  const { id, answer } = current.prediction;
  if (session.revealedPredictions.includes(id)) return;
  session.revealedPredictions = [...session.revealedPredictions, id];
  const picks = Object.values(session.predictionVotes[id] ?? {});
  if (picks.length === 0) return;
  const isMostlyRight = picks.filter((p) => p === answer).length * 2 >= picks.length;
  setPip(
    session,
    isMostlyRight ? 'cheer' : 'talking',
    coreDeps(session, deps),
    isMostlyRight ? CHEER_MS : REVEAL_TALK_MS,
  );
}

/** Back to the lobby; a quiz in progress and its timer are dropped. */
export function goToLobby(session: Session, deps: FlowDeps): void {
  dropQuiz(session, deps);
  session.stage = 'lobby';
  session.assistant = { open: false, byId: null };
  broadcast(session, deps);
}

/** Pip Core's dependencies for one session: its broadcast, the shared timers and the clock. */
export function coreDeps(session: Session, deps: FlowDeps): CoreDeps {
  return { timers: deps.timers, broadcast: () => broadcast(session, deps), now: deps.now };
}

/**
 * Checks an ask (not-watching, busy, too-soon) and, when it is ok, starts it: the ask lock,
 * Pip thinking, one model call, then pip:say. `done` settles when Pip has answered; it never rejects.
 */
export function askPip(
  session: Session,
  player: Player,
  text: string,
  via: AskVia,
  deps: FlowDeps,
): { result: AskResult; done: Promise<void> } {
  const now = deps.now();
  const film = deps.films.find((f) => f.id === session.contentId);
  const refuse = (reason: Extract<AskResult, { ok: false }>['reason']) => ({
    result: { ok: false, reason } as const,
    done: Promise.resolve(),
  });
  if (session.stage !== 'watch' || !film) return refuse('not-watching');
  if (session.asking) return refuse('busy');
  if (now - player.lastAskAt < LIMITS.askMinIntervalMs) return refuse('too-soon');

  player.lastAskAt = now;
  session.asking = true;
  setPip(session, 'thinking', coreDeps(session, deps));
  return { result: { ok: true }, done: answer(session, film, player, text, via, deps) };
}

async function answer(
  session: Session,
  film: Content,
  player: Player,
  text: string,
  via: AskVia,
  deps: FlowDeps,
): Promise<void> {
  const startedAt = deps.now();
  const positionSec = session.playback
    ? estimatePosition(session.playback, session.playbackAt, startedAt)
    : 0;
  const contentId = film.id;
  deps.log.info('ask.start', {
    code: session.code,
    playerId: player.id,
    via,
    ...(deps.logText ? { question: text } : {}),
  });
  const recallQuery = {
    contentId,
    sceneSec: sceneAt(film.notes, positionSec),
    question: text,
  };
  // The same question at the same scene was answered before: answer at once.
  const repeat = deps.memory?.recallExact(recallQuery) ?? null;
  let outcome: AskOutcome;
  let fromMemory = repeat !== null;
  try {
    outcome = repeat
      ? { reply: { kind: 'answer', text: repeat.answer, next: repeat.next } }
      : deps.aiEnabled
        ? await runAsk(
            deps.model,
            buildAskPrompt({
              ...film,
              positionSec,
              history: session.history,
              question: text,
              via,
              simpleFormat: deps.simpleFormat,
            }),
            text,
            { ...ASK_SETTINGS, allowClarify: !deps.simpleFormat && via !== 'clarify' },
          )
        : { reply: null, error: 'offline' };
  } finally {
    session.asking = false;
  }
  if (outcome.reply === null) {
    // The model failed or is off: the closest answer from a scene already watched, if any.
    const similar = deps.memory?.recallSimilar(recallQuery);
    if (similar) {
      outcome = { reply: { kind: 'answer', text: similar.answer, next: similar.next } };
      fromMemory = true;
    }
  } else if (outcome.reply.kind === 'answer' && !fromMemory) {
    deps.memory?.remember({ ...recallQuery, answer: outcome.reply.text, next: outcome.reply.next });
  }
  if (session.stage !== 'watch' || session.contentId !== contentId) {
    deps.log.info('ask.dropped', { code: session.code, playerId: player.id });
    setPip(session, restingPip(session), coreDeps(session, deps));
    return;
  }
  const say = toPipSay(outcome, player, text, LINES);
  if (outcome.reply?.kind === 'answer') {
    session.history = [
      ...session.history,
      { atSec: positionSec, question: text, answer: outcome.reply.text },
    ].slice(-MAX_HISTORY);
  }
  deps.log.info('ask.done', {
    code: session.code,
    playerId: player.id,
    ms: deps.now() - startedAt,
    kind: fromMemory ? 'memory' : (outcome.reply?.kind ?? 'fallback'),
    source: say.source,
    ...(outcome.reply ? {} : { error: outcome.error }),
  });
  deps.io.to(roomOf(session.code)).emit('pip:say', say);
  setPip(session, 'talking', coreDeps(session, deps), TALKING_MS);
}

function toPipSay(outcome: AskOutcome, player: Player, question: string, lines: PipLines): PipSay {
  const base = { askedBy: player.id, askedByName: player.name, question, next: [], clarify: [] };
  const reply = outcome.reply;
  if (reply?.kind === 'answer')
    return { ...base, text: reply.text, next: reply.next, source: 'ai' };
  if (reply?.kind === 'clarify') {
    return { ...base, text: lines.didYouMean, clarify: reply.options, source: 'ai' };
  }
  const error = outcome.reply === null ? outcome.error : '';
  const text =
    error === 'offline' ? lines.offline : error === 'unparsed' ? lines.unparsed : lines.modelFailed;
  return { ...base, text, source: 'template' };
}
