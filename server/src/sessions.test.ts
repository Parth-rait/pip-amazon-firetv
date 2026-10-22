import { describe, expect, it } from 'vitest';
import { joinPlayer, leaveSocket } from './core/players.js';
import { InMemorySessionStore, isIdle } from './sessions.js';
import { LIMITS } from './shared/protocol.js';

const KEY = 'a'.repeat(32);
const PLAYER = 'b'.repeat(32);

describe('InMemorySessionStore', () => {
  it('creates, gets and removes sessions', () => {
    const store = new InMemorySessionStore();
    const session = store.create('ABCD', KEY, 'tv1', 0);
    expect(session).toMatchObject({
      code: 'ABCD',
      stage: 'lobby',
      pip: 'sleep',
      tvSocketId: 'tv1',
    });
    expect(store.get('ABCD')).toBe(session);
    store.remove('ABCD');
    expect(store.get('ABCD')).toBeUndefined();
  });

  it('sweeps only idle sessions and returns their codes', () => {
    const store = new InMemorySessionStore();
    store.create('AAAA', KEY, 'tv1', 0).tvSocketId = null;
    store.create('BBBB', KEY, 'tv2', 0);
    expect(store.sweep(LIMITS.sessionIdleMs)).toEqual(['AAAA']);
    expect(store.get('BBBB')).toBeDefined();
  });
});

describe('isIdle', () => {
  it('is false while a TV or a player is online, and until the idle time has passed', () => {
    const store = new InMemorySessionStore();
    const session = store.create('ABCD', KEY, 'tv1', 0);
    const later = LIMITS.sessionIdleMs;
    expect(isIdle(session, later)).toBe(false);
    session.tvSocketId = null;
    joinPlayer(session, { playerId: PLAYER, name: 'Sam', socketId: 'p1' }, 0);
    expect(isIdle(session, later)).toBe(false);
    leaveSocket(session, PLAYER, 'p1', 0);
    expect(isIdle(session, later - 1)).toBe(false);
    expect(isIdle(session, later)).toBe(true);
  });
});

describe('Parallel Stories and the end of a session', () => {
  it('keeps branches on the session only, so they go when the session ends', () => {
    const store = new InMemorySessionStore();
    const session = store.create('WXYZ', 'k'.repeat(32), 'tv-1', 0);
    session.branches.push({
      id: 'b1',
      ownerId: 'p1',
      ownerName: 'Maya',
      contentId: 'film',
      splitSec: 10,
      inherited: [],
      premise: 'What if?',
      changes: ['What if?'],
      events: [],
      open: true,
      createdAt: 0,
    });
    session.tvSocketId = null; // everyone has gone
    expect(store.sweep(LIMITS.sessionIdleMs + 1)).toEqual(['WXYZ']);
    expect(store.get('WXYZ')).toBeUndefined();
    expect(store.all()).toEqual([]);
  });
});
