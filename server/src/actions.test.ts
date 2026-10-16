import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_TIMEOUT_MS, confirmTimerKey, handleApplied, handleInput } from './actions.js';
import { createFakeTimers } from './core/fake-timers.js';
import { createMemoryJournal, pseudonym } from './core/journal.js';
import { joinPlayer, pickHost } from './core/players.js';
import { goToLobby, type FlowDeps, type PipServer } from './flow.js';
import { createSession, type Session } from './sessions.js';
import type { InputSource, PipInput, PipInputEvent, TvCommand } from './shared/protocol.js';

const HOST = '1'.repeat(32);
const GUEST = '2'.repeat(32);

function setup() {
  let now = 1_000_000;
  const toTv: TvCommand[] = [];
  const emit = (event: string, payload: unknown) => {
    if (event === 'tv:command') toTv.push(payload as TvCommand);
  };
  const io = { to: () => ({ emit, except: () => ({ emit }) }) } as unknown as PipServer;
  const complete = vi.fn(() => Promise.reject(new Error('no model calls for actions')));
  const journal = createMemoryJournal(() => now);
  const timers = createFakeTimers();
  const deps: FlowDeps = {
    io,
    films: [],
    publicUrl: 'http://x',
    timers,
    now: () => now,
    model: { complete },
    aiEnabled: true,
    journal,
    logText: false,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  const session: Session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
  joinPlayer(session, { playerId: HOST, name: 'Mom', socketId: 's1' }, 0);
  joinPlayer(session, { playerId: GUEST, name: 'Leo', socketId: 's2' }, 0);
  pickHost(session, 0);
  session.stage = 'watch';
  session.contentId = 'film';
  session.playback = {
    contentId: 'film',
    positionSec: 10,
    durationSec: 100,
    paused: false,
    ended: false,
  };
  let n = 0;
  const input = (event: PipInputEvent, source: InputSource = 'pad_touch'): PipInput => {
    n += 1;
    return { id: `input-${n}-xyz`, source, at: now, event };
  };
  return {
    deps,
    session,
    toTv,
    complete,
    journal,
    timers,
    input,
    advance: (ms: number) => (now += ms),
  };
}

describe('handleInput', () => {
  it('turns play/pause into the right TV command without calling a model', () => {
    const t = setup();
    expect(handleInput(t.session, HOST, t.input({ type: 'media.playPause' }), t.deps)).toEqual({
      ok: true,
      action: 'pause',
    });
    expect(t.toTv[0]).toMatchObject({ type: 'pause' });
    expect(t.complete).not.toHaveBeenCalled();
  });

  it('gives the same command whichever adapter sent the input', () => {
    const t = setup();
    handleInput(t.session, HOST, t.input({ type: 'media.seekRelative', seconds: 10 }), t.deps);
    handleInput(
      t.session,
      HOST,
      t.input({ type: 'media.seekRelative', seconds: 10 }, 'touchwheel_proto'),
      t.deps,
    );
    handleInput(
      t.session,
      HOST,
      t.input({ type: 'media.seekRelative', seconds: 10 }, 'pad_voice'),
      t.deps,
    );
    expect(
      t.toTv.map((c) => ({ type: c.type, deltaSec: 'deltaSec' in c ? c.deltaSec : null })),
    ).toEqual([
      { type: 'seek', deltaSec: 10 },
      { type: 'seek', deltaSec: 10 },
      { type: 'seek', deltaSec: 10 },
    ]);
  });

  it('refuses a resent input and a stale one, so nothing happens twice', () => {
    const t = setup();
    const once = t.input({ type: 'media.pause' });
    expect(handleInput(t.session, HOST, once, t.deps).ok).toBe(true);
    expect(handleInput(t.session, HOST, once, t.deps)).toEqual({ ok: false, reason: 'duplicate' });
    const old = { ...t.input({ type: 'media.play' }), at: 0 };
    expect(handleInput(t.session, HOST, old, t.deps)).toEqual({ ok: false, reason: 'stale' });
    expect(t.toTv).toHaveLength(1);
  });

  it("keeps the film's controls for the host, but anyone can open Pip", () => {
    const t = setup();
    expect(handleInput(t.session, GUEST, t.input({ type: 'media.pause' }), t.deps)).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    expect(handleInput(t.session, GUEST, t.input({ type: 'pip.invoke' }), t.deps)).toEqual({
      ok: true,
      action: 'pip.open',
    });
    expect(t.session.assistant).toEqual({ open: true, byId: GUEST });
    handleInput(t.session, GUEST, t.input({ type: 'pip.dismiss' }), t.deps);
    expect(t.session.assistant.open).toBe(false);
  });

  it('hides Pip again when the host goes back to the films', () => {
    const t = setup();
    handleInput(t.session, GUEST, t.input({ type: 'pip.invoke' }), t.deps);
    goToLobby(t.session, t.deps);
    expect(t.session.assistant).toEqual({ open: false, byId: null });
  });

  it('keeps volume and brightness in range and sends the level to the TV', () => {
    const t = setup();
    handleInput(t.session, HOST, t.input({ type: 'media.volumeDelta', delta: 0.5 }), t.deps);
    handleInput(t.session, HOST, t.input({ type: 'media.brightnessDelta', delta: -1 }), t.deps);
    expect(t.session.device).toMatchObject({ volume: 1, brightness: 0.3 });
    expect(t.toTv.map((c) => c.type)).toEqual(['volume', 'brightness']);
  });

  it('counts an action as done only when the TV confirms it, and as failed after 3 s', () => {
    const t = setup();
    const pause = t.input({ type: 'media.pause' });
    handleInput(t.session, HOST, pause, t.deps);
    expect(t.session.device.lastAction).toEqual({ id: pause.id, action: 'pause', ok: null });
    expect(handleApplied(t.session, { id: pause.id, ok: true }, t.deps)).toBe(true);
    expect(t.session.device.lastAction?.ok).toBe(true);

    const play = t.input({ type: 'media.play' });
    handleInput(t.session, HOST, play, t.deps);
    const key = confirmTimerKey(t.session.code, play.id);
    expect(t.timers.pending.get(key)?.ms).toBe(CONFIRM_TIMEOUT_MS);
    t.timers.fire(key);
    expect(t.session.device.lastAction).toEqual({ id: play.id, action: 'play', ok: false });
    expect(t.journal.events.map((e) => e.event_type)).toContain('action.failed');
  });

  it('refuses media while no film is on, and when the TV is gone', () => {
    const t = setup();
    t.session.stage = 'lobby';
    expect(handleInput(t.session, HOST, t.input({ type: 'media.pause' }), t.deps)).toEqual({
      ok: false,
      reason: 'not-watching',
    });
    t.session.stage = 'watch';
    t.session.tvSocketId = null;
    expect(handleInput(t.session, HOST, t.input({ type: 'media.pause' }), t.deps)).toEqual({
      ok: false,
      reason: 'no-tv',
    });
  });

  it('simulates lights honestly: confirmed at once, recorded as simulated', () => {
    const t = setup();
    expect(
      handleInput(t.session, HOST, t.input({ type: 'ambient.set', scene: 'movie' }), t.deps),
    ).toEqual({
      ok: true,
      action: 'ambient.movie',
    });
    expect(t.session.device.ambient).toBe('movie');
    expect(t.journal.events.at(-1)).toMatchObject({ source: 'lights_simulated' });
  });

  it('journals inputs with a pseudonym, never the player id or a name', () => {
    const t = setup();
    handleInput(t.session, HOST, t.input({ type: 'media.pause' }), t.deps);
    const first = t.journal.events[0];
    expect(first).toMatchObject({
      schema_version: 1,
      event_type: 'media.pause',
      subject_id: pseudonym(HOST),
      session_id: t.session.journalId,
      source: 'pad_touch',
    });
    expect(JSON.stringify(t.journal.events)).not.toContain(HOST);
    expect(JSON.stringify(t.journal.events)).not.toContain('Mom');
  });
});
