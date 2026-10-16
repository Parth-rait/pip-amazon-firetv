// Playback commands from any source (host buttons, typed commands, remote keys, the pad's button
// and wheel) go through one path: dedupe, track, send, then confirm from the TV's own report.
import { randomBytes } from 'node:crypto';
import {
  expireAction,
  observeReport,
  trackAction,
  type PlayerState,
} from './core/actions/tracker.js';
import { toIntent } from './core/input/adapters.js';
import type { PlaybackIntent } from './core/intent/route-text.js';
import { dismissAssist } from './assist-flow.js';
import { actionTimerKey, broadcast, positionOf, type FlowDeps } from './flow.js';
import type { Session } from './sessions.js';
import { LIMITS, type InputEnvelope, type InputResult } from './shared/protocol.js';

const FRESH_REPORT_MS = 10_000;

export type SendResult =
  { ok: true; commandId: string } | { ok: false; reason: 'duplicate' | 'no-tv' | 'not-watching' };

function newCommandId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

function playerState(session: Session, nowMs: number): PlayerState | null {
  const playback = session.playback;
  if (!playback || playback.contentId !== session.contentId) return null;
  return {
    positionSec: positionOf(session, nowMs),
    durationSec: playback.durationSec,
    paused: playback.paused,
  };
}

/**
 * Sends one playback command to the TV and tracks it. A repeated commandId is ignored. Play or
 * pause on a player already in that state, by a fresh report, counts as done at once.
 */
export function sendPlayback(
  session: Session,
  intent: PlaybackIntent,
  by: string,
  commandId: string | null,
  deps: FlowDeps,
): SendResult {
  if (session.stage !== 'watch') return { ok: false, reason: 'not-watching' };
  if (!session.tvSocketId) return { ok: false, reason: 'no-tv' };
  const id = commandId ?? newCommandId();
  if (!session.seenIds.firstTime(`cmd:${id}`)) return { ok: false, reason: 'duplicate' };
  const now = deps.now();
  const estimate = playerState(session, now);
  const action = trackAction({ commandId: id, command: intent, by, estimate, now });
  const isFresh = estimate !== null && now - session.playbackAt <= FRESH_REPORT_MS;
  if (isFresh && intent.type !== 'seek' && estimate.paused === action.expected.paused) {
    action.status = 'done';
  }
  session.lastAction = action;
  deps.io.to(session.tvSocketId).emit('tv:command', { ...intent, commandId: id });
  deps.timers.clear(actionTimerKey(session.code));
  if (action.status === 'sent') {
    deps.timers.set(actionTimerKey(session.code), LIMITS.actionConfirmMs, () => {
      if (session.lastAction?.commandId !== id || !expireAction(session.lastAction)) return;
      session.journal.append({
        at: deps.now(),
        type: 'action.unconfirmed',
        source: 'server',
        actor: by,
        data: { commandId: id, kind: intent.type },
      });
      deps.log.warn('action.unconfirmed', { code: session.code, commandId: id, kind: intent.type });
      broadcast(session, deps);
    });
  }
  session.journal.append({
    at: now,
    type: 'action.sent',
    source: 'server',
    actor: by,
    data: { commandId: id, kind: intent.type, status: action.status },
  });
  broadcast(session, deps);
  return { ok: true, commandId: id };
}

/** After a TV playback report: a matching report turns the latest command into "done". */
export function observePlayback(session: Session, deps: FlowDeps): void {
  const playback = session.playback;
  if (!playback) return;
  const report = {
    positionSec: playback.positionSec,
    durationSec: playback.durationSec,
    paused: playback.paused,
  };
  if (!observeReport(session.lastAction, report, session.playbackAt)) return;
  deps.timers.clear(actionTimerKey(session.code));
  const action = session.lastAction;
  session.journal.append({
    at: deps.now(),
    type: 'action.done',
    source: 'tv',
    actor: action?.by ?? null,
    data: { commandId: action?.commandId ?? null, ms: action ? deps.now() - action.sentAt : null },
  });
}

/**
 * One device input, from a pad (button, wheel, simulator) or the TV's remote. The adapters decide
 * what it means; pads may change playback only when they belong to the host.
 */
export function applyInput(
  session: Session,
  envelope: InputEnvelope,
  actor: { kind: 'pad'; playerId: string } | { kind: 'tv' },
  deps: FlowDeps,
): InputResult {
  if (!session.seenIds.firstTime(`evt:${envelope.eventId}`))
    return { ok: false, reason: 'duplicate' };
  const watching = session.stage === 'watch' && session.playback?.contentId === session.contentId;
  const intent = toIntent(envelope.input, {
    paused: watching ? (session.playback?.paused ?? null) : null,
  });
  const by = actor.kind === 'pad' ? actor.playerId : 'remote';
  session.journal.append({
    at: deps.now(),
    type: 'input.received',
    source: envelope.source,
    actor: actor.kind === 'pad' ? actor.playerId : null,
    data: { eventId: envelope.eventId, input: envelope.input.kind, intent: intent.type },
  });
  if (intent.type === 'none') return { ok: true, intent: 'none', commandId: null };
  if (intent.type === 'invoke') {
    return actor.kind === 'pad'
      ? { ok: true, intent: 'invoke', commandId: null }
      : { ok: true, intent: 'none', commandId: null };
  }
  if (intent.type === 'dismiss') {
    dismissAssist(session, deps);
    return { ok: true, intent: 'dismiss', commandId: null };
  }
  if (session.stage !== 'watch') return { ok: false, reason: 'not-watching' };
  if (actor.kind === 'pad' && session.hostId !== actor.playerId)
    return { ok: false, reason: 'not-allowed' };
  const sent = sendPlayback(
    session,
    intent,
    by,
    `in-${envelope.eventId}`.slice(0, LIMITS.eventIdMaxChars),
    deps,
  );
  if (!sent.ok)
    return { ok: false, reason: sent.reason === 'duplicate' ? 'duplicate' : 'not-watching' };
  return { ok: true, intent: intent.type, commandId: sent.commandId };
}
