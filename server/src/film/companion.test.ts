import { describe, expect, it } from 'vitest';
import {
  buildCompanion,
  currentPrediction,
  favouriteMoment,
  recordReaction,
  recordVote,
  REVEAL_SHOW_SEC,
  type PredictionVotes,
} from './companion.js';
import { checkContent, type Content } from './content.js';

const URL_BASE = 'https://pip.example.com';

const film = {
  id: 'test-film',
  title: 'Test',
  url: '/media/test-film.mp4',
  credit: 'Credit',
  durationSec: 600,
  premise: 'Premise.',
  notes: [
    { atSec: 0, text: 'A meadow.' },
    { atSec: 100, text: 'A bunny wakes up.' },
    { atSec: 300, text: 'A squirrel throws an apple.' },
  ],
  quiz: [
    { atSec: 100, question: 'Q?', choices: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'E.' },
  ],
  chapters: [
    { atSec: 120, title: 'Morning', summary: 'The bunny wakes up.', image: '/media/c1.jpg' },
    { atSec: 320, title: 'Trouble', summary: 'A squirrel throws an apple.' },
  ],
  characters: [
    {
      id: 'bunny',
      name: 'The bunny',
      image: '/media/bunny.jpg',
      facts: [
        { atSec: 100, text: 'He lives in a burrow.' },
        { atSec: 400, text: 'He gets his own back.' },
      ],
    },
    { id: 'squirrel', name: 'The squirrel', facts: [{ atSec: 300, text: 'He throws apples.' }] },
  ],
  predictions: [
    {
      id: 'revenge',
      askAtSec: 310,
      revealAtSec: 400,
      question: 'What will the bunny do?',
      choices: ['Forgive them', 'Get his own back'],
      answer: 1,
      reveal: 'He makes a plan to get his own back.',
    },
  ],
} as unknown as Content;

describe('buildCompanion', () => {
  it('shows only chapters, characters and facts the family has already seen', () => {
    const early = buildCompanion(film, 50, {}, URL_BASE);
    expect(early.chapters).toEqual([]);
    expect(early.characters).toEqual([]);

    const later = buildCompanion(film, 320, {}, URL_BASE);
    expect(later.chapters.map((c) => c.title)).toEqual(['Morning', 'Trouble']);
    expect(later.chapters[0]?.image).toBe(`${URL_BASE}/media/c1.jpg`);
    expect(later.characters).toEqual([
      {
        id: 'bunny',
        name: 'The bunny',
        image: `${URL_BASE}/media/bunny.jpg`,
        facts: ['He lives in a burrow.'],
      },
      { id: 'squirrel', name: 'The squirrel', image: null, facts: ['He throws apples.'] },
    ]);
  });

  it('shows who voted but never what, or the answer, before the reveal', () => {
    const votes: PredictionVotes = { revenge: { p1: 1, p2: 0 } };
    const open = buildCompanion(film, 350, votes, URL_BASE).prediction;
    expect(open).toMatchObject({ status: 'open', votedIds: ['p1', 'p2'] });
    expect(open?.answer).toBeNull();
    expect(open?.reveal).toBeNull();
    expect(open?.picks).toBeNull();

    const revealed = buildCompanion(film, 405, votes, URL_BASE).prediction;
    expect(revealed).toMatchObject({ status: 'revealed', answer: 1, picks: { p1: 1, p2: 0 } });
  });

  it('keeps a revealed prediction for 20 s, then hides it', () => {
    expect(currentPrediction(film, 400 + REVEAL_SHOW_SEC)?.status).toBe('revealed');
    expect(currentPrediction(film, 401 + REVEAL_SHOW_SEC)).toBeNull();
    expect(currentPrediction(film, 309)).toBeNull();
  });
});

describe('recordVote', () => {
  it('takes a vote only while the prediction is open, and lets a player change it', () => {
    const votes: PredictionVotes = {};
    expect(recordVote(film, 200, votes, 'p1', { id: 'revenge', choice: 1 })).toBe(false);
    expect(recordVote(film, 350, votes, 'p1', { id: 'revenge', choice: 1 })).toBe(true);
    expect(recordVote(film, 360, votes, 'p1', { id: 'revenge', choice: 0 })).toBe(true);
    expect(votes).toEqual({ revenge: { p1: 0 } });
    expect(recordVote(film, 360, votes, 'p2', { id: 'revenge', choice: 2 })).toBe(false);
    expect(recordVote(film, 410, votes, 'p2', { id: 'revenge', choice: 1 })).toBe(false);
  });
});

describe('reactions', () => {
  it('counts reactions per scene and names the favourite moment (the earlier one on a tie)', () => {
    const reactions: Record<string, number> = {};
    expect(favouriteMoment(film, reactions)).toBeNull();
    recordReaction(film, 120, reactions);
    recordReaction(film, 320, reactions);
    recordReaction(film, 330, reactions);
    expect(favouriteMoment(film, reactions)).toEqual({
      atSec: 300,
      text: 'A squirrel throws an apple.',
      reactions: 2,
    });
    recordReaction(film, 150, reactions);
    expect(favouriteMoment(film, reactions)?.atSec).toBe(100);
  });
});

describe('content checks for the companion', () => {
  const base = { ...(film as object), id: 'test-film' } as Record<string, unknown>;

  it('accepts the companion fields and treats them as optional', () => {
    expect(checkContent(base, 'test-film').ok).toBe(true);
    const without = { ...base };
    delete without.chapters;
    delete without.characters;
    delete without.predictions;
    const checked = checkContent(without, 'test-film');
    expect(checked.ok && checked.content.chapters).toEqual([]);
  });

  it('refuses a reveal before the question, a wrong answer and a twice-used id', () => {
    const prediction = (film.predictions[0] ?? {}) as object;
    const bad = (over: object) =>
      checkContent({ ...base, predictions: [{ ...prediction, ...over }] }, 'test-film');
    expect(bad({ revealAtSec: 300 })).toMatchObject({ ok: false });
    expect(bad({ answer: 2 })).toMatchObject({ ok: false });
    expect(
      checkContent({ ...base, predictions: [prediction, prediction] }, 'test-film'),
    ).toMatchObject({ ok: false });
  });
});
