// Stage changes and Ask Pip for film night (PROJECT.md section 4.5).
import type { Server } from 'socket.io';
import { answerQuestion, recheckAtPosition } from './answer.js';
import {
  activeBranch,
  branchIntent,
  changeBranch,
  clearBranches,
  continueBranch,
  createBranch,
  splitReply,
  toBranchView,
  whyInBranch,
  type Branch,
  type BranchIntent,
  type BranchReply,
  type BranchRequest,
} from './branch.js';

import { runAsk, type AskOutcome } from './core/ai/ask.js';
import type { AnswerMemory } from './core/ai/answer-memory.js';
import type { AnswerCache } from './core/context/answer-cache.js';
import { isUsable, type ReviewPolicy, type Timeline } from './core/context/timeline.js';
import { shouldOfferCommandChoices, type IntentJudge } from './core/intent/judge.js';
import { routeText, type QuestionTopic } from './core/intent/route-text.js';
import type { Journal } from './core/journal.js';
import type { TextModel } from './core/ai/model.js';
import { restingPip, setPip, type CoreDeps } from './core/pip.js';
import type { Player } from './core/players.js';
import type { Timers } from './core/timers.js';
import { buildAskPrompt, sceneAt } from './film/ask-prompt.js';
import { currentPrediction } from './film/companion.js';
import type { Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import { ASK_SETTINGS } from './film/prompts.js';
import { quizTimerKey } from './film/quiz.js';
import { LINES, type PipLines } from './lines.js';
import type { log as Log } from './log.js';
import type { Session } from './sessions.js';
import {
  LIMITS,
  type AskResult,
  type AskVia,
  type ClientToServerEvents,
  type PipSay,
  type ServerToClientEvents,
  type Source,
} from './shared/protocol.js';
import { buildView, tvView } from './view.js';

export type PipServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** What the flow functions need; realtime.ts builds one and passes it in. */
export interface FlowDeps {
  io: PipServer;
  films: Content[];
  publicUrl: string;
  timers: Timers;
  now: () => number;
  model: TextModel;
  aiEnabled: boolean;
  simpleFormat?: boolean; // a small local model: no "Did you mean"
  memory?: AnswerMemory; // good answers by film and scene (core/ai/answer-memory.ts)
  journal?: Journal; // the append-only event journal (core/journal.ts)
  timelines?: Map<string, Timeline>; // films with an evidence timeline answer from it (answer.ts)
  answerCache?: AnswerCache; // grounded answers, keyed by the exact permitted evidence
  timelinePolicy?: ReviewPolicy; // TIMELINE_REVIEW: accepted facts only, or drafts too
  modelId?: string; // part of the answer-cache key
  judge?: IntentJudge; // INTENT_JUDGE=typesafe; it can only offer command choices
  logText: boolean; // LOG_TEXT: question text in logs, development only
  log: typeof Log;
}

const TALKING_MS = 8000;
const CHEER_MS = 1500;
const REVEAL_TALK_MS = 4000;
const MAX_HISTORY = 3;
const JUDGE_THRESHOLD = 0.8;
// Each choice is routed by the rules when tapped (ask-commands.ts), so the judge never acts itself.
const COMMAND_CHOICES = ['Pause the film', 'Play the film', 'Go back 10 seconds'];
const NO_CACHE: AnswerCache = { get: () => undefined, set: () => undefined, size: () => 0 };

export function roomOf(code: string): string {
  return `s:${code}`;
}

/** Marks the session changed and sends the whole view to its TV and pads. */
export function broadcast(session: Session, deps: FlowDeps): void {
  const now = deps.now();
  session.updatedAt = now;
  const view = buildView(session, deps.films, deps.publicUrl, now);
  const room = deps.io.to(roomOf(session.code));
  if (!session.tvSocketId) {
    room.emit('session:view', view);
    return;
  }
  // The TV gets a slim view: on Vega its WebSocket dropped every few seconds once the view
  // carried the chapters and character cards (about 5 KB), which only the pads show.
  room.except(session.tvSocketId).emit('session:view', view);
  deps.io.to(session.tvSocketId).emit('session:view', tvView(view));
}

function dropQuiz(session: Session, deps: FlowDeps): void {
  deps.timers.clear(quizTimerKey(session.code));
  session.quiz = null;
}

/** Goes to watch with a film. A new film clears playback and history; an ended one restarts. */
export function watchFilm(session: Session, contentId: string, deps: FlowDeps): boolean {
  if (!deps.films.some((f) => f.id === contentId)) return false;
  dropQuiz(session, deps);
  if (session.contentId !== contentId) {
    session.playback = null;
    session.history = [];
    session.predictionVotes = {};
    session.revealedPredictions = [];
    session.reactions = {};
    clearBranches(session); // a branch belongs to one film
  } else if (session.playback?.ended) {
    session.playback = null;
  }
  session.contentId = contentId;
  session.stage = 'watch';
  session.assistant = { open: false, byId: null }; // Pip starts hidden with every film
  broadcast(session, deps);
  return true;
}

/** Where the film is now, or null when nothing of this session's film is playing. */
export function positionNow(
  session: Session,
  deps: FlowDeps,
): { film: Content; positionSec: number } | null {
  const film = deps.films.find((f) => f.id === session.contentId);
  if (!film || !session.playback || session.playback.contentId !== film.id) return null;
  return { film, positionSec: estimatePosition(session.playback, session.playbackAt, deps.now()) };
}

/**
 * When a "What happens next?" vote has just been revealed, Pip reacts once: a cheer when at
 * least half of the votes were right, talking otherwise (the quiz's rule).
 */
export function checkPredictionReveal(session: Session, deps: FlowDeps): void {
  const now = positionNow(session, deps);
  if (!now || session.stage !== 'watch' || session.asking) return;
  const current = currentPrediction(now.film, now.positionSec);
  if (current?.status !== 'revealed') return;
  const { id, answer } = current.prediction;
  if (session.revealedPredictions.includes(id)) return;
  session.revealedPredictions = [...session.revealedPredictions, id];
  const picks = Object.values(session.predictionVotes[id] ?? {});
  if (picks.length === 0) return;
  const isMostlyRight = picks.filter((p) => p === answer).length * 2 >= picks.length;
  setPip(
    session,
    isMostlyRight ? 'cheer' : 'talking',
    coreDeps(session, deps),
    isMostlyRight ? CHEER_MS : REVEAL_TALK_MS,
  );
}

/** Back to the lobby; a quiz in progress and its timer are dropped. */
export function goToLobby(session: Session, deps: FlowDeps): void {
  dropQuiz(session, deps);
  session.stage = 'lobby';
  session.assistant = { open: false, byId: null };
  broadcast(session, deps);
}

/** Pip Core's dependencies for one session: its broadcast, the shared timers and the clock. */
export function coreDeps(session: Session, deps: FlowDeps): CoreDeps {
  return { timers: deps.timers, broadcast: () => broadcast(session, deps), now: deps.now };
}

/**
 * Checks an ask (not-watching, busy, too-soon) and, when it is ok, starts it: the ask lock,
 * Pip thinking, one model call, then pip:say. `done` settles when Pip has answered; it never rejects.
 */
export function askPip(
  session: Session,
  player: Player,
  text: string,
  via: AskVia,
  deps: FlowDeps,
): { result: AskResult; done: Promise<void> } {
  const now = deps.now();
  const film = deps.films.find((f) => f.id === session.contentId);
  const refuse = (reason: Extract<AskResult, { ok: false }>['reason']) => ({
    result: { ok: false, reason } as const,
    done: Promise.resolve(),
  });
  if (session.stage !== 'watch' || !film) return refuse('not-watching');
  if (session.asking) return refuse('busy');
  if (now - player.lastAskAt < LIMITS.askMinIntervalMs) return refuse('too-soon');

  player.lastAskAt = now;
  session.asking = true;
  setPip(session, 'thinking', coreDeps(session, deps));
  return { result: { ok: true }, done: answer(session, film, player, text, via, deps) };
}

async function answer(
  session: Session,
  film: Content,
  player: Player,
  text: string,
  via: AskVia,
  deps: FlowDeps,
): Promise<void> {
  const startedAt = deps.now();
  const positionSec = session.playback
    ? estimatePosition(session.playback, session.playbackAt, startedAt)
    : 0;
  const contentId = film.id;
  const route = routeText(text);
  const topic = route.kind === 'question' ? route.topic : 'other';
  deps.log.info('ask.start', {
    code: session.code,
    playerId: player.id,
    via,
    topic,
    ...(deps.logText ? { question: text } : {}),
  });
  const timeline = deps.timelines?.get(contentId);
  const grounded =
    timeline && hasUsableFacts(timeline, deps.timelinePolicy ?? 'accepted') ? timeline : null;
  // Parallel Stories: a "what if" opens a branch; with one open, "what happens next" and "why"
  // stay in it. Questions about the film go to the film as usual.
  const branch = grounded ? activeBranch(session, player.id, contentId) : null;
  const intent = grounded ? branchIntent(text, topic, branch !== null) : null;
  let changed: Branch | null = null;
  let reply: Reply;
  try {
    // Only text the rules could not place waits for the judge; everything else goes straight on.
    const judge = deps.judge && topic === 'other' && via !== 'clarify' ? deps.judge : null;
    const story =
      grounded && intent
        ? await branchStep(
            intent,
            branch,
            {
              state: session,
              film,
              timeline: grounded,
              ownerId: player.id,
              ownerName: player.name,
              positionSec,
              question: text,
              aiEnabled: deps.aiEnabled,
            },
            deps,
          )
        : null;
    changed = story?.branch ?? null;
    reply =
      (story ? storyReply(story) : null) ??
      (judge ? await commandChoices(text, judge) : null) ??
      (grounded
        ? await groundedReply(session, film, grounded, positionSec, text, via, topic, deps)
        : await notesReply(session, film, positionSec, text, via, topic, deps));
  } finally {
    session.asking = false;
  }
  if (session.stage !== 'watch' || session.contentId !== contentId) {
    deps.log.info('ask.dropped', { code: session.code, playerId: player.id });
    setPip(session, restingPip(session), coreDeps(session, deps));
    return;
  }
  const say: PipSay = {
    askedBy: player.id,
    askedByName: player.name,
    question: text,
    text: reply.text,
    next: reply.next,
    clarify: reply.clarify,
    source: reply.source,
  };
  if (reply.isAnswer) {
    session.history = [
      ...session.history,
      { atSec: positionSec, question: text, answer: reply.text },
    ].slice(-MAX_HISTORY);
  }
  deps.log.info('ask.done', {
    code: session.code,
    playerId: player.id,
    ms: deps.now() - startedAt,
    source: say.source,
    ...reply.log,
  });
  deps.io.to(roomOf(session.code)).emit('pip:say', say);
  if (changed && grounded) emitBranch(session, changed, grounded, deps);
  setPip(session, 'talking', coreDeps(session, deps), TALKING_MS);
}

async function branchStep(
  intent: BranchIntent,
  branch: Branch | null,
  req: BranchRequest,
  deps: FlowDeps,
): Promise<BranchReply> {
  const story = { model: deps.model, policy: deps.timelinePolicy ?? 'accepted', now: deps.now };
  if (intent === 'create' || !branch) return createBranch(req, story);
  if (intent === 'continue') return continueBranch(branch, req, story);
  if (intent === 'change') return changeBranch(branch, req, story);
  if (intent === 'why') return whyInBranch(branch, req, story);
  return splitReply(branch, req.timeline, req.positionSec, story.policy);
}

function storyReply(story: BranchReply): Reply {
  return {
    text: story.text,
    next:
      story.source === 'imagined'
        ? ['What happens next?', 'Where did it split?', 'Why did that happen?']
        : ['What if it went differently?'],
    clarify: [],
    source: story.source,
    isAnswer: false, // a made-up story never enters the history Pip answers the film from
    log: story.log,
  };
}

/** Sends a branch to the room as screens draw it, cut at what the room has watched now. */
export function emitBranch(
  session: Session,
  branch: Branch,
  timeline: Timeline,
  deps: FlowDeps,
): void {
  const now = positionNow(session, deps);
  const watched =
    session.playback?.ended && now ? now.film.durationSec : (now?.positionSec ?? branch.splitSec);
  deps.io.to(roomOf(session.code)).emit('pip:branch', {
    ownerId: branch.ownerId,
    branch: branch.open
      ? toBranchView(branch, timeline, watched, deps.timelinePolicy ?? 'accepted')
      : null,
  });
}

/**
 * A timeline answers only once it has facts the review policy allows. A machine-made timeline
 * that nobody has reviewed yet leaves the film on its notes instead of making Pip go quiet.
 */
function hasUsableFacts(timeline: Timeline, policy: ReviewPolicy): boolean {
  return timeline.facts.some((f) => isUsable(f.review, policy));
}

/** What Pip says, plus what the log may record about how it was found (never the text). */
interface Reply {
  text: string;
  next: string[];
  clarify: string[];
  source: Source;
  isAnswer: boolean; // goes into the history the next prompt sees
  log: Record<string, string | number | null>;
}

/**
 * Text the rules could not place may still be a command ("hold it a sec"). With a typed judge
 * configured, a confident command-like judgement only offers explicit choices; a pick from
 * "Did you mean" never asks the judge again.
 */
async function commandChoices(text: string, judge: IntentJudge): Promise<Reply | null> {
  const judgement = await judge.judge(text);
  if (!shouldOfferCommandChoices(judgement, JUDGE_THRESHOLD)) return null;
  return {
    text: LINES.wantACommand,
    next: [],
    clarify: COMMAND_CHOICES,
    source: 'template',
    isAnswer: false,
    log: { kind: 'clarify', path: 'judge', judge: judge.name },
  };
}

/**
 * A film with a timeline (vNext): the spoiler boundary, retrieval, the model only when needed and
 * the answer gate (answer.ts). If the film was rewound while Pip was thinking, the answer is
 * checked again against the new position before anyone sees it.
 */
async function groundedReply(
  session: Session,
  film: Content,
  timeline: Timeline,
  positionSec: number,
  question: string,
  via: AskVia,
  topic: QuestionTopic,
  deps: FlowDeps,
): Promise<Reply> {
  const policy = deps.timelinePolicy ?? 'accepted';
  const found = await answerQuestion(
    { film, timeline, positionSec, history: session.history, question, via, topic },
    {
      model: deps.model,
      modelId: deps.modelId ?? 'unknown',
      aiEnabled: deps.aiEnabled,
      simpleFormat: deps.simpleFormat,
      cache: deps.answerCache ?? NO_CACHE,
      policy,
      now: deps.now,
    },
  );
  const nowAt = positionNow(session, deps);
  const result =
    nowAt && nowAt.film.id === film.id
      ? recheckAtPosition(found, timeline, nowAt.positionSec, policy)
      : found;
  return {
    text: result.text,
    next: result.next,
    clarify: result.clarify,
    source: result.source,
    isAnswer: result.kind === 'answer',
    log: {
      kind: result.kind,
      path: result.path,
      sources: result.sources.length,
      withheld: result.withheld,
      modelMs: result.modelMs,
      ...(result.error ? { error: result.error } : {}),
    },
  };
}

/**
 * A film without a timeline: the notes up to now, answer memory and the model (Step 7). Questions
 * about what happens later get the fixed no-spoiler line without a model call.
 */
async function notesReply(
  session: Session,
  film: Content,
  positionSec: number,
  text: string,
  via: AskVia,
  topic: QuestionTopic,
  deps: FlowDeps,
): Promise<Reply> {
  const fixed = (line: string, kind: string): Reply => ({
    text: line,
    next: [],
    clarify: [],
    source: 'template',
    isAnswer: false,
    log: { kind, path: 'notes' },
  });
  if (topic === 'future') return fixed(LINES.noFuture, 'future-question');
  if (film.notes.length === 0) return fixed(LINES.noTimeline, 'no-notes');
  const recallQuery = {
    contentId: film.id,
    sceneSec: sceneAt(film.notes, positionSec),
    question: text,
  };
  // The same question at the same scene was answered before: answer at once.
  const repeat = deps.memory?.recallExact(recallQuery) ?? null;
  let outcome: AskOutcome;
  let fromMemory = repeat !== null;
  outcome = repeat
    ? { reply: { kind: 'answer', text: repeat.answer, next: repeat.next, sources: [] } }
    : deps.aiEnabled
      ? await runAsk(
          deps.model,
          buildAskPrompt({
            ...film,
            positionSec,
            history: session.history,
            question: text,
            via,
            simpleFormat: deps.simpleFormat,
          }),
          text,
          { ...ASK_SETTINGS, allowClarify: !deps.simpleFormat && via !== 'clarify' },
          deps.now,
        )
      : { reply: null, error: 'offline' };
  if (outcome.reply === null) {
    // The model failed or is off: the closest answer from a scene already watched, if any.
    const similar = deps.memory?.recallSimilar(recallQuery);
    if (similar) {
      outcome = {
        reply: { kind: 'answer', text: similar.answer, next: similar.next, sources: [] },
      };
      fromMemory = true;
    }
  } else if (outcome.reply.kind === 'answer' && !fromMemory) {
    deps.memory?.remember({ ...recallQuery, answer: outcome.reply.text, next: outcome.reply.next });
  }
  const said = toPipSay(outcome, LINES);
  return {
    ...said,
    isAnswer: outcome.reply?.kind === 'answer',
    log: {
      kind: fromMemory ? 'memory' : (outcome.reply?.kind ?? 'fallback'),
      path: 'notes',
      modelMs: outcome.ms ?? null,
      ...(outcome.reply ? {} : { error: outcome.error }),
    },
  };
}

function toPipSay(
  outcome: AskOutcome,
  lines: PipLines,
): Pick<PipSay, 'text' | 'next' | 'clarify' | 'source'> {
  const reply = outcome.reply;
  if (reply?.kind === 'answer')
    return { text: reply.text, next: reply.next, clarify: [], source: 'ai' };
  if (reply?.kind === 'clarify') {
    return { text: lines.didYouMean, next: [], clarify: reply.options, source: 'ai' };
  }
  const error = outcome.reply === null ? outcome.error : '';
  const text =
    error === 'offline' ? lines.offline : error === 'unparsed' ? lines.unparsed : lines.modelFailed;
  return { text, next: [], clarify: [], source: 'template' };
}
