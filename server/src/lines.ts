// Pip's fixed lines (PROJECT.md section 3.5). One consistent, warm, short voice: Pip's personality is
// timing and restraint, not moods (docs/vnext/PLAN.md 3.1). Model text never comes from here.

export const LINES = {
  modelFailed: "I'm not sure right now. Ask me again in a moment.",
  unparsed: "I'm not sure about that one yet. Try asking another way.",
  offline: 'My brain is resting right now. Ask me again soon.',
  didYouMean: 'Did you mean one of these?',
  notYet: "The film hasn't shown that yet.",
  cantTell: "I can't tell from what we've seen so far.",
  noTimeline: "I don't have notes for this film yet, so I can't answer that.",
  noEvidenceYet: "I haven't seen enough of this film yet to answer that.",
  noFuture: 'No spoilers from me. Keep watching and see!',
} as const;

export type PipLines = typeof LINES;

const GREETINGS = ['Hi {name}.', 'Welcome, {name}.', 'Hello {name}, glad you are here.'];

/** Pip's hello in the lobby for a new player; `turn` picks among the lines so they vary. */
export function greeting(name: string, turn: number): string {
  const line = GREETINGS[turn % GREETINGS.length] ?? 'Hi {name}.';
  return line.replace('{name}', name);
}
