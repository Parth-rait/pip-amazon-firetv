// Answering a question from a film's evidence timeline (vNext, from the cloud session's
// claude/pip-vnext-core): spoiler boundary, then retrieval, then (only if needed) the model, then
// the answer gate. Never throws; every path ends in a reply people can see. Films without a
// timeline still use the notes path in flow.ts.
import { runAsk } from './core/ai/ask.js';
import { cleanText } from './core/ai/clean-text.js';
import type { TextModel } from './core/ai/model.js';
import type { AnswerCache, CacheKeyParts } from './core/context/answer-cache.js';
import { permittedEvidence, type EvidenceSet } from './core/context/boundary.js';
import { checkAnswer } from './core/context/check-answer.js';
import { entitiesNear, mentionedEntities, retrieve } from './core/context/retrieve.js';
import { containsTerm, contentWords } from './core/context/text.js';
import type { Entity, ReviewPolicy, Timeline, TimedFact } from './core/context/timeline.js';
import type { QuestionTopic } from './core/intent/route-text.js';
import { BRANCH_FACTS, writeEvents } from './branch.js';
import { buildBranchPrompt, buildGroundedPrompt, type HistoryItem } from './film/ask-prompt.js';
import { ASK_SETTINGS, GROUNDED_PROMPT_VERSION } from './film/prompts.js';
import { LINES } from './lines.js';
import type { AskVia, Source } from './shared/protocol.js';

/**
 * answer: from the facts; clarify: "Did you mean"; unknown: Pip abstains; fallback: no model;
 * imagined: a made-up "what if" story (never history, never cached).
 */
