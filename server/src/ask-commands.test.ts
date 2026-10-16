import { describe, expect, it, vi } from 'vitest';
import { askCommand } from './ask-commands.js';
import { createFakeTimers } from './core/fake-timers.js';
import { joinPlayer, pickHost, type Player } from './core/players.js';
import type { FlowDeps, PipServer } from './flow.js';
import { LINES } from './lines.js';
import { createSession, type Session } from './sessions.js';
import type { PipSay, TvCommand } from './shared/protocol.js';

const HOST = '1'.repeat(32);
const GUEST = '2'.repeat(32);

function setup() {
  const toTv: TvCommand[] = [];
  const said: { to: string; say: PipSay }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        if (event === 'tv:command') toTv.push(payload as TvCommand);
        if (event === 'pip:say') said.push({ to: room, say: payload as PipSay });
      },
      except: () => ({ emit: () => undefined }),
    }),
  } as unknown as PipServer;
  const complete = vi.fn(() => Promise.reject(new Error('commands never call a model')));
  const deps: FlowDeps = {
    io,
    films: [],
    publicUrl: 'http://x',
    timers: createFakeTimers(),
    now: () => 1_000_000,
    model: { complete },
    aiEnabled: true,
    logText: false,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  const session: Session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
  joinPlayer(session, { playerId: HOST, name: 'Mom', socketId: 'pad-mom' }, 0);
  joinPlayer(session, { playerId: GUEST, name: 'Leo', socketId: 'pad-leo' }, 0);
  pickHost(session, 0);
  session.stage = 'watch';
  session.tvSocketId = 'tv-socket';
  session.contentId = 'film';
  session.playback = {
    contentId: 'film',
    positionSec: 10,
    durationSec: 100,
    paused: false,
    ended: false,
  };
  const player = (id: string) => session.players.get(id) as Player;
  return { deps, session, toTv, said, complete, mom: player(HOST), leo: player(GUEST) };
}

describe('askCommand', () => {
  it('runs a typed "pause" as the host command, replies only to the asker, with no model', async () => {
    const t = setup();
    const handled = askCommand(t.session, t.mom, 'Pause the film please', t.deps);
    expect(handled?.result).toEqual({ ok: true });
    expect(t.said).toEqual([]); // the reply comes after the ack
    await handled?.done;
    expect(t.toTv).toEqual([expect.objectContaining({ type: 'pause' })]);
    expect(t.said).toEqual([
      { to: 'pad-mom', say: expect.objectContaining({ text: LINES.pause, source: 'template' }) },
    ]);
    expect(t.complete).not.toHaveBeenCalled();
  });

  it('turns "go back 30 seconds" into a 30 s seek back', async () => {
    const t = setup();
    await askCommand(t.session, t.mom, 'go back 30 seconds', t.deps)?.done;
    expect(t.toTv[0]).toMatchObject({ type: 'seek', deltaSec: -30 });
    expect(t.said[0]?.say.text).toBe(LINES.seekBack(30));
  });

  it('refuses a media command from a guest and names the host', async () => {
    const t = setup();
    await askCommand(t.session, t.leo, 'pause', t.deps)?.done;
    expect(t.toTv).toEqual([]);
    expect(t.said).toEqual([
      { to: 'pad-leo', say: expect.objectContaining({ text: LINES.onlyHost('Mom') }) },
    ]);
  });

  it('closes Pip on "never mind", for anyone', async () => {
    const t = setup();
    t.session.assistant = { open: true, byId: GUEST };
    await askCommand(t.session, t.leo, 'never mind', t.deps)?.done;
    expect(t.session.assistant).toEqual({ open: false, byId: null });
    expect(t.said[0]?.say.text).toBe(LINES.dismissed);
  });

  it('asks what to stop for a bare "stop", with choices the rules route when tapped', async () => {
    const t = setup();
    await askCommand(t.session, t.mom, 'stop', t.deps)?.done;
    expect(t.toTv).toEqual([]);
    expect(t.said[0]?.say).toMatchObject({
      text: LINES.whatToStop,
      clarify: ['Pause the film', 'Hide Pip'],
    });
    await askCommand(t.session, t.mom, 'Pause the film', t.deps)?.done;
    expect(t.toTv).toEqual([expect.objectContaining({ type: 'pause' })]);
  });

  it('leaves questions to Ask Pip, and refuses commands outside watch', () => {
    const t = setup();
    expect(askCommand(t.session, t.mom, 'Why did he stop?', t.deps)).toBeNull();
    t.session.stage = 'lobby';
    expect(askCommand(t.session, t.mom, 'play', t.deps)?.result).toEqual({
      ok: false,
      reason: 'not-watching',
    });
  });
});
