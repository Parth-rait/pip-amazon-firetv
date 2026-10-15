// Pip's state and the timer that brings Pip back to rest (PROJECT.md section 3.4).
import type { PipState } from '../shared/protocol.js';
import { isOnline, type Roster } from './players.js';
import type { Timers } from './timers.js';

/** What core functions need from the outside world, passed in so they stay testable. */
export interface CoreDeps {
  timers: Timers;
  broadcast: () => void;
  now: () => number;
}

export type PipHolder = Roster & { code: string; pip: PipState };

export function pipTimerKey(code: string): string {
  return `${code}:pip`;
}

/** Idle while someone is online, asleep otherwise. */
export function restingPip(roster: Roster): PipState {
  return [...roster.players.values()].some(isOnline) ? 'idle' : 'sleep';
}

/** Sets Pip's state and broadcasts; optionally returns Pip to rest after a while. */
export function setPip(
  holder: PipHolder,
  state: PipState,
  deps: CoreDeps,
  backToIdleAfterMs?: number,
): void {
  const key = pipTimerKey(holder.code);
  deps.timers.clear(key);
  holder.pip = state;
  deps.broadcast();
  if (backToIdleAfterMs !== undefined) {
    deps.timers.set(key, backToIdleAfterMs, () => setPip(holder, restingPip(holder), deps));
  }
}
