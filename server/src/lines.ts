// Pip's fixed lines (PROJECT.md section 3.5). One consistent, warm, short voice: Pip's personality is
// timing and restraint, not moods (docs/vnext/PLAN.md 3.1). Model text never comes from here.

export const LINES = {
  modelFailed: "I'm not sure right now. Ask me again in a moment.",
  unparsed: "I'm not sure about that one yet. Try asking another way.",
  offline: 'My brain is resting right now. Ask me again soon.',
  didYouMean: 'Did you mean one of these?',
  notYet: "The film hasn't shown that yet.",
  cantTell: "I can't tell from what we've seen so far.",
  cantTellWho: "I can't tell who that is from what we've seen.",
  notLookedYet: "I haven't looked closely at this part yet, so I can't say.",
  hedge: "I'm not completely sure, but I think so:",
  noTimeline: "I don't have notes for this film yet, so I can't answer that.",
  noEvidenceYet: "I haven't seen enough of this film yet to answer that.",
  noFuture: 'No spoilers from me. Keep watching and see!',
  imagineWithheld: "That story got too close to what's coming. Ask me for another one?",
  play: 'Playing the film.',
  pause: 'Pausing the film.',
  seekBack: (sec: number) => `Going back ${sec} seconds.`,
  seekForward: (sec: number) => `Skipping ahead ${sec} seconds.`,
  onlyHost: (host: string) => `${host} has the controls, so ask them.`,
  cantNow: "I can't do that right now.",
  dismissed: 'Okay.',
  whatToStop: 'What should I stop?',
  wantACommand: 'Do you want me to do one of these?',
} as const;

export type PipLines = typeof LINES;

const GREETINGS = ['Hi {name}.', 'Welcome, {name}.', 'Hello {name}, glad you are here.'];

/** Pip's hello in the lobby for a new player; `turn` picks among the lines so they vary. */
export function greeting(name: string, turn: number): string {
  const line = GREETINGS[turn % GREETINGS.length] ?? 'Hi {name}.';
  return line.replace('{name}', name);
}
