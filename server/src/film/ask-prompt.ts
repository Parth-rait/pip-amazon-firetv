// buildAskPrompt(): the model sees only permitted facts and history from at or before now.
import type { TimedFact } from '../core/context/timeline.js';
import type { AskVia } from '../shared/protocol.js';
import { ASK_SYSTEM_PROMPT } from './prompts.js';

export interface HistoryItem {
  atSec: number; // where the film was when it was asked
  question: string;
  answer: string;
}

export interface AskPromptInput {
  title: string;
  positionSec: number;
  premise: string;
  facts: TimedFact[]; // already filtered by the spoiler boundary and retrieval
  history: HistoryItem[];
  question: string;
  via: AskVia;
}

const MAX_HISTORY = 3;

/** m:ss for a number of seconds. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Strips tag-like text so content cannot close our tags or pose as instructions. */
function inert(text: string): string {
  return text.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The Ask Pip prompt. History asked after the current position is left out (rewinds). */
export function buildAskPrompt(input: AskPromptInput): { system: string; user: string } {
  const facts = input.facts.map((f) => `[${f.id} ${clock(f.startSec)}] ${inert(f.text)}`);
  const recent = input.history
    .filter((h) => h.atSec <= input.positionSec)
    .slice(-MAX_HISTORY)
    .map((h) => `Q: ${inert(h.question)}\nA: ${inert(h.answer)}`);
  const lines = [
    `<title>${inert(input.title)}</title>`,
    `<now>${clock(input.positionSec)}</now>`,
    `<premise>${inert(input.premise)}</premise>`,
    '<facts>',
    ...facts,
    '</facts>',
    '<recent>',
    ...recent,
    '</recent>',
  ];
  if (input.via === 'clarify') {
    lines.push('They picked this question from your options, so reply with ANSWER.');
  }
  lines.push(`Question: ${inert(input.question)}`);
  return { system: ASK_SYSTEM_PROMPT, user: lines.join('\n') };
}
