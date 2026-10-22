// Parallel Stories: a "What if...?" becomes a branch of the film, split at the moment it was asked.
// The model writes the branch's events; code owns everything that must be true: the split point,
// the canon a branch may know (only facts revealed by the split, never later), event ids and order,
// and the label on every line, "The film" or "Pip's version". The canonical timeline is never
// written to. Branches live in the session only and end with it.
import { z } from 'zod';
import { cleanText, stripMarkdown } from './core/ai/clean-text.js';
import type { TextModel } from './core/ai/model.js';
import { permittedEvidence, type EvidenceSet } from './core/context/boundary.js';
import { checkAnswer } from './core/context/check-answer.js';
import {
  isUsable,
  type ReviewPolicy,
  type TimedFact,
  type Timeline,
} from './core/context/timeline.js';
import type { QuestionTopic } from './core/intent/route-text.js';
import { buildBranchPrompt, buildBranchWhyPrompt, formatTime } from './film/ask-prompt.js';
import { LINES } from './lines.js';
import type { BranchView } from './shared/protocol.js';

export const BRANCH_FACTS = 25; // the canon a branch prompt carries: the latest facts before the split
const MAX_BRANCHES = 6; // per session; the oldest closed ones go first
const MAX_EVENTS = 12; // per branch, so a long exploration stays readable
const VIEW_FILM_EVENTS = 3; // canon events shown before the split
const VIEW_AFTER_EVENTS = 4; // watched canon events shown after the split
const ATTEMPTS = 2; // a withheld or malformed reply is tried once more
const TIMEOUT_MS = 30_000;
const EVENT_MAX_CHARS = 240;

export interface BranchEvent {
  id: string; // assigned by code: <branch id>-e<n>
  order: number;
  text: string;
}

export interface Branch {
  id: string;
  ownerId: string;
  ownerName: string;
  contentId: string;
  splitSec: number; // the playback position when it was asked: the canon it may know ends here
  inherited: string[]; // ids of the canonical facts revealed by splitSec
  premise: string; // the change, as asked
  changes: string[]; // every premise this branch has had, oldest first
  events: BranchEvent[]; // Pip's version, in order
  open: boolean;
  createdAt: number;
}

/** What a session keeps: its branches, and which one each player is exploring. */
export interface BranchState {
  branches: Branch[];
  activeBranch: Record<string, string>; // playerId -> branch id
  branchSeq: number;
}

export type BranchIntent = 'create' | 'continue' | 'why' | 'change' | 'split';

const SPLIT_QUESTION =
  /\b(where|when)\b.*\b(split|differ|different|diverge|changed?)\b|\bshow me where\b/i;
const CONTINUE_QUESTION =
  /\b(what happens next|then what|what next|and then|keep going|continue|go on|what happens now)\b/i;
// "How does the real film end?" asks about the film, branch or not.
const ABOUT_THE_FILM = /\b(real|original|actual(ly)?|the (film|movie)|in the film|canon)\b/i;

/**
 * Where a question goes when a player may be exploring a branch. Null means the film: the usual
 * grounded answer. A "what if" with no branch open starts one; with one open it changes it.
 */
export function branchIntent(
  text: string,
  topic: QuestionTopic,
  hasActive: boolean,
): BranchIntent | null {
  if (topic === 'imagine') return hasActive ? 'change' : 'create';
  if (!hasActive) return null;
  if (SPLIT_QUESTION.test(text)) return 'split';
  if (ABOUT_THE_FILM.test(text)) return null;
  if (topic === 'future' || CONTINUE_QUESTION.test(text)) return 'continue';
  if (topic === 'why') return 'why';
  return null;
}

export function activeBranch(
  state: BranchState,
  playerId: string,
  contentId: string,
): Branch | null {
  const id = state.activeBranch[playerId];
  const branch = state.branches.find((b) => b.id === id && b.open);
  return branch && branch.contentId === contentId ? branch : null;
}

/** Back to the film: the player's branch closes; the session still remembers it. */
export function closeBranch(state: BranchState, playerId: string): Branch | null {
  const id = state.activeBranch[playerId];
  delete state.activeBranch[playerId];
  const branch = state.branches.find((b) => b.id === id) ?? null;
  if (branch) branch.open = false;
  return branch;
}

/** A new film, or the end of the session: every branch goes. */
export function clearBranches(state: BranchState): void {
  state.branches = [];
  state.activeBranch = {};
}

