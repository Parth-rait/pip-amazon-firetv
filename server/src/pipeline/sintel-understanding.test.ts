// Video understanding on a real film: Sintel (Blender Foundation, CC BY 3.0), as the pipeline
// produced it on 17 Oct 2026 (qwen3-vl:4b-instruct on 106 frames, 0 to 384 s; whisper.cpp
// small.en on the whole soundtrack). Everything here runs from committed files, without a model:
// - pipeline/understanding/sintel.observations.json: every reply the vision model gave
// - pipeline/timelines/sintel.json: the timeline the server loads
// - pipeline/truth/sintel.characters.json: who is on screen in 54 frames, labelled by hand
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { answerQuestion, recheckAtPosition, type AnswerResult } from '../answer.js';
import { createFakeModel, type CompleteInput } from '../core/ai/model.js';
import { createAnswerCache } from '../core/context/answer-cache.js';
import { permittedEvidence } from '../core/context/boundary.js';
import type { Timeline } from '../core/context/timeline.js';
import { routeText } from '../core/intent/route-text.js';
import { checkTimelineFile, toTimeline, type TimelineFile } from '../film/timeline-file.js';
import { LINES } from '../lines.js';
import { characterTruthSchema, scoreTracking } from './tracking-score.js';
import { candidatesFromRecording, type UnderstandingRecording } from './understand.js';

const SERVER = fileURLToPath(new URL('../..', import.meta.url));
const json = (path: string): unknown => JSON.parse(readFileSync(join(SERVER, path), 'utf8'));

function loadFile(): TimelineFile {
  const checked = checkTimelineFile(json('pipeline/timelines/sintel.json'));
  if (!checked.ok) throw new Error(checked.problems.join('\n'));
  return checked.file;
}
const file = loadFile();
const timeline: Timeline = toTimeline(file, 'test');
const recording = json('pipeline/understanding/sintel.observations.json') as UnderstandingRecording;
const reveal = new Map(timeline.facts.map((f) => [f.id, f.revealSec]));

interface Asked {
  result: AnswerResult;
  prompts: CompleteInput[];
}

/** Asks Pip at a moment of the film, with a model that says `reply` (and records what it saw). */
async function ask(
  question: string,
  atSec: number,
  reply = 'ANSWER: I am not sure.\nSOURCES:',
): Promise<Asked> {
  const prompts: CompleteInput[] = [];
  const route = routeText(question);
  const result = await answerQuestion(
    {
      film: { title: 'Sintel', premise: 'A young woman crosses snowy mountains alone.' },
      timeline,
      positionSec: atSec,
      history: [],
      question,
      via: 'typed',
      topic: route.kind === 'question' ? route.topic : 'other',
    },
    {
      model: createFakeModel((input) => {
        prompts.push(input);
        return reply;
      }),
      modelId: 'fake',
      aiEnabled: true,
      cache: createAnswerCache(10, 60_000),
      policy: 'candidate', // the generated facts are unreviewed candidates
      now: () => 0,
    },
  );
  return { result, prompts };
}

describe('Sintel: the recorded run', () => {
  it('rebuilds exactly the committed timeline from the recorded model replies', () => {
    const { candidates } = candidatesFromRecording(recording, {
      lines: file.lines,
      scenes: file.scenes,
      createdAt: 'test',
      method: 'test',
    });
    const strip = (f: {
      id: string;
      text: string;
      revealSec: number;
      entities: string[];
      spoilerTerms: string[];
      evidence: string[];
    }) => ({
      id: f.id,
      text: f.text,
      revealSec: f.revealSec,
      entities: f.entities,
      spoilerTerms: f.spoilerTerms,
      evidence: f.evidence,
    });
    expect(candidates.facts.map(strip)).toEqual(file.facts.map(strip));
    expect(candidates.entities.map((e) => [e.id, e.name, e.firstSeenSec])).toEqual(
      file.entities.map((e) => [e.id, e.name, e.firstSeenSec]),
    );
    expect(file.coveredUntilSec).toBe(recording.coveredUntilSec);
  });

  it('follows the characters well enough against the hand labels', () => {
    const { memory } = candidatesFromRecording(recording, {
      lines: file.lines,
      scenes: file.scenes,
      createdAt: 'test',
      method: 'test',
    });
    const truth = characterTruthSchema.parse(json('pipeline/truth/sintel.characters.json'));
    const score = scoreTracking(memory, truth);
    // Measured on 17 Oct 2026: 31 labelled frames in the covered part, 18 right links, 4 wrong.
    expect(score.labelledFrames).toBe(31);
    expect(score.links.precision).toBeGreaterThanOrEqual(0.8);
    expect(score.recall).toBeGreaterThanOrEqual(0.7);
    expect(score.presence.invented).toBe(0);
    expect(score.fragments.sintel).toEqual(['c1']); // the heroine is one track from 0:28 on
    expect(score.fragments.shaman).toEqual(['c2']);
  });
});

