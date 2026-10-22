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
    expect(routeText('Who owns the lantern?')).toEqual({ kind: 'question', topic: 'other' });
    expect(routeText('Who does the lantern belong to?')).toEqual({
      kind: 'question',
      topic: 'other',
    });
    expect(routeText('Is the lake cold?')).toEqual({ kind: 'question', topic: 'other' });
  });

  it('tags questions about later as future, never as a recap', () => {
    for (const q of [
      'What happens next?',
      'How does it end?',
      'Where will Ember take the lantern?',
      'Does the lighthouse ever shine?',
      'What do they do at the end?',
      'Is the fox going to find something?',
    ]) {
      expect(routeText(q)).toEqual({ kind: 'question', topic: 'future' });
    }
    expect(routeText('What happened before the lake?')).not.toEqual({
      kind: 'question',
      topic: 'future',
    });
  });

  it('tags yes-or-no questions about how things turn out as future, but not the past', () => {
    for (const q of [
      'Does she find the dragon?',
      'Is Scales still alive?',
      'Does the flying squirrel get hurt?',
      'Does Scales grow up?',
    ])
      expect(routeText(q)).toEqual({ kind: 'question', topic: 'future' });
    for (const q of [
      'Did the bunny save the flying squirrel?',
      'Does the bunny have a family?',
      'Is the big dragon Scales?',
    ])
      expect(routeText(q)).not.toEqual({ kind: 'question', topic: 'future' });
  });

  it('reads "Who is she looking for?" as a question about her, not "who is that?"', () => {
    expect(routeText('Who is she looking for?')).toEqual({ kind: 'question', topic: 'other' });
    expect(routeText('Who is that?')).toEqual({ kind: 'question', topic: 'identify' });
  });
});
