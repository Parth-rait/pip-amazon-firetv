import { describe, expect, it } from 'vitest';
import { runAsk } from './ask.js';
import { createFakeModel } from './model.js';

const prompt = { system: 's', user: 'u' };
const settings = { maxTokens: 200, temperature: 0.2, timeoutMs: 30, allowClarify: true };

describe('runAsk', () => {
  it('returns the parsed reply', async () => {
    const outcome = await runAsk(
      createFakeModel('ANSWER: Yes.\nNEXT: Why?'),
      prompt,
      'q',
      settings,
    );
    expect(outcome).toEqual({ reply: { kind: 'answer', text: 'Yes.', next: ['Why?'] } });
  });

  it('gives the error name when the model throws', async () => {
    const model = createFakeModel(() => {
      const error = new Error('slow down');
      error.name = 'ThrottlingException';
      throw error;
    });
    expect(await runAsk(model, prompt, 'q', settings)).toEqual({
      reply: null,
      error: 'ThrottlingException',
    });
  });

  it('gives TimeoutError when the model never answers', async () => {
    const model = createFakeModel(() => new Promise<string>(() => {}));
    expect(await runAsk(model, prompt, 'q', settings)).toEqual({
      reply: null,
      error: 'TimeoutError',
    });
  });

  it("gives 'unparsed' for a CLARIFY when clarify is not allowed", async () => {
    const model = createFakeModel('CLARIFY: A? | B?');
    expect(await runAsk(model, prompt, 'q', { ...settings, allowClarify: false })).toEqual({
      reply: null,
      error: 'unparsed',
    });
  });
});
