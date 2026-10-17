// Virtual Pip Lab: hand gestures end to end. The vendored gesture-tv-remote pipeline (gesture/,
// Python) plays a trace of hand poses through its real classifier, activation, debounce and
// joysticks; each command it sends becomes a semantic input from the host's pad, and the real
// server drives the fake TV. Needs gesture/.venv (gesture/README.md); skipped without it.
import { afterEach, describe, expect, it } from 'vitest';
import { gestureEvent, type BridgeLine } from '../core/gesture.js';
import { bridgeInstalled, startBridge } from '../gesture-bridge.js';
import type { InputResult } from '../shared/protocol.js';
import type { FakePad } from './fake-pad.js';
import { startLab, waitFor, type Lab } from './harness.js';

let lab: Lab | null = null;

afterEach(async () => {
  await lab?.stop();
  lab = null;
});

async function watching(current: Lab) {
  const tv = current.tv();
  const code = await waitFor(() => tv.code, 'the TV code');
  const host = current.pad('Sam');
  expect((await host.join(code)).ok).toBe(true);
  host.host({ type: 'watch', contentId: 'lantern-fox' });
  await waitFor(() => current.session()?.playback, 'the first playback report');
  return { tv, host };
}

/** Plays a trace through the bridge; each command goes to the server as the host's input. */
async function playTrace(trace: string, host: FakePad, lab: Lab) {
  const steps: { command: string; result: InputResult; assistantOpen: boolean | undefined }[] = [];
  let queue = Promise.resolve();
  const bridge = startBridge({ mode: 'replay', trace }, (line: BridgeLine) => {
    if (line.type !== 'command') return;
    queue = queue.then(async () => {
      const result = await host.input(gestureEvent(line.command), 'hand_gesture_cam');
      steps.push({ command: line.command, result, assistantOpen: lab.session()?.assistant.open });
    });
  });
  expect(await bridge.exited).toBe(0);
  await queue;
  return steps;
}

describe.skipIf(!bridgeInstalled())('Virtual Pip Lab: hand gestures', () => {
  it('drives playback and Pip from the vendored pipeline through the same router', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    const steps = await playTrace('traces/evening.json', host, lab);

    expect(steps.map((s) => s.command)).toEqual([
      'DPAD_CENTER',
      'DPAD_RIGHT',
      'DPAD_LEFT',
      'VOLUME_UP',
      'HOME',
      'BACK',
      'DPAD_UP',
    ]);
    expect(steps.map((s) => s.result)).toEqual([
      { ok: true, action: 'pause' },
      { ok: true, action: 'seek +10' },
      { ok: true, action: 'seek -10' },
      { ok: true, action: expect.stringMatching(/^volume \d+%$/) },
      { ok: true, action: 'pip.open' },
      { ok: true, action: 'pip.close' },
      { ok: false, reason: 'unsupported' }, // browsing comes with Phase 6
    ]);
    expect(steps.find((s) => s.command === 'HOME')?.assistantOpen).toBe(true);
    expect(steps.find((s) => s.command === 'BACK')?.assistantOpen).toBe(false);

    await waitFor(() => tv.commands.length === 4, 'four TV commands');
    expect(tv.commands.map((c) => ({ ...c, id: '' }))).toEqual([
      { id: '', type: 'pause' },
      { id: '', type: 'seek', deltaSec: 10 },
      { id: '', type: 'seek', deltaSec: -10 },
      { id: '', type: 'volume', level: expect.any(Number) },
    ]);
    const confirmed = await waitFor(() => {
      const done = lab!.journal.filter((e) => e.event_type === 'action.confirmed');
      return done.length === 4 && done;
    }, 'four confirmations from the TV');
    expect(confirmed.map((e) => e.data.action)).toEqual([
      'pause',
      'seek +10',
      'seek -10',
      expect.stringMatching(/^volume/),
    ]);
    const fromGestures = lab.journal.filter((e) => e.source === 'hand_gesture_cam');
    expect(fromGestures.map((e) => e.event_type)).toEqual([
      'media.playPause',
      'media.seekRelative',
      'media.seekRelative',
      'media.volumeDelta',
      'pip.invoke',
      'pip.dismiss',
      'navigation.move',
      'input.refused',
    ]);
  }, 30_000);

  it('sends nothing when the hands never make the two-palm activation', async () => {
    lab = await startLab();
    const { tv, host } = await watching(lab);
    expect(await playTrace('traces/no-activation.json', host, lab)).toEqual([]);
    expect(tv.commands).toEqual([]);
    expect(lab.journal.filter((e) => e.source === 'hand_gesture_cam')).toEqual([]);
  }, 30_000);

  it("refuses a guest's gestures for playback, like a guest's taps", async () => {
    lab = await startLab();
    const { tv } = await watching(lab);
    const guest = lab.pad('Mia');
    expect((await guest.join(tv.code!)).ok).toBe(true);
    const steps = await playTrace('traces/evening.json', guest, lab);
    const media = steps.filter((s) => s.command.startsWith('DPAD_') || s.command.startsWith('VOL'));
    expect(media.map((s) => s.result)).toEqual([
      { ok: false, reason: 'not-allowed' },
      { ok: false, reason: 'not-allowed' },
      { ok: false, reason: 'not-allowed' },
      { ok: false, reason: 'not-allowed' },
      { ok: false, reason: 'unsupported' },
    ]);
    expect(tv.commands).toEqual([]);
  }, 30_000);
});
