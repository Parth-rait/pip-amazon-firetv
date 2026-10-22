// Virtual Pip Lab: "While you were away". A viewer locks their pad (or loses it) while the film
// plays on; when they come back, their pad alone gets what they missed, and nothing after now.
// A late joiner gets the story so far. On Sintel's reviewed timeline, over real sockets.
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFilms } from '../film/content.js';
import { loadTimeline } from '../film/timeline-file.js';
import { startLab, waitFor, type Lab } from './harness.js';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const sintel = loadFilms(CONTENT).find((f) => f.id === 'sintel');
if (!sintel) throw new Error('content/sintel.json is missing');
const timeline = loadTimeline(`${CONTENT}/timelines`, sintel);

let lab: Lab | null = null;
afterEach(async () => {
  await lab?.stop();
  lab = null;
});

async function watching(current: Lab) {
  const tv = current.tv();
  const code = await waitFor(() => tv.code, 'the TV code');
  const host = current.pad('Sam');
  const friend = current.pad('Mia');
  expect((await host.join(code)).ok).toBe(true);
  expect((await friend.join(code)).ok).toBe(true);
  host.host({ type: 'watch', contentId: 'sintel' });
  await waitFor(() => current.session()?.playback, 'the first playback report');
  return { tv, host, friend, code };
}

async function filmAt(current: Lab, tv: ReturnType<Lab['tv']>, sec: number) {
  tv.scrubTo(sec);
  await waitFor(() => current.session()?.playback?.positionSec === sec, `the film at ${sec}s`);
}

describe('Virtual Pip Lab: while you were away', () => {
  it('catches up only the viewer who stepped away, with nothing past now', async () => {
    lab = await startLab({ film: sintel, timeline });
    const { tv, host, friend } = await watching(lab);
    await filmAt(lab, tv, 150);
    friend.away(true);
    await waitFor(() => lab?.session()?.away[friend.playerId], 'the away mark');
    await filmAt(lab, tv, 345);
    friend.away(false);
    const missed = await waitFor(() => friend.missed[0], 'the recap');

    expect(missed).toMatchObject({
      contentId: 'sintel',
      fromSec: 150,
      toSec: 345,
      lateJoin: false,
    });
    expect(missed.items.length).toBeGreaterThan(1);
    expect(missed.items.length).toBeLessThanOrEqual(4);
    expect(missed.items.at(-1)?.text).toContain('carries him away');
    for (const item of missed.items) {
      expect(item.atSec).toBeGreaterThanOrEqual(150);
      expect(item.atSec).toBeLessThan(345);
      expect(item.text).not.toMatch(/cave|grown up|scar/i);
    }
    // The room is not interrupted: the host got nothing, and the film never paused.
    expect(host.missed).toEqual([]);
    expect(lab.session()?.playback?.paused).toBe(false);
  });

  it('gives a late joiner the story so far, and a short absence nothing', async () => {
    lab = await startLab({ film: sintel, timeline });
    const { tv, friend, code } = await watching(lab);
    await filmAt(lab, tv, 250);
    const late = lab.pad('Leo');
    expect((await late.join(code)).ok).toBe(true);
    const story = await waitFor(() => late.missed[0], 'the story so far');
    expect(story).toMatchObject({ fromSec: 0, lateJoin: true });
    expect(story.items.some((i) => /Scales/.test(i.text))).toBe(true);

    friend.away(true);
    await waitFor(() => lab?.session()?.away[friend.playerId], 'the away mark');
    await filmAt(lab, tv, 260);
    friend.away(false);
    await waitFor(() => (lab?.session()?.away[friend.playerId] ? null : true), 'the return');
    expect(friend.missed).toEqual([]);
  });

  it('remembers a pad that lost its connection and catches it up when it rejoins', async () => {
    lab = await startLab({ film: sintel, timeline });
    const { tv, friend, code } = await watching(lab);
    await filmAt(lab, tv, 470);
    friend.socket.disconnect();
    await waitFor(() => lab?.session()?.away[friend.playerId], 'the away mark');
    await filmAt(lab, tv, 560);
    friend.socket.connect();
    await friend.join(code);
    const missed = await waitFor(() => friend.missed[0], 'the recap');
    expect(missed.fromSec).toBe(470);
    expect(missed.items.some((i) => /cave/i.test(i.text))).toBe(true);
    expect(missed.items.every((i) => !/all grown up/.test(i.text))).toBe(true);
  });
});
