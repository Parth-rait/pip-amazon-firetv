import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkContent,
  loadFilms,
  toContentView,
  unlockedQuestions,
  type Content,
} from './content.js';

const CONTENT_DIR = new URL('../../content/', import.meta.url);
const realFile: unknown = JSON.parse(
  readFileSync(new URL('big-buck-bunny.json', CONTENT_DIR), 'utf8'),
);

function question(atSec: number, overrides: Record<string, unknown> = {}) {
  return {
    atSec,
    question: `What happens at ${atSec}?`,
    choices: ['A', 'B', 'C', 'D'],
    answer: 1,
    explanation: 'Because.',
    ...overrides,
  };
}

function film(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-film',
    title: 'Test Film',
    url: '/media/test-film.mp4',
    credit: 'Credit',
    durationSec: 100,
    premise: 'A premise.',
    notes: [
      { atSec: 0, text: 'Start.' },
      { atSec: 50, text: 'Middle.' },
    ],
    quiz: [question(10), question(40), question(90)],
    ...overrides,
  };
}

function problemOf(data: unknown, id = 'test-film'): string {
  const result = checkContent(data, id);
  return result.ok ? 'ok' : result.problem;
}

describe('checkContent', () => {
  it('accepts the real film file', () => {
    expect(checkContent(realFile, 'big-buck-bunny').ok).toBe(true);
  });

  it('loads every file in content/', () => {
    const films = loadFilms(CONTENT_DIR.pathname);
    expect(films.map((f) => f.id)).toContain('big-buck-bunny');
  });

  it('rejects a question after the end of the film', () => {
    expect(problemOf(film({ quiz: [question(10), question(101)] }))).toMatch(/after the end/);
  });

  it('rejects notes out of order', () => {
    const notes = [
      { atSec: 50, text: 'Middle.' },
      { atSec: 0, text: 'Start.' },
    ];
    expect(problemOf(film({ notes }))).toMatch(/order of atSec/);
  });

  it('rejects a question with 3 choices', () => {
    expect(problemOf(film({ quiz: [question(10, { choices: ['A', 'B', 'C'] })] }))).toMatch(
      /choices/,
    );
  });

  it('rejects an id that does not match the file name', () => {
    expect(problemOf(film(), 'other-film')).toMatch(/file name/);
  });

  it('rejects a url that is neither https nor /media/', () => {
    expect(problemOf(film({ url: 'http://example.com/a.mp4' }))).toMatch(/url/);
  });
});

describe('unlockedQuestions', () => {
  const content = film() as Content;

  it('returns only the questions at or before the position', () => {
    expect(unlockedQuestions(content, 40).map((q) => q.atSec)).toEqual([10, 40]);
  });

  it('returns none before the first unlock', () => {
    expect(unlockedQuestions(content, 5)).toEqual([]);
  });
});

describe('toContentView', () => {
  it('makes a full URL and leaves out the notes and the quiz', () => {
    const view = toContentView(film() as Content, 'https://pip.trycloudflare.com');
    expect(view).toEqual({
      id: 'test-film',
      title: 'Test Film',
      url: 'https://pip.trycloudflare.com/media/test-film.mp4',
      credit: 'Credit',
      durationSec: 100,
      poster: null,
    });
    expect(view).not.toHaveProperty('notes');
    expect(view).not.toHaveProperty('quiz');
  });

  it('makes the poster a full URL too', () => {
    const view = toContentView(
      { ...(film() as Content), poster: '/media/test-film.jpg' },
      'https://pip.trycloudflare.com',
    );
    expect(view.poster).toBe('https://pip.trycloudflare.com/media/test-film.jpg');
  });

  it('keeps an https url as it is', () => {
    const view = toContentView(
      film({ url: 'https://cdn.example.com/a.mp4' }) as Content,
      'http://localhost:8787',
    );
    expect(view.url).toBe('https://cdn.example.com/a.mp4');
  });
});
