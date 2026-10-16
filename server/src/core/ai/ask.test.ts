import { describe, expect, it } from 'vitest';
import { runAsk } from './ask.js';
import { createFakeModel } from './model.js';

const prompt = { system: 's', user: 'u' };
const settings = { maxTokens: 10, temperature: 0, timeoutMs: 50, allowClarify: true };

describe('runAsk', () => {
  it('returns the parsed reply', async () => {
    const outcome = await runAsk(
      createFakeModel('ANSWER: Hi.\nSOURCES: f1'),
      prompt,
      'q',
      settings,
    );
    expect(outcome.reply).toMatchObject({ kind: 'answer', text: 'Hi.', sources: ['f1'] });
  });

  it('never throws: a failing model gives the error name', async () => {
    const throttled = createFakeModel(() => {
      const error = new Error('slow down');
      error.name = 'ThrottlingException';
      throw error;
    });
    expect(await runAsk(throttled, prompt, 'q', settings)).toMatchObject({
      reply: null,
      error: 'ThrottlingException',
    });
  });

  it('times out a model that never answers', async () => {
    const hung = createFakeModel(() => new Promise<string>(() => {}));
    expect(await runAsk(hung, prompt, 'q', settings)).toMatchObject({
      reply: null,
      error: 'TimeoutError',
    });
  });

  it('reports "unparsed" for a CLARIFY when clarify is not allowed', async () => {
    const outcome = await runAsk(createFakeModel('CLARIFY: a | b'), prompt, 'q', {
      ...settings,
      allowClarify: false,
    });
    expect(outcome).toMatchObject({ reply: null, error: 'unparsed' });
  });
});
