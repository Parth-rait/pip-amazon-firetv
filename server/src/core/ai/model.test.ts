import { describe, expect, it } from 'vitest';
import { createFakeModel, createOllamaModel, TimeoutError, withTimeout } from './model.js';

const input = { system: 's', user: 'u', maxTokens: 10, temperature: 0, timeoutMs: 100 };

describe('withTimeout', () => {
  it('rejects a promise that never settles', async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes through a promise that settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });
});

describe('createFakeModel', () => {
  it('returns a fixed reply', async () => {
    await expect(createFakeModel('hello').complete(input)).resolves.toBe('hello');
  });

  it('calls a function with the input, which may throw', async () => {
    const echo = createFakeModel((i) => i.user);
    await expect(echo.complete(input)).resolves.toBe('u');
    const broken = createFakeModel(() => {
      throw new Error('boom');
    });
    await expect(broken.complete(input)).rejects.toThrow('boom');
  });
});

describe('createOllamaModel', () => {
  it('sends the system and user messages and returns the reply text', async () => {
    let sent: { url: string; body: Record<string, unknown> } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
      return new Response(JSON.stringify({ message: { content: 'ANSWER: Hi.' } }));
    }) as typeof fetch;
    const model = createOllamaModel({
      url: 'http://ollama.test/',
      model: 'tiny',
      fetch: fakeFetch,
    });
    await expect(model.complete(input)).resolves.toBe('ANSWER: Hi.');
    expect(sent!.url).toBe('http://ollama.test/api/chat');
    expect(sent!.body).toMatchObject({
      model: 'tiny',
      stream: false,
      options: { temperature: 0, num_predict: 10 },
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'u' },
      ],
    });
  });

  it('throws a named error for an HTTP failure', async () => {
    const fakeFetch = (async () => new Response('no model', { status: 404 })) as typeof fetch;
    const model = createOllamaModel({ url: 'http://ollama.test', model: 'x', fetch: fakeFetch });
    await expect(model.complete(input)).rejects.toMatchObject({ name: 'OllamaHttpError' });
  });
});
