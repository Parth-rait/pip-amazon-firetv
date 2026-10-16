import { describe, expect, it } from 'vitest';
import type { PipSay, SessionView } from '../shared/protocol';
import { initialState, isHost, reducer, STARTER_CHIPS } from './store';

const ME = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

function view(overrides: Partial<SessionView> = {}): SessionView {
  return {
    code: 'ABCD',
    stage: 'lobby',
    tvOnline: true,
    hostId: ME,
    players: [
      { id: ME, name: 'Sam', score: 0, online: true },
      { id: OTHER, name: 'Leo', score: 0, online: true },
    ],
    content: null,
    playback: null,
    quizUnlocked: 0,
    pip: 'idle',
    assist: null,
    lastAction: null,
    features: { quiz: false },
    quiz: null,
    results: null,
    ...overrides,
  };
}

function say(askedBy: string, overrides: Partial<PipSay> = {}): PipSay {
  return {
    askedBy,
    askedByName: 'Sam',
    question: 'Who is that?',
    text: 'A big bunny.',
    next: ['Why is he sad?', 'Where is he?'],
    clarify: [],
    source: 'ai',
    kind: 'answer',
    ...overrides,
  };
}

const joined = () => reducer(initialState(ME), { type: 'joined', view: view(), at: 1 });

describe('reducer', () => {
  it('replaces the old view with a new one', () => {
    const next = reducer(joined(), { type: 'view', view: view({ stage: 'watch' }), at: 2 });
    expect(next.view?.stage).toBe('watch');
  });

  it('ignores views before joining and views from another session', () => {
    expect(reducer(initialState(ME), { type: 'view', view: view(), at: 1 }).view).toBeNull();
    const state = joined();
    expect(reducer(state, { type: 'view', view: view({ code: 'WXYZ' }), at: 2 })).toBe(state);
  });

  it('gives the host controls to whoever hostId names', () => {
    const state = joined();
    expect(isHost(state)).toBe(true);
    const handedOver = reducer(state, { type: 'view', view: view({ hostId: OTHER }), at: 2 });
    expect(isHost(handedOver)).toBe(false);
  });

  it('shows the next chips after my answer, and ignores a pip:say for someone else', () => {
    const mine = reducer(joined(), { type: 'say', say: say(ME) });
    expect(mine.chips).toEqual({ kind: 'next', items: ['Why is he sad?', 'Where is he?'] });
    const theirs = reducer(joined(), { type: 'say', say: say(OTHER) });
    expect(theirs.chips).toEqual({ kind: 'starter', items: STARTER_CHIPS });
    expect(theirs.say).toBeNull();
  });

  it('shows "Did you mean" options instead of next chips when Pip asks to clarify', () => {
    const state = reducer(joined(), {
      type: 'say',
      say: say(ME, { clarify: ['A?', 'B?'], next: [] }),
    });
    expect(state.chips).toEqual({ kind: 'clarify', items: ['A?', 'B?'] });
    expect(reducer(state, { type: 'chips-expired' }).chips.kind).toBe('starter');
  });

  it('keeps the playback arrival time when a view repeats the same report', () => {
    const playback = {
      contentId: 'f',
      positionSec: 10,
      durationSec: 100,
      paused: false,
      ended: false,
    };
    const first = reducer(joined(), { type: 'view', view: view({ playback }), at: 5 });
    const same = reducer(first, { type: 'view', view: view({ playback: { ...playback } }), at: 9 });
    expect(same.playbackAt).toBe(5);
    const moved = reducer(same, {
      type: 'view',
      view: view({ playback: { ...playback, positionSec: 15 } }),
      at: 10,
    });
    expect(moved.playbackAt).toBe(10);
  });

  it('goes back to the join screen on leave, keeping the connection state', () => {
    const online = reducer(joined(), { type: 'connected' });
    const left = reducer(online, { type: 'leave' });
    expect(left.view).toBeNull();
    expect(left.connection).toBe('online');
  });
});
