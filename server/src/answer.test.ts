import { describe, expect, it, vi } from 'vitest';
import {
  answerQuestion,
  recheckAtPosition,
  type AnswerDeps,
  type AnswerRequest,
} from './answer.js';
import { createFakeModel, type CompleteInput } from './core/ai/model.js';
import { createAnswerCache } from './core/context/answer-cache.js';
import { lanternFoxTimeline } from './core/context/fixture.js';
import { emptyTimeline } from './core/context/timeline.js';
import { routeText } from './core/intent/route-text.js';
import { LINES } from './lines.js';

const timeline = lanternFoxTimeline();

function deps(
  reply: string | ((input: CompleteInput) => string | Promise<string>),
  extra: Partial<AnswerDeps> = {},
) {
  const complete = vi.fn(typeof reply === 'string' ? () => reply : reply);
  const value: AnswerDeps = {
    model: createFakeModel(complete),
    modelId: 'fake',
    aiEnabled: true,
    cache: createAnswerCache(50, 60_000),
    policy: 'accepted',
    now: () => 0,
    ...extra,
  };
  return { deps: value, complete };
}

function request(
  question: string,
  positionSec: number,
  extra: Partial<AnswerRequest> = {},
): AnswerRequest {
  const route = routeText(question);
  return {
    film: { title: 'The Lantern Fox', premise: 'A fox in a snowy forest.' },
    timeline,
    positionSec,
    history: [],
    question,
    via: 'typed',
    topic: route.kind === 'question' ? route.topic : 'other',
    ...extra,
  };
}

// A model that "knows the whole story", like a real model may for a famous film.
const LEAKY =
  'ANSWER: The lantern belongs to Moss the badger, who keeps the lighthouse.\nNEXT: Will it glow?\nSOURCES: f3';