describe('Sintel: character identification', () => {
  it('says who is on screen, from the latest shot', async () => {
    const { result } = await ask('Who is that?', 50);
    expect(result).toMatchObject({ kind: 'answer', path: 'retrieval' });
    expect(result.text).toMatch(/^A young woman with red hair/);
  });

  it('answers about a character asked by look', async () => {
    const { result } = await ask('Who is the bald man in dark clothes?', 125);
    expect(result.text).toMatch(/^A bald man in dark clothes, first seen .* at 1:08\.$/);
  });

  it('does not take the figure on screen for a name it cannot match', async () => {
    const { result } = await ask('Who is Scales?', 240);
    expect(result.text).not.toMatch(/young woman/);
  });
});

describe('Sintel: scene questions', () => {
  it('"What just happened?" retells the latest moments, dialogue included', async () => {
    const { result, prompts } = await ask('What just happened?', 145);
    expect(result).toMatchObject({ kind: 'answer', path: 'retrieval' });
    expect(result.sources).toContain('dl-ln-01376'); // "Someone very dear, a kindred spirit, a dragon."
    expect(prompts).toEqual([]);
  });

  it('"Why is he helping her?" gives the model the earlier scenes of who is on screen', async () => {
    const { prompts } = await ask('Why is he helping her?', 125);
    const user = prompts[0]?.user ?? '';
    // The fight in the snow at 1:08 shares no word with the question; it is there because the
    // bald man on screen now is in it.
    expect(user).toContain('[ev-fr-00704 ');
    expect(user).toContain('It has shed much innocent blood.');
  });
});

describe('Sintel: timestamp grounding', () => {
  it('never answers from a fact revealed after the moment asked, anywhere in the film', async () => {
    for (let t = 0; t <= 888; t += 11) {
      for (const question of ['What just happened?', 'Who is that?', 'Why did she do that?']) {
        const { result, prompts } = await ask(question, t, 'ANSWER: I am not sure.\nSOURCES:');
        for (const id of result.sources)
          expect(reveal.get(id), `${id} at ${t}s`).toBeLessThanOrEqual(t);
        for (const p of prompts) {
          for (const [, id] of p.user.matchAll(/\[([a-z]{2}-[\w-]+) \d+:\d+\]/g)) {
            expect(reveal.get(id ?? ''), `${id} in the prompt at ${t}s`).toBeLessThanOrEqual(t);
          }
        }
      }
    }
  });

  it('changes its answer as the film moves, and goes back after a rewind', async () => {
    const early = await ask('What just happened?', 100);
    const later = await ask('What just happened?', 230);
    expect(later.result.sources).toContain('dl-ln-02275'); // "Goodnight, Scales."
    expect(early.result.sources).not.toContain('dl-ln-02275');
    const back = await ask('What just happened?', 100);
    expect(back.result.text).toBe(early.result.text);
  });
});

describe('Sintel: uncertainty', () => {
  it('hedges when the only sighting of a character is unconfirmed', async () => {
    const { result } = await ask('Who is that?', 261);
    expect(result.text.startsWith(LINES.hedge)).toBe(true);
  });

  it('says it cannot tell when nobody has been on screen lately', async () => {
    const { result } = await ask('Who is that?', 20);
    expect(result).toMatchObject({ kind: 'unknown', text: LINES.cantTellWho });
  });

  it('says it has not looked at the part of the film after the run stopped', async () => {
    expect(timeline.coveredUntilSec).toBeCloseTo(383.9, 1);
    for (const question of ['Who is that?', 'What just happened?']) {
      const { result } = await ask(question, 600);
      expect(result).toMatchObject({
        kind: 'unknown',
        path: 'not-covered',
        text: LINES.notLookedYet,
      });
    }
  });

  it('abstains before anything is revealed', async () => {
    const { result, prompts } = await ask('What is this film about?', 2);
    expect(result).toMatchObject({ kind: 'unknown', path: 'no-evidence' });
    expect(prompts).toEqual([]);
  });
});

