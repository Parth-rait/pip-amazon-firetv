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
import { emptyTimeline, type Timeline, type TimedFact } from './core/context/timeline.js';
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
    expect(result).toMatchObject({ kind: 'unknown', text: LINES.unparsed });
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
      text: LINES.unparsed,
      error: 'unparsed',
    });
  });

  it('with AI off, answers a clear keyword match from the timeline and otherwise says so', async () => {
    const { deps: d, complete } = deps(LEAKY, { aiEnabled: false });
    const match = await answerQuestion(request('Where did Ember carry the lantern?', 60), d);
    expect(match).toMatchObject({ kind: 'answer', source: 'timeline', sources: ['f5'] });
    expect(await answerQuestion(request('Is it cold?', 60), d)).toMatchObject({
      kind: 'fallback',
      text: LINES.offline,
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
    expect(rewound).toMatchObject({ kind: 'unknown', text: LINES.unparsed });
  });
});

/**
 * A machine-made timeline, the shape the video-understanding pipeline writes: a character known by
 * its look until its name is heard, captions with honest confidence, and dialogue.
 */
function generated(): Timeline {
  const fact = (
    id: string,
    revealSec: number,
    text: string,
    entities: string[],
    confidence: number,
    kind: TimedFact['kind'] = 'event',
  ): TimedFact => ({
    id,
    startSec: revealSec,
    revealSec,
    kind,
    text,
    entities,
    spoilerTerms: [],
    evidence: [{ ref: `fr-${id}`, atSec: revealSec }],
    confidence,
    review: 'candidate',
  });
  return {
    contentId: 'gen',
    version: 'g1',
    durationSec: 600,
    entities: [
      {
        id: 'c1',
        name: 'young woman with red hair',
        aliases: [],
        firstSeenSec: 10,
        intro: 'A young woman with red hair, first seen in a snowy mountain at 0:10.',
        review: 'candidate',
      },
      {
        id: 'c2',
        name: 'Scales',
        aliases: ['baby dragon'],
        label: 'baby dragon',
        namedSec: 230,
        firstSeenSec: 200,
        intro: 'A baby dragon, first seen in a city rooftop at 3:20.',
        review: 'candidate',
      },
    ],
    facts: [
      fact(
        'a1',
        10,
        'A young woman with red hair appears for the first time.',
        ['c1'],
        0.5,
        'appearance',
      ),
      fact('e1', 20, 'The woman searches the mountain for her lost friend.', ['c1'], 0.7),
      fact(
        'a2',
        200,
        'A baby dragon appears for the first time: lies hurt.',
        ['c2'],
        0.5,
        'appearance',
      ),
      fact('e2', 215, 'The woman bandages the baby dragon.', ['c1', 'c2'], 0.85),
      fact(
        'n2',
        230,
        'The baby dragon is called Scales: someone says "Goodnight, Scales."',
        ['c2'],
        0.7,
        'relation',
      ),
      fact('e3', 400, 'Snow falls on an empty valley.', [], 0.7),
    ],
  };
}

