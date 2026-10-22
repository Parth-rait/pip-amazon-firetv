import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  activeBranch,
  branchIntent,
  changeBranch,
  clearBranches,
  closeBranch,
  continueBranch,
  createBranch,
  parseEvents,
  splitReply,
  toBranchView,
  whyInBranch,
  type BranchRequest,
  type BranchState,
} from './branch.js';
import { createFakeModel, type CompleteInput } from './core/ai/model.js';
import { permittedEvidence } from './core/context/boundary.js';
import { routeText } from './core/intent/route-text.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { LINES } from './lines.js';

const CONTENT = fileURLToPath(new URL('../content', import.meta.url));
const film = loadFilms(CONTENT).find((f) => f.id === 'tears-of-steel');
if (!film) throw new Error('content/tears-of-steel.json is missing');
const timeline = loadTimeline(`${CONTENT}/timelines`, film);
// Verified against the timeline, not assumed: the reveals the branch must never reach early.
const THOM_REVEAL = timeline.facts.find((f) => f.text.includes('calls the old man Thom'));
const CELIA_REVEAL = timeline.facts.find((f) => f.text.includes("speaks with Celia's voice"));

const EVENTS = (n: number, tag = 'Pip') =>
  JSON.stringify({
    events: Array.from({ length: n }, (_, i) => `In ${tag}'s version, step ${i + 1} happens.`),
  });

function model(...replies: (string | Error)[]) {
  const queue = [...replies];
  // Typed with the input so tests can read the prompts it was shown.
  const complete = vi.fn((input: CompleteInput): string => {
    void input;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next ?? '';
  });
  return { model: createFakeModel(complete), complete };
}

const state = (): BranchState => ({ branches: [], activeBranch: {}, branchSeq: 0 });
const req = (s: BranchState, positionSec: number, question: string): BranchRequest => ({
  state: s,
  film,
  timeline,
  ownerId: 'p1',
  ownerName: 'Maya',
  positionSec,
  question,
  aiEnabled: true,
});
const deps = (m: ReturnType<typeof model>) => ({
  model: m.model,
  policy: 'accepted' as const,
  now: () => 0,
});
const topic = (text: string) => {
  const r = routeText(text);
  return r.kind === 'question' ? r.topic : 'other';
};
const laterThan = (sec: number) => timeline.facts.filter((f) => f.revealSec > sec);

