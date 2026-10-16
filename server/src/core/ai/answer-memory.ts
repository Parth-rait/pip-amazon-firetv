// Pip's answer memory: good answers kept per film and scene, so a repeated question is answered
// at once and Pip still answers when the model is offline. It never recalls an answer from a
// scene the family has not reached, so it cannot spoil anything the notes would not.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Remembered {
  contentId: string;
  sceneSec: number; // atSec of the last note the family had seen when it was asked
  question: string;
  answer: string;
  next: string[];
  savedAt: number;
}

export interface Recalled {
  answer: string;
  next: string[];
}

export interface RecallQuery {
  contentId: string;
  sceneSec: number;
  question: string;
}

export interface AnswerMemory {
  remember(entry: Omit<Remembered, 'savedAt'>): void;
  /** The same question asked before at the same scene of the same film. */
  recallExact(query: RecallQuery): Recalled | null;
  /** The closest question asked before at this scene or an earlier one. */
  recallSimilar(query: RecallQuery): Recalled | null;
}

const MAX_ENTRIES = 2000;
const SIMILAR_MIN = 0.5;
// Little words that say nothing about the topic. Question words (who, why, ...) stay.
const STOP_WORDS = new Set(
  'a an the is are was were be been do does did to of in on at for with and or but it its this that these those there he she they his her their him them i you me my your we our so just now then can will would could should about'.split(
    ' ',
  ),
);

/** Lowercase words without punctuation, for comparing questions. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topicWords(question: string): Set<string> {
  return new Set(
    normalizeQuestion(question)
      .split(' ')
      .filter((word) => word && !STOP_WORDS.has(word)),
  );
}

/** Shared topic words over all topic words (0 to 1). */
export function similarity(a: string, b: string): number {
  const wordsA = topicWords(a);
  const wordsB = topicWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / (wordsA.size + wordsB.size - shared);
}

/**
 * An answer memory kept in a JSON file (or only in memory when `file` is omitted).
 * A file that cannot be read starts an empty memory; `onError` hears about it.
 */
export function createAnswerMemory(options: {
  file?: string;
  now: () => number;
  onError?: (error: unknown) => void;
}): AnswerMemory {
  let entries: Remembered[] = [];
  if (options.file && existsSync(options.file)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(options.file, 'utf8'));
      if (Array.isArray(parsed)) entries = parsed.filter(isRemembered);
    } catch (error) {
      options.onError?.(error);
    }
  }

  const save = () => {
    if (!options.file) return;
    try {
      mkdirSync(dirname(options.file), { recursive: true });
      const temp = `${options.file}.tmp`;
      writeFileSync(temp, JSON.stringify(entries));
      renameSync(temp, options.file);
    } catch (error) {
      options.onError?.(error);
    }
  };

  const sameKey = (entry: Remembered, query: RecallQuery) =>
    entry.contentId === query.contentId &&
    entry.sceneSec === query.sceneSec &&
    normalizeQuestion(entry.question) === normalizeQuestion(query.question);

  return {
    remember(entry) {
      entries = entries.filter((old) => !sameKey(old, entry));
      entries.push({ ...entry, savedAt: options.now() });
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
      save();
    },

    recallExact(query) {
      const hit = [...entries].reverse().find((entry) => sameKey(entry, query));
      return hit ? { answer: hit.answer, next: hit.next } : null;
    },

    recallSimilar(query) {
      let best: { entry: Remembered; score: number } | null = null;
      for (const entry of entries) {
        if (entry.contentId !== query.contentId || entry.sceneSec > query.sceneSec) continue;
        const score = similarity(entry.question, query.question);
        if (score < SIMILAR_MIN) continue;
        // Prefer the closest match, then the latest scene, then the newest answer.
        const better =
          !best ||
          score > best.score ||
          (score === best.score &&
            (entry.sceneSec > best.entry.sceneSec ||
              (entry.sceneSec === best.entry.sceneSec && entry.savedAt >= best.entry.savedAt)));
        if (better) best = { entry, score };
      }
      return best ? { answer: best.entry.answer, next: best.entry.next } : null;
    },
  };
}

function isRemembered(value: unknown): value is Remembered {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.contentId === 'string' &&
    typeof v.sceneSec === 'number' &&
    typeof v.question === 'string' &&
    typeof v.answer === 'string' &&
    Array.isArray(v.next) &&
    v.next.every((n) => typeof n === 'string') &&
    typeof v.savedAt === 'number'
  );
}