const eventsSchema = z.object({
  events: z.array(z.string().trim().min(8).max(600)).min(1).max(8),
});

/** The events in a model reply, or null when it is not the JSON asked for. */
export function parseEvents(raw: string, min: number, max: number): string[] | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = eventsSchema.safeParse(data);
  if (!parsed.success) return null;
  const events = parsed.data.events
    .map((e) => cleanText(stripMarkdown(e)).slice(0, EVENT_MAX_CHARS))
    .filter((e) => e.length >= 8);
  return events.length >= min ? events.slice(0, max) : null;
}

export interface StoryDeps {
  model: TextModel;
  policy: ReviewPolicy;
  now: () => number;
}

export type StoryOutcome =
  | { ok: true; events: string[]; modelMs: number }
  | { ok: false; reason: 'model-failed' | 'unparsed' | 'withheld'; detail: string | null };

/**
 * The canon a branch may know: the facts revealed by its split, the latest BRANCH_FACTS of them.
 * Nothing after the split can reach a branch prompt, however far the family has watched since.
 */
export function branchCanon(timeline: Timeline, splitSec: number, policy: ReviewPolicy) {
  const evidence = permittedEvidence(timeline, splitSec, policy);
  return { evidence, facts: evidence.facts.slice(-BRANCH_FACTS) };
}

/**
 * Asks the model for events and checks each against the spoiler rules at the split: no word the
 * film has not reached and no character not seen yet. A story may invent, so this is the only
 * gate; it detects names and words, not every paraphrase, which the branch benchmark measures.
 */
export async function writeEvents(
  prompt: { system: string; user: string },
  evidence: EvidenceSet,
  timeline: Timeline,
  range: { min: number; max: number },
  deps: StoryDeps,
): Promise<StoryOutcome> {
  const startedAt = deps.now();
  let last: StoryOutcome = { ok: false, reason: 'unparsed', detail: null };
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let raw: string;
    try {
      raw = await deps.model.complete({
        ...prompt,
        maxTokens: 320,
        temperature: 0.9,
        timeoutMs: TIMEOUT_MS,
        format: 'json',
      });
    } catch (error) {
      return {
        ok: false,
        reason: 'model-failed',
        detail: error instanceof Error ? error.name : 'error',
      };
    }
    const events = parseEvents(raw, range.min, range.max);
    if (!events) {
      last = { ok: false, reason: 'unparsed', detail: null };
      continue;
    }
    const blocked = events
      .map((text) => storyVerdict(text, evidence, timeline))
      .find((v) => v !== null);
    if (blocked) {
      last = { ok: false, reason: 'withheld', detail: blocked };
      continue;
    }
    return { ok: true, events, modelMs: deps.now() - startedAt };
  }
  return last;
}

/** Null when a made-up line passes the spoiler rules at this evidence; otherwise why not. */
export function storyVerdict(
  text: string,
  evidence: EvidenceSet,
  timeline: Timeline,
): string | null {
  const verdict = checkAnswer(
    text,
    evidence.facts.map((f) => f.id),
    evidence,
    storyLexicon(timeline),
  );
  return verdict.ok ? null : `${verdict.reason}:${verdict.detail}`;
}

function storyLexicon(timeline: Timeline): string[] {
  return [
    ...new Set([
      ...timeline.entities.flatMap((e) => [e.name, ...e.aliases, ...(e.label ? [e.label] : [])]),
      ...timeline.facts.flatMap((f) => f.spoilerTerms),
    ]),
  ];
}

export interface BranchRequest {
  state: BranchState;
  film: { id: string; title: string; premise: string };
  timeline: Timeline;
  ownerId: string;
  ownerName: string;
  positionSec: number;
  question: string;
  aiEnabled: boolean;
}

export interface BranchReply {
  text: string;
  source: 'imagined' | 'template';
  branch: Branch | null; // the branch to show, when it changed
  log: Record<string, string | number | null>;
}

function failed(outcome: Extract<StoryOutcome, { ok: false }>): BranchReply {
  const text =
    outcome.reason === 'withheld'
      ? LINES.imagineWithheld
      : outcome.reason === 'model-failed'
        ? LINES.modelFailed
        : LINES.unparsed;
  return {
    text,
    source: 'template',
    branch: null,
    log: { kind: 'unknown', path: 'branch', withheld: outcome.detail ?? outcome.reason },
  };
}

