// The deterministic action router (docs/vnext/PLAN.md 8): every semantic input from any adapter
// (pad touch, pad voice, the touchwheel simulator) lands here. Media and device inputs never call
// a model. A TV action counts as done only when the TV confirms it with tv:applied.
import { broadcast, type FlowDeps } from './flow.js';
import type { Session } from './sessions.js';
import { LIMITS, type InputResult, type PipInput, type TvCommand } from './shared/protocol.js';

/** How long the TV has to confirm an action before it counts as failed. */
export const CONFIRM_TIMEOUT_MS = 3000;
const SEEN_INPUTS_KEPT = 200;
const MIN_BRIGHTNESS = 0.3;

export type ActionDeps = FlowDeps;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function confirmTimerKey(code: string, id: string): string {
  return `confirm:${code}:${id}`;
}

/** Applies one semantic input from a player's pad, or refuses it with a reason. */
export function handleInput(
  session: Session,
  playerId: string,
  input: PipInput,
  deps: ActionDeps,
): InputResult {
  const now = deps.now();
  const refuse = (reason: Extract<InputResult, { ok: false }>['reason']): InputResult => {
    deps.journal?.record({
      session_id: session.journalId,
      playerId,
      event_type: 'input.refused',
      content_id: session.contentId,
      source: input.source,
      data: { input: input.event.type, reason },
    });
    return { ok: false, reason };
  };
  if (now - input.at > LIMITS.inputMaxAgeMs) return refuse('stale');
  if (session.seenInputIds.includes(input.id)) return { ok: false, reason: 'duplicate' };
  session.seenInputIds = [...session.seenInputIds, input.id].slice(-SEEN_INPUTS_KEPT);
  deps.journal?.record({
    session_id: session.journalId,
    playerId,
    event_type: input.event.type,
    content_id: session.contentId,
    source: input.source,
    data: eventData(input),
  });

  const event = input.event;
  switch (event.type) {
    case 'pip.invoke':
    case 'pip.dismiss': {
      session.assistant =
        event.type === 'pip.invoke' ? { open: true, byId: playerId } : { open: false, byId: null };
      broadcast(session, deps);
      return { ok: true, action: event.type === 'pip.invoke' ? 'pip.open' : 'pip.close' };
    }
    case 'navigation.move':
    case 'navigation.confirm':
    case 'navigation.back':
      return refuse('unsupported'); // recommendations browsing comes with Phase 6
    default:
      break;
  }

  // Media, device and light controls: the host's, and only while a film is on.
  if (session.hostId !== playerId) return refuse('not-allowed');
  if (event.type === 'ambient.set') {
    // No lights bridge is connected, so the scene is simulated and confirmed at once.
    session.device = {
      ...session.device,
      ambient: event.scene,
      lastAction: { id: input.id, action: `ambient.${event.scene}`, ok: true },
    };
    deps.journal?.record({
      session_id: session.journalId,
      playerId,
      event_type: 'action.confirmed',
      content_id: session.contentId,
      source: 'lights_simulated',
      data: { action: `ambient.${event.scene}` },
    });
    broadcast(session, deps);
    return { ok: true, action: `ambient.${event.scene}` };
  }
  if (session.stage !== 'watch') return refuse('not-watching');
  if (!session.tvSocketId) return refuse('no-tv');

  let command: TvCommand;
  switch (event.type) {
    case 'media.playPause':
      command = { id: input.id, type: session.playback?.paused ? 'play' : 'pause' };
      break;
    case 'media.play':
    case 'media.pause':
      command = { id: input.id, type: event.type === 'media.play' ? 'play' : 'pause' };
      break;
    case 'media.seekRelative':
      command = {
        id: input.id,
        type: 'seek',
        deltaSec: clamp(event.seconds, -LIMITS.seekStepMaxSec, LIMITS.seekStepMaxSec),
      };
      break;
    case 'media.volumeDelta': {
      const level = round2(clamp(session.device.volume + event.delta, 0, 1));
      session.device = { ...session.device, volume: level };
      command = { id: input.id, type: 'volume', level };
      break;
    }
    case 'media.brightnessDelta': {
      const level = round2(clamp(session.device.brightness + event.delta, MIN_BRIGHTNESS, 1));
      session.device = { ...session.device, brightness: level };
      command = { id: input.id, type: 'brightness', level };
      break;
    }
  }
  sendToTv(session, command, deps, playerId);
  return { ok: true, action: describe(command) };
}

function describe(command: TvCommand): string {
  if (command.type === 'seek') return `seek ${command.deltaSec > 0 ? '+' : ''}${command.deltaSec}`;
  if (command.type === 'volume' || command.type === 'brightness') {
    return `${command.type} ${Math.round(command.level * 100)}%`;
  }
  return command.type;
}

function eventData(input: PipInput): Record<string, string | number | boolean | null> {
  const e = input.event;
  if (e.type === 'media.seekRelative') return { seconds: e.seconds };
  if (e.type === 'media.volumeDelta' || e.type === 'media.brightnessDelta')
    return { delta: e.delta };
  if (e.type === 'ambient.set') return { scene: e.scene };
  if (e.type === 'navigation.move') return { direction: e.direction };
  return {};
}

/** Sends a command to the TV and waits for its confirmation; no answer in time is a failure. */
export function sendToTv(
  session: Session,
  command: TvCommand,
  deps: ActionDeps,
  playerId: string | null,
): void {
  const action = describe(command);
  session.pendingActions = { ...session.pendingActions, [command.id]: { action, at: deps.now() } };
  session.device = { ...session.device, lastAction: { id: command.id, action, ok: null } };
  if (session.tvSocketId) deps.io.to(session.tvSocketId).emit('tv:command', command);
  deps.journal?.record({
    session_id: session.journalId,
    playerId,
    event_type: 'action.requested',
    content_id: session.contentId,
    source: 'router',
    data: { action, command_id: command.id },
    provenance: 'system',
  });
  deps.timers.set(confirmTimerKey(session.code, command.id), CONFIRM_TIMEOUT_MS, () => {
    settle(session, command.id, false, 'timeout', deps);
  });
  broadcast(session, deps);
}

/** The TV's tv:applied: marks the action done or failed. */
export function handleApplied(
  session: Session,
  result: { id: string; ok: boolean; detail?: string },
  deps: ActionDeps,
): boolean {
  if (!session.pendingActions[result.id]) return false;
  deps.timers.clear(confirmTimerKey(session.code, result.id));
  settle(session, result.id, result.ok, result.detail ?? null, deps);
  return true;
}

function settle(
  session: Session,
  id: string,
  ok: boolean,
  detail: string | null,
  deps: ActionDeps,
): void {
  const pending = session.pendingActions[id];
  if (!pending) return;
  const rest = { ...session.pendingActions };
  delete rest[id];
  session.pendingActions = rest;
  if (session.device.lastAction?.id === id) {
    session.device = { ...session.device, lastAction: { id, action: pending.action, ok } };
  }
  deps.journal?.record({
    session_id: session.journalId,
    playerId: null,
    event_type: ok ? 'action.confirmed' : 'action.failed',
    content_id: session.contentId,
    source: 'tv',
    data: { action: pending.action, command_id: id, ms: deps.now() - pending.at, detail },
    provenance: 'system',
  });
  deps.log.info(ok ? 'action.confirmed' : 'action.failed', {
    code: session.code,
    action: pending.action,
    ms: deps.now() - pending.at,
    ...(detail ? { detail } : {}),
  });
  broadcast(session, deps);
}
