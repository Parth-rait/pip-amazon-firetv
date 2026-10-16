// Parses the model's labelled reply: ANSWER + NEXT, or CLARIFY, plus SOURCES (PROJECT.md 5.3).
import { cleanText } from './clean-text.js';

export type ParsedReply =
  | { kind: 'answer'; text: string; next: string[]; sources: string[] }
  | { kind: 'clarify'; options: string[] };

type Label = 'ANSWER' | 'NEXT' | 'CLARIFY' | 'SOURCES';

const MAX_CHIPS = 3;
const MAX_CHIP_CHARS = 60;
const MAX_SOURCES = 8;
const LABEL_LINE = /^\s*(ANSWER|NEXT|CLARIFY|SOURCES)\s*:\s*(.*)$/i;
const SOURCE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** Splits text into labelled fields; text before the first label is kept as unlabelled. */
function fields(raw: string): { labelled: Partial<Record<Label, string>>; unlabelled: string } {
  const labelled: Partial<Record<Label, string>> = {};
  const loose: string[] = [];
  let current: Label | null = null;
  for (const line of raw.replace(/[*_#`]/g, '').split(/\r?\n/)) {
    const match = LABEL_LINE.exec(line);
    if (match) {
      current = (match[1] ?? '').toUpperCase() as Label;
      labelled[current] = [labelled[current], match[2] ?? ''].filter(Boolean).join(' ');
    } else if (current) {
      labelled[current] = `${labelled[current] ?? ''} ${line}`.trim();
    } else {
      loose.push(line);
    }
  }
  return { labelled, unlabelled: loose.join(' ').trim() };
}

function comparable(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
}

/** Chips: split on |, cleaned, at most 60 characters, ending in "?", no repeats of the question. */
export function toChips(raw: string | undefined, question: string): string[] {
  if (!raw) return [];
  const seen = new Set([comparable(question)]);
  const chips: string[] = [];
  for (const part of raw.split('|')) {
    let chip = part.replace(/"/g, '').replace(/\s+/g, ' ').trim();
    if (chip.length === 0 || chip.length > MAX_CHIP_CHARS) continue;
    chip = chip.replace(/[.!]+$/, '');
    if (!chip.endsWith('?')) chip = `${chip}?`;
    const key = comparable(chip);
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push(chip);
    if (chips.length === MAX_CHIPS) break;
  }
  return chips;
}

function toSources(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(/[\s,|;]+/)
    .map((id) => id.replace(/^\[|\]$/g, ''))
    .filter((id) => SOURCE_ID.test(id) && id.toLowerCase() !== 'none');
  return [...new Set(ids)].slice(0, MAX_SOURCES);
}

/**
 * The reply as an answer, "Did you mean" options, or null when nothing usable is in it.
 * With allowClarify false (a question picked from "Did you mean"), CLARIFY is ignored.
 */
export function parseReply(
  raw: string,
  question: string,
  options: { allowClarify: boolean },
): ParsedReply | null {
  const { labelled, unlabelled } = fields(raw);
  const answer = cleanText(labelled.ANSWER ?? '');
  if (answer) {
    return {
      kind: 'answer',
      text: answer,
      next: toChips(labelled.NEXT, question),
      sources: toSources(labelled.SOURCES),
    };
  }
  if (options.allowClarify) {
    const clarify = toChips(labelled.CLARIFY, question);
    if (clarify.length >= 2) return { kind: 'clarify', options: clarify };
  }
  const loose = labelled.CLARIFY === undefined ? cleanText(unlabelled) : '';
  if (loose) return { kind: 'answer', text: loose, next: [], sources: [] };
  return null;
}
