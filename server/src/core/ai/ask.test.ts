import { describe, expect, it } from 'vitest';
import { runAsk } from './ask.js';
import { createFakeModel } from './model.js';

const prompt = { system: 's', user: 'u' };
const settings = { maxTokens: 200, temperature: 0.2, timeoutMs: 30, allowClarify: true };
const frozen = () => 1000; // a clock that never moves, so ms is 0

describe('runAsk', () => {
  it('returns the parsed reply', async () => {
    const outcome = await runAsk(
      createFakeModel('ANSWER: Yes.\nNEXT: Why?'),
      prompt,
      'q',
      settings,
      frozen,
    );
    expect(outcome).toEqual({
      reply: { kind: 'answer', text: 'Yes.', next: ['Why?'], sources: [] },
      ms: 0,
    });
  });

  it('gives the error name when the model throws', async () => {
    const model = createFakeModel(() => {
      const error = new Error('slow down');
      error.name = 'ThrottlingException';
      throw error;
    });
    expect(await runAsk(model, prompt, 'q', settings, frozen)).toEqual({
      reply: null,
      error: 'ThrottlingException',
      ms: 0,
    });
  });

  it('gives TimeoutError when the model never answers', async () => {
    const model = createFakeModel(() => new Promise<string>(() => {}));
    expect(await runAsk(model, prompt, 'q', settings, frozen)).toEqual({
      reply: null,
      error: 'TimeoutError',
      ms: 0,
    });
  });

  it("gives 'unparsed' for a CLARIFY when clarify is not allowed", async () => {
    const model = createFakeModel('CLARIFY: A? | B?');
    expect(
      await runAsk(model, prompt, 'q', { ...settings, allowClarify: false }, frozen),
    ).toEqual({ reply: null, error: 'unparsed', ms: 0 });
  });

  it('says how long the model took', async () => {
    let t = 0;
    const clock = () => (t += 250);
    const outcome = await runAsk(createFakeModel('ANSWER: Yes.'), prompt, 'q', settings, clock);
    expect(outcome.ms).toBe(250);
  });
});
