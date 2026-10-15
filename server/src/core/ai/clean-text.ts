// Cleans model text for a TV bubble: no markdown, at most 2 sentences and 240 characters (section 5.3).
const MAX_SENTENCES = 2;
const MAX_CHARS = 240;
const ELLIPSIS = '…';

/** Removes markdown characters (*, _, #, backticks). */
export function stripMarkdown(raw: string): string {
  return raw.replace(/[*_#`]/g, '');
}

/** Plain text of at most 2 whole sentences within 240 characters; one long sentence is cut at a word. */
export function cleanText(raw: string): string {
  const text = stripMarkdown(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();
  const sentences =
    text
      .match(/[^.!?…]+(?:[.!?…]+|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [];
  let kept = '';
  for (const sentence of sentences.slice(0, MAX_SENTENCES)) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (next.length > MAX_CHARS) break;
    kept = next;
  }
  if (kept || sentences.length === 0) return kept;
  return cutAtWord(sentences[0] ?? '', MAX_CHARS);
}

function cutAtWord(sentence: string, maxChars: number): string {
  const room = sentence.slice(0, maxChars - ELLIPSIS.length);
  const lastSpace = room.lastIndexOf(' ');
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.!?-]+$/, '')}${ELLIPSIS}`;
}
