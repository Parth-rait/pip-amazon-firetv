// Stage changes for film night (PROJECT.md section 4.5, Watch and the stage rules), and the shared
// dependencies of the vNext flows (assist-flow.ts, playback-flow.ts).
import type { Server } from 'socket.io';
import type { Timeline } from './core/context/timeline.js';
import type { IntentJudge } from './core/intent/judge.js';
import type { CoreDeps } from './core/pip.js';
import type { Timers } from './core/timers.js';
import type { AnswerDeps } from './answer.js';
import type { Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import { quizTimerKey } from './film/quiz.js';
import type { log as Log } from './log.js';
import type { Session } from './sessions.js';
import type {
  ClientToServerEvents,
  FeaturesView,
  ServerToClientEvents,
} from './shared/protocol.js';
import { buildView } from './view.js';

export type PipServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** What the flow functions need; realtime.ts builds one and passes it in. */
export interface FlowDeps {
  io: PipServer;
  films: Content[];
  publicUrl: string;
  timers: Timers;
  now: () => number;
  timelines: Map<string, Timeline>;
  answer: AnswerDeps;
  features: FeaturesView;
  judge: IntentJudge; // noJudge unless INTENT_JUDGE=typesafe works
  log: typeof Log;
}

export function roomOf(code: string): string {
  return `s:${code}`;
}

export function assistTimerKey(code: string): string {
  return `${code}:assist`;
}

export function actionTimerKey(code: string): string {
  return `${code}:action`;
}

/** Marks the session changed and sends the whole view to its TV and pads. */
export function broadcast(session: Session, deps: FlowDeps): void {
  const now = deps.now();
  session.updatedAt = now;
  deps.io
    .to(roomOf(session.code))
    .emit('session:view', buildView(session, deps.films, deps.publicUrl, now, deps.features));
}

/** The core dependencies for Pip's state timers on this session. */
export function coreOf(session: Session, deps: FlowDeps): CoreDeps {
  return { timers: deps.timers, broadcast: () => broadcast(session, deps), now: deps.now };
}

/** Where the chosen film is now, by the TV's last report; 0 before any report. */
export function positionOf(session: Session, nowMs: number): number {
  const playback = session.playback;
  if (!playback || playback.contentId !== session.contentId) return 0;
  return estimatePosition(playback, session.playbackAt, nowMs);
}

function dropQuiz(session: Session, deps: FlowDeps): void {
  deps.timers.clear(quizTimerKey(session.code));
  session.quiz = null;
}

/** Leaving watch hides Pip and forgets the last command; their timers go too. */
function leaveWatch(session: Session, deps: FlowDeps): void {
  deps.timers.clear(assistTimerKey(session.code));
  deps.timers.clear(actionTimerKey(session.code));
  session.assist = null;
  session.lastAction = null;
}

/** Goes to watch with a film. A new film clears playback and history; an ended one restarts. */
export function watchFilm(session: Session, contentId: string, deps: FlowDeps): boolean {
  if (!deps.films.some((f) => f.id === contentId)) return false;
  dropQuiz(session, deps);
  leaveWatch(session, deps);
  if (session.contentId !== contentId) {
    session.playback = null;
    session.history = [];
  } else if (session.playback?.ended) {
    session.playback = null;
  }
  session.contentId = contentId;
  session.stage = 'watch';
  broadcast(session, deps);
  return true;
}

/** Back to the lobby; a quiz in progress and its timer are dropped. */
export function goToLobby(session: Session, deps: FlowDeps): void {
  dropQuiz(session, deps);
  leaveWatch(session, deps);
  session.stage = 'lobby';
  broadcast(session, deps);
}
