import { describe, expect, it } from 'vitest';
import type { Playback } from '../shared/protocol.js';
import { estimatePosition } from './playback.js';

const base: Playback = {
  contentId: 'f',
  positionSec: 100,
  durationSec: 596,
  paused: false,
  ended: false,
};

describe('estimatePosition', () => {
  it('adds the time since the report while playing', () => {
    expect(estimatePosition(base, 1000, 6000)).toBe(105);
  });

  it('adds nothing while paused', () => {
    expect(estimatePosition({ ...base, paused: true }, 1000, 60_000)).toBe(100);
  });

  it('counts an ended film as its full length', () => {
    expect(estimatePosition({ ...base, ended: true, positionSec: 10 }, 0, 0)).toBe(596);
  });

  it('never goes past the end', () => {
    expect(estimatePosition(base, 0, 10_000_000)).toBe(596);
  });
});
