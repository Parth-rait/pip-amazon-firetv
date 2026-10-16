// Pip's fixed lines that the server sends (PROJECT.md 3.5, plus the vNext lines for abstaining,
// actions and permissions). Model text never replaces these.

export const LINES = {
  modelFailed: "I'm not sure right now. Ask me again in a moment.",
  notSure: "I'm not sure about that one yet. Try asking another way.",
  aiOff: 'My brain is offline right now.',
  didYouMean: 'Did you mean one of these?',
  noEvidenceYet: "I haven't seen enough of this film yet to answer that.",
  noTimeline: "I don't have notes for this film yet, so I can't answer that.",
  play: 'Playing the film.',
  pause: 'Pausing the film.',
  seekBack: (sec: number) => `Going back ${sec} seconds.`,
  seekForward: (sec: number) => `Skipping ahead ${sec} seconds.`,
  onlyHost: (host: string) => `${host} has the controls, so ask them.`,
  dismissed: 'Okay.',
  whatToStop: 'What should I stop?',
} as const;
