import { describe, expect, it } from 'vitest';
import { createJournal } from '../events/journal.js';
import { toIntent } from './adapters.js';
import { createSeenIds } from './dedupe.js';

const playing = { paused: false };
const paused = { paused: true };

describe('toIntent', () => {
  it('maps every source of play/pause to the same absolute intent', () => {
    expect(toIntent({ kind: 'key', key: 'play-pause' }, playing)).toEqual({ type: 'pause' });
    expect(toIntent({ kind: 'key', key: 'play-pause' }, paused)).toEqual({ type: 'play' });
    expect(toIntent({ kind: 'button', gesture: 'double-press' }, playing)).toEqual({
      type: 'pause',
    });
    expect(toIntent({ kind: 'key', key: 'pause' }, paused)).toEqual({ type: 'pause' });
  });

  it('does nothing for a toggle when nothing is playing', () => {
    expect(toIntent({ kind: 'key', key: 'play-pause' }, { paused: null })).toEqual({
      type: 'none',
    });
  });

  it('maps remote and wheel movement to clamped seeks', () => {
    expect(toIntent({ kind: 'key', key: 'rewind' }, playing)).toEqual({
      type: 'seek',
      deltaSec: -10,
    });
    expect(toIntent({ kind: 'key', key: 'right' }, playing)).toEqual({
      type: 'seek',
      deltaSec: 10,
    });
    expect(toIntent({ kind: 'wheel', detents: 3 }, playing)).toEqual({
      type: 'seek',
      deltaSec: 15,
    });
    expect(toIntent({ kind: 'wheel', detents: -24 }, playing)).toEqual({
      type: 'seek',
      deltaSec: -60,
    });
    expect(toIntent({ kind: 'wheel', detents: 0 }, playing)).toEqual({ type: 'none' });
  });

  it('maps the button press to invoke and back or a long press to dismiss', () => {
    expect(toIntent({ kind: 'button', gesture: 'press' }, playing)).toEqual({ type: 'invoke' });
    expect(toIntent({ kind: 'button', gesture: 'long-press' }, playing)).toEqual({
      type: 'dismiss',
    });
    expect(toIntent({ kind: 'key', key: 'back' }, playing)).toEqual({ type: 'dismiss' });
  });
});

describe('createSeenIds', () => {
  it('lets each id through once and forgets the oldest past its limit', () => {
    const seen = createSeenIds(2);
    expect(seen.firstTime('a')).toBe(true);
    expect(seen.firstTime('a')).toBe(false);
    seen.firstTime('b');
    seen.firstTime('c');
    expect(seen.size()).toBe(2);
    expect(seen.firstTime('a')).toBe(true);
  });
});

describe('createJournal', () => {
  it('numbers events, keeps the newest and exports JSON Lines', () => {
    const journal = createJournal(2);
    for (const type of ['a', 'b', 'c'])
      journal.append({ at: 1, type, source: 'server', actor: null, data: {} });
    expect(journal.events().map((e) => [e.seq, e.type])).toEqual([
      [2, 'b'],
      [3, 'c'],
    ]);
    const lines = journal.toJsonl().trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ v: 1, seq: 2, type: 'b' });
  });
});
