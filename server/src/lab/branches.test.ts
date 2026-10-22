// Virtual Pip Lab: Parallel Stories end to end on Tears of Steel's reviewed timeline, over real
// sockets. A viewer asks "what if" mid-film; the branch splits there; follow-ups stay in it; the TV
// gets the comparison on pause, cut at what was watched; Back to the film returns to canon.
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFakeModel, type CompleteInput } from '../core/ai/model.js';
import { loadFilms } from '../film/content.js';
import { loadTimeline } from '../film/timeline-file.js';
import { LINES } from '../lines.js';
import { startLab, waitFor, type Lab } from './harness.js';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const film = loadFilms(CONTENT).find((f) => f.id === 'tears-of-steel');
if (!film) throw new Error('content/tears-of-steel.json is missing');
const timeline = loadTimeline(`${CONTENT}/timelines`, film);

let lab: Lab | null = null;
afterEach(async () => {
  await lab?.stop();
  lab = null;
});

/** A model that writes branch events as JSON, and records every prompt it was shown. */
function storyteller() {
  const prompts: CompleteInput[] = [];
  let n = 0;
  return {
    prompts,
    model: createFakeModel((input: CompleteInput) => {
      prompts.push(input);
      n += 1;
      return JSON.stringify({
        events: [
          `Pip's event ${n}a: Thom stays on the bridge.`,
          `Pip's event ${n}b: they talk.`,
          `Pip's event ${n}c: the sun sets.`,
        ],
      });
    }),
  };
}

async function watching(current: Lab) {
  const tv = current.tv();
  const code = await waitFor(() => tv.code, 'the TV code');
  const maya = current.pad('Maya');
  const leo = current.pad('Leo');
  expect((await maya.join(code)).ok).toBe(true);
  expect((await leo.join(code)).ok).toBe(true);
  maya.host({ type: 'watch', contentId: 'tears-of-steel' });
  await waitFor(() => current.session()?.playback, 'the first playback report');
  return { tv, maya, leo };
}

async function ask(current: Lab, pad: ReturnType<Lab['pad']>, question: string) {
  current.clock.advance(15_000); // past the per-player ask interval
  const before = pad.mine().length;
  expect(await pad.ask(question)).toEqual({ ok: true });
  return waitFor(() => pad.mine()[before], `Pip's reply to "${question}"`);
}

describe('Virtual Pip Lab: Parallel Stories', () => {
  it('branches at the moment asked, explores it, compares on pause, and returns to the film', async () => {
    const { model, prompts } = storyteller();
    lab = await startLab({ film, timeline, model });
    const { tv, maya, leo } = await watching(lab);
    tv.scrubTo(230);
    tv.pauseHere(); // the viewer paused to ask, so the split is exactly here
    await waitFor(
      () => (lab?.session()?.playback?.paused ? true : null),
      'the film paused at 3:50',
    );

    const created = await ask(lab, maya, 'What if Thom never left Celia?');
    expect(created.source).toBe('imagined');
    const map = await waitFor(() => maya.branches.at(-1)?.branch, 'the branch map');
    expect(map).toMatchObject({ ownerId: maya.playerId, splitSec: 230, open: true });
    expect(map.pip).toHaveLength(3);
    expect(map.after).toEqual([]);
    // The prompt carried canon up to the split only.
    for (const fact of timeline.facts.filter((f) => f.revealSec > 230))
      expect(prompts[0]?.user).not.toContain(fact.text);

    // "What happens next?" stays in Pip's version instead of "No spoilers".
    const next = await ask(lab, maya, 'What happens next?');
    expect(next.source).toBe('imagined');
    expect(next.text).not.toBe(LINES.noFuture);
    await waitFor(
      () => (maya.branches.at(-1)?.branch?.pip.length ?? 0) >= 6 || null,
      'more events',
    );
    // ...and for someone not exploring a branch, it is still "No spoilers".
    const leoNext = await ask(lab, leo, 'What happens next?');
    expect(leoNext.text).toBe(LINES.noFuture);

    // Asking for the real ending mid-film is about the film: no spoilers, branch or not.
    const real = await ask(lab, maya, 'How does the real film end?');
    expect(real.text).toBe(LINES.noFuture);

    // Watch on past the old man's reveal, then pause: the comparison grows to what was watched.
    if (tv.playback) tv.playback.paused = false; // play on
    tv.scrubTo(300);
    await waitFor(() => (lab?.session()?.playback?.paused === false ? true : null), 'playing');
    const seen = tv.branches.length;
    tv.pauseHere();
    const compared = await waitFor(() => tv.branches[seen]?.branch, 'the comparison on pause');
    expect(compared.after.length).toBeGreaterThan(0);
    expect(compared.after.every((line) => line.atSec <= 300)).toBe(true);
    expect(compared.unseenAfter).toBeGreaterThan(0);
    expect(JSON.stringify(compared)).not.toMatch(/Celia's voice|overwrite complete/i);

    const split = await ask(lab, maya, 'Where did it split?');
    expect(split.text).toMatch(/split at 3:50/);

    // Back to the film: the branch closes and questions go to the film again.
    maya.backToFilm();
    await waitFor(() => (maya.branches.at(-1)?.branch === null ? true : null), 'the branch closed');
    const after = await ask(lab, maya, 'What happens next?');
    expect(after.text).toBe(LINES.noFuture);
    expect(lab.session()?.branches.every((b) => !b.open)).toBe(true);
  });
});
