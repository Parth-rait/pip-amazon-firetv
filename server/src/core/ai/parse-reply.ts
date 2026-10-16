// Parses the guided reply: ANSWER with NEXT chips and the SOURCES it used, or CLARIFY options
// (sections 5.3 and 5.4).
import { cleanText, stripMarkdown } from './clean-text.js';

export type ParsedReply =
  | { kind: 'answer'; text: string; next: string[]; sources: string[] }
  | { kind: 'clarify'; options: string[] };

type Label = 'answer' | 'next' | 'clarify' | 'sources';

const MAX_CHIPS = 3;
const MAX_CHIP_CHARS = 60;
const MIN_CLARIFY_OPTIONS = 2;
const MAX_SOURCES = 8;
const LABEL_LINE = /^\s*(answer|next|clarify|sources)\s*:\s*(.*)$/i;
const SOURCE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** Lower case, letters, digits and single spaces only, for comparing questions. */
function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a NEXT or CLARIFY field into at most 3 clean questions (section 5.3, toChips). */
export function toChips(field: string, question: string): string[] {
  const seen = new Set([comparable(question)]);
  const chips: string[] = [];
  for (const part of field.split('|')) {
    const chip = part
      .replace(/["“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.!?]+$/, '');
    if (!chip || chip.length > MAX_CHIP_CHARS) continue;
    const key = comparable(chip);
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push(`${chip}?`);
    if (chips.length === MAX_CHIPS) break;
  }
  return chips;
}

function splitFields(raw: string): { unlabelled: string; fields: Partial<Record<Label, string>> } {
  const fields: Partial<Record<Label, string>> = {};
  const unlabelled: string[] = [];
  let current: Label | null = null;
  for (const line of stripMarkdown(raw).split(/\r?\n/)) {
    const match = LABEL_LINE.exec(line);
    if (match) {
      current = (match[1] ?? '').toLowerCase() as Label;
      fields[current] = [fields[current], match[2] ?? ''].filter(Boolean).join(' ');
    } else if (current) {
      fields[current] = `${fields[current] ?? ''} ${line}`.trim();
    } else {
      unlabelled.push(line);
    }
  }
  return { unlabelled: unlabelled.join(' '), fields };
}

/** The fact ids an answer cites ("f3, f7"); "none" and anything that is not an id are dropped. */
function toSources(field: string): string[] {
  const ids = field
    .split(/[\s,|;]+/)
    .map((id) => id.replace(/^\[|\]$/g, ''))
    .filter((id) => SOURCE_ID.test(id) && id.toLowerCase() !== 'none');
  return [...new Set(ids)].slice(0, MAX_SOURCES);
}

/** An answer with next chips, "Did you mean" options, or null when nothing usable came back. */
export function parseReply(
  raw: string,
  question: string,
  options: { allowClarify: boolean },
): ParsedReply | null {
  const { unlabelled, fields } = splitFields(raw);
  const answer = cleanText(fields.answer ?? '');
  if (answer) {
    return {
      kind: 'answer',
      text: answer,
      next: toChips(fields.next ?? '', question),
      sources: toSources(fields.sources ?? ''),
    };
  }
  if (options.allowClarify) {
    const clarify = toChips(fields.clarify ?? '', question);
    if (clarify.length >= MIN_CLARIFY_OPTIONS) return { kind: 'clarify', options: clarify };
  }
  const plain = cleanText(unlabelled);
  return plain ? { kind: 'answer', text: plain, next: [], sources: [] } : null;
}
