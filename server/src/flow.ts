// Stage changes for film night (PROJECT.md section 4.5, Watch and the stage rules).
import type { Server } from 'socket.io';
import type { Timers } from './core/timers.js';
import type { Content } from './film/content.js';
import { quizTimerKey } from './film/quiz.js';
import type { Session } from './sessions.js';
import type { ClientToServerEvents, ServerToClientEvents } from './shared/protocol.js';
import { buildView } from './view.js';

export type PipServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** What the flow functions need; realtime.ts builds one and passes it in. */
export interface FlowDeps {
  io: PipServer;
  films: Content[];
  publicUrl: string;
  timers: Timers;
  now: () => number;
}

export function roomOf(code: string): string {
  return `s:${code}`;
}

/** Marks the session changed and sends the whole view to its TV and pads. */
export function broadcast(session: Session, deps: FlowDeps): void {
  const now = deps.now();
  session.updatedAt = now;
  deps.io
    .to(roomOf(session.code))
    .emit('session:view', buildView(session, deps.films, deps.publicUrl, now));
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
  session.stage = 'lobby';
  broadcast(session, deps);
}
