import { describe, expect, it, vi } from 'vitest';
import { keepAwake, type WakeLockEnv } from './wake-lock';

function fakeEnv(visible = true) {
  const state = {
    visible,
    listener: null as null | (() => void),
    locks: [] as { released: boolean }[],
  };
  const env: WakeLockEnv = {
    wakeLock: {
      request: vi.fn(async () => {
        const lock = {
          released: false,
          release: async () => {
            lock.released = true;
          },
        };
        state.locks.push(lock);
        return lock;
      }),
    },
    isVisible: () => state.visible,
    onVisibilityChange(listener) {
      state.listener = listener;
      return () => (state.listener = null);
    },
  };
  return { env, state };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('keepAwake', () => {
  it('holds a lock while joined and releases it when stopped', async () => {
    const { env, state } = fakeEnv();
    const stop = keepAwake(env);
    await settle();
    expect(state.locks).toHaveLength(1);
    stop();
    await settle();
    expect(state.locks[0]?.released).toBe(true);
    expect(state.listener).toBeNull();
  });

  it('asks again when the page comes back after the browser dropped the lock', async () => {
    const { env, state } = fakeEnv();
    keepAwake(env);
    await settle();
    state.locks[0]!.released = true; // the page was hidden
    state.listener?.();
    await settle();
    expect(state.locks).toHaveLength(2);
    state.listener?.(); // still held: no second request
    await settle();
    expect(state.locks).toHaveLength(2);
  });

  it('waits for the page to be visible', async () => {
    const { env, state } = fakeEnv(false);
    keepAwake(env);
    await settle();
    expect(state.locks).toHaveLength(0);
    state.visible = true;
    state.listener?.();
    await settle();
    expect(state.locks).toHaveLength(1);
  });

  it('does nothing where the browser has no wake lock', () => {
    expect(() => keepAwake({ ...fakeEnv().env, wakeLock: undefined })()).not.toThrow();
  });
});
