import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PipInputEvent } from '../shared/protocol.js';
import { createTouchAdapter, replay, turn, type TouchSample } from './touch.js';

interface Trace {
  name: string;
  samples: TouchSample[];
  expected: PipInputEvent[];
}

const TRACES = new URL('../../sim/traces/', import.meta.url);
const traces: Trace[] = readdirSync(TRACES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, TRACES), 'utf8')) as Trace);

describe('touch traces', () => {
  it('has the repeatable traces', () => {
    expect(traces.map((t) => t.name).sort()).toEqual([
      'evening',
      'pip-tap',
      'play-pause',
      'wheel-jitter',
      'wheel-seek',
    ]);
  });

  it.each(traces.map((t) => [t.name, t] as const))(
    '%s gives exactly its expected inputs',
    (_, trace) => {
      expect(replay(trace.samples).map((o) => o.event)).toEqual(trace.expected);
    },
  );

  it('gives the same inputs on every run', () => {
    for (const trace of traces) expect(replay(trace.samples)).toEqual(replay(trace.samples));
  });
});

describe('the touch adapter', () => {
  it('names the adapter as the source, never the person', () => {
    const adapter = createTouchAdapter();
    adapter.push({ t: 0, button: 'pip', touched: true });
    const [tap] = adapter.push({ t: 100, button: 'pip', touched: false });
    expect(tap?.source).toBe('capacitive_button_proto');
    adapter.push({ t: 200, wheel: 0 });
    const [step] = adapter.push({ t: 240, wheel: 30 });
    expect(step?.source).toBe('touchwheel_proto');
  });

  it('ignores bounces and a release without a touch', () => {
    const adapter = createTouchAdapter();
    expect(adapter.push({ t: 0, button: 'play', touched: false })).toEqual([]);
    adapter.push({ t: 10, button: 'play', touched: true });
    expect(adapter.push({ t: 25, button: 'play', touched: false })).toEqual([]);
  });

  it('starts each wheel touch from where the finger lands', () => {
    const adapter = createTouchAdapter();
    adapter.push({ t: 0, wheel: 0 });
    adapter.push({ t: 40, wheel: 20 });
    adapter.push({ t: 80, wheel: null });
    // 20 degrees, a lift, then a touch at 180: the jump from 20 to 180 is not a turn.
    expect(adapter.push({ t: 120, wheel: 180 })).toEqual([]);
    expect(adapter.push({ t: 160, wheel: 200 })).toEqual([]);
  });

  it('turns the short way round across 0 degrees', () => {
    expect(turn(350, 10)).toBe(20);
    expect(turn(10, 350)).toBe(-20);
    expect(turn(90, 90)).toBe(0);
  });
});
