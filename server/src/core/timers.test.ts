import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimers } from './timers.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createTimers', () => {
  it('replaces a timer when its key is set again', () => {
    const timers = createTimers();
    const first = vi.fn();
    const second = vi.fn();
    timers.set('k', 100, first);
    timers.set('k', 100, second);
    vi.advanceTimersByTime(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('stops timers with clear and clearAll', () => {
    const timers = createTimers();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    timers.set('a', 50, a);
    timers.set('b', 50, b);
    timers.set('c', 50, c);
    timers.clear('a');
    timers.clearAll();
    vi.advanceTimersByTime(100);
    expect([a, b, c].some((fn) => fn.mock.calls.length > 0)).toBe(false);
  });
});