describe('answerQuestion', () => {
  it('abstains without calling the model when the film has no timeline', async () => {
    const { deps: d, complete } = deps(LEAKY);
    const result = await answerQuestion(
      request('Who is that?', 50, { timeline: emptyTimeline('x', 96) }),
      d,
    );
    expect(result).toMatchObject({ kind: 'unknown', path: 'no-timeline', text: LINES.noTimeline });
    expect(complete).not.toHaveBeenCalled();
  });

  it('abstains without calling the model before any fact is revealed', async () => {
    const { deps: d, complete } = deps(LEAKY);
    expect(await answerQuestion(request('How does it end?', 2), d)).toMatchObject({
      kind: 'unknown',
      path: 'no-evidence',
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('answers "not sure" to a question naming something not seen yet', async () => {
    const { deps: d, complete } = deps(LEAKY);
    const result = await answerQuestion(request('Who is Moss?', 30), d);
    expect(result).toMatchObject({ kind: 'unknown', path: 'restricted-question' });
    expect(complete).not.toHaveBeenCalled();
  });

  it('answers "what just happened" from the latest reviewed facts, without the model', async () => {
    const { deps: d, complete } = deps(LEAKY);
    const result = await answerQuestion(request('What just happened?', 41), d);
    expect(result).toMatchObject({
      kind: 'answer',
      source: 'timeline',
      path: 'retrieval',
      sources: ['f3', 'f4'],
    });
    expect(result.text).toContain('Hoot');
    expect(complete).not.toHaveBeenCalled();
  });

  it('answers "who is that" with who is on screen now', async () => {
    const { deps: d } = deps(LEAKY);
    const result = await answerQuestion(request('Who is that?', 41), d);
    expect(result).toMatchObject({ kind: 'answer', path: 'retrieval' });
    expect(result.text).toContain('Hoot');
    expect(result.text).not.toMatch(/Moss|badger/);
  });

  it('passes a grounded model answer and caches it', async () => {
    const { deps: d, complete } = deps(
      'ANSWER: Hoot said the lantern belongs to someone.\nNEXT: Who is Hoot?\nSOURCES: f4',
    );
    const first = await answerQuestion(request('What did the owl say?', 45), d);
    expect(first).toMatchObject({ kind: 'answer', source: 'ai', path: 'model', sources: ['f4'] });
    const again = await answerQuestion(request('what did the owl say', 45), d);
    expect(again.path).toBe('cache');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('withholds a model answer that leaks a later name, and drops leaky chips', async () => {
    const { deps: d } = deps(LEAKY);
    const result = await answerQuestion(request('Whose is the lantern?', 30), d);
    expect(result).toMatchObject({ kind: 'unknown', text: LINES.notSure });
    expect(result.withheld).toMatch(/^restricted-term:/);
    expect(result.next).toEqual([]);
  });

  it('withholds a model answer citing a fact the family has not seen', async () => {
    const { deps: d } = deps('ANSWER: Ember walks on.\nSOURCES: f2, f9');
    expect((await answerQuestion(request('Is Ember tired?', 30), d)).withheld).toBe(
      'unknown-source:f9',
    );
  });

  it('withholds an uncited claim about the film', async () => {
    const { deps: d } = deps('ANSWER: Ember is the bravest fox ever.\nSOURCES: none');
    expect((await answerQuestion(request('Is Ember brave?', 30), d)).withheld).toMatch(
      /^uncited-claim/,
    );
  });

  it('never caches across a rewind: earlier evidence means a fresh, checked call', async () => {
    let call = 0;
    const replies = [
      'ANSWER: Ember climbed up and the lighthouse shines again.\nSOURCES: f7',
      'ANSWER: I am not sure yet.\nSOURCES: none',
    ];
    const { deps: d, complete } = deps(() => replies[call++] ?? '');
    const late = await answerQuestion(request('Is the lake frozen?', 85), d);
    expect(late.kind).toBe('answer');
    const rewound = await answerQuestion(request('Is the lake frozen?', 66), d);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(rewound.text).not.toMatch(/shines again/);
  });

  it('filters "Did you mean" options that would spoil, and abstains if too few remain', async () => {
    const { deps: d } = deps('CLARIFY: Is it Moss? | Will the lantern glow? | Where did Ember go?');
    expect(await answerQuestion(request('what was that thing', 30), d)).toMatchObject({
      kind: 'unknown',
    });
    const ok = deps('CLARIFY: The fox? | The lantern? | The owl tree?');
    expect(await answerQuestion(request('what was that thing', 45), ok.deps)).toMatchObject({
      kind: 'clarify',
      clarify: ['The fox?', 'The lantern?', 'The owl tree?'],
    });
  });

  it('gives the fixed lines for model failures and unusable replies', async () => {
    const failing = deps(() => {
      throw new Error('boom');
    });
    expect(await answerQuestion(request('Is the lake cold?', 45), failing.deps)).toMatchObject({
      kind: 'fallback',
      text: LINES.modelFailed,
      error: 'Error',
    });
    const empty = deps('NEXT: a | b');
    expect(await answerQuestion(request('Is the lake cold?', 45), empty.deps)).toMatchObject({
      kind: 'fallback',
      text: LINES.notSure,
      error: 'unparsed',
    });
  });

  it('with AI off, answers a clear keyword match from the timeline and otherwise says so', async () => {
    const { deps: d, complete } = deps(LEAKY, { aiEnabled: false });
    const match = await answerQuestion(request('Where did Ember carry the lantern?', 60), d);
    expect(match).toMatchObject({ kind: 'answer', source: 'timeline', sources: ['f5'] });
    expect(await answerQuestion(request('Is it cold?', 60), d)).toMatchObject({
      kind: 'fallback',
      text: LINES.aiOff,
    });
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('questions about later and names without a predicate', () => {
  it('answers a question about the future with the no-spoiler line, without any model', async () => {
    const { deps: d, complete } = deps(LEAKY);
    const result = await answerQuestion(request('What happens next?', 60), d);
    expect(result).toMatchObject({
      kind: 'unknown',
      path: 'future-question',
      text: LINES.noFuture,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not answer "How old is Hoot?" with an unrelated Hoot fact when AI is off', async () => {
    const { deps: d } = deps(LEAKY, { aiEnabled: false });
    expect(await answerQuestion(request('How old is Hoot?', 95), d)).toMatchObject({
      kind: 'fallback',
    });
  });
});

describe('recheckAtPosition', () => {
  it('withholds an answer that relied on facts after a rewind', async () => {
    const { deps: d } = deps('ANSWER: The lantern glows blue now.\nSOURCES: f5');
    const result = await answerQuestion(request('What is the lantern doing?', 60), d);
    expect(result.kind).toBe('answer');
    expect(recheckAtPosition(result, timeline, 59, 'accepted')).toMatchObject({
      kind: 'answer',
      text: result.text,
    });
    const rewound = recheckAtPosition(result, timeline, 30, 'accepted');
    expect(rewound).toMatchObject({ kind: 'unknown', text: LINES.notSure });
  });
});

describe('createTypeSafeJudge', () => {
  it('maps a typed choice to a judgement, and returns null on errors or odd labels', async () => {
    const { createTypeSafeJudge } = await import('./typesafe-judge.js');
    const choice = (instructions: string, criteria: Record<string, string>) => ({
      type: 'choice',
      instructions,
      criteria,
    });
    const ok = createTypeSafeJudge(
      {
        systemOne: async () => ({
          answers: { intent: { choice: 'playback-command', confidence: 0.91 } },
        }),
      },
      choice,
      100,
    );
    expect(await ok.judge('hold it')).toEqual({ label: 'playback-command', confidence: 0.91 });
    const odd = createTypeSafeJudge(
      { systemOne: async () => ({ answers: { intent: { choice: 'launch', confidence: 1 } } }) },
      choice,
      100,
    );
    expect(await odd.judge('x')).toBeNull();
    const down = createTypeSafeJudge(
      {
        systemOne: async () => {
          throw new Error('offline');
        },
      },
      choice,
      100,
    );
    expect(await down.judge('x')).toBeNull();
  });
});