describe('Parallel Stories: the branch engine', () => {
  it('finds the reveals it guards in the real timeline', () => {
    expect(THOM_REVEAL?.revealSec).toBe(236); // said at 3:46, counted 10 s later
    expect(CELIA_REVEAL?.revealSec).toBe(393); // said at 6:23
  });

  it('routes questions by whether a branch is open', () => {
    const cases: [string, boolean, string | null][] = [
      ['What if Thom never left?', false, 'create'],
      ['What if Thom never left?', true, 'change'],
      ['What happens next?', true, 'continue'],
      ['What happens next?', false, null],
      ['Why did that happen?', true, 'why'],
      ['Where did it split?', true, 'split'],
      ['How does the real film end?', true, null],
      ['What happens next in the film?', true, null],
      ['Who is that?', true, null],
    ];
    for (const [text, open, want] of cases)
      expect([text, branchIntent(text, topic(text), open)]).toEqual([text, want]);
  });

  it('splits at the position asked, from canon revealed by then only, with ids made by code', async () => {
    const s = state();
    const m = model(EVENTS(4));
    const before = JSON.stringify(timeline);
    const out = await createBranch(req(s, 230, 'What if Thom never left?'), deps(m));
    expect(out.source).toBe('imagined');
    const branch = out.branch;
    expect(branch).toMatchObject({ id: 'b1', splitSec: 230, open: true });
    expect(branch?.events.map((e) => e.id)).toEqual(['b1-e1', 'b1-e2', 'b1-e3', 'b1-e4']);
    expect(branch?.inherited).toEqual(
      permittedEvidence(timeline, 230, 'accepted').facts.map((f) => f.id),
    );
    const prompt = m.complete.mock.calls[0]?.[0];
    expect(prompt?.format).toBe('json');
    for (const fact of laterThan(230)) expect(prompt?.user).not.toContain(fact.text);
    expect(activeBranch(s, 'p1', film.id)?.id).toBe('b1');
    expect(JSON.stringify(timeline)).toBe(before); // canon is never written to
  });

  it('continues from the split, never from what was watched since', async () => {
    const s = state();
    await createBranch(req(s, 230, 'What if Thom never left?'), deps(model(EVENTS(3))));
    const branch = activeBranch(s, 'p1', film.id);
    if (!branch) throw new Error('no branch');
    const m = model(EVENTS(2, 'next'));
    const out = await continueBranch(branch, req(s, 600, 'What happens next?'), deps(m));
    expect(out.branch?.events.map((e) => e.id)).toEqual([
      'b1-e1',
      'b1-e2',
      'b1-e3',
      'b1-e4',
      'b1-e5',
    ]);
    const prompt = m.complete.mock.calls[0]?.[0];
    expect(prompt?.user).toContain('<pip-so-far>');
    for (const fact of laterThan(230)) expect(prompt?.user).not.toContain(fact.text);
  });

  it('changes one thing from the same split, and remembers each premise', async () => {
    const s = state();
    await createBranch(req(s, 230, 'What if Thom never left?'), deps(model(EVENTS(3))));
    const branch = activeBranch(s, 'p1', film.id);
    if (!branch) throw new Error('no branch');
    const out = await changeBranch(
      branch,
      req(s, 260, 'What if Celia left instead?'),
      deps(model(EVENTS(3, 'other'))),
    );
    expect(out.branch).toMatchObject({ splitSec: 230, premise: 'What if Celia left instead?' });
    expect(out.branch?.changes).toEqual([
      'What if Thom never left?',
      'What if Celia left instead?',
    ]);
    expect(out.branch?.events[0]).toMatchObject({
      id: 'b1-e1',
      text: "In other's version, step 1 happens.",
    });
  });

  it('withholds a branch that names something the film has not reached', async () => {
    const s = state();
    const term = permittedEvidence(timeline, 230, 'accepted').restrictedTerms[0] ?? 'heartbroken';
    const leak = JSON.stringify({
      events: [`Suddenly ${term} appears.`, 'Then more.', 'The end comes.'],
    });
    const m = model(leak);
    const out = await createBranch(req(s, 230, 'What if Thom never left?'), deps(m));
    expect(out).toMatchObject({ text: LINES.imagineWithheld, branch: null });
    expect(m.complete).toHaveBeenCalledTimes(2);
    expect(s.branches).toEqual([]);
  });

  it('survives malformed output and a failing model without making a branch', async () => {
    const bad = await createBranch(
      req(state(), 230, 'What if Thom never left?'),
      deps(model('{"events": "not a list"}')),
    );
    expect(bad).toMatchObject({ text: LINES.unparsed, branch: null });
    const down = await createBranch(
      req(state(), 230, 'What if Thom never left?'),
      deps(model(new Error('timeout'))),
    );
    expect(down).toMatchObject({ text: LINES.modelFailed, branch: null });
    const off = await createBranch(
      { ...req(state(), 230, 'What if?'), aiEnabled: false },
      deps(model(EVENTS(3))),
    );
    expect(off.text).toBe(LINES.offline);
  });

  it('parses only the schema: events as a list of 3 to 5 lines', () => {
    expect(parseEvents('nope', 3, 5)).toBeNull();
    expect(parseEvents('{"events": ["one long line here"]}', 3, 5)).toBeNull();
    expect(parseEvents(`Sure! ${EVENTS(6)}`, 3, 5)).toHaveLength(5);
  });

  it('answers "Why?" from the branch, and says where the stories split without spoiling', async () => {
    const s = state();
    await createBranch(req(s, 230, 'What if Thom never left?'), deps(model(EVENTS(3))));
    const branch = activeBranch(s, 'p1', film.id);
    if (!branch) throw new Error('no branch');
    const why = await whyInBranch(
      branch,
      req(s, 240, 'Why did that happen?'),
      deps(model('Because Thom stayed.')),
    );
    expect(why).toMatchObject({ source: 'imagined', text: 'Because Thom stayed.' });

    const early = splitReply(branch, timeline, 230, 'accepted');
    expect(early.text).toMatch(/split at 3:50/);
    expect(early.text).toMatch(/haven't seen yet/);
    for (const fact of laterThan(230)) expect(early.text).not.toContain(fact.text);
    const later = splitReply(branch, timeline, 400, 'accepted');
    expect(later.text).toMatch(/The film went on differently/);
  });

  it('shows the film after the split only as far as it was watched', async () => {
    const s = state();
    await createBranch(req(s, 230, 'What if Thom never left?'), deps(model(EVENTS(3))));
    const branch = activeBranch(s, 'p1', film.id);
    if (!branch) throw new Error('no branch');
    const now = toBranchView(branch, timeline, 230, 'accepted');
    expect(now.after).toEqual([]);
    expect(now.unseenAfter).toBe(laterThan(230).length);
    expect(now.film).toHaveLength(3);
    const watched = toBranchView(branch, timeline, 400, 'accepted');
    expect(watched.after.length).toBeGreaterThan(0);
    for (const line of watched.after) expect(line.atSec).toBeLessThanOrEqual(400);
    expect(JSON.stringify(watched)).not.toContain('Memory overwrite complete');
  });

  it('goes back to the film, and forgets every branch with a new film', async () => {
    const s = state();
    await createBranch(req(s, 230, 'What if Thom never left?'), deps(model(EVENTS(3))));
    expect(closeBranch(s, 'p1')?.open).toBe(false);
    expect(activeBranch(s, 'p1', film.id)).toBeNull();
    expect(branchIntent('What happens next?', 'future', false)).toBeNull();
    clearBranches(s);
    expect(s).toMatchObject({ branches: [], activeBranch: {} });
  });
});
