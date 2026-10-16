// The touch adapter (docs/vnext/PLAN.md 4.2 and 4.3): raw readings from capacitive buttons and a
// touchwheel, the kind a microcontroller bridge would send over USB serial, become the same
// semantic inputs the pad sends. The brain never sees a raw reading. Pure, so the simulator, the
// tests and a future serial bridge all share it.
import type { InputSource, PipInputEvent } from '../shared/protocol.js';

export type TouchButton = 'pip' | 'play' | 'back';

/** One reading: a button touched or released, or the wheel's angle (null when let go). */
export type TouchSample =
  { t: number; button: TouchButton; touched: boolean } | { t: number; wheel: number | null };

export interface TouchConfig {
  debounceMs: number; // a touch shorter than this is a bounce, not a tap
  stepDeg: number; // wheel rotation for one seek step
  jitterDeg: number; // smaller wheel movements are noise
  seekSec: number; // seconds per wheel step during playback
}

/** Starting values, to calibrate with real users and the real board (PLAN.md 4.3). */
export const DEFAULT_TOUCH: TouchConfig = {
  debounceMs: 30,
  stepDeg: 30,
  jitterDeg: 3,
  seekSec: 10,
};

export interface TouchOutput {
  t: number; // the reading that produced it
  source: InputSource;
  event: PipInputEvent;
}

const BUTTON_EVENTS: Record<TouchButton, PipInputEvent> = {
  pip: { type: 'pip.invoke' }, // the deliberate way in
  play: { type: 'media.playPause' }, // frequent, and never a model call
  back: { type: 'pip.dismiss' }, // the fast way out
};

/** The signed shortest turn from one angle to another, in degrees (-180 to 180). */
export function turn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function createTouchAdapter(config: TouchConfig = DEFAULT_TOUCH) {
  const downAt = new Map<TouchButton, number>();
  let wheelAt: number | null = null; // the last angle that counted
  let turned = 0; // rotation not yet spent on a step

  return {
    /** Feeds one reading; returns the semantic inputs it completes (often none). */
    push(sample: TouchSample): TouchOutput[] {
      if ('button' in sample) {
        if (sample.touched) {
          if (!downAt.has(sample.button)) downAt.set(sample.button, sample.t);
          return [];
        }
        const start = downAt.get(sample.button);
        downAt.delete(sample.button);
        if (start === undefined || sample.t - start < config.debounceMs) return [];
        return [
          { t: sample.t, source: 'capacitive_button_proto', event: BUTTON_EVENTS[sample.button] },
        ];
      }

      if (sample.wheel === null) {
        wheelAt = null;
        turned = 0;
        return [];
      }
      if (wheelAt === null) {
        wheelAt = sample.wheel; // a new touch sets the origin; it does not move anything
        return [];
      }
      const delta = turn(wheelAt, sample.wheel);
      if (Math.abs(delta) < config.jitterDeg) return []; // keep the origin, so slow turns add up
      wheelAt = sample.wheel;
      turned += delta;
      const out: TouchOutput[] = [];
      while (Math.abs(turned) >= config.stepDeg) {
        const sign = Math.sign(turned);
        turned -= sign * config.stepDeg;
        out.push({
          t: sample.t,
          source: 'touchwheel_proto',
          event: { type: 'media.seekRelative', seconds: sign * config.seekSec },
        });
      }
      return out;
    },
  };
}

/** Runs a whole trace through a fresh adapter. */
export function replay(samples: TouchSample[], config: TouchConfig = DEFAULT_TOUCH) {
  const adapter = createTouchAdapter(config);
  return samples.flatMap((s) => adapter.push(s));
}
