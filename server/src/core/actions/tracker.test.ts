import { describe, expect, it } from 'vitest';
import { expireAction, observeReport, trackAction } from './tracker.js';

const playing = { positionSec: 30, durationSec: 100, paused: false };

describe('action tracker', () => {
  it('marks a pause done only when a report shows the player paused', () => {
    const action = trackAction({
      commandId: 'c1',
      command: { type: 'pause' },
      by: 'p',
      estimate: playing,
      now: 0,
    });
    expect(action.status).toBe('sent');
    expect(observeReport(action, playing, 100)).toBe(false);
    expect(observeReport(action, { ...playing, paused: true }, 200)).toBe(true);
    expect(action.status).toBe('done');
  });

  it('confirms a seek near its target, allowing for play time since it was sent', () => {
    const action = trackAction({
      commandId: 'c2',
      command: { type: 'seek', deltaSec: 10 },
      by: 'p',
      estimate: playing,
      now: 0,
    });
    expect(action.expected.positionSec).toBe(40);
    expect(observeReport(action, { ...playing, positionSec: 31 }, 500)).toBe(false);
    expect(observeReport(action, { ...playing, positionSec: 44 }, 3000)).toBe(true);
  });

  it('clamps a seek target to the film', () => {
    const action = trackAction({
      commandId: 'c3',
      command: { type: 'seek', deltaSec: -60 },
      by: 'p',
      estimate: playing,
      now: 0,
    });
    expect(action.expected.positionSec).toBe(0);
  });

  it('turns a command with no matching report into "unconfirmed", once', () => {
    const action = trackAction({
      commandId: 'c4',
      command: { type: 'play' },
      by: 'p',
      estimate: null,
      now: 0,
    });
    expect(expireAction(action)).toBe(true);
    expect(action.status).toBe('unconfirmed');
    expect(expireAction(action)).toBe(false);
    expect(observeReport(action, playing, 10)).toBe(false);
  });
});
