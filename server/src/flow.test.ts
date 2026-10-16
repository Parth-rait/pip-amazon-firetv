import { describe, expect, it, vi } from 'vitest';
import { createAnswerMemory } from './core/ai/answer-memory.js';
import { createFakeModel, type TextModel } from './core/ai/model.js';
import { createFakeTimers } from './core/fake-timers.js';
import { pipTimerKey } from './core/pip.js';
import { joinPlayer, type Player } from './core/players.js';
import type { Content } from './film/content.js';
import { askPip, goToLobby, type FlowDeps, type PipServer } from './flow.js';
import { LINES } from './lines.js';
import { createSession, type Session } from './sessions.js';
import { LIMITS, type PipSay } from './shared/protocol.js';

const film: Content = {
  id: 'test-film',
  title: 'Test',
  url: '/media/test.mp4',
  credit: 'Credit',
  durationSec: 100,
  premise: 'Premise.',
  chapters: [],
  characters: [],
  predictions: [],
  notes: [{ atSec: 0, text: 'Start.' }],
  quiz: [
    { atSec: 10, question: 'Q?', choices: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'E.' },
  ],
};

function setup(
  model: TextModel,
  options: { aiEnabled?: boolean; memory?: boolean; simpleFormat?: boolean } = {},
) {
  const said: PipSay[] = [];
  const emit = (event: string, payload: unknown) => {
    if (event === 'pip:say') said.push(payload as PipSay);
  };
  const io = { to: () => ({ emit, except: () => ({ emit }) }) } as unknown as PipServer;
  let now = 10_000;
  const timers = createFakeTimers();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const deps: FlowDeps = {
    io,
    films: [film],
    publicUrl: 'http://x',
    timers,
    now: () => now,
    model,
    aiEnabled: options.aiEnabled ?? true,
    simpleFormat: options.simpleFormat,
    memory: options.memory ? createAnswerMemory({ now: () => now }) : undefined,
    logText: false,
    log,
  };
  const session: Session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
  session.stage = 'watch';
  session.contentId = film.id;
  session.playback = {
    contentId: film.id,
    positionSec: 20,
    durationSec: 100,
    paused: true,
    ended: false,
  };
  joinPlayer(session, { playerId: '1'.repeat(32), name: 'Sam', socketId: 's1' }, 0);
  joinPlayer(session, { playerId: '2'.repeat(32), name: 'Leo', socketId: 's2' }, 0);
  const sam = session.players.get('1'.repeat(32)) as Player;
  const leo = session.players.get('2'.repeat(32)) as Player;
  return { deps, session, sam, leo, said, timers, log, advance: (ms: number) => (now += ms) };
}

