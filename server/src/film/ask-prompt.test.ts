import { describe, expect, it } from 'vitest';
import { buildAskPrompt, formatTime, type AskPromptInput } from './ask-prompt.js';
import { ASK_SYSTEM_PROMPT, CLARIFY_PICKED_LINE } from './prompts.js';

function input(overrides: Partial<AskPromptInput> = {}): AskPromptInput {
  return {
    title: 'Test Film',
    positionSec: 65,
    premise: 'A bunny wakes up.',
    notes: [
      { atSec: 0, text: 'NOTE-START' },
      { atSec: 65, text: 'NOTE-NOW' },
      { atSec: 66, text: 'NOTE-LATER' },
    ],
    history: [],
    question: 'Who is that?',
    via: 'typed',
    ...overrides,
  };
}

describe('buildAskPrompt', () => {
  it('uses the system prompt verbatim', () => {
    expect(buildAskPrompt(input()).system).toBe(ASK_SYSTEM_PROMPT);
  });

  it('sends every note up to the position and none after it', () => {
    const { user } = buildAskPrompt(input());
    expect(user).toContain('[0:00] NOTE-START');
    expect(user).toContain('[1:05] NOTE-NOW');
    expect(user).not.toContain('NOTE-LATER');
    expect(user).toContain('<now>1:05</now>');
    expect(user.endsWith('Question: Who is that?')).toBe(true);
  });

  it('sends only history asked at or before the position, at most 3 pairs', () => {
    const history = [10, 20, 30, 40, 200].map((atSec) => ({
      atSec,
      question: `Q${atSec}`,
      answer: `A${atSec}`,
    }));
    const { user } = buildAskPrompt(input({ history }));
    expect(user).not.toContain('Q10');
    expect(user).toContain('Q: Q20\nA: A20');
    expect(user).toContain('Q: Q40');
    expect(user).not.toContain('Q200');
  });

  it('adds the picked-option line only for clarify', () => {
    expect(buildAskPrompt(input()).user).not.toContain(CLARIFY_PICKED_LINE);
    expect(buildAskPrompt(input({ via: 'clarify' })).user).toContain(
      `${CLARIFY_PICKED_LINE}\nQuestion: Who is that?`,
    );
  });
});

describe('formatTime', () => {
  it('writes m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(596.7)).toBe('9:56');
  });
});
