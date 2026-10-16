// The Session type and the in-memory store (PROJECT.md section 4.6, vNext fields below history).
import type { TrackedAction } from './core/actions/tracker.js';
import { createJournal, type Journal } from './core/events/journal.js';
import { createSeenIds, type SeenIds } from './core/input/dedupe.js';
import { isOnline, type Roster } from './core/players.js';
import type { HistoryItem } from './film/ask-prompt.js';
import type { QuizRun } from './film/quiz.js';
import {
  LIMITS,
  type AssistView,
  type PipState,
  type Playback,
  type Stage,
} from './shared/protocol.js';

const SEEN_IDS_MAX = 500;
const JOURNAL_MAX = 1000;

export interface Session extends Roster {
  code: string;
  tvKey: string; // 32 hex characters; a TV needs it to take this code back
  tvSocketId: string | null;
  pip: PipState;
  stage: Stage;
  contentId: string | null;
  playback: Playback | null;
  playbackAt: number; // when the last tv:playback arrived (ms)
  asking: boolean; // the ask lock: one model call at a time
  // Newest last, at most 3; atSec is where the film was. Cleared for a new film.
  history: HistoryItem[];
  quiz: QuizRun | null; // kept through the results stage
  updatedAt: number;
  assist: AssistView | null; // Pip on the TV; null keeps the film full screen
  lastAction: TrackedAction | null; // the latest playback command and its observed outcome
  seenIds: SeenIds; // event and command ids already applied (idempotency)
  journal: Journal; // what happened, without names or question text
}

export interface SessionStore {
  create(code: string, tvKey: string, tvSocketId: string, now: number): Session;
  get(code: string): Session | undefined;
  remove(code: string): void;
  sweep(now: number): string[]; // removes idle sessions (isIdle); returns their codes
}

/** True only when no TV and no player is online and nothing changed for the idle time. */
export function isIdle(session: Session, nowMs: number): boolean {
  if (session.tvSocketId !== null) return false;
  if ([...session.players.values()].some(isOnline)) return false;
  return nowMs - session.updatedAt >= LIMITS.sessionIdleMs;
}

export function createSession(
  code: string,
  tvKey: string,
  tvSocketId: string,
  now: number,
): Session {
  return {
    code,
    tvKey,
    tvSocketId,
    players: new Map(),
    hostId: null,
    pip: 'sleep',
    stage: 'lobby',
    contentId: null,
    playback: null,
    playbackAt: 0,
    asking: false,
    history: [],
    quiz: null,
    updatedAt: now,
    assist: null,
    lastAction: null,
    seenIds: createSeenIds(SEEN_IDS_MAX),
    journal: createJournal(JOURNAL_MAX),
  };
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(code: string, tvKey: string, tvSocketId: string, now: number): Session {
    const session = createSession(code, tvKey, tvSocketId, now);
    this.sessions.set(code, session);
    return session;
  }

  get(code: string): Session | undefined {
    return this.sessions.get(code);
  }

  remove(code: string): void {
    this.sessions.delete(code);
  }

  sweep(now: number): string[] {
    const removed = [...this.sessions.values()].filter((s) => isIdle(s, now)).map((s) => s.code);
    for (const code of removed) this.sessions.delete(code);
    return removed;
  }
}
