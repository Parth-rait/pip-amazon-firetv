// Pip's fixed lines that the server sends (PROJECT.md section 3.5). Model text never comes from here.
export const LINES = {
  modelFailed: "I'm not sure right now. Ask me again in a moment.",
  unparsed: "I'm not sure about that one yet. Try asking another way.",
  offline: 'My brain is offline right now.',
  didYouMean: 'Did you mean one of these?',
} as const;
