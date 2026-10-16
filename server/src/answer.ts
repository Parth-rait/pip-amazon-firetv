// Answering a question about the film: spoiler boundary, then retrieval, then (only if needed) the
// model, then the answer gate. Never throws; every path ends in a reply people can see.
import { runAsk } from './core/ai/ask.js';
import type { TextModel } from './core/ai/model.js';
import type { AnswerCache, CacheKeyParts } from './core/context/answer-cache.js';
import { permittedEvidence, type EvidenceSet } from './core/context/boundary.js';
import { checkAnswer } from './core/context/check-answer.js';
import { entitiesNear, mentionedEntities, retrieve } from './core/context/retrieve.js';
import { containsTerm, contentWords } from './core/context/text.js';
import type { ReviewPolicy, Timeline, TimedFact } from './core/context/timeline.js';
import type { QuestionTopic } from './core/intent/route-text.js';
import { cleanText } from './core/ai/clean-text.js';
import { buildAskPrompt, type HistoryItem } from './film/ask-prompt.js';
import { ASK_PROMPT_VERSION } from './film/prompts.js';
import { LINES } from './lines.js';
import type { AskVia, ReplyKind, Source } from './shared/protocol.js';

export const ASK_SETTINGS = { maxTokens: 200, temperature: 0.2, timeoutMs: 6000 } as const;
const RETRIEVE = { limit: 10, recentCount: 4 } as const;
const IDENTIFY_WINDOW_SEC = 30;
const MIN_KEYWORD_SCORE = 2; // matched content words (an entity name counts double)

export interface AnswerDeps {
  model: TextModel;
  modelId: string;
  aiEnabled: boolean;
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
  | 'retrieval'
  | 'cache'
  | 'model'
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

/** Every entity name and alias in the timeline, revealed or not. */
export function lexiconOf(timeline: Timeline): string[] {
  return timeline.entities.flatMap((e) => [e.name, ...e.aliases]);
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
      text: LINES.notSure,
    });
  }
  const direct = retrievalAnswer(req, evidence, deps.aiEnabled);
  if (direct) return gate(direct, req.timeline, evidence);
  if (!deps.aiEnabled) {
    return reply(evidence, 'ai-off', { kind: 'fallback', source: 'template', text: LINES.aiOff });
  }
  return modelAnswer(req, evidence, deps);
}

/** Applies the answer gate to a reply that has text and sources. */
function gate(result: AnswerResult, timeline: Timeline, evidence: EvidenceSet): AnswerResult {
  if (result.kind !== 'answer') return result;
  const verdict = checkAnswer(result.text, result.sources, evidence, lexiconOf(timeline));
  if (verdict.ok) return { ...result, next: safeChips(result.next, evidence) };
  return {
    ...result,
    kind: 'unknown',
    source: 'template',
    text: LINES.notSure,
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
      text: cleanText(latest.map((f) => f.text).join(' ')),
      sources: latest.map((f) => f.id),
      next: ['Who is that?', 'Why did they do that?'],
    });
  }
  if (req.topic === 'identify') {
    const asked = mentionedEntities(evidence.entities, req.question);
    const near = entitiesNear(evidence, IDENTIFY_WINDOW_SEC);
    // Pip speaks briefly: who was named, or else the one figure seen most recently.
    const people =
      asked.size > 0 ? evidence.entities.filter((e) => asked.has(e.id)) : near.slice(0, 1);
    if (people.length > 0) {
      const ids = new Set(people.map((p) => p.id));
      const sources = evidence.facts.filter((f) => f.entities.some((id) => ids.has(id))).slice(-2);
      return reply(evidence, 'retrieval', {
        kind: 'answer',
        source: 'timeline',
        text: cleanText(people.map((p) => p.intro).join(' ')),
        sources: sources.map((f) => f.id),
        next: [`What is ${people[0]?.name ?? 'it'} doing?`, 'What just happened?'],
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
    promptVersion: ASK_PROMPT_VERSION,
    modelId: deps.modelId,
    isClarifyPick: req.via === 'clarify',
  };
  const cached = deps.cache.get(keyParts, deps.now());
  if (cached) {
    return reply(evidence, 'cache', { kind: 'answer', source: 'ai', ...cached });
  }
  const facts = retrieve(evidence, req.question, RETRIEVE);
  const prompt = buildAskPrompt({
    title: req.film.title,
    positionSec: req.positionSec,
    premise: req.film.premise,
    facts,
    history: req.history,
    question: req.question,
    via: req.via,
  });
  const outcome = await runAsk(
    deps.model,
    prompt,
    req.question,
    { ...ASK_SETTINGS, allowClarify: req.via !== 'clarify' },
    deps.now,
  );
  if (!outcome.reply) {
    const text = outcome.error === 'unparsed' ? LINES.notSure : LINES.modelFailed;
    return reply(evidence, 'model', {
      kind: 'fallback',
      source: 'template',
      text,
      error: outcome.error,
      modelMs: outcome.ms,
    });
  }
  if (outcome.reply.kind === 'clarify') {
    const options = safeChips(outcome.reply.options, evidence);
    if (options.length < 2) {
      return reply(evidence, 'model', {
        kind: 'unknown',
        source: 'template',
        text: LINES.notSure,
        withheld: 'restricted-term:clarify',
        modelMs: outcome.ms,
      });
    }
    return reply(evidence, 'model', {
      kind: 'clarify',
      source: 'ai',
      text: LINES.didYouMean,
      clarify: options,
      modelMs: outcome.ms,
    });
  }
  const checked = gate(
    reply(evidence, 'model', {
      kind: 'answer',
      source: 'ai',
      text: outcome.reply.text,
      next: outcome.reply.next,
      sources: outcome.reply.sources,
      modelMs: outcome.ms,
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
  }
  return checked;
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
  if (result.kind !== 'answer' || positionSec >= result.boundarySec) return result;
  const evidence = permittedEvidence(timeline, positionSec, policy);
  return gate(
    { ...result, evidenceKey: evidence.key, boundarySec: positionSec },
    timeline,
    evidence,
  );
}
