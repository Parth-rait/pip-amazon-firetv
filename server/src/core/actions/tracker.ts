// Playback commands and their outcomes. Sending a command is not success: a command is "done"
// only when the device's own report shows its effect, and "unconfirmed" if that never comes.
import type { ActionStatus } from '../../shared/protocol.js';

export interface PlayerState {
  positionSec: number;
  durationSec: number;
  paused: boolean;
}

export interface TrackedAction {
  commandId: string;
  type: 'play' | 'pause' | 'seek';
  deltaSec: number | null;
  by: string;
  sentAt: number;
  expected: { paused?: boolean; positionSec?: number };
  status: ActionStatus;
}

const SEEK_TOLERANCE_SEC = 2.5;

/** What the player should look like once the command has worked, from the best current estimate. */
export function expectedOutcome(
  command: { type: 'play' | 'pause' | 'seek'; deltaSec?: number },
  estimate: PlayerState,
): TrackedAction['expected'] {
  if (command.type === 'play') return { paused: false };
  if (command.type === 'pause') return { paused: true };
  const target = estimate.positionSec + (command.deltaSec ?? 0);
  return { positionSec: Math.min(Math.max(target, 0), estimate.durationSec) };
}

/**
 * True when a playback report shows the expected effect. A seek allows for the time that passed
 * while playing, since the report comes a moment after the jump.
 */
export function showsOutcome(
  action: TrackedAction,
  report: PlayerState,
  reportAt: number,
): boolean {
  const { paused, positionSec } = action.expected;
  if (paused !== undefined && report.paused !== paused) return false;
  if (positionSec !== undefined) {
    const drift = report.paused ? 0 : Math.max(0, reportAt - action.sentAt) / 1000;
    if (Math.abs(report.positionSec - positionSec) > SEEK_TOLERANCE_SEC + drift) return false;
  }
  return true;
}

/** Creates the record for a command that is about to be sent. */
export function trackAction(input: {
  commandId: string;
  command: { type: 'play' | 'pause' | 'seek'; deltaSec?: number };
  by: string;
  estimate: PlayerState | null;
  now: number;
}): TrackedAction {
  const estimate = input.estimate ?? {
    positionSec: 0,
    durationSec: Number.MAX_SAFE_INTEGER,
    paused: true,
  };
  return {
    commandId: input.commandId,
    type: input.command.type,
    deltaSec: input.command.type === 'seek' ? (input.command.deltaSec ?? 0) : null,
    by: input.by,
    sentAt: input.now,
    expected: expectedOutcome(input.command, estimate),
    status: 'sent',
  };
}

/** Applies a playback report. Returns true when it changed the action's status to done. */
export function observeReport(
  action: TrackedAction | null,
  report: PlayerState,
  reportAt: number,
): boolean {
  if (!action || action.status !== 'sent') return false;
  if (!showsOutcome(action, report, reportAt)) return false;
  action.status = 'done';
  return true;
}

/** After the confirmation window: a command still only "sent" becomes "unconfirmed". */
export function expireAction(action: TrackedAction | null): boolean {
  if (!action || action.status !== 'sent') return false;
  action.status = 'unconfirmed';
  return true;
}
