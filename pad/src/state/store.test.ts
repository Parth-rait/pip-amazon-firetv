import { describe, expect, it } from 'vitest';
import type { PipSay, SessionView } from '../shared/protocol';
import {
  actionLine,
  initialState,
  isHost,
  isPipThinkingForMe,
  reducer,
  STARTER_CHIPS,
} from './store';

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

  it('tracks my question from sent to reply, and clears a refusal on the next ask', () => {
    const sent = reducer(joined(), { type: 'ask-sent' });
    expect(isPipThinkingForMe(sent)).toBe(true);
    const refused = reducer(sent, { type: 'ask-refused', reason: 'busy' });
    expect(refused).toMatchObject({ isAsking: false, askError: 'busy' });
    const again = reducer(refused, { type: 'ask-sent' });
    expect(again.askError).toBeNull();
    const answered = reducer(again, { type: 'say', say: say(ME) });
    expect(answered).toMatchObject({ isAsking: false, say: { text: 'A big bunny.' } });
  });

  it('closes my reply with Done and goes back to the starter chips', () => {
    const answered = reducer(joined(), { type: 'say', say: say(ME) });
    const closed = reducer(answered, { type: 'reply-closed' });
    expect(closed.say).toBeNull();
    expect(closed.chips.kind).toBe('starter');
  });

  it('forgets the reply and the chips when the session leaves watch', () => {
    const watching = reducer(joined(), { type: 'view', view: view({ stage: 'watch' }), at: 2 });
    const answered = reducer(watching, { type: 'say', say: say(ME) });
    const lobby = reducer(answered, { type: 'view', view: view({ stage: 'lobby' }), at: 3 });
    expect(lobby.say).toBeNull();
    expect(lobby.chips.kind).toBe('starter');
  });

  it('stops waiting for an answer when the connection drops', () => {
    const sent = reducer(joined(), { type: 'ask-sent' });
    expect(reducer(sent, { type: 'disconnected' }).isAsking).toBe(false);
  });
});

describe('actionLine', () => {
  const action = (
    status: 'sent' | 'done' | 'unconfirmed',
    type: 'play' | 'pause' | 'seek' = 'pause',
    deltaSec: number | null = null,
  ) => ({ commandId: 'c', type, deltaSec, by: ME, status });

  it('says what was asked while sent, and the result only once done', () => {
    expect(actionLine(action('sent'))).toBe('Pausing…');
    expect(actionLine(action('done'))).toBe('Paused');
    expect(actionLine(action('sent', 'seek', -10))).toBe('Going back 10 s…');
    expect(actionLine(action('done', 'seek', 10))).toBe('Ahead 10 s');
  });

  it('says plainly when the TV did not respond', () => {
    expect(actionLine(action('unconfirmed'))).toBe("The TV didn't respond. Try again.");
    expect(actionLine(null)).toBeNull();
  });
});
