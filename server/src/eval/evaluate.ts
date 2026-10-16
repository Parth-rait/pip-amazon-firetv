// The benchmark: runs evaluation examples through the real answer pipeline with one strategy
// (timeline only, a fake careful model, a fake leaky model, or a real model) and scores them.
import { performance } from 'node:perf_hooks';
import { answerQuestion, type AnswerResult } from '../answer.js';
import type { TextModel } from '../core/ai/model.js';
import { createAnswerCache } from '../core/context/answer-cache.js';
import { isAbstention } from '../core/context/check-answer.js';
import { containsTerm } from '../core/context/text.js';
import type { Timeline } from '../core/context/timeline.js';
import { routeText } from '../core/intent/route-text.js';
import type { EvalExample } from '../pipeline/dataset.js';

export interface Strategy {
  name: string;
  model: TextModel | null; // null = AI off (timeline answers only)
  modelId: string;
  simpleFormat?: boolean; // a small local model gets the simple prompt, as in the server
}

export interface ExampleResult {
  id: string;
  task: EvalExample['task'];
  variant: 'fresh' | 'after-rewind';
  kind: string;
  path: string;
  text: string;
  sources: string[];
  leaked: string[]; // mustNotMention terms found in the reply (critical)
  correct: boolean;
  ms: number;
}

export interface Summary {
  strategy: string;
  examples: number;
  leaks: number;
  spoilerProbes: number;
  abstainExpected: number;
  abstainCorrect: number;
  answerExpected: number;
  answered: number;
  citeHits: number;
  citeExpected: number;
  routing: number;
  routingCorrect: number;
  ungrounded: number; // sources outside the allowed facts (must be 0)
  p50Ms: number;
  p95Ms: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

function leaksOf(result: AnswerResult, terms: string[]): string[] {
  const shown = [result.text, ...result.next, ...result.clarify].join(' \n ');
  return terms.filter((t) => containsTerm(shown, t));
}

function routeKind(question: string): { kind: string; intent?: unknown } {
  const route = routeText(question);
  if (route.kind === 'action') return { kind: 'action', intent: route.intent };
  if (route.kind === 'ambiguous-command') return { kind: 'ambiguous' };
  return { kind: route.kind };
}

/** Runs every example once (twice for spoiler probes: fresh, and after the cache saw the ending). */
export async function evaluate(
  examples: EvalExample[],
  timeline: Timeline,
  film: { title: string; premise: string },
  strategy: Strategy,
): Promise<{ results: ExampleResult[]; summary: Summary }> {
  const results: ExampleResult[] = [];
  const deps = {
    model: strategy.model ?? { complete: async () => '' },
    modelId: strategy.modelId,
    aiEnabled: strategy.model !== null,
    simpleFormat: strategy.simpleFormat,
    cache: createAnswerCache(500, 60 * 60 * 1000),
    policy: 'accepted' as const,
    now: Date.now,
  };
  const ask = async (example: EvalExample, atSec: number) => {
    const route = routeText(example.question);
    const started = performance.now();
    const result = await answerQuestion(
      {
        film,
        timeline,
        positionSec: atSec,
        history: [],
        question: example.question,
        via: 'typed',
        topic: route.kind === 'question' ? route.topic : 'other',
      },
      deps,
    );
    return { result, ms: performance.now() - started };
  };

  for (const example of examples) {
    if (example.task === 'routing') {
      const started = performance.now();
      const got = routeKind(example.question);
      const correct =
        got.kind === example.expect.kind &&
        JSON.stringify(got.intent ?? null) === JSON.stringify(example.expect.intent ?? null);
      results.push({
        id: example.id,
        task: example.task,
        variant: 'fresh',
        kind: got.kind,
        path: 'router',
        text: '',
        sources: [],
        leaked: [],
        correct,
        ms: performance.now() - started,
      });
      continue;
    }
    const variants: ExampleResult['variant'][] = example.expect.mustNotMention
      ? ['fresh', 'after-rewind']
      : ['fresh'];
    for (const variant of variants) {
      if (variant === 'after-rewind') await ask(example, timeline.durationSec); // warm the cache at the end
      const { result, ms } = await ask(example, example.atSec);
      const leaked = leaksOf(result, example.expect.mustNotMention ?? []);
      const abstained =
        result.kind === 'unknown' || result.kind === 'fallback' || isAbstention(result.text);
      const cited = (example.expect.cites ?? []).some((id) => result.sources.includes(id));
      const mentioned = (example.expect.mention ?? []).every((m) => containsTerm(result.text, m));
      const correct =
        example.expect.kind === 'abstain'
          ? abstained && leaked.length === 0
          : result.kind === 'answer' &&
            !abstained &&
            (example.expect.cites ? cited : true) &&
            mentioned;
      results.push({
        id: example.id,
        task: example.task,
        variant,
        kind: result.kind,
        path: result.path,
        text: result.text,
        sources: result.sources,
        leaked,
        correct,
        ms,
      });
    }
  }
  return { results, summary: summarize(strategy.name, examples, results) };
}

function summarize(strategy: string, examples: EvalExample[], results: ExampleResult[]): Summary {
  const byId = new Map(examples.map((e) => [e.id, e]));
  const answers = results.filter((r) => r.task !== 'routing');
  const expectAbstain = answers.filter((r) => byId.get(r.id)?.expect.kind === 'abstain');
  const expectAnswer = answers.filter((r) => byId.get(r.id)?.expect.kind === 'answer');
  const withCites = expectAnswer.filter((r) => byId.get(r.id)?.expect.cites);
  const routing = results.filter((r) => r.task === 'routing');
  return {
    strategy,
    examples: examples.length,
    leaks: answers.filter((r) => r.leaked.length > 0).length,
    spoilerProbes: answers.filter((r) => byId.get(r.id)?.expect.mustNotMention).length,
    abstainExpected: expectAbstain.length,
    abstainCorrect: expectAbstain.filter((r) => r.correct).length,
    answerExpected: expectAnswer.length,
    answered: expectAnswer.filter((r) => r.correct).length,
    citeHits: withCites.filter((r) =>
      (byId.get(r.id)?.expect.cites ?? []).some((id) => r.sources.includes(id)),
    ).length,
    citeExpected: withCites.length,
    routing: routing.length,
    routingCorrect: routing.filter((r) => r.correct).length,
    ungrounded: answers.filter((r) =>
      r.sources.some((id) => !(byId.get(r.id)?.allowedFacts ?? []).includes(id)),
    ).length,
    p50Ms: percentile(
      answers.map((r) => r.ms),
      50,
    ),
    p95Ms: percentile(
      answers.map((r) => r.ms),
      95,
    ),
  };
}
