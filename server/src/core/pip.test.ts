import { describe, expect, it, vi } from 'vitest';
import { createFakeTimers } from './fake-timers.js';
import { hostTimerKey, startHostGrace } from './pairing.js';
import { pipTimerKey, restingPip, setPip, type PipHolder } from './pip.js';
import { joinPlayer, leaveSocket, pickHost } from './players.js';
import { LIMITS } from '../shared/protocol.js';

function holder(): PipHolder {
  return { code: 'ABCD', pip: 'sleep', players: new Map(), hostId: null };
}

describe('setPip', () => {
  it('sets the state, broadcasts and returns to rest after the given time', () => {
    const h = holder();
    joinPlayer(h, { playerId: 'a'.repeat(32), name: 'Sam', socketId: 's' }, 0);
    const timers = createFakeTimers();
    const broadcast = vi.fn();
    setPip(h, 'talking', { timers, broadcast, now: () => 0 }, 8000);
    expect(h.pip).toBe('talking');
    expect(broadcast).toHaveBeenCalledOnce();
    expect(timers.pending.get(pipTimerKey('ABCD'))?.ms).toBe(8000);
    timers.fire(pipTimerKey('ABCD'));
    expect(h.pip).toBe('idle');
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it('clears an earlier return-to-rest timer', () => {
    const h = holder();
    const timers = createFakeTimers();
    setPip(h, 'talking', { timers, broadcast: () => {}, now: () => 0 }, 8000);
    setPip(h, 'thinking', { timers, broadcast: () => {}, now: () => 0 });
    expect(timers.pending.has(pipTimerKey('ABCD'))).toBe(false);
  });

  it('rests asleep when nobody is online', () => {
    expect(restingPip(holder())).toBe('sleep');
  });
});

describe('startHostGrace', () => {
  it('passes the host on after the grace period and broadcasts', () => {
    const h = holder();
    joinPlayer(h, { playerId: 'a'.repeat(32), name: 'A', socketId: 'sa' }, 0);
    joinPlayer(h, { playerId: 'b'.repeat(32), name: 'B', socketId: 'sb' }, 1);
    pickHost(h, 1);
    leaveSocket(h, 'a'.repeat(32), 'sa', 1000);
    const timers = createFakeTimers();
    const broadcast = vi.fn();
    let now = 1000;
    startHostGrace(h, { timers, broadcast, now: () => now });
    expect(timers.pending.get(hostTimerKey('ABCD'))?.ms).toBe(LIMITS.hostGraceMs + 100);
    now += LIMITS.hostGraceMs + 100;
    timers.fire(hostTimerKey('ABCD'));
    expect(h.hostId).toBe('b'.repeat(32));
    expect(broadcast).toHaveBeenCalledOnce();
  });
});
