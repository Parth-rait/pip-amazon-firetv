import { describe, expect, it } from 'vitest';
import { cacheKey, createAnswerCache, type CacheKeyParts } from './answer-cache.js';
import { containsTerm, normalizeQuestion } from './text.js';

const parts: CacheKeyParts = {
  evidenceKey: 'e1',
  question: 'Who is that?',
  promptVersion: 'p1',
  modelId: 'm1',
  isClarifyPick: false,
};
const answer = { text: 'A fox.', next: [], sources: ['f2'] };

describe('answer cache', () => {
  it('shares a key between phrasings that differ only in case and punctuation', () => {
    expect(cacheKey(parts)).toBe(cacheKey({ ...parts, question: '  who IS that ' }));
  });

  it('never shares a key across evidence sets, prompts or models', () => {
    for (const change of [{ evidenceKey: 'e2' }, { promptVersion: 'p2' }, { modelId: 'm2' }, { isClarifyPick: true }]) {
      expect(cacheKey({ ...parts, ...change })).not.toBe(cacheKey(parts));
    }
  });

  it('expires entries and evicts the least recently used', () => {
    const cache = createAnswerCache(2, 1000);
    cache.set(parts, answer, 0);
    expect(cache.get(parts, 500)).toEqual(answer);
    expect(cache.get(parts, 2000)).toBeUndefined();
    cache.set({ ...parts, question: 'a' }, answer, 0);
    cache.set({ ...parts, question: 'b' }, answer, 0);
    cache.get({ ...parts, question: 'a' }, 1);
    cache.set({ ...parts, question: 'c' }, answer, 2);
    expect(cache.get({ ...parts, question: 'b' }, 3)).toBeUndefined();
    expect(cache.get({ ...parts, question: 'a' }, 3)).toEqual(answer);
    expect(cache.size()).toBe(2);
  });
});

describe('text helpers', () => {
  it('matches whole words with simple endings, never inside other words', () => {
    expect(containsTerm('The badgers are here', 'badger')).toBe(true);
    expect(containsTerm('It glows blue', 'glow')).toBe(true);
    expect(containsTerm('The lantern is glowing', 'glow')).toBe(true);
    expect(containsTerm('A glowworm', 'glow')).toBe(false);
    expect(containsTerm('Mossy rocks', 'Moss')).toBe(false);
    expect(containsTerm('the lighthouse  keeper waves', 'lighthouse keeper')).toBe(true);
  });

  it('normalizes questions', () => {
    expect(normalizeQuestion("Who's THAT?!")).toBe('whos that');
  });
});
