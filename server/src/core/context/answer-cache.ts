// Answer memory that cannot leak: the key includes the exact permitted evidence set, so after a
// rewind a question only hits an answer made from the same (or no later) evidence.
import { normalizeQuestion } from './text.js';

export interface CacheKeyParts {
  evidenceKey: string; // EvidenceSet.key: content, timeline version and permitted ids
  question: string;
  promptVersion: string;
  modelId: string;
  isClarifyPick: boolean;
}

export interface CachedAnswer {
  text: string;
  next: string[];
  sources: string[];
}

export interface AnswerCache {
  get(parts: CacheKeyParts, nowMs: number): CachedAnswer | undefined;
  set(parts: CacheKeyParts, answer: CachedAnswer, nowMs: number): void;
  size(): number;
}

export function cacheKey(parts: CacheKeyParts): string {
  return [
    parts.evidenceKey,
    parts.promptVersion,
    parts.modelId,
    parts.isClarifyPick ? 'clarify' : 'ask',
    normalizeQuestion(parts.question),
  ].join('|');
}

/** A small LRU with a time limit. Only validated answers go in; fallbacks never do. */
export function createAnswerCache(maxEntries: number, ttlMs: number): AnswerCache {
  const entries = new Map<string, { answer: CachedAnswer; at: number }>();
  return {
    get(parts, nowMs) {
      const key = cacheKey(parts);
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (nowMs - hit.at > ttlMs) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key); // refresh its place in the LRU order
      entries.set(key, hit);
      return hit.answer;
    },
    set(parts, answer, nowMs) {
      const key = cacheKey(parts);
      entries.delete(key);
      entries.set(key, { answer, at: nowMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    size: () => entries.size,
  };
}
