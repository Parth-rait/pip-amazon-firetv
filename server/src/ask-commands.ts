// Text sent to Ask Pip that is really a command ("pause", "back 30", "never mind", "stop"): it takes
// the deterministic path (actions.ts), never a model. The pad sends most commands as inputs
// already (pad/src/lib/commands.ts); this catches typed ones and the command choices Pip offers.
// The short reply goes only to the asker's pads, so the TV stays quiet.
import { randomUUID } from 'node:crypto';
import { handleInput } from './actions.js';
import type { Player } from './core/players.js';
import { routeText, type PlaybackIntent } from './core/intent/route-text.js';
import type { FlowDeps } from './flow.js';
import { LINES } from './lines.js';
import type { Session } from './sessions.js';
import {
  LIMITS,
  type AskResult,
  type InputResult,
  type PipInputEvent,
  type PipSay,
} from './shared/protocol.js';

function eventOf(intent: PlaybackIntent): PipInputEvent {
  if (intent.type === 'play') return { type: 'media.play' };
  if (intent.type === 'pause') return { type: 'media.pause' };
  return { type: 'media.seekRelative', seconds: intent.deltaSec };
}

function actionLine(intent: PlaybackIntent): string {
  if (intent.type === 'play') return LINES.play;
  if (intent.type === 'pause') return LINES.pause;
  const sec = Math.min(Math.abs(intent.deltaSec), LIMITS.seekStepMaxSec);
  return intent.deltaSec < 0 ? LINES.seekBack(sec) : LINES.seekForward(sec);
}

function sayTo(
  session: Session,
  player: Player,
  question: string,
  reply: Pick<PipSay, 'text'> & Partial<Pick<PipSay, 'clarify'>>,
  deps: FlowDeps,
): void {
  const say: PipSay = {
    askedBy: player.id,
    askedByName: player.name,
    question,
    next: [],
    clarify: [],
    source: 'template',
    ...reply,
  };
  for (const socketId of player.socketIds) deps.io.to(socketId).emit('pip:say', say);
}

function refusalLine(session: Session, result: InputResult): string {
  if (result.ok) return '';
  if (result.reason !== 'not-allowed') return LINES.cantNow;
  const host = session.hostId ? session.players.get(session.hostId)?.name : undefined;
  return LINES.onlyHost(host ?? 'The host');
}

/**
 * Runs the text as a command when the rules say it is one; null when it is a question for Pip.
 * `done` sends the reply after the ack, so the pad knows its ask was taken before the reply comes.
 */
export function askCommand(
  session: Session,
  player: Player,
  text: string,
  deps: FlowDeps,
): { result: AskResult; done: Promise<void> } | null {
  const route = routeText(text);
  if (route.kind === 'question') return null;
  if (session.stage !== 'watch') {
    return { result: { ok: false, reason: 'not-watching' }, done: Promise.resolve() };
  }
  const reply = (fields: Pick<PipSay, 'text'> & Partial<Pick<PipSay, 'clarify'>>) => ({
    result: { ok: true } as const,
    done: Promise.resolve().then(() => sayTo(session, player, text, fields, deps)),
  });
  if (route.kind === 'ambiguous-command') {
    return reply({ text: LINES.whatToStop, clarify: route.options });
  }
  const event: PipInputEvent =
    route.kind === 'dismiss' ? { type: 'pip.dismiss' } : eventOf(route.intent);
  const input = { id: `ask-${randomUUID()}`, source: 'pad_touch' as const, at: deps.now(), event };
  const result = handleInput(session, player.id, input, deps);
  deps.log.info('ask.command', {
    code: session.code,
    playerId: player.id,
    action: event.type,
    ok: result.ok,
    ...(result.ok ? {} : { reason: result.reason }),
  });
  if (!result.ok) return reply({ text: refusalLine(session, result) });
  return reply({ text: route.kind === 'dismiss' ? LINES.dismissed : actionLine(route.intent) });
}
