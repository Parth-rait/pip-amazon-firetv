import { describe, expect, it } from 'vitest';
import { createRateLimit } from './rate-limit.js';

describe('createRateLimit', () => {
  it('is limited at the max inside the window and free again as it passes', () => {
    const limit = createRateLimit(3, 1000);
    for (const at of [0, 100, 200]) {
      expect(limit.isLimited('a', at)).toBe(false);
      limit.record('a', at);
    }
    expect(limit.isLimited('a', 999)).toBe(true);
    expect(limit.isLimited('a', 1000)).toBe(false); // the event at 0 has left the window
  });

  it('counts keys apart', () => {
    const limit = createRateLimit(1, 1000);
    limit.record('a', 0);
    expect(limit.isLimited('a', 1)).toBe(true);
    expect(limit.isLimited('b', 1)).toBe(false);
  });
});
