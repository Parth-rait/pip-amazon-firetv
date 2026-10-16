import { describe, expect, it } from 'vitest';
import { createTypeSafeJudge } from './typesafe-judge.js';

describe('createTypeSafeJudge', () => {
  it('maps a typed choice to a judgement, and returns null on errors or odd labels', async () => {
    const choice = (instructions: string, criteria: Record<string, string>) => ({
      type: 'choice',
      instructions,
      criteria,
    });
    const ok = createTypeSafeJudge(
      {
        systemOne: async () => ({
          answers: { intent: { choice: 'playback-command', confidence: 0.91 } },
        }),
      },
      choice,
      100,
    );
    expect(await ok.judge('hold it')).toEqual({ label: 'playback-command', confidence: 0.91 });
    const odd = createTypeSafeJudge(
      { systemOne: async () => ({ answers: { intent: { choice: 'launch', confidence: 1 } } }) },
      choice,
      100,
    );
    expect(await odd.judge('x')).toBeNull();
    const down = createTypeSafeJudge(
      {
        systemOne: async () => {
          throw new Error('offline');
        },
      },
      choice,
      100,
    );
    expect(await down.judge('x')).toBeNull();
  });
});
