// The hand-gesture adapter (docs/extractions/gesture-control.md): the vendored gesture-tv-remote
// pipeline in gesture/ tracks hands with MediaPipe and ends each gesture in a TV remote command;
// the bridge prints those commands as JSON lines, and this turns each one into the same semantic
// input the pad sends. The brain never sees a landmark. Pure, so the script and the tests share it.
import { z } from 'zod';
import type { PipInputEvent } from '../shared/protocol.js';

/** What upstream's GESTURE_TO_COMMAND can produce (gesture/vendor/.../domain/commands). */
export const GESTURE_COMMANDS = [
  'DPAD_CENTER',
  'DPAD_LEFT',
  'DPAD_RIGHT',
  'DPAD_UP',
  'DPAD_DOWN',
  'VOLUME_UP',
  'VOLUME_DOWN',
  'HOME',
  'BACK',
] as const;
export type GestureCommand = (typeof GESTURE_COMMANDS)[number];

export interface GestureConfig {
  seekSec: number; // seconds per point left or right
  volumeStep: number; // volume per pinch up or down, like one tap on the pad
}

export const DEFAULT_GESTURE: GestureConfig = { seekSec: 10, volumeStep: 0.1 };

/**
 * One meaning per gesture, whatever is on screen (docs/vnext/PLAN.md 4.3): no mode switches.
 * Every target is a reversible playback or assistant action; none needs a confirmation step.
 */
export function gestureEvent(
  command: GestureCommand,
  config: GestureConfig = DEFAULT_GESTURE,
): PipInputEvent {
  switch (command) {
    case 'DPAD_CENTER': // open palm, fist, open palm
      return { type: 'media.playPause' };
    case 'DPAD_LEFT': // point and move left
      return { type: 'media.seekRelative', seconds: -config.seekSec };
    case 'DPAD_RIGHT':
      return { type: 'media.seekRelative', seconds: config.seekSec };
    case 'DPAD_UP': // point and move up or down: for browsing (Phase 6); refused until then
      return { type: 'navigation.move', direction: 'previous' };
    case 'DPAD_DOWN':
      return { type: 'navigation.move', direction: 'next' };
    case 'VOLUME_UP': // pinch and move up or down
      return { type: 'media.volumeDelta', delta: config.volumeStep };
    case 'VOLUME_DOWN':
      return { type: 'media.volumeDelta', delta: -config.volumeStep };
    case 'HOME': // hold a fist: the deliberate way in
      return { type: 'pip.invoke' };
    case 'BACK': // two fingers, then an open palm: the fast way out
      return { type: 'pip.dismiss' };
  }
}

/** Commands upstream repeats while a pointing hand is held off-centre (a joystick, about 3 a second). */
const HELD_COMMANDS: ReadonlySet<GestureCommand> = new Set([
  'DPAD_LEFT',
  'DPAD_RIGHT',
  'DPAD_UP',
  'DPAD_DOWN',
]);
/** Upstream repeats a held point every debounce (0.3 s); a new point comes well after this. */
export const HELD_REPEAT_GAP_MS = 600;

/**
 * Keeps one command per point: upstream's joystick repeats a held point about 3 times a second,
 * which for a 10 s seek scrubs 30 s a second. Repeats of the same command closer together than
 * gapMs are dropped, and each one restarts the gap, so a held point sends once. Volume is left to
 * repeat: holding a pinch is how you turn it further.
 */
export function createRepeatFilter(
  gapMs = HELD_REPEAT_GAP_MS,
): (command: GestureCommand, at: number) => boolean {
  let last: { command: GestureCommand; at: number } | null = null;
  return (command, at) => {
    const held = HELD_COMMANDS.has(command) && last?.command === command && at - last.at < gapMs;
    last = { command, at };
    return !held;
  };
}

const lineSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), mode: z.enum(['camera', 'replay']) }),
  z.object({ type: z.literal('command'), command: z.string().max(32), at: z.number().finite() }),
  z.object({ type: z.literal('done') }),
]);

export type BridgeLine =
  | { type: 'ready'; mode: 'camera' | 'replay' }
  | { type: 'command'; command: GestureCommand; at: number }
  | { type: 'done' };

/** One stdout line from the bridge; null for anything else (blank, log noise, unknown commands). */
export function parseBridgeLine(line: string): BridgeLine | null {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = lineSchema.safeParse(json);
  if (!parsed.success) return null;
  const message = parsed.data;
  if (message.type !== 'command') return message;
  return (GESTURE_COMMANDS as readonly string[]).includes(message.command)
    ? { ...message, command: message.command as GestureCommand }
    : null;
}
