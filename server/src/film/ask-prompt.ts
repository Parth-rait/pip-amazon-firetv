// buildAskPrompt(): the Ask Pip prompt from what the family has already seen (section 5.3).
import type { AskVia } from '../shared/protocol.js';
import type { Note } from './content.js';
import { ASK_SYSTEM_PROMPT, CLARIFY_PICKED_LINE } from './prompts.js';

const MAX_HISTORY = 3;

export interface HistoryItem {
  atSec: number; // where the film was when it was asked
  question: string;
  answer: string;
}

export interface AskPromptInput {
  title: string;
  positionSec: number; // the estimated position now
  premise: string;
  notes: Note[];
  history: HistoryItem[]; // oldest first
  question: string;
  via: AskVia;
}

/** m:ss, as the notes and <now> use. */
export function formatTime(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The system prompt and the user message. Nothing after positionSec is ever included. */
export function buildAskPrompt(input: AskPromptInput): { system: string; user: string } {
  const notes = input.notes
    .filter((note) => note.atSec <= input.positionSec)
    .map((note) => `[${formatTime(note.atSec)}] ${note.text}`);
  const recent = input.history
    .filter((item) => item.atSec <= input.positionSec)
    .slice(-MAX_HISTORY)
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`);
  const lines = [
    `<title>${input.title}</title>`,
    `<now>${formatTime(input.positionSec)}</now>`,
    `<premise>${input.premise}</premise>`,
    '<notes>',
    ...notes,
    '</notes>',
    '<recent>',
    ...recent,
    '</recent>',
    ...(input.via === 'clarify' ? [CLARIFY_PICKED_LINE] : []),
    `Question: ${input.question}`,
  ];
  return { system: ASK_SYSTEM_PROMPT, user: lines.join('\n') };
}