export type ReplyKind = 'answer' | 'clarify' | 'unknown' | 'fallback' | 'imagined';
const RETRIEVE = { limit: 10, recentCount: 4 } as const;
const END_MARGIN_SEC = 30; // this close to the end, a story rewrites the whole film
const UPDATE_AFTER_SEC = 60;
// A model reply that only says the facts do not tell (it is an abstention, not an answer).
const NOT_SAID =
  /\b(?:not (?:been )?(?:mentioned|said|shown|specified|described|stated|given)|(?:does not|doesn'?t) (?:say|mention)|no (?:information|mention)|in the (?:facts|notes|premise))\b/i;
const IDENTIFY_WINDOW_SEC = 30;
// Below this, an answer resting on the fact says it is unsure (CONFIDENCE in
// pipeline/scene-memory.ts: a character seen once, or linked only by look, is below it).
const HEDGE_BELOW = 0.6;
const COVERAGE_MARGIN_SEC = 10;
const FOCUS_ENTITIES = 2; // "why did she do that?": the latest figures on screen are "she"
const PRONOUN = /\b(he|she|they|him|her|them|his|hers|their|it|that|this)\b/i;
const MIN_KEYWORD_SCORE = 2; // matched content words (an entity name counts double)

export interface AnswerDeps {
  model: TextModel;
  modelId: string;
  aiEnabled: boolean;
  simpleFormat?: boolean; // a small local model: no "Did you mean"
  cache: AnswerCache;
  policy: ReviewPolicy;
  now: () => number;
}

export interface AnswerRequest {
  film: { title: string; premise: string };
  timeline: Timeline;
  positionSec: number;
  history: HistoryItem[];
  question: string;
  via: AskVia;
  topic: QuestionTopic;
}

export type AnswerPath =
  | 'no-timeline'
  | 'no-evidence'
  | 'restricted-question'
  | 'future-question'
  | 'not-covered'
  | 'retrieval'
  | 'cache'
  | 'model'
  | 'imagine'
  | 'ai-off';

export interface AnswerResult {
  kind: ReplyKind;
  source: Source;
  text: string;
  next: string[];
  clarify: string[];
  sources: string[]; // fact ids behind the text; internal, never sent to clients
  evidenceKey: string;
  boundarySec: number;
  path: AnswerPath;
  withheld: string | null; // why the gate stopped a reply, for the log
  error: string | null; // model error name or 'unparsed'
  modelMs: number | null;
}

function reply(
  evidence: EvidenceSet,
  path: AnswerPath,
  fields: Partial<AnswerResult> & Pick<AnswerResult, 'kind' | 'source' | 'text'>,
): AnswerResult {
  return {
    next: [],
    clarify: [],
    sources: [],
    withheld: null,
    error: null,
    modelMs: null,
    ...fields,
    evidenceKey: evidence.key,
    boundarySec: evidence.boundarySec,
    path,
  };
}

/**
 * The film's own words, revealed or not: every entity name and alias, and every fact's spoiler
 * terms (names heard, things shown). An answer may use one only with evidence that has it.
 */
export function lexiconOf(timeline: Timeline): string[] {
  return [
    ...new Set([
      ...timeline.entities.flatMap((e) => [e.name, ...e.aliases, ...(e.label ? [e.label] : [])]),
      ...timeline.facts.flatMap((f) => f.spoilerTerms),
    ]),
  ];
}

function safeChips(chips: string[], evidence: EvidenceSet): string[] {
  return chips.filter((chip) => !evidence.restrictedTerms.some((t) => containsTerm(chip, t)));
}

/** The answer to one question at one moment. */
export async function answerQuestion(req: AnswerRequest, deps: AnswerDeps): Promise<AnswerResult> {
  const evidence = permittedEvidence(req.timeline, req.positionSec, deps.policy);
  if (req.timeline.facts.length === 0) {
    return reply(evidence, 'no-timeline', {
      kind: 'unknown',
      source: 'template',
      text: LINES.noTimeline,
    });
  }
  // With no evidence the model is never asked: its own knowledge of a famous film could spoil it.
  if (evidence.facts.length === 0) {
    return reply(evidence, 'no-evidence', {
      kind: 'unknown',
      source: 'template',
      text: LINES.noEvidenceYet,
    });
  }
  // Pip never predicts: what happens later is the one thing it must not say.
  if (req.topic === 'future') {
    return reply(evidence, 'future-question', {
      kind: 'unknown',
      source: 'template',
      text: LINES.noFuture,
    });
  }
  // A question naming something not seen yet gets "not sure": yes or no would both give it away.
  if (evidence.restrictedTerms.some((t) => containsTerm(req.question, t))) {
    return reply(evidence, 'restricted-question', {
      kind: 'unknown',
      source: 'template',
      text: LINES.unparsed,
    });
  }
  if (req.topic === 'imagine') {
    if (!deps.aiEnabled) {
      return reply(evidence, 'ai-off', {
        kind: 'fallback',
        source: 'template',
        text: LINES.offline,
      });
    }
    return imagineAnswer(req, evidence, deps);
  }
  // Past the part of the film that was described, "who is that?" and "what just happened?" would
  // be answered from older scenes as if they were now: say so instead.
  const covered = req.timeline.coveredUntilSec;
  if (
    covered !== undefined &&
    req.positionSec > covered + COVERAGE_MARGIN_SEC &&
    (req.topic === 'recap' || req.topic === 'identify')
  ) {
    return reply(evidence, 'not-covered', {
      kind: 'unknown',
      source: 'template',
      text: LINES.notLookedYet,
    });
  }
  const direct = retrievalAnswer(req, evidence, deps.aiEnabled);
  if (direct) return gate(direct, req.timeline, evidence);
  if (!deps.aiEnabled) {
    return reply(evidence, 'ai-off', { kind: 'fallback', source: 'template', text: LINES.offline });
  }
  return modelAnswer(req, evidence, deps);
}

/** Applies the answer gate to a reply that has text and sources. */
function gate(result: AnswerResult, timeline: Timeline, evidence: EvidenceSet): AnswerResult {
  if (result.kind === 'imagined') return gateImagined(result, timeline, evidence);
  if (result.kind !== 'answer') return result;
  const verdict = checkAnswer(result.text, result.sources, evidence, lexiconOf(timeline));
  if (verdict.ok) return { ...result, next: safeChips(result.next, evidence) };
  return {
    ...result,
    kind: 'unknown',
    source: 'template',
    text: LINES.unparsed,
    next: [],
    sources: [],
    withheld: `${verdict.reason}:${verdict.detail}`,
  };
}

/**
 * Answers straight from reviewed facts: "what just happened" and "who is that" always; any other
 * question only when the model is off and one fact clearly matches.
 */
function retrievalAnswer(
  req: AnswerRequest,
  evidence: EvidenceSet,
  aiEnabled: boolean,
): AnswerResult | null {
  if (req.topic === 'recap') {
    const latest = [...evidence.facts].sort((a, b) => a.revealSec - b.revealSec).slice(-2);
    return reply(evidence, 'retrieval', {
      kind: 'answer',
      source: 'timeline',
      // The gist of each: a fact's first sentence ("Also visible: ..." would crowd out the next).
      text: cleanText(
        latest.map((f) => (f.kind === 'dialogue' ? f.text : firstSentence(f.text))).join(' '),
      ),
      sources: latest.map((f) => f.id),
      next: ['Who is that?', 'Why did they do that?'],
    });
  }
  if (req.topic === 'identify') {
    const asked = mentionedEntities(evidence.entities, req.question);
    // Pip speaks briefly: who was named, or else one figure from the latest scene. With several
    // on screen, "who is that?" is usually about the newcomer, so the latest introduced wins.
    // "Who is that?" points at the screen; "Who is Scales?" names someone, and if Pip cannot match
    // the name, the figure on screen is not the answer.
    const pointing = PRONOUN.test(req.question);
    const people =
      asked.size > 0
        ? evidence.entities.filter((e) => asked.has(e.id))
        : pointing
          ? onScreenNow(evidence)
          : [];
    if (people.length > 0) {
      const ids = new Set(people.map((p) => p.id));
      const sources = evidence.facts.filter((f) => f.entities.some((id) => ids.has(id))).slice(-2);
      const latest = sources[sources.length - 1];
      // Asked by name, the latest thing the film revealed about them may matter most ("The big man
      // calls the old man Thom"): it follows the intro, when it came well after it.
      const update =
        asked.size > 0 &&
        latest &&
        latest.revealSec > (people[0]?.firstSeenSec ?? 0) + UPDATE_AFTER_SEC
          ? cleanText(firstSentence(latest.text))
          : '';
      const text = [cleanText(people.map(introduce).join(' ')), update].filter(Boolean).join(' ');
      return reply(evidence, 'retrieval', {
        kind: 'answer',
        source: 'timeline',
        text: latest && latest.confidence < HEDGE_BELOW ? `${LINES.hedge} ${text}` : text,
        sources: sources.map((f) => f.id),
        next: [`What is ${people[0]?.name ?? 'it'} doing?`, 'What just happened?'],
      });
    }
    // "Who is that?" with nobody on screen lately: say so rather than guess from older scenes.
    if (asked.size === 0 && pointing) {
      return reply(evidence, 'retrieval', {
        kind: 'unknown',
        source: 'template',
        text: LINES.cantTellWho,
      });
    }
  }
  if (!aiEnabled) {
    const best = bestKeywordMatch(evidence, req.question);
    if (best) {
      return reply(evidence, 'retrieval', {
        kind: 'answer',
        source: 'timeline',
        text: cleanText(best.text),
        sources: [best.id],
      });
    }
  }
  return null;
}

/** The newest-introduced figure of the latest fact that shows anyone, within the window. */
function onScreenNow(evidence: EvidenceSet): Entity[] {
  const near = entitiesNear(evidence, IDENTIFY_WINDOW_SEC);
  const latest = [...evidence.facts]
    .reverse()
    .find((f) => f.startSec >= evidence.boundarySec - IDENTIFY_WINDOW_SEC && f.entities.length > 0);
  const shown = near.filter((e) => latest?.entities.includes(e.id));
  return shown.sort((a, b) => b.firstSeenSec - a.firstSeenSec).slice(0, 1);
}

function firstSentence(text: string): string {
  return /^.*?[.!?…]["”]?(?=\s|$)/.exec(text.trim())?.[0] ?? text;
}

/** What Pip says about one entity: its intro, led by its name when the intro does not say it. */
function introduce(entity: Entity): string {
  if (containsTerm(entity.intro, entity.name)) return entity.intro;
  // Until its name is heard, the name is the label ("the baby dragon"), which the intro describes.
  if (entity.label !== undefined && entity.name === entity.label) return entity.intro;
  return `That's ${entity.name.replace(/^The\b/, 'the')}. ${entity.intro}`;
}

/**
 * The permitted fact sharing the most meaningful words with the question, if clearly relevant.
 * Names alone are not enough ("How old is Hoot?" must not return any Hoot fact): at least one
 * other word of the question has to match too.
 */
export function bestKeywordMatch(evidence: EvidenceSet, question: string): TimedFact | null {
  const nameWords = new Set(
    evidence.entities.flatMap((e) => [e.name, ...e.aliases].flatMap(contentWords)),
  );
  const queryWords = new Set(contentWords(question));
  const asked = mentionedEntities(evidence.entities, question);
  let best: { fact: TimedFact; score: number } | null = null;
  for (const fact of evidence.facts) {
    const shared = new Set(contentWords(fact.text).filter((w) => queryWords.has(w)));
    const predicate = [...shared].filter((w) => !nameWords.has(w)).length;
    const score = predicate + fact.entities.filter((id) => asked.has(id)).length;
    if (predicate >= 1 && score >= MIN_KEYWORD_SCORE && (!best || score >= best.score))
      best = { fact, score };
  }
  return best?.fact ?? null;
}

async function modelAnswer(
  req: AnswerRequest,
  evidence: EvidenceSet,
  deps: AnswerDeps,
): Promise<AnswerResult> {
  const keyParts: CacheKeyParts = {
    evidenceKey: evidence.key,
    question: req.question,
    promptVersion: GROUNDED_PROMPT_VERSION,
    modelId: deps.modelId,
    isClarifyPick: req.via === 'clarify',
  };
  const cached = deps.cache.get(keyParts, deps.now());
  if (cached) {
    return reply(evidence, 'cache', { kind: 'answer', source: 'ai', ...cached });
  }
  // "Why did she do that?" names nobody: the figures on screen now are who it is about, so their
  // earlier scenes are retrieved too.
  const named = mentionedEntities(evidence.entities, req.question);
  const focus =
    named.size === 0 && (req.topic === 'why' || PRONOUN.test(req.question))
      ? entitiesNear(evidence, IDENTIFY_WINDOW_SEC)
          .slice(0, FOCUS_ENTITIES)
          .map((e) => e.id)
      : [];
  const facts = retrieve(evidence, req.question, { ...RETRIEVE, focusEntities: focus });
  const prompt = buildGroundedPrompt({
    title: req.film.title,
    positionSec: req.positionSec,
    premise: req.film.premise,
    facts,
    history: req.history,
    question: req.question,
    via: req.via,
    simpleFormat: deps.simpleFormat,
  });
  const outcome = await runAsk(
    deps.model,
    prompt,
    req.question,
    { ...ASK_SETTINGS, allowClarify: !deps.simpleFormat && req.via !== 'clarify' },
    deps.now,
  );
  if (!outcome.reply) {
    const found = fromKeywords(req, evidence);
    if (found) return found;
    const text = outcome.error === 'unparsed' ? LINES.unparsed : LINES.modelFailed;
    return reply(evidence, 'model', {
      kind: 'fallback',
      source: 'template',
      text,
      error: outcome.error,
      modelMs: outcome.ms ?? null,
    });
  }
  if (outcome.reply.kind === 'clarify') {
    const options = safeChips(outcome.reply.options, evidence);
    if (options.length < 2) {
      return reply(evidence, 'model', {
        kind: 'unknown',
        source: 'template',
        text: LINES.unparsed,
        withheld: 'restricted-term:clarify',
        modelMs: outcome.ms ?? null,
      });
    }
    return reply(evidence, 'model', {
      kind: 'clarify',
      source: 'ai',
      text: LINES.didYouMean,
      clarify: options,
      modelMs: outcome.ms ?? null,
    });
  }
  // "Her age is not mentioned in the facts" is Pip not knowing: say so plainly, in Pip's words.
  if (NOT_SAID.test(outcome.reply.text)) {
    return reply(evidence, 'model', {
      kind: 'unknown',
      source: 'template',
      text: LINES.cantTell,
      modelMs: outcome.ms ?? null,
    });
  }
  const checked = gate(
    reply(evidence, 'model', {
      kind: 'answer',
      source: 'ai',
      text: outcome.reply.text,
      next: outcome.reply.next,
      sources: outcome.reply.sources,
      modelMs: outcome.ms ?? null,
    }),
    req.timeline,
    evidence,
  );
  if (checked.kind === 'answer') {
    deps.cache.set(
      keyParts,
      { text: checked.text, next: checked.next, sources: checked.sources },
      deps.now(),
    );
    return checked;
  }
  // The gate withheld the model's words; a reviewed fact that clearly answers is still safe.
  const found = fromKeywords(req, evidence);
  return found ? { ...found, withheld: checked.withheld } : checked;
}

/** The one permitted fact that clearly matches the question, through the gate, or null. */
function fromKeywords(req: AnswerRequest, evidence: EvidenceSet): AnswerResult | null {
  const best = bestKeywordMatch(evidence, req.question);
  if (!best) return null;
  const found = gate(
    reply(evidence, 'retrieval', {
      kind: 'answer',
      source: 'timeline',
      text: cleanText(best.text),
      sources: [best.id],
    }),
    req.timeline,
    evidence,
  );
  return found.kind === 'answer' ? found : null;
}

/**
 * Re-checks a finished answer against a new position, for when the film was rewound while the
 * model was thinking. Returns the answer unchanged, or a withheld "not sure" reply.
 */
export function recheckAtPosition(
  result: AnswerResult,
  timeline: Timeline,
  positionSec: number,
  policy: ReviewPolicy,
): AnswerResult {
  if ((result.kind !== 'answer' && result.kind !== 'imagined') || positionSec >= result.boundarySec)
    return result;
  const evidence = permittedEvidence(timeline, positionSec, policy);
  return gate(
    { ...result, evidenceKey: evidence.key, boundarySec: positionSec },
    timeline,
    evidence,
  );
}

/**
 * "What if...?" asked outside a session (the benchmark, a test): Parallel Stories' engine
 * (branch.ts) writes the events from the facts revealed by now only, and they are read as one
 * story. In a session the same question opens a branch the viewer can explore (flow.ts).
 */
async function imagineAnswer(
  req: AnswerRequest,
  evidence: EvidenceSet,
  deps: AnswerDeps,
): Promise<AnswerResult> {
  const facts = evidence.facts.slice(-BRANCH_FACTS);
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
    { model: deps.model, policy: deps.policy, now: deps.now },
  );
  if (!outcome.ok) {
    return reply(evidence, 'imagine', {
      kind: outcome.reason === 'withheld' ? 'unknown' : 'fallback',
      source: 'template',
      text:
        outcome.reason === 'withheld'
          ? LINES.imagineWithheld
          : outcome.reason === 'model-failed'
            ? LINES.modelFailed
            : LINES.unparsed,
      next: ['What if it went differently?'],
      withheld: outcome.reason === 'withheld' ? outcome.detail : null,
      error: outcome.reason === 'withheld' ? null : (outcome.detail ?? outcome.reason),
    });
  }
  const isEnd = req.positionSec >= req.timeline.durationSec - END_MARGIN_SEC;
  return reply(evidence, 'imagine', {
    kind: 'imagined',
    source: 'imagined',
    text: outcome.events.join(' '),
    sources: facts.map((f) => f.id),
    next: isEnd
      ? ['Give it a happier ending', 'What if it went differently?']
      : ['What happens next?', 'What if it went differently?'],
    modelMs: outcome.modelMs,
  });
}

/**
 * A made-up story may invent, so only the spoiler rules apply: no word the film has not reached
 * and no character not seen yet. Withheld, Pip says why in its own words.
 */
function gateImagined(
  result: AnswerResult,
  timeline: Timeline,
  evidence: EvidenceSet,
): AnswerResult {
  const verdict = checkAnswer(result.text, result.sources, evidence, lexiconOf(timeline));
  if (verdict.ok) return { ...result, next: safeChips(result.next, evidence) };
  return {
    ...result,
    kind: 'unknown',
    source: 'template',
    text: LINES.imagineWithheld,
    next: ['What if it went differently?'],
    sources: [],
    withheld: `${verdict.reason}:${verdict.detail}`,
  };
}