function events(branch: Branch, texts: string[]): BranchEvent[] {
  return texts.map((text, i) => {
    const order = branch.events.length + i + 1;
    return { id: `${branch.id}-e${order}`, order, text };
  });
}

/** "What if...?" with no branch open: a new branch split at the current position. */
export async function createBranch(req: BranchRequest, deps: StoryDeps): Promise<BranchReply> {
  if (!req.aiEnabled) return offline();
  const { evidence, facts } = branchCanon(req.timeline, req.positionSec, deps.policy);
  const outcome = await writeEvents(
    buildBranchPrompt({
      title: req.film.title,
      premise: req.film.premise,
      splitSec: req.positionSec,
      isEnd: req.positionSec >= req.timeline.durationSec - END_MARGIN_SEC,
      facts,
      change: req.question,
      sofar: [],
      want: '3 to 5',
    }),
    evidence,
    req.timeline,
    { min: 3, max: 5 },
    deps,
  );
  if (!outcome.ok) return failed(outcome);
  req.state.branchSeq += 1;
  const branch: Branch = {
    id: `b${req.state.branchSeq}`,
    ownerId: req.ownerId,
    ownerName: req.ownerName,
    contentId: req.film.id,
    splitSec: req.positionSec,
    inherited: evidence.facts.map((f) => f.id),
    premise: req.question,
    changes: [req.question],
    events: [],
    open: true,
    createdAt: deps.now(),
  };
  branch.events = events(branch, outcome.events);
  closeBranch(req.state, req.ownerId);
  req.state.branches = [...prune(req.state.branches), branch];
  req.state.activeBranch[req.ownerId] = branch.id;
  return storyReply(branch, branch.events, outcome.modelMs, 'create');
}

/** "What happens next?" in a branch: more of Pip's version, from the same canon. */
export async function continueBranch(
  branch: Branch,
  req: BranchRequest,
  deps: StoryDeps,
): Promise<BranchReply> {
  if (!req.aiEnabled) return offline();
  if (branch.events.length >= MAX_EVENTS) {
    return {
      text: "That's where Pip's version ends. Try changing one thing, or go back to the film.",
      source: 'imagined',
      branch,
      log: { kind: 'imagined', path: 'branch', intent: 'continue-full' },
    };
  }
  const { evidence, facts } = branchCanon(req.timeline, branch.splitSec, deps.policy);
  const outcome = await writeEvents(
    buildBranchPrompt({
      title: req.film.title,
      premise: req.film.premise,
      splitSec: branch.splitSec,
      isEnd: branch.splitSec >= req.timeline.durationSec - END_MARGIN_SEC,
      facts,
      change: branch.premise,
      sofar: branch.events.map((e) => e.text),
      want: '2 or 3',
    }),
    evidence,
    req.timeline,
    { min: 1, max: 3 },
    deps,
  );
  if (!outcome.ok) return failed(outcome);
  const added = events(branch, outcome.events);
  branch.events = [...branch.events, ...added];
  return storyReply(branch, added, outcome.modelMs, 'continue');
}

/** "Change one thing": the same split, a new premise; Pip's version is written again. */
export async function changeBranch(
  branch: Branch,
  req: BranchRequest,
  deps: StoryDeps,
): Promise<BranchReply> {
  if (!req.aiEnabled) return offline();
  const { evidence, facts } = branchCanon(req.timeline, branch.splitSec, deps.policy);
  const outcome = await writeEvents(
    buildBranchPrompt({
      title: req.film.title,
      premise: req.film.premise,
      splitSec: branch.splitSec,
      isEnd: branch.splitSec >= req.timeline.durationSec - END_MARGIN_SEC,
      facts,
      change: req.question,
      sofar: [],
      want: '3 to 5',
    }),
    evidence,
    req.timeline,
    { min: 3, max: 5 },
    deps,
  );
  if (!outcome.ok) return failed(outcome);
  branch.premise = req.question;
  branch.changes = [...branch.changes, req.question];
  branch.events = [];
  branch.events = events(branch, outcome.events);
  return storyReply(branch, branch.events, outcome.modelMs, 'change');
}

