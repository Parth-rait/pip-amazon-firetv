// Pip's fixed lines that the server sends (PROJECT.md section 3.5), one set per mood (section 2.4).
// Model text never comes from here.
import type { PipMood } from './shared/protocol.js';

export interface PipLines {
  modelFailed: string;
  unparsed: string;
  offline: string;
  didYouMean: string;
}

export const LINES_BY_MOOD: Record<PipMood, PipLines> = {
  chill: {
    modelFailed: "I'm not sure right now. Ask me again in a moment.",
    unparsed: "I'm not sure about that one yet. Try asking another way.",
    offline: 'My brain is resting right now. Ask me again soon.',
    didYouMean: 'Did you mean one of these?',
  },
  playful: {
    modelFailed: 'Oops, my thoughts got tangled. Ask me again in a moment.',
    unparsed: 'Hmm, that one stumped me. Try asking another way?',
    offline: 'My brain is on a snack break. Back soon!',
    didYouMean: 'Ooh, did you mean one of these?',
  },
  sassy: {
    modelFailed: 'Brain freeze. Give me a second and try again.',
    unparsed: "Nope, didn't catch that. Try again, with feeling.",
    offline: 'My brain stepped out. Rude, I know.',
    didYouMean: 'Be honest. Did you mean one of these?',
  },
};

/** The playful set, the default mood. */
export const LINES = LINES_BY_MOOD.playful;

const GREETINGS: Record<PipMood, string[]> = {
  chill: [
    'Hi {name}. Make yourself comfy.',
    "Welcome, {name}. Glad you're here.",
    'Hello {name}. Settle in.',
  ],
  playful: [
    "Hi {name}! Grab a snack, it's movie time.",
    "{name} is here! Now it's a party.",
    "Hey {name}! The best seat's still free.",
  ],
  sassy: [
    'Well, well. {name} finally made it.',
    '{name} is here. The fun can officially start.',
    'Hi {name}. Fashionably late, I see.',
  ],
};

/** Pip's hello for a new player; `turn` picks among the lines so they vary. */
export function greeting(mood: PipMood, name: string, turn: number): string {
  const lines = GREETINGS[mood];
  return (lines[turn % lines.length] ?? lines[0] ?? 'Hi {name}.').replace('{name}', name);
}
