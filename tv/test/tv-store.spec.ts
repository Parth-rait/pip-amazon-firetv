import {initialTvState, tvReducer} from '../src/state/tv-store';
import type {PipSay, SessionView} from '../src/shared/protocol';

const film = {
  id: 'big-buck-bunny',
  title: 'Big Buck Bunny',
  url: 'https://example.test/media/big-buck-bunny.mp4',
  credit: 'Blender Foundation',
  durationSec: 596,
};

function view(over: Partial<SessionView>): SessionView {
  return {
    code: 'K7QD',
    stage: 'lobby',
    tvOnline: true,
    hostId: null,
    players: [],
    content: null,
    playback: null,
    quizUnlocked: 0,
    pip: 'sleep',
    quiz: null,
    results: null,
    ...over,
  };
}

const say: PipSay = {
  askedBy: 'p1',
  askedByName: 'Leo',
  question: 'Who is the big bunny?',
  text: 'That is Big Buck Bunny.',
  next: [],
  clarify: [],
  source: 'template',
};

describe('tvReducer', () => {
  it('keeps the last view while disconnected, so the film keeps playing', () => {
    const watching = tvReducer(initialTvState, {
      type: 'view',
      view: view({stage: 'watch', content: film}),
    });
    const down = tvReducer(watching, {type: 'disconnected'});
    expect(down.connected).toBe(false);
    expect(down.view?.stage).toBe('watch');
  });

  it('numbers each answer, so the same answer twice shows twice', () => {
    const watching = tvReducer(initialTvState, {
      type: 'view',
      view: view({stage: 'watch', content: film}),
    });
    const once = tvReducer(watching, {type: 'say', say});
    const twice = tvReducer(once, {type: 'say', say});
    expect(twice.say?.id).toBe((once.say?.id ?? 0) + 1);
  });

  it('drops the answer when the stage leaves watch', () => {
    let state = tvReducer(initialTvState, {
      type: 'view',
      view: view({stage: 'watch', content: film}),
    });
    state = tvReducer(state, {type: 'say', say});
    state = tvReducer(state, {
      type: 'view',
      view: view({stage: 'quiz', content: film}),
    });
    expect(state.say).toBeNull();
  });
});
