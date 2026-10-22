// Virtual Pip Lab: video understanding end to end. The real server answers about Sintel from the
// timeline the pipeline generated (pipeline/timelines/sintel.json), at the position the fake TV
// reports, over real sockets. The TV scrubs forward and back; the pad asks.
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFakeModel, type CompleteInput } from '../core/ai/model.js';
import { loadFilms } from '../film/content.js';
import { loadTimeline } from '../film/timeline-file.js';
import { LINES } from '../lines.js';
import { startLab, waitFor, type Lab } from './harness.js';

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const sintel = loadFilms(CONTENT).find((f) => f.id === 'sintel');
if (!sintel) throw new Error('content/sintel.json is missing');
const GENERATED = fileURLToPath(new URL('../../pipeline/timelines', import.meta.url));
const timeline = loadTimeline(GENERATED, sintel);

let lab: Lab | null = null;
afterEach(async () => {
  await lab?.stop();
  lab = null;
});

function counting(reply = 'ANSWER: I am not sure.\nSOURCES:') {
  const calls: CompleteInput[] = [];
  return {
    calls,
    model: createFakeModel((input: CompleteInput) => {
      calls.push(input);
      return reply;
    }),
  };
}

async function watchSintel(current: Lab) {
  const tv = current.tv();
  const code = await waitFor(() => tv.code, 'the TV code');
  const pad = current.pad('Sam');
  expect((await pad.join(code)).ok).toBe(true);
  pad.host({ type: 'watch', contentId: 'sintel' });
  await waitFor(() => current.session()?.playback, 'the first playback report');
  return { tv, pad };
}

async function askAt(
  current: Lab,
  tv: Awaited<ReturnType<typeof watchSintel>>['tv'],
  pad: Awaited<ReturnType<typeof watchSintel>>['pad'],
  sec: number,
  question: string,
) {
  current.clock.advance(15_000); // a moment between questions (Pip limits how fast one player asks)
  tv.scrubTo(sec);
  await waitFor(() => current.session()?.playback?.positionSec === sec, `the film at ${sec}s`);
  const before = pad.mine().length;
  expect(await pad.ask(question)).toEqual({ ok: true });
  return waitFor(() => pad.mine()[before], `the reply at ${sec}s`);
}

describe('Virtual Pip Lab: video understanding on Sintel', () => {
  it('answers from the generated timeline at the TV position, forward and back, without spoilers', async () => {
    const { model, calls } = counting();
    lab = await startLab({ film: sintel, timeline, model, env: { TIMELINE_REVIEW: 'candidate' } });
    const { tv, pad } = await watchSintel(lab);

    const who = await askAt(lab, tv, pad, 50, 'Who is that?');
    expect(who).toMatchObject({ source: 'timeline' });
    expect(who.text).toMatch(/^A young woman with red hair/);

    const recap = await askAt(lab, tv, pad, 230, 'What just happened?');
    expect(recap.text).toContain('Goodnight, Scales.');

    // Rewind before the name is said: the same kind of question no longer gets it.
    const early = await askAt(lab, tv, pad, 200, 'Who is Scales?');
    expect(early.text).toBe(LINES.unparsed);
    const back = await askAt(lab, tv, pad, 200, 'What just happened?');
    expect(back.text).not.toContain('Scales');

    // After the part the run covered, Pip says so instead of describing older scenes as now.
    const late = await askAt(lab, tv, pad, 600, 'Who is that?');
    expect(late.text).toBe(LINES.notLookedYet);

    // Those were all answered from the timeline: no model call.
    expect(calls).toEqual([]);
  });

  it('keeps Sintel on its notes while the generated facts are unreviewed (the default policy)', async () => {
    const { model, calls } = counting('ANSWER: She is walking in the snow.');
    lab = await startLab({ film: sintel, timeline, model });
    const { tv, pad } = await watchSintel(lab);
    const reply = await askAt(lab, tv, pad, 50, 'Who is that?');
    // The notes path asks the model with the film's notes, not the generated timeline.
    expect(reply.text).not.toMatch(/^A young woman with red hair, first seen/);
    expect(calls.length).toBe(1);
    expect(calls[0]?.user).not.toContain('[ev-fr-');
  });
});
