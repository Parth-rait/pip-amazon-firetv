import { describe, expect, it } from 'vitest';
import type { Content, QuizQuestion } from './content.js';
import { buildDraftPrompt, parseQuizDraft, spreadAnswers } from './draft-quiz.js';
import { DRAFT_SYSTEM_PROMPT } from './prompts.js';

const NOTE_TIMES = [0, 30, 60, 90, 120, 150];
const film: Content = {
  id: 'test-film',
  title: 'Test',
  url: '/media/test.mp4',
  credit: 'Credit',
  durationSec: 200,
  premise: 'A bunny wakes up.',
  tags: [],
  chapters: [],
  characters: [],
  predictions: [],
  notes: NOTE_TIMES.map((atSec) => ({ atSec, text: `Note at ${atSec}.` })),
  quiz: [{ atSec: 0, question: 'Q?', choices: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'E.' }],
};

function question(atSec: number, overrides: Record<string, unknown> = {}) {
  return {
    atSec,
    question: `What happens at ${atSec}?`,
    choices: [`Right ${atSec}`, 'Wrong one', 'Wrong two', 'Wrong three'],
    answer: 0,
    explanation: 'Because the note says so.',
    ...overrides,
  };
}

const good = () => [120, 0, 30, 60, 90].map((t) => question(t));
const reply = (quiz: unknown[]) => JSON.stringify({ quiz });

function problems(raw: string): string {
  const result = parseQuizDraft(raw, film);
  return result.ok ? 'ok' : result.problems.join('; ');
}

describe('buildDraftPrompt', () => {
  it('lists every note with its exact time', () => {
    const prompt = buildDraftPrompt(film);
    expect(prompt.system).toBe(DRAFT_SYSTEM_PROMPT);
    expect(prompt.user).toContain('[150] Note at 150.');
    expect(prompt.user.endsWith('Write the quiz.')).toBe(true);
  });
});

describe('parseQuizDraft', () => {
  it('accepts a good reply with extra text around the JSON, sorted by atSec', () => {
    const result = parseQuizDraft(`Here is your quiz:\n${reply(good())}\nEnjoy!`, film);
    expect(result.ok && result.questions.map((q) => q.atSec)).toEqual([0, 30, 60, 90, 120]);
  });

  it('rejects invalid JSON', () => {
    expect(problems('{"quiz": [oops]}')).toMatch(/invalid JSON/);
    expect(problems('no json here')).toMatch(/no JSON/);
  });

  it('rejects 4 or 6 questions', () => {
    expect(problems(reply(good().slice(0, 4)))).toMatch(/quiz/);
    expect(problems(reply([...good(), question(150)]))).toMatch(/quiz/);
  });

  it('rejects 3 choices and an answer of 4', () => {
    const three = good();
    three[0] = question(120, { choices: ['A', 'B', 'C'] });
    expect(problems(reply(three))).toMatch(/choices/);
    const four = good();
    four[0] = question(120, { answer: 4 });
    expect(problems(reply(four))).toMatch(/answer/);
  });

  it('rejects an atSec that is not the time of a note', () => {
    const quiz = good();
    quiz[0] = question(45);
    expect(problems(reply(quiz))).toMatch(/45 is not the time of a note/);
  });
});

describe('spreadAnswers', () => {
  it('puts the right answers at B, D, A, C, B and keeps the text of every choice', () => {
    const questions = good().map((q, i) => ({ ...q, answer: i % 4 })) as QuizQuestion[];
    const spread = spreadAnswers(questions);
    expect(spread.map((q) => q.answer)).toEqual([1, 3, 0, 2, 1]);
    spread.forEach((q, i) => {
      const before = questions[i] as QuizQuestion;
      expect(q.choices[q.answer]).toBe(before.choices[before.answer]);
      expect([...q.choices].sort()).toEqual([...before.choices].sort());
    });
  });
});
