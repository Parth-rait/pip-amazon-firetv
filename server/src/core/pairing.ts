// Which code a TV gets, and the host's grace period (PROJECT.md section 4.5, Join and Host).
import { LIMITS } from '../shared/protocol.js';
import { isValidCode } from './codes.js';
import type { CoreDeps } from './pip.js';
import { pickHost, type Roster } from './players.js';

// Fire just after the grace period, so it has passed by the clock when pickHost checks it.
const HOST_GRACE_MARGIN_MS = 100;

export type TvCodeChoice =
  | { kind: 'reuse'; code: string } // a live session with this code and key
  | { kind: 'restore'; code: string } // a valid code no session has (the server restarted)
  | { kind: 'new' };

/** `findKey` returns the tvKey of the live session with that code, or undefined. */
export function pickTvCode(
  hello: { previousCode: string | null; tvKey: string | null },
  findKey: (code: string) => string | undefined,
): TvCodeChoice {
  const { previousCode, tvKey } = hello;
  if (!previousCode || !isValidCode(previousCode)) return { kind: 'new' };
  const liveKey = findKey(previousCode);
  if (liveKey === undefined) return { kind: 'restore', code: previousCode };
  if (tvKey !== null && liveKey === tvKey) return { kind: 'reuse', code: previousCode };
  return { kind: 'new' };
}

export function hostTimerKey(code: string): string {
  return `${code}:host`;
}

/** After the grace period, hands the host role on if the host is still away, and broadcasts. */
export function startHostGrace(roster: Roster & { code: string }, deps: CoreDeps): void {
  deps.timers.set(hostTimerKey(roster.code), LIMITS.hostGraceMs + HOST_GRACE_MARGIN_MS, () => {
    pickHost(roster, deps.now());
    deps.broadcast();
  });
}
