import { describe, expect, it } from 'vitest';
import { GESTURE_COMMANDS, gestureEvent } from './core/gesture.js';
import { LIMITS } from './shared/protocol.js';
import {
  askSchema,
  helloSchema,
  hostCommandSchema,
  inputSchema,
  joinSchema,
  playbackSchema,
  predictSchema,
  reactSchema,
} from './validate.js';

const ID = '0123456789abcdef0123456789abcdef';

describe('validate', () => {
  it('accepts a good join and rejects bad codes and ids', () => {
    expect(joinSchema.safeParse({ code: 'ABCD', playerId: ID, name: 'Sam' }).success).toBe(true);
    for (const code of ['AB0D', 'abcd', 'ABC', 'ABCDE']) {
      expect(joinSchema.safeParse({ code, playerId: ID, name: 'Sam' }).success).toBe(false);
    }
    for (const playerId of [ID.toUpperCase(), ID.slice(1), `${ID}0`, 'x'.repeat(32)]) {
      expect(joinSchema.safeParse({ code: 'ABCD', playerId, name: 'Sam' }).success).toBe(false);
    }
  });

  it('accepts a first hello and rejects a bad tv key', () => {
    expect(helloSchema.safeParse({ previousCode: null, tvKey: null, playback: null }).success).toBe(
      true,
    );
    expect(
      helloSchema.safeParse({ previousCode: 'ABCD', tvKey: 'nope', playback: null }).success,
    ).toBe(false);
  });

  it('accepts the kids-mode host command and refuses the old media commands', () => {
    expect(hostCommandSchema.safeParse({ type: 'kids-mode', on: true }).success).toBe(true);
    expect(hostCommandSchema.safeParse({ type: 'pause' }).success).toBe(false);
  });

  it('rejects unknown host commands', () => {
    expect(hostCommandSchema.safeParse({ type: 'explode' }).success).toBe(false);
    expect(hostCommandSchema.safeParse({ type: 'seek', deltaSec: 'far' }).success).toBe(false);
  });

  it('trims the ask text and rejects text that is too short or too long', () => {
    expect(askSchema.parse({ text: '  why?  ', via: 'typed' }).text).toBe('why?');
    expect(askSchema.safeParse({ text: ' a ', via: 'typed' }).success).toBe(false);
    const long = 'a'.repeat(LIMITS.askMaxChars + 1);
    expect(askSchema.safeParse({ text: long, via: 'typed' }).success).toBe(false);
    expect(askSchema.safeParse({ text: 'why?', via: 'shout' }).success).toBe(false);
  });

  it('rejects playback that is not a number', () => {
    const playback = {
      contentId: 'f',
      positionSec: 'x',
      durationSec: 1,
      paused: false,
      ended: false,
    };
    expect(playbackSchema.safeParse(playback).success).toBe(false);
  });
});

describe('inputs (docs/vnext/PLAN.md 4.2)', () => {
  it('accepts an optional avatar from 0 to 7 when joining', () => {
    expect(
      joinSchema.safeParse({ code: 'ABCD', playerId: ID, name: 'Sam', avatar: 7 }).success,
    ).toBe(true);
    for (const avatar of [-1, 8, 1.5, '2']) {
      expect(
        joinSchema.safeParse({ code: 'ABCD', playerId: ID, name: 'Sam', avatar }).success,
      ).toBe(false);
    }
  });

  it('accepts semantic inputs from known adapters only', () => {
    const input = {
      id: 'abcdefgh1',
      source: 'pad_touch',
      at: 1,
      event: { type: 'media.playPause' },
    };
    expect(inputSchema.safeParse(input).success).toBe(true);
    expect(inputSchema.safeParse({ ...input, source: 'hacker' }).success).toBe(false);
    expect(
      inputSchema.safeParse({ ...input, event: { type: 'media.volumeDelta', delta: 3 } }).success,
    ).toBe(false);
    expect(inputSchema.safeParse({ ...input, event: { type: 'shell.run' } }).success).toBe(false);
  });

  it('accepts the input of every hand gesture', () => {
    for (const command of GESTURE_COMMANDS) {
      const input = { id: `gesture-${command}`, source: 'hand_gesture_cam', at: 0 };
      expect(inputSchema.safeParse({ ...input, event: gestureEvent(command) }).success).toBe(true);
    }
  });
});

describe('companion events (PROJECT.md 2.4)', () => {
  it('accepts the four reactions only', () => {
    expect(reactSchema.safeParse({ kind: 'laugh' }).success).toBe(true);
    expect(reactSchema.safeParse({ kind: 'angry' }).success).toBe(false);
  });

  it('accepts a vote for choice 0 to 2 only', () => {
    expect(predictSchema.safeParse({ id: 'revenge', choice: 2 }).success).toBe(true);
    expect(predictSchema.safeParse({ id: 'revenge', choice: 3 }).success).toBe(false);
    expect(predictSchema.safeParse({ id: '', choice: 0 }).success).toBe(false);
  });
});