// The twist of Sintel: the big dragon she kills is Scales grown up. A model may know it.
const TWIST = 'ANSWER: The big dragon is Scales, all grown up, and she will kill him.\nSOURCES: ';

describe('Sintel: spoiler probes', () => {
  it('1. keeps a name back before it is said: "Who is Scales?" at 3:20', async () => {
    const { result, prompts } = await ask('Who is Scales?', 200);
    expect(result.path).toBe('restricted-question');
    expect(prompts).toEqual([]);
  });

  it('2. keeps a thing back before it is shown or said: "dragon" at 1:40', async () => {
    expect(permittedEvidence(timeline, 100, 'candidate').restrictedTerms).toContain('dragon');
    expect((await ask('Is she looking for a dragon?', 100)).result.path).toBe(
      'restricted-question',
    );
    expect(permittedEvidence(timeline, 144, 'candidate').restrictedTerms).not.toContain('dragon');
  });

  it('3. never predicts: "Will she find the dragon?"', async () => {
    const { result, prompts } = await ask('Will she find the dragon?', 300);
    expect(result).toMatchObject({ path: 'future-question', text: LINES.noFuture });
    expect(prompts).toEqual([]);
  });

  it('4. never predicts: "How does it end?"', async () => {
    expect((await ask('How does it end?', 380)).result.path).toBe('future-question');
  });

  it('5. withholds the twist from a model that knows the film, before the name is said', async () => {
    const { result } = await ask('Who is the small creature?', 215, `${TWIST}ev-fr-02158`);
    // The model's words are withheld; Pip may still describe what has been shown, never the name.
    expect(result.withheld).toMatch(/^restricted-term:/);
    expect(result.text).not.toMatch(/Scales/);
  });

  it('6. withholds the twist after the name is said, when no evidence supports it', async () => {
    const { result } = await ask('Who is the small creature?', 300, `${TWIST}dl-ln-02275`);
    expect(result.kind).toBe('unknown');
    expect(result.withheld).toMatch(/^unsupported-term:/);
  });

  it('7. withholds the twist with no citation at all', async () => {
    const { result } = await ask('What is the creature?', 300, TWIST);
    expect(result.withheld).toMatch(/^uncited-claim:/);
  });

  it('8. withholds an answer citing a line not heard yet ("These are dragon lands, Sintel.")', async () => {
    const { result } = await ask(
      'Where is she going?',
      300,
      'ANSWER: She is going to the dragon lands.\nSOURCES: dl-ln-04577',
    );
    expect(result.withheld).toBe('unknown-source:dl-ln-04577');
  });

  it('9. re-checks an answer when the film is rewound while Pip was thinking', async () => {
    const { result } = await ask(
      'What did she say?',
      240,
      'ANSWER: She said goodnight to Scales.\nSOURCES: dl-ln-02275',
    );
    expect(result.kind).toBe('answer');
    const rewound = recheckAtPosition(result, timeline, 200, 'candidate');
    expect(rewound).toMatchObject({ kind: 'unknown', text: LINES.unparsed });
  });

  it('10. does not reuse a cached answer after a rewind past what it rests on', async () => {
    const reply = 'ANSWER: She said goodnight to Scales.\nSOURCES: dl-ln-02275';
    const after = permittedEvidence(timeline, 240, 'candidate');
    const before = permittedEvidence(timeline, 200, 'candidate');
    expect(after.key).not.toBe(before.key);
    expect((await ask('What did she say?', 240, reply)).result.kind).toBe('answer');
    expect((await ask('What did she say to Scales?', 200, reply)).result.path).toBe(
      'restricted-question',
    );
  });

  it('11. names a heard-but-unmatched name only from the line it was said in', () => {
    const named = timeline.facts.filter((f) => f.spoilerTerms.includes('scale'));
    expect(named.map((f) => [f.id, f.revealSec])).toEqual([['dl-ln-02275', 229.54]]);
  });

  it('12. no fact text from the model names anyone before it is heard', () => {
    for (const fact of timeline.facts) {
      if (fact.revealSec < 229.54) expect(fact.text, fact.id).not.toMatch(/\bScales\b/);
      if (fact.revealSec < 460.48 && fact.kind !== 'event')
        expect(fact.text, fact.id).not.toMatch(/\bSintel\b/);
    }
  });
});
