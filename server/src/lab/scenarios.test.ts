// Virtual Pip Lab scenarios: the real server, real sockets, a fake TV and pads, injected faults.
import { io as connect } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS } from '../shared/protocol.js';
import { labId } from './fake-pad.js';
import { startLab, waitFor, type Lab } from './harness.js';
import { failingModel, groundedModel, heldModel, leakyModel, malformedModel } from './models.js';

let lab: Lab | null = null;

afterEach(async () => {
  await lab?.stop();
  lab = null;
});

/** A TV, a host (Sam) and a guest (Mia), with the lab film playing. */
async function watching(current: Lab) {
  const tv = current.tv();
  const code = await waitFor(() => tv.code, 'the TV code');
  const host = current.pad('Sam');
  const guest = current.pad('Mia');
  expect((await host.join(code)).ok).toBe(true);
  expect((await guest.join(code)).ok).toBe(true);
  host.host({ type: 'watch', contentId: 'lantern-fox' });
  await waitFor(() => current.session()?.playback, 'the first playback report');
  return { tv, host, guest, code };
}

/** Moves the film to `sec` on the TV and waits until the server knows. */
async function seekTv(current: Lab, tv: ReturnType<Lab['tv']>, sec: number): Promise<void> {
  tv.scrubTo(sec);
  await waitFor(() => current.session()?.playback?.positionSec === sec, `the film at ${sec}s`);
}

