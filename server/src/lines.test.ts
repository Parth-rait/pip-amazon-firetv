import { describe, expect, it } from 'vitest';
import { greeting, LINES } from './lines.js';
import { askSystemPrompt } from './film/prompts.js';
import { LIMITS } from './shared/protocol.js';

describe("Pip's one voice (docs/vnext/PLAN.md 3.1)", () => {
  it('greets by name, with lines that vary', () => {
    expect(greeting('Leo', 0)).toContain('Leo');
    expect(greeting('Leo', 0)).not.toBe(greeting('Leo', 1));
  });

  it('keeps every fixed line short and without emoji', () => {
    const texts = [
      ...Object.values(LINES).flatMap((line) => (typeof line === 'string' ? [line] : [])),
      LINES.seekBack(LIMITS.seekStepMaxSec),
      LINES.seekForward(LIMITS.seekStepMaxSec),
      LINES.onlyHost('W'.repeat(LIMITS.nameMaxChars)),
    ];
    for (const line of texts) {
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(80);
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('uses the same persona in both prompts, with the rules after it', () => {
    expect(askSystemPrompt()).toContain('You are Pip');
    expect(askSystemPrompt(true)).toContain('Never say or guess what happens next');
  });
});
