// A Timers object for tests: nothing runs until the test calls fire(key).
import type { Timers } from './timers.js';

export interface FakeTimers extends Timers {
  pending: Map<string, { ms: number; fn: () => void }>;
  fire(key: string): void;
}

export function createFakeTimers(): FakeTimers {
  const pending = new Map<string, { ms: number; fn: () => void }>();
  return {
    pending,
    set: (key, ms, fn) => void pending.set(key, { ms, fn }),
    clear: (key) => void pending.delete(key),
    clearAll: () => pending.clear(),
    fire(key) {
      const timer = pending.get(key);
      pending.delete(key);
      timer?.fn();
    },
  };
}
