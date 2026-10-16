// Small text helpers for retrieval and answer checks: tokens, stopwords and whole-word matching.

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does doing for from had has have he her ' +
    'here him his how i if in into is it its just me my of on or our she so than that the their ' +
    'them then there these they this those to too up us was we were what when where which who ' +
    'whom why will with would you your that thats whats whos happened happen happening going ' +
    'about again also any some very really now pip film movie please tell know thing one'
  ).split(' '),
);

/** Lowercase words without punctuation; apostrophes are dropped ("who's" becomes "whos"). */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** Words that carry meaning for matching, with a crude singular form. */
export function contentWords(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w) && w.length > 1)
    .map(singular);
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `term` appears in `text` as whole words, case-insensitive, also with a simple ending
 * ("glow" matches "glows", "glowing", "glowed"). Erring wide is right for a spoiler gate.
 */
export function containsTerm(text: string, term: string): boolean {
  const cleaned = term.trim();
  if (cleaned.length === 0) return false;
  const pattern = cleaned.split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${pattern}(s|es|ing|ed|d)?(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  ).test(text);
}

/** Collapses spaces and case so two phrasings of one question share a cache key. */
export function normalizeQuestion(text: string): string {
  return words(text).join(' ');
}
