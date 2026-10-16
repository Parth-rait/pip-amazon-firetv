// Input adapters: every device input (remote key, capacitive button, touchwheel) becomes one of a
// few semantic intents. Devices never decide what an input means; this module does, in one place.
import { LIMITS, type RawInput } from '../../shared/protocol.js';

export type SemanticIntent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; deltaSec: number }
  | { type: 'invoke' } // open the Ask panel on the pad that pressed
  | { type: 'dismiss' } // hide Pip on the TV
  | { type: 'none' }; // a valid input that means nothing right now

/** The little the adapters need to know about the moment. */
export interface InputContext {
  paused: boolean | null; // null when nothing is playing
}

function toggle(context: InputContext): SemanticIntent {
  if (context.paused === null) return { type: 'none' };
  return context.paused ? { type: 'play' } : { type: 'pause' };
}

function clampSeek(deltaSec: number): number {
  return Math.min(Math.max(Math.round(deltaSec), -LIMITS.seekMaxAbsSec), LIMITS.seekMaxAbsSec);
}

/**
 * The intent of one raw input. A toggle becomes an absolute play or pause from the current state,
 * so a repeated event (same eventId, dropped upstream) can never flip it back.
 */
export function toIntent(input: RawInput, context: InputContext): SemanticIntent {
  switch (input.kind) {
    case 'key':
      switch (input.key) {
        case 'play-pause':
          return toggle(context);
        case 'play':
          return { type: 'play' };
        case 'pause':
          return { type: 'pause' };
        case 'rewind':
        case 'left':
          return { type: 'seek', deltaSec: -LIMITS.remoteSeekSec };
        case 'fast-forward':
        case 'right':
          return { type: 'seek', deltaSec: LIMITS.remoteSeekSec };
        case 'back':
          return { type: 'dismiss' };
      }
      return { type: 'none' };
    case 'button':
      if (input.gesture === 'press') return { type: 'invoke' };
      if (input.gesture === 'double-press') return toggle(context);
      return { type: 'dismiss' };
    case 'wheel': {
      const deltaSec = clampSeek(input.detents * LIMITS.wheelSecPerDetent);
      return deltaSec === 0 ? { type: 'none' } : { type: 'seek', deltaSec };
    }
  }
}
