// buildAskPrompt(): the Ask Pip prompt from what the family has already seen (section 5.3), and
// buildGroundedPrompt(): the same from timeline facts that passed the spoiler boundary (vNext).
import type { TimedFact } from '../core/context/timeline.js';
import type { AskVia } from '../shared/protocol.js';
import type { Note } from './content.js';
import { askSystemPrompt, CLARIFY_PICKED_LINE, groundedSystemPrompt } from './prompts.js';

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
  simpleFormat?: boolean; // a small local model: no CLARIFY, one example reply
}

/** The atSec of the last note at or before positionSec: the scene the family is in (0 before any). */
export function sceneAt(notes: Note[], positionSec: number): number {
  let scene = 0;
  for (const note of notes) if (note.atSec <= positionSec) scene = note.atSec;
  return scene;
}

/** m:ss, as the notes and <now> use. */
export function formatTime(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Strips tag-like text so a question or a note cannot close our tags or pose as instructions. */
export function inert(text: string): string {
  return text.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The questions asked at or before positionSec (a rewind leaves later ones out), newest last. */
function recentHistory(history: HistoryItem[], positionSec: number): string[] {
  return history
    .filter((item) => item.atSec <= positionSec)
    .slice(-MAX_HISTORY)
    .map((item) => `Q: ${inert(item.question)}\nA: ${inert(item.answer)}`);
}

/** The system prompt and the user message. Nothing after positionSec is ever included. */
export function buildAskPrompt(input: AskPromptInput): { system: string; user: string } {
  const notes = input.notes
    .filter((note) => note.atSec <= input.positionSec)
    .map((note) => `[${formatTime(note.atSec)}] ${note.text}`);
  const recent = recentHistory(input.history, input.positionSec);
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
    `Question: ${inert(input.question)}`,
  ];
  return {
    system: askSystemPrompt(input.simpleFormat),
    user: lines.join('\n'),
  };
}

export interface GroundedPromptInput {
  title: string;
  positionSec: number;
  premise: string;
  facts: TimedFact[]; // already filtered by the spoiler boundary and retrieval
  history: HistoryItem[];
  question: string;
  via: AskVia;
  simpleFormat?: boolean;
}

/** The grounded prompt: each fact with its id, so the reply can cite it in SOURCES. */
export function buildGroundedPrompt(input: GroundedPromptInput): { system: string; user: string } {
  const facts = input.facts.map((f) => `[${f.id} ${formatTime(f.startSec)}] ${inert(f.text)}`);
  const lines = [
    `<title>${inert(input.title)}</title>`,
    `<now>${formatTime(input.positionSec)}</now>`,
    `<premise>${inert(input.premise)}</premise>`,
    '<facts>',
    ...facts,
    '</facts>',
    '<recent>',
    ...recentHistory(input.history, input.positionSec),
    '</recent>',
    ...(input.via === 'clarify' ? [CLARIFY_PICKED_LINE] : []),
    `Question: ${inert(input.question)}`,
  ];
  return { system: groundedSystemPrompt(input.simpleFormat), user: lines.join('\n') };
}