describe('askPip', () => {
  it('answers, saves the answer to history and sets Pip talking for 8 s', async () => {
    const t = setup(createFakeModel('ANSWER: A bunny.\nNEXT: Why? | Where?'));
    const { result, done } = askPip(t.session, t.sam, 'Who?', 'typed', t.deps);
    expect(result).toEqual({ ok: true });
    expect(t.session.pip).toBe('thinking');
    await done;
    expect(t.said).toEqual([
      expect.objectContaining({
        askedByName: 'Sam',
        text: 'A bunny.',
        next: ['Why?', 'Where?'],
        source: 'ai',
      }),
    ]);
    expect(t.session.history).toEqual([{ atSec: 20, question: 'Who?', answer: 'A bunny.' }]);
    expect(t.session.pip).toBe('talking');
    expect(t.timers.pending.get(pipTimerKey('ABCD'))?.ms).toBe(8000);
    expect(t.session.asking).toBe(false);
  });

  it('is busy while another ask runs, and too-soon within 2 s for the same player', async () => {
    let release: (text: string) => void = () => {};
    const t = setup(createFakeModel(() => new Promise<string>((r) => (release = r))));
    const first = askPip(t.session, t.sam, 'One?', 'typed', t.deps);
    expect(askPip(t.session, t.leo, 'Two?', 'typed', t.deps).result).toEqual({
      ok: false,
      reason: 'busy',
    });
    release('ANSWER: Yes.');
    await first.done;
    t.advance(LIMITS.askMinIntervalMs - 1);
    expect(askPip(t.session, t.sam, 'Again?', 'typed', t.deps).result).toEqual({
      ok: false,
      reason: 'too-soon',
    });
    t.advance(1);
    expect(askPip(t.session, t.sam, 'Again?', 'typed', t.deps).result).toEqual({ ok: true });
  });

  it('is not-watching outside watch', () => {
    const t = setup(createFakeModel('ANSWER: Yes.'));
    t.session.stage = 'lobby';
    expect(askPip(t.session, t.sam, 'Who?', 'typed', t.deps).result).toEqual({
      ok: false,
      reason: 'not-watching',
    });
  });

  it('drops a reply that lands after the host went to the lobby', async () => {
    let release: (text: string) => void = () => {};
    const t = setup(createFakeModel(() => new Promise<string>((r) => (release = r))));
    const { done } = askPip(t.session, t.sam, 'Who?', 'typed', t.deps);
    goToLobby(t.session, t.deps);
    release('ANSWER: A bunny.');
    await done;
    expect(t.said).toEqual([]);
    expect(t.session.history).toEqual([]);
    expect(t.session.pip).toBe('idle');
  });

  it('frees the lock after a model error and says the fallback line', async () => {
    const t = setup(
      createFakeModel(() => {
        throw new Error('down');
      }),
    );
    await askPip(t.session, t.sam, 'Who?', 'typed', t.deps).done;
    expect(t.session.asking).toBe(false);
    expect(t.said[0]).toMatchObject({ text: LINES.modelFailed, source: 'template', next: [] });
    expect(t.session.history).toEqual([]);
  });

  it('says "Did you mean" for a vague question, and never twice after a pick', async () => {
    const t = setup(createFakeModel('CLARIFY: The bird? | The bunny?'));
    await askPip(t.session, t.sam, 'what was that', 'typed', t.deps).done;
    expect(t.said[0]).toMatchObject({
      text: LINES.didYouMean,
      clarify: ['The bird?', 'The bunny?'],
    });
    expect(t.session.history).toEqual([]);
    t.advance(LIMITS.askMinIntervalMs);
    await askPip(t.session, t.sam, 'The bird?', 'clarify', t.deps).done;
    expect(t.said[1]).toMatchObject({ text: LINES.unparsed, clarify: [], source: 'template' });
  });

  it('uses the offline line without calling the model when AI is off', async () => {
    const complete = vi.fn();
    const t = setup({ complete }, { aiEnabled: false });
    await askPip(t.session, t.sam, 'Who?', 'typed', t.deps).done;
    expect(complete).not.toHaveBeenCalled();
    expect(t.said[0]).toMatchObject({ text: LINES.offline, source: 'template' });
  });

  it('never logs the question text or the name by default', async () => {
    const t = setup(createFakeModel('ANSWER: Yes.'));
    await askPip(t.session, t.sam, 'Secret question?', 'typed', t.deps).done;
    const logged = JSON.stringify(t.log.info.mock.calls);
    expect(logged).not.toContain('Secret question');
    expect(logged).not.toContain('Sam');
    expect(logged).toContain('ask.done');
  });

  it('answers a repeated question at the same scene from memory, without the model', async () => {
    const complete = vi.fn(async () => 'ANSWER: A bunny.\nNEXT: Why?');
    const t = setup({ complete }, { memory: true });
    await askPip(t.session, t.sam, 'Who is that?', 'typed', t.deps).done;
    t.advance(LIMITS.askMinIntervalMs);
    await askPip(t.session, t.leo, 'who is that', 'starter', t.deps).done;
    expect(complete).toHaveBeenCalledTimes(1);
    expect(t.said[1]).toMatchObject({ askedByName: 'Leo', text: 'A bunny.', source: 'ai' });
    expect(t.log.info).toHaveBeenCalledWith(
      'ask.done',
      expect.objectContaining({ kind: 'memory' }),
    );
  });

  it('falls back to a similar remembered answer when the model fails', async () => {
    let fail = false;
    const t = setup(
      createFakeModel(() => {
        if (fail) throw new Error('down');
        return 'ANSWER: He is sad about the butterfly.\nNEXT: Why?';
      }),
      { memory: true },
    );
    await askPip(t.session, t.sam, 'Why is the bunny sad?', 'typed', t.deps).done;
    fail = true;
    t.advance(LIMITS.askMinIntervalMs);
    await askPip(t.session, t.leo, 'why is bunny so sad', 'typed', t.deps).done;
    expect(t.said[1]?.text).toBe('He is sad about the butterfly.');
  });

  it('sends a small local model the simple prompt and never says "Did you mean"', async () => {
    const complete = vi.fn<TextModel['complete']>(async () => 'CLARIFY: A? | B?');
    const t = setup({ complete }, { simpleFormat: true });
    await askPip(t.session, t.sam, 'huh', 'typed', t.deps).done;
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      system: expect.stringContaining('Always reply in exactly this format') as unknown,
    });
    expect(t.said[0]).toMatchObject({ text: LINES.unparsed, clarify: [] });
  });
});
