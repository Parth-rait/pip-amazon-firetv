// Output cleaning for model text (PROJECT.md 5.3): no markdown, at most 2 sentences and 240 characters.

const MAX_CHARS = 240;
const MAX_SENTENCES = 2;

/** Plain text, at most two whole sentences within 240 characters; a long first sentence is cut at a word. */
export function cleanText(raw: string): string {
  const text = raw
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .trim();
  if (text.length === 0) return '';
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [text];
  let result = '';
  for (const sentence of sentences.slice(0, MAX_SENTENCES)) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > MAX_CHARS) break;
    result = next;
  }
  if (result) return result;
  const cut = text.slice(0, MAX_CHARS - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trimEnd();
  return `${atWord}…`;
}
