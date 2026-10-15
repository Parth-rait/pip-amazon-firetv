import { describe, expect, it } from 'vitest';
import { createFakeModel, TimeoutError, withTimeout } from './model.js';

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