describe('answerQuestion on a generated timeline', () => {
  const ask = (question: string, positionSec: number) =>
    request(question, positionSec, { timeline: generated() });
  const candidateDeps = (reply = LEAKY) => deps(reply, { policy: 'candidate' });

  it('hedges "who is that" when the only sighting is unconfirmed', async () => {
    const { deps: d } = candidateDeps();
    const result = await answerQuestion(ask('Who is that?', 205), d);
    expect(result.text).toBe(`${LINES.hedge} A baby dragon, first seen in a city rooftop at 3:20.`);
  });

  it('answers plainly once the sighting is confirmed, and by name only after it is heard', async () => {
    const { deps: d } = candidateDeps();
    const before = await answerQuestion(ask('Who is that?', 220), d);
    expect(before.text).toBe('A baby dragon, first seen in a city rooftop at 3:20.');
    expect(before.text).not.toContain('Scales');
    const after = await answerQuestion(ask('Who is that?', 235), d);
    expect(after.text).toBe("That's Scales. A baby dragon, first seen in a city rooftop at 3:20.");
  });

  it('keeps a name back until it is heard, even when asked directly', async () => {
    const { deps: d, complete } = candidateDeps();
    expect(await answerQuestion(ask('Is the dragon called Scales?', 220), d)).toMatchObject({
      kind: 'unknown',
      path: 'restricted-question',
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('says it cannot tell who is on screen when nobody has been seen lately', async () => {
    const { deps: d, complete } = candidateDeps();
    const result = await answerQuestion(ask('Who is that?', 420), d);
    expect(result).toMatchObject({ kind: 'unknown', text: LINES.cantTellWho });
    expect(complete).not.toHaveBeenCalled();
  });

  it('gives "why did she do that" the earlier scenes of whoever is on screen', async () => {
    const { deps: d, complete } = candidateDeps(
      'ANSWER: She is looking after the dragon she found.\nSOURCES: e2',
    );
    await answerQuestion(ask('Why did she do that?', 216), d);
    const prompt = complete.mock.calls[0]?.[0].user ?? '';
    // e1 shares no word with the question; it is there because it is about the woman on screen.
    expect(prompt).toContain('[e1 ');
    expect(prompt).not.toContain('Scales');
  });
});

describe('answerQuestion: what if', () => {
  const EVENTS = [
    "In Pip's version, the fox curls up by the lantern.",
    'The snow stops falling.',
    'The forest is quiet and warm.',
  ];
  const STORY = JSON.stringify({ events: EVENTS });

  it('makes up a story from the facts revealed so far only, labelled as imagined', async () => {
    const { deps: d, complete } = deps(STORY);
    const result = await answerQuestion(request('What if the fox stayed home?', 40), d);
    expect(result).toMatchObject({ kind: 'imagined', source: 'imagined', path: 'imagine' });
    expect(result.text).toBe(EVENTS.join(' '));
    const prompt = complete.mock.calls[0]?.[0] as CompleteInput;
    expect(prompt.format).toBe('json');
    const later = timeline.facts.filter((f) => f.revealSec > 40);
    for (const fact of later) expect(prompt.user).not.toContain(fact.text);
  });

  it('keeps a story that uses a word from later, so a made-up ending cannot give the real one away', async () => {
    const { deps: d, complete } = deps(
      JSON.stringify({
        events: [
          "In Pip's version, Moss the badger lights the lighthouse.",
          'Everyone cheers.',
          'The end.',
        ],
      }),
    );
    const result = await answerQuestion(request('Give it a better ending', 40), d);
    expect(result).toMatchObject({ kind: 'unknown', text: LINES.imagineWithheld });
    expect(result.withheld).toMatch(/^restricted-term:/);
    expect(complete).toHaveBeenCalledTimes(2); // told again once before giving up
  });

  it('rewrites the ending from the whole film once it is over', async () => {
    const { deps: d, complete } = deps(STORY);
    await answerQuestion(request('Give it a happier ending', timeline.durationSec), d);
    const prompt = complete.mock.calls[0]?.[0] as CompleteInput;
    expect(prompt.user).toContain('the end of the film');
    expect(prompt.user).toContain(timeline.facts.at(-1)?.text ?? '');
  });

  it('refuses prose where the schema asks for events, and says so after one more try', async () => {
    const { deps: d, complete } = deps('Once upon a time the fox went home.');
    const result = await answerQuestion(request('What if the fox stayed home?', 40), d);
    expect(result).toMatchObject({ kind: 'fallback', text: LINES.unparsed });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('routes "what if" and "a better ending" to a story, and "how does it end" still to no spoilers', () => {
    for (const q of [
      'What if Sintel stayed home?',
      'Give it a better ending',
      'Imagine the bunny was mean',
    ])
      expect(routeText(q)).toEqual({ kind: 'question', topic: 'imagine' });
    expect(routeText('How does it end?')).toEqual({ kind: 'question', topic: 'future' });
  });
});