describe('Virtual Pip Lab', () => {
  it('keeps the default watch path quiet: Pip hidden, no quiz, no unrequested replies', async () => {
    lab = await startLab();
    const { tv, host, guest } = await watching(lab);
    const view = await waitFor(
      () => tv.latest()?.stage === 'watch' && tv.latest(),
      'watch on the TV',
    );
    expect(view.assist).toBeNull();
    expect(view.features.quiz).toBe(false);
    expect(view.quizUnlocked).toBe(0);
    expect(host.says).toEqual([]);
    expect(guest.says).toEqual([]);
  });

  it('asks, answers on the TV and the asker pad only, then any player dismisses', async () => {
    lab = await startLab();
    const { tv, host, guest, code } = await watching(lab);
    await seekTv(lab, tv, 45);
    expect(await guest.ask('What did the owl say about the lantern?')).toEqual({ ok: true });
    const say = await waitFor(() => guest.says[0], 'the reply');
    expect(say).toMatchObject({ kind: 'answer', source: 'ai' });
    expect(say.text).toContain('belongs to someone');
    const shown = await waitFor(
      () => tv.latest()?.assist?.phase === 'reply' && tv.latest()?.assist,
      'Pip on the TV',
    );
    expect(shown).toMatchObject({ askedByName: 'Mia', kind: 'answer' });
    expect(host.says).toEqual([]); // replies go to the asker's pads only
    host.dismiss();
    await waitFor(
      () => tv.latest()?.assist === null && lab?.session()?.assist === null,
      'Pip hidden',
    );
    expect(lab.timers.pending.has(`${code}:assist`)).toBe(false);
  });

  it('hides the reply by itself after the show time', async () => {
    lab = await startLab();
    const { tv, guest, code } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('Who is that?', 'starter');
    await waitFor(() => tv.latest()?.assist?.phase === 'reply', 'the reply');
    expect(lab.timers.pending.get(`${code}:assist`)?.ms).toBe(LIMITS.assistShowMs);
    lab.timers.fire(`${code}:assist`);
    await waitFor(() => tv.latest()?.assist === null, 'Pip hidden after the show time');
  });

  it('shows a command as done only after the TV reports it', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    host.host({ type: 'pause', commandId: labId('cmd') });
    const done = await waitFor(
      () => host.latest()?.lastAction?.status === 'done' && host.latest()?.lastAction,
      'done',
    );
    expect(done.type).toBe('pause');
    expect(tv.commands.map((c) => c.type)).toEqual(['pause']);
  });

  it('marks a command unconfirmed when the TV ignores it', async () => {
    lab = await startLab();
    const { tv, host, code } = await watching(lab);
    tv.ignoreCommands = true;
    host.host({ type: 'seek', deltaSec: 10 });
    await waitFor(() => host.latest()?.lastAction?.status === 'sent', 'sent');
    lab.timers.fire(`${code}:action`);
    await waitFor(() => host.latest()?.lastAction?.status === 'unconfirmed', 'unconfirmed');
    expect(
      lab
        .session()
        ?.journal.events()
        .some((e) => e.type === 'action.unconfirmed'),
    ).toBe(true);
  });

  it('applies a repeated commandId once, so a double tap seeks once', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    const commandId = labId('cmd');
    host.host({ type: 'seek', deltaSec: 10, commandId });
    host.host({ type: 'seek', deltaSec: 10, commandId });
    await waitFor(() => tv.commands.length === 1, 'one command');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tv.commands).toHaveLength(1);
  });

  it('routes the pad button, the touchwheel and the remote through the same command path', async () => {
    lab = await startLab();
    const { tv, host, guest } = await watching(lab);
    expect(await host.input({ kind: 'button', gesture: 'double-press' })).toMatchObject({
      ok: true,
      intent: 'pause',
    });
    expect(await host.input({ kind: 'wheel', detents: -2 })).toMatchObject({
      ok: true,
      intent: 'seek',
    });
    expect(await host.input({ kind: 'button', gesture: 'press' })).toEqual({
      ok: true,
      intent: 'invoke',
      commandId: null,
    });
    expect(await guest.input({ kind: 'wheel', detents: 2 })).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    const eventId = labId('evt');
    expect((await host.input({ kind: 'wheel', detents: 1 }, eventId)).ok).toBe(true);
    expect(await host.input({ kind: 'wheel', detents: 1 }, eventId)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    tv.pressKey('fast-forward', labId('key'));
    await waitFor(() => tv.commands.length === 4, 'four commands at the TV');
    expect(tv.commands.map((c) => (c.type === 'seek' ? `seek ${c.deltaSec}` : c.type))).toEqual([
      'pause',
      'seek -10',
      'seek 5',
      'seek 10',
    ]);
  });

  it('runs typed commands without a model, and only for the host', async () => {
    const model = heldModel(() => 'ANSWER: should not be called');
    lab = await startLab({ model });
    const { tv, host, guest } = await watching(lab);
    await host.ask('pause please');
    await waitFor(() => tv.commands.length === 1, 'the pause');
    expect(model.pending()).toBe(0);
    expect(await waitFor(() => host.says[0], 'the action line')).toMatchObject({ kind: 'action' });
    await guest.ask('rewind 30 seconds');
    expect(await waitFor(() => guest.says[0], 'the refusal')).toMatchObject({
      kind: 'refused',
      text: 'Sam has the controls, so ask them.',
    });
    expect(tv.commands).toHaveLength(1);
  });

  it('never shows a leak from a model that knows the ending', async () => {
    lab = await startLab({
      model: leakyModel('The lantern belongs to Moss the badger, the lighthouse keeper.'),
    });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 30);
    await guest.ask('Whose lantern is that?');
    const say = await waitFor(() => guest.says[0], 'the reply');
    expect(say.kind).toBe('unknown');
    const shown = await waitFor(() => tv.latest()?.assist?.text, 'the TV text');
    expect(shown).not.toMatch(/Moss|badger|lighthouse|keeper/i);
  });

  it('withholds an answer when the film was rewound while the model was thinking', async () => {
    const model = heldModel(
      () => 'ANSWER: Ember climbs the lighthouse and it shines again.\nSOURCES: f7',
    );
    lab = await startLab({ model });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 85);
    await guest.ask('Is the lake frozen?');
    await waitFor(() => model.pending() === 1, 'the model call');
    await seekTv(lab, tv, 30);
    model.release();
    const say = await waitFor(() => guest.says[0], 'the reply');
    expect(say.kind).toBe('unknown');
    expect(say.text).not.toMatch(/shines|lighthouse/);
  });

  it('falls back on a model failure or a broken reply, and frees the ask lock', async () => {
    lab = await startLab({ model: failingModel() });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('Is the lake cold?');
    expect(await waitFor(() => guest.says[0], 'the fallback')).toMatchObject({
      kind: 'fallback',
      source: 'template',
    });
    expect(lab.session()?.asking).toBe(false);
    await lab.stop();
    lab = await startLab({ model: malformedModel() });
    const second = await watching(lab);
    await seekTv(lab, second.tv, 45);
    await second.guest.ask('Is the lake cold?');
    expect(await waitFor(() => second.guest.says[0], 'the not-sure line')).toMatchObject({
      kind: 'fallback',
    });
  });

  it('answers "busy" to a second question but still runs a command while Pip thinks', async () => {
    const model = heldModel(() => 'ANSWER: I am not sure yet.\nSOURCES: none');
    lab = await startLab({ model });
    const { tv, host, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    expect(await guest.ask('Is the lake cold?')).toEqual({ ok: true });
    await waitFor(() => model.pending() === 1, 'the model call');
    expect(await host.ask('Is the owl old?')).toEqual({ ok: false, reason: 'busy' });
    // PROJECT.md 4.5 order: busy is checked before too-soon.
    expect(await guest.ask('Is it night?')).toEqual({ ok: false, reason: 'busy' });
    expect(await host.ask('pause')).toEqual({ ok: true });
    await waitFor(() => tv.commands.length === 1, 'the pause during thinking');
    model.release();
    await waitFor(() => guest.says[0], 'the reply');
  });

  it('drops a reply that lands after the host went back to the lobby', async () => {
    const model = heldModel(() => 'ANSWER: I am not sure yet.\nSOURCES: none');
    lab = await startLab({ model });
    const { tv, host, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('Is the lake cold?');
    await waitFor(() => model.pending() === 1, 'the model call');
    host.host({ type: 'lobby' });
    await waitFor(() => tv.latest()?.stage === 'lobby', 'the lobby');
    model.release();
    await waitFor(() => lab?.logs.some((l) => l.event === 'ask.dropped'), 'the drop');
    expect(guest.says).toEqual([]);
    expect(lab.session()?.assist).toBeNull();
  });

  it('survives a server restart mid-film: the TV keeps its code and the pads rejoin', async () => {
    lab = await startLab();
    const { tv, code } = await watching(lab);
    await seekTv(lab, tv, 40);
    await lab.restart();
    const session = await waitFor(
      () => {
        const s = lab?.session();
        return (
          s &&
          s.stage === 'watch' &&
          [...s.players.values()].filter((p) => p.socketIds.size > 0).length === 2 &&
          s
        );
      },
      'the restored session',
      4000,
    );
    expect(session.code).toBe(code);
    expect(session.contentId).toBe('lantern-fox');
  });

  it('ignores playback from a stale TV socket after the TV reconnects', async () => {
    lab = await startLab();
    const { tv } = await watching(lab);
    await seekTv(lab, tv, 40);
    const stale = tv.socket;
    tv.reconnect();
    await waitFor(() => lab?.session()?.tvSocketId === tv.socket.id, 'the new TV socket');
    stale.connect();
    stale.emit('tv:playback', {
      contentId: 'lantern-fox',
      positionSec: 90,
      durationSec: 96,
      paused: false,
      ended: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lab.session()?.playback?.positionSec).toBe(40);
    stale.close();
  });

  it('hands the host role on after the grace period', async () => {
    lab = await startLab();
    const { host, guest, code } = await watching(lab);
    host.close();
    await waitFor(() => lab?.timers.pending.has(`${code}:host`), 'the grace timer');
    lab.clock.advance(LIMITS.hostGraceMs + 200);
    lab.timers.fire(`${code}:host`);
    await waitFor(() => guest.latest()?.hostId === guest.playerId, 'Mia as host');
  });

  it('drops malformed messages without stopping the server', async () => {
    lab = await startLab({ model: groundedModel() });
    const { code } = await watching(lab);
    const raw = connect(lab.url, { forceNew: true });
    await waitFor(() => raw.connected, 'a raw socket');
    raw.emit('pad:ask', { text: 'no ack' });
    const bad = await raw.timeout(1000).emitWithAck('pad:input', { v: 2, eventId: 'x', input: {} });
    expect(bad).toEqual({ ok: false, reason: 'invalid' });
    raw.emit('tv:input', 'garbage');
    raw.emit('pad:assist', { type: 'explode' });
    const health = await fetch(`${lab.url}/health`);
    expect(health.ok).toBe(true);
    expect(lab.session()?.code).toBe(code);
    raw.close();
  });

  it('keeps names and question text out of the logs', async () => {
    lab = await startLab();
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('What did the owl say about the lantern?');
    await waitFor(() => guest.says[0], 'the reply');
    const text = JSON.stringify(lab.logs);
    expect(text).not.toContain('Mia');
    expect(text).not.toContain('Sam');
    expect(text).not.toContain('owl say');
    expect(lab.logs.some((l) => l.event === 'ask.done')).toBe(true);
  });
});
