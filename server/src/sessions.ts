// The Session type and the in-memory store (PROJECT.md section 4.6).
import { randomBytes } from 'node:crypto';
import { isOnline, type Roster } from './core/players.js';
import type { BranchState } from './branch.js';
import type { PredictionVotes } from './film/companion.js';
import type { QuizRun } from './film/quiz.js';
import {
  LIMITS,
  type PipState,
  type AmbientScene,
  type Playback,
  type Stage,
} from './shared/protocol.js';

export interface Session extends Roster, BranchState {
  code: string;
  tvKey: string; // 32 hex characters; a TV needs it to take this code back
  tvSocketId: string | null;
  pip: PipState;
  journalId: string; // pseudonymous session id for the event journal, never the pairing code
  kidsMode: boolean; // the host's opt-in for the quiz, guesses and reactions
  assistant: { open: boolean; byId: string | null };
  device: {
    volume: number;
    brightness: number;
    ambient: AmbientScene;
    lastAction: { id: string; action: string; ok: boolean | null } | null;
  };
  seenInputIds: string[]; // recent input ids, newest last, so a resent input is not applied twice
  pendingActions: Record<string, { action: string; at: number }>; // tv commands awaiting tv:applied
  stage: Stage;
  contentId: string | null;
  playback: Playback | null;
  playbackAt: number; // when the last tv:playback arrived (ms)
  asking: boolean; // the ask lock: one model call at a time
  // Newest last, at most 3; atSec is where the film was. Cleared for a new film.
  history: { atSec: number; question: string; answer: string }[];
  quiz: QuizRun | null; // kept through the results stage
  // The companion (PROJECT.md 2.4), for the current film; cleared for a new film.
  predictionVotes: PredictionVotes;
  revealedPredictions: string[]; // reveals Pip has already reacted to
  reactions: Record<string, number>; // scene atSec -> reactions there
  // Where each viewer stopped watching (pad hidden or offline), for "While you were away".
  away: Record<string, { contentId: string; atSec: number }>;
  updatedAt: number;
}

export interface SessionStore {
  create(code: string, tvKey: string, tvSocketId: string, now: number): Session;
  get(code: string): Session | undefined;
  remove(code: string): void;
  all(): Session[]; // every live session, for the Command Center
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
    journalId: `ses_${randomBytes(8).toString('hex')}`,
    kidsMode: false,
    assistant: { open: false, byId: null },
    device: { volume: 1, brightness: 1, ambient: 'off', lastAction: null },
    seenInputIds: [],
    pendingActions: {},
    stage: 'lobby',
    contentId: null,
    playback: null,
    playbackAt: 0,
    asking: false,
    history: [],
    quiz: null,
    predictionVotes: {},
    revealedPredictions: [],
    reactions: {},
    away: {},
    branches: [],
    activeBranch: {},
    branchSeq: 0,
    updatedAt: now,
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

  all(): Session[] {
    return [...this.sessions.values()];
  }

  sweep(now: number): string[] {
    const removed = [...this.sessions.values()].filter((s) => isIdle(s, now)).map((s) => s.code);
    for (const code of removed) this.sessions.delete(code);
    return removed;
  }
}
