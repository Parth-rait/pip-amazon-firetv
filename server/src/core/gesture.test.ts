import { describe, expect, it } from 'vitest';
import { createRepeatFilter, GESTURE_COMMANDS, gestureEvent, parseBridgeLine } from './gesture.js';

// That the server accepts every one of these inputs is in validate.test.ts (core imports no
// server code).
describe('the gesture adapter', () => {
  it('maps the playback gestures the way the touch adapter does', () => {
    expect(gestureEvent('DPAD_CENTER')).toEqual({ type: 'media.playPause' });
    expect(gestureEvent('DPAD_LEFT')).toEqual({ type: 'media.seekRelative', seconds: -10 });
    expect(gestureEvent('DPAD_RIGHT')).toEqual({ type: 'media.seekRelative', seconds: 10 });
    expect(gestureEvent('VOLUME_UP')).toEqual({ type: 'media.volumeDelta', delta: 0.1 });
    expect(gestureEvent('VOLUME_DOWN')).toEqual({ type: 'media.volumeDelta', delta: -0.1 });
    expect(gestureEvent('HOME')).toEqual({ type: 'pip.invoke' });
    expect(gestureEvent('BACK')).toEqual({ type: 'pip.dismiss' });
  });

  it('uses the configured step sizes', () => {
    const config = { seekSec: 30, volumeStep: 0.05 };
    expect(gestureEvent('DPAD_LEFT', config)).toEqual({ type: 'media.seekRelative', seconds: -30 });
    expect(gestureEvent('VOLUME_UP', config)).toEqual({ type: 'media.volumeDelta', delta: 0.05 });
  });

  it('never maps a gesture to a model call or an irreversible action', () => {
    const types = new Set(GESTURE_COMMANDS.map((c) => gestureEvent(c).type));
    expect([...types].sort()).toEqual([
      'media.playPause',
      'media.seekRelative',
      'media.volumeDelta',
      'navigation.move',
      'pip.dismiss',
      'pip.invoke',
    ]);
  });
});

describe('held points', () => {
  it('sends one seek for a held point, not one every 0.3 s', () => {
    // what the webcam log showed: one point held left, then one held right, repeated by upstream
    const send = createRepeatFilter();
    const left = [0, 330, 660, 990, 1320].map((at) => send('DPAD_LEFT', at));
    const right = [2300, 2630, 2960].map((at) => send('DPAD_RIGHT', at));
    expect(left).toEqual([true, false, false, false, false]);
    expect(right).toEqual([true, false, false]);
  });

  it('sends a new point after a pause, and never holds back volume or play', () => {
    const send = createRepeatFilter();
    expect(send('DPAD_RIGHT', 0)).toBe(true);
    expect(send('DPAD_RIGHT', 1000)).toBe(true); // pointed again
    expect(send('VOLUME_UP', 1100)).toBe(true);
    expect(send('VOLUME_UP', 1400)).toBe(true); // a held pinch keeps turning it up
    expect(send('DPAD_CENTER', 1500)).toBe(true);
    expect(send('DPAD_CENTER', 1700)).toBe(true);
  });
});

describe('bridge lines', () => {
  it('reads ready, command and done lines', () => {
    expect(parseBridgeLine('{"type":"ready","mode":"replay"}')).toEqual({
      type: 'ready',
      mode: 'replay',
    });
    expect(parseBridgeLine('{"type":"command","command":"HOME","at":5}')).toEqual({
      type: 'command',
      command: 'HOME',
      at: 5,
    });
    expect(parseBridgeLine('{"type":"done"}')).toEqual({ type: 'done' });
  });

  it('ignores log noise, malformed lines and commands no gesture makes', () => {
    expect(parseBridgeLine('')).toBeNull();
    expect(parseBridgeLine('[INFO] Downloading model')).toBeNull();
    expect(parseBridgeLine('{"type":"command","command":"POWER_OFF","at":5}')).toBeNull();
    expect(parseBridgeLine('{"type":"command","command":"HOME"}')).toBeNull();
    expect(parseBridgeLine('{"type":"launch"}')).toBeNull();
  });
});