/** "Why?" inside a branch: answered from Pip's version and the canon before the split only. */
export async function whyInBranch(
  branch: Branch,
  req: BranchRequest,
  deps: StoryDeps,
): Promise<BranchReply> {
  if (!req.aiEnabled) return offline();
  const { evidence, facts } = branchCanon(req.timeline, branch.splitSec, deps.policy);
  const prompt = buildBranchWhyPrompt({
    title: req.film.title,
    splitSec: branch.splitSec,
    facts,
    change: branch.premise,
    sofar: branch.events.map((e) => e.text),
    question: req.question,
  });
  try {
    const raw = await deps.model.complete({
      ...prompt,
      maxTokens: 120,
      temperature: 0.6,
      timeoutMs: TIMEOUT_MS,
    });
    const text = cleanText(raw);
    const blocked = text ? storyVerdict(text, evidence, req.timeline) : 'empty';
    if (blocked) return failed({ ok: false, reason: 'withheld', detail: blocked });
    return {
      text,
      source: 'imagined',
      branch: null,
      log: { kind: 'imagined', path: 'branch', intent: 'why' },
    };
  } catch (error) {
    return failed({
      ok: false,
      reason: 'model-failed',
      detail: error instanceof Error ? error.name : 'error',
    });
  }
}

/**
 * "Where did it split?": from code alone. The film up to the split, the change, and the film
 * after it only as far as the family has watched; the rest is "you haven't seen this yet".
 */
export function splitReply(
  branch: Branch,
  timeline: Timeline,
  positionSec: number,
  policy: ReviewPolicy,
): BranchReply {
  const view = toBranchView(branch, timeline, positionSec, policy);
  const before = view.film.at(-1);
  const parts = [
    `The stories split at ${formatTime(branch.splitSec)}.`,
    before ? `The film, up to there: ${before.text}` : null,
    `Pip's version: ${branch.premise}`,
    view.after[0]
      ? `The film went on differently: ${view.after[0].text}`
      : view.unseenAfter > 0
        ? "What the film does after that, you haven't seen yet."
        : null,
  ].filter((p): p is string => p !== null);
  return {
    text: parts.join(' '),
    source: 'template',
    branch,
    log: { kind: 'answer', path: 'branch', intent: 'split' },
  };
}

/**
 * The branch as screens draw it. Canon before the split; canon after it only up to `positionSec`
 * (what the family has watched), and only a count of the rest. Never a later fact's text.
 */
export function toBranchView(
  branch: Branch,
  timeline: Timeline,
  positionSec: number,
  policy: ReviewPolicy,
): BranchView {
  const atSplit = permittedEvidence(timeline, branch.splitSec, policy).facts;
  const watched = permittedEvidence(timeline, Math.max(positionSec, branch.splitSec), policy).facts;
  const inherited = new Set(atSplit.map((f) => f.id));
  const after = watched.filter((f) => !inherited.has(f.id));
  const total = timeline.facts.filter((f) => isUsable(f.review, policy));
  const unseenAfter = total.filter((f) => !inherited.has(f.id)).length - after.length;
  const line = (f: TimedFact) => ({ atSec: f.startSec, text: f.text });
  return {
    id: branch.id,
    ownerId: branch.ownerId,
    ownerName: branch.ownerName,
    contentId: branch.contentId,
    splitSec: branch.splitSec,
    premise: branch.premise,
    changes: branch.changes,
    film: atSplit.slice(-VIEW_FILM_EVENTS).map(line),
    pip: branch.events.map((e) => ({ id: e.id, order: e.order, text: e.text })),
    after: spread(after, VIEW_AFTER_EVENTS).map(line),
    unseenAfter: Math.max(0, unseenAfter),
    open: branch.open,
  };
}

const END_MARGIN_SEC = 30;

function storyReply(
  branch: Branch,
  added: BranchEvent[],
  modelMs: number,
  intent: string,
): BranchReply {
  return {
    text: added.map((e) => e.text).join(' '),
    source: 'imagined',
    branch,
    log: { kind: 'imagined', path: 'branch', intent, events: added.length, modelMs },
  };
}

function offline(): BranchReply {
  return {
    text: LINES.offline,
    source: 'template',
    branch: null,
    log: { kind: 'fallback', path: 'ai-off' },
  };
}

function prune(branches: Branch[]): Branch[] {
  if (branches.length < MAX_BRANCHES) return branches;
  const oldestClosed = branches.findIndex((b) => !b.open);
  const drop = oldestClosed >= 0 ? oldestClosed : 0;
  return branches.filter((_, i) => i !== drop);
}

function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)] as T);
}
