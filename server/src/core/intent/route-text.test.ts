import { describe, expect, it } from 'vitest';
import { routeText } from './route-text.js';

describe('routeText', () => {
  it.each([
    ['pause', { type: 'pause' }],
    ['Pause the movie please', { type: 'pause' }],
    ['hey Pip, pause!', { type: 'pause' }],
    ['play', { type: 'play' }],
    ['Resume the film', { type: 'play' }],
    ['keep going', { type: 'play' }],
    ['go back', { type: 'seek', deltaSec: -10 }],
    ['rewind 30 seconds', { type: 'seek', deltaSec: -30 }],
    ['skip ahead 20 s', { type: 'seek', deltaSec: 20 }],
    ['fast forward', { type: 'seek', deltaSec: 10 }],
    ['go back 5 minutes', { type: 'seek', deltaSec: -60 }],
  ])('sends "%s" to a deterministic action', (text, intent) => {
    expect(routeText(text)).toEqual({ kind: 'action', intent });
  });

  it('treats "never mind" and "thanks" as dismiss', () => {
    expect(routeText('Never mind')).toEqual({ kind: 'dismiss' });
    expect(routeText('thanks pip')).toEqual({ kind: 'dismiss' });
  });

  it('fails closed on an ambiguous "stop": explicit choices, no action', () => {
    expect(routeText('stop')).toEqual({
      kind: 'ambiguous-command',
      options: ['Pause the film', 'Hide Pip'],
    });
  });

  it('keeps questions that only contain command words as questions', () => {
    expect(routeText('Why did the fox pause?')).toEqual({ kind: 'question', topic: 'why' });
    expect(routeText('Where does the lantern go back to?')).toMatchObject({ kind: 'question' });
  });

  it('tags question topics', () => {
    expect(routeText('What just happened?')).toEqual({ kind: 'question', topic: 'recap' });
    expect(routeText("Who's that?")).toEqual({ kind: 'question', topic: 'identify' });
    expect(routeText('Why did she do that?')).toEqual({ kind: 'question', topic: 'why' });
    expect(routeText('Is the lake cold?')).toEqual({ kind: 'question', topic: 'other' });
  });
});
