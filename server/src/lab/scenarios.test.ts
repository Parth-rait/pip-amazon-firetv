// Virtual Pip Lab scenarios: the real server, real sockets, a fake TV and pads, injected faults.
// Ported from the cloud session's lab (claude/pip-vnext-core) to protocol v5: inputs are PipInputs,
// the TV confirms each command with tv:applied, and Pip opens and closes through pip.invoke and
// pip.dismiss.
import { io as connect } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIRM_TIMEOUT_MS, confirmTimerKey } from '../actions.js';
import { createFakeModel, type CompleteInput } from '../core/ai/model.js';
import { hostTimerKey } from '../core/pairing.js';
import { LINES } from '../lines.js';
import { LIMITS, type InputSource } from '../shared/protocol.js';
import { labId } from './fake-pad.js';
import { startLab, waitFor, type Lab } from './harness.js';
import { failingModel, heldModel, leakyModel, malformedModel } from './models.js';

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

/** A model that counts its calls and always says the same thing. */
function countingModel(reply = 'ANSWER: Should not be asked.') {
  const calls: CompleteInput[] = [];
  return {
    model: createFakeModel((input: CompleteInput) => {
      calls.push(input);
      return reply;
    }),
    calls,
  };
}

describe('Virtual Pip Lab', () => {
  it('keeps the default watch path quiet: Pip closed, no kids games, no unrequested replies', async () => {
    lab = await startLab();
    const { tv, host, guest } = await watching(lab);
    const view = await waitFor(
      () => tv.latest()?.stage === 'watch' && tv.latest(),
      'watch on the TV',
    );
    expect(view.assistant).toEqual({ open: false, byId: null });
    expect(view.kidsMode).toBe(false);
    expect(view.quizUnlocked).toBe(0);
    expect([...tv.says, ...host.says, ...guest.says]).toEqual([]);
  });

  it('opens Pip, answers from the timeline with the model, and any player closes it', async () => {
    lab = await startLab();
    const { tv, host, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    expect(await guest.input({ type: 'pip.invoke' }, 'pad_touch')).toMatchObject({ ok: true });
    await waitFor(() => tv.latest()?.assistant.open, 'Pip open on the TV');
    expect(await guest.ask('What did the owl say about the lantern?')).toEqual({ ok: true });
    const say = await waitFor(() => guest.mine()[0], 'the reply');
    expect(say).toMatchObject({ askedByName: 'Mia', source: 'ai' });
    expect(say.text).toContain('belongs to someone');
    expect(await waitFor(() => tv.says[0], 'the reply on the TV')).toEqual(say);
    expect(host.mine()).toEqual([]);
    expect(await host.input({ type: 'pip.dismiss' }, 'pad_touch')).toMatchObject({ ok: true });
    await waitFor(() => tv.latest()?.assistant.open === false, 'Pip closed');
  });

  it('shows a command as done only after the TV confirms it', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    expect(await host.input({ type: 'media.pause' }, 'pad_touch')).toEqual({
      ok: true,
      action: 'pause',
    });
    const done = await waitFor(
      () => host.latest()?.device.lastAction?.ok === true && host.latest()?.device.lastAction,
      'confirmed',
    );
    expect(done.action).toBe('pause');
    expect(tv.commands.map((c) => c.type)).toEqual(['pause']);
    expect(lab.journal.some((e) => e.event_type === 'action.confirmed')).toBe(true);
  });

  it('reports a failure when the TV never answers, and when it says it could not', async () => {
    lab = await startLab();
    const { tv, host, code } = await watching(lab);
    tv.ignoreCommands = true;
    const id = labId('in');
    await host.input({ type: 'media.seekRelative', seconds: 10 }, 'pad_touch', id);
    await waitFor(() => host.latest()?.device.lastAction?.ok === null, 'sent, not confirmed');
    expect(lab.timers.pending.get(confirmTimerKey(code, id))?.ms).toBe(CONFIRM_TIMEOUT_MS);
    lab.timers.fire(confirmTimerKey(code, id));
    await waitFor(() => host.latest()?.device.lastAction?.ok === false, 'failed after the timeout');
    tv.ignoreCommands = false;
    tv.failCommands = true;
    await host.input({ type: 'media.pause' }, 'pad_touch');
    await waitFor(
      () =>
        host.latest()?.device.lastAction?.action === 'pause' &&
        host.latest()?.device.lastAction?.ok === false,
      'failed by the TV',
    );
    const failed = lab.journal.filter((e) => e.event_type === 'action.failed');
    expect(failed.map((e) => e.data.detail)).toEqual(['timeout', 'fault']);
  });

  it('applies a repeated input id once, so a double tap seeks once', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    const id = labId('in');
    const event = { type: 'media.seekRelative', seconds: 10 } as const;
    expect(await host.input(event, 'pad_touch', id)).toMatchObject({ ok: true });
    expect(await host.input(event, 'pad_touch', id)).toEqual({ ok: false, reason: 'duplicate' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tv.commands).toHaveLength(1);
  });

  it('refuses a stale input, so a tap replayed after a reconnect does not act', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    const old = { id: labId('in'), source: 'pad_touch' as const, at: lab.clock.now() };
    lab.clock.advance(LIMITS.inputMaxAgeMs + 1);
    const result = await host.socket.emitWithAck('pad:input', {
      ...old,
      event: { type: 'media.pause' },
    });
    expect(result).toEqual({ ok: false, reason: 'stale' });
    expect(tv.commands).toEqual([]);
  });

  it('sends the same command whichever adapter the input came from', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    const sources: InputSource[] = [
      'pad_touch',
      'pad_voice',
      'touchwheel_proto',
      'capacitive_button_proto',
      'simulator',
    ];
    for (const source of sources) {
      await host.input({ type: 'media.seekRelative', seconds: -10 }, source);
    }
    await waitFor(() => tv.commands.length === sources.length, 'every command');
    expect(new Set(tv.commands.map((c) => JSON.stringify({ ...c, id: '' }))).size).toBe(1);
    const sourced = lab.journal.filter((e) => e.event_type === 'media.seekRelative');
    expect(sourced.map((e) => e.source)).toEqual(sources);
  });

  it('runs typed commands without a model, and only for the host', async () => {
    const counted = countingModel();
    lab = await startLab({ model: counted.model });
    const { tv, host, guest } = await watching(lab);
    expect(await host.ask('pause please')).toEqual({ ok: true });
    await waitFor(() => tv.commands.length === 1, 'the pause');
    expect(await waitFor(() => host.mine()[0], 'the action line')).toMatchObject({
      text: LINES.pause,
    });
    await guest.ask('rewind 30 seconds');
    expect(await waitFor(() => guest.mine()[0], 'the refusal')).toMatchObject({
      text: LINES.onlyHost('Sam'),
    });
    expect(tv.commands).toHaveLength(1);
    expect(tv.says).toEqual([]); // command replies stay on the asker's pad
    expect(counted.calls).toEqual([]);
  });

  it('never shows a leak from a model that knows the ending', async () => {
    lab = await startLab({
      model: leakyModel('The lantern belongs to Moss the badger, the lighthouse keeper.'),
    });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 30);
    await guest.ask('Whose lantern is that?');
    const say = await waitFor(() => tv.says[0], 'the reply on the TV');
    expect(say.text).not.toMatch(/Moss|badger|lighthouse|keeper/i);
    expect(say.source).toBe('template');
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
    const say = await waitFor(() => guest.mine()[0], 'the reply');
    expect(say.text).toBe(LINES.unparsed);
    expect(say.text).not.toMatch(/shines|lighthouse/);
  });

  it('answers questions about the future with the fixed line, without the model', async () => {
    const counted = countingModel();
    lab = await startLab({ model: counted.model });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('What happens at the end?');
    expect(await waitFor(() => guest.mine()[0], 'the reply')).toMatchObject({
      text: LINES.noFuture,
    });
    expect(counted.calls).toEqual([]);
  });

  it('falls back on a model failure or a broken reply, and frees the ask lock', async () => {
    lab = await startLab({ model: failingModel() });
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('Is the lake cold?');
    expect(await waitFor(() => guest.mine()[0], 'the fallback')).toMatchObject({
      text: LINES.modelFailed,
      source: 'template',
    });
    expect(lab.session()?.asking).toBe(false);
    await lab.stop();
    lab = await startLab({ model: malformedModel() });
    const second = await watching(lab);
    await seekTv(lab, second.tv, 45);
    await second.guest.ask('Is the lake cold?');
    expect(await waitFor(() => second.guest.mine()[0], 'the not-sure line')).toMatchObject({
      text: LINES.unparsed,
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
    expect(await host.ask('pause')).toEqual({ ok: true });
    expect(await host.input({ type: 'media.volumeDelta', delta: -0.1 }, 'pad_touch')).toMatchObject(
      {
        ok: true,
      },
    );
    await waitFor(() => tv.commands.length === 2, 'the commands during thinking');
    model.release();
    await waitFor(() => guest.mine()[0], 'the reply');
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
    expect(lab.session()?.asking).toBe(false);
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
    expect(session.playback?.positionSec).toBe(40);
  });

  it('ignores playback and confirmations from a stale TV socket after the TV reconnects', async () => {
    lab = await startLab();
    const { tv } = await watching(lab);
    await seekTv(lab, tv, 40);
    const stale = tv.socket;
    tv.reconnect();
    await waitFor(() => lab?.session()?.tvSocketId === tv.socket.id, 'the new TV socket');
    stale.connect();
    await waitFor(() => stale.connected, 'the stale socket back');
    stale.emit('tv:playback', {
      contentId: 'lantern-fox',
      positionSec: 90,
      durationSec: 96,
      paused: false,
      ended: false,
    });
    stale.emit('tv:applied', { id: 'not-a-command-x', ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lab.session()?.playback?.positionSec).toBe(40);
    stale.close();
  });

  it('hands the host role on after the grace period', async () => {
    lab = await startLab();
    const { host, guest, code } = await watching(lab);
    host.close();
    await waitFor(() => lab?.timers.pending.has(hostTimerKey(code)), 'the grace timer');
    lab.clock.advance(LIMITS.hostGraceMs + 200);
    lab.timers.fire(hostTimerKey(code));
    await waitFor(() => guest.latest()?.hostId === guest.playerId, 'Mia as host');
  });

  it('drops malformed messages without stopping the server', async () => {
    lab = await startLab();
    const { code } = await watching(lab);
    const raw = connect(lab.url, { forceNew: true });
    await waitFor(() => raw.connected, 'a raw socket');
    raw.emit('pad:ask', { text: 'no ack' });
    const bad = await raw.timeout(1000).emitWithAck('pad:input', { id: 'x', event: {} });
    expect(bad).toEqual({ ok: false, reason: 'invalid' });
    raw.emit('tv:applied', 'garbage');
    raw.emit('pad:host', { type: 'explode' });
    raw.emit('tv:playback', { positionSec: 'soon' });
    const health = await fetch(`${lab.url}/health`);
    expect(health.ok).toBe(true);
    expect(lab.session()?.code).toBe(code);
    raw.close();
  });

  it('lets a confident typed judgement offer command choices, but never run one', async () => {
    const judge = {
      name: 'fake',
      judge: async (text: string) =>
        text.includes('hold it')
          ? { label: 'playback-command' as const, confidence: 0.95 }
          : { label: 'question' as const, confidence: 0.9 },
    };
    lab = await startLab({ judge });
    const { tv, host } = await watching(lab);
    await seekTv(lab, tv, 45);
    await host.ask('could you hold it a sec');
    const say = await waitFor(() => host.mine()[0], 'the choices');
    expect(say).toMatchObject({
      text: LINES.wantACommand,
      clarify: ['Pause the film', 'Play the film', 'Go back 10 seconds'],
    });
    expect(tv.commands).toEqual([]);
    lab.clock.advance(LIMITS.askMinIntervalMs);
    await host.ask('Pause the film', 'clarify');
    await waitFor(() => tv.commands.length === 1, 'the pause after the tap');
    expect(tv.commands[0]?.type).toBe('pause');
  });

  it('keeps names and question text out of the logs and the journal', async () => {
    lab = await startLab();
    const { tv, guest } = await watching(lab);
    await seekTv(lab, tv, 45);
    await guest.ask('What did the owl say about the lantern?');
    await waitFor(() => guest.mine()[0], 'the reply');
    const text = JSON.stringify([lab.logs, lab.journal]);
    expect(text).not.toContain('Mia');
    expect(text).not.toContain('Sam');
    expect(text).not.toContain('owl say');
    expect(lab.logs.some((l) => l.event === 'ask.done')).toBe(true);
  });
});
