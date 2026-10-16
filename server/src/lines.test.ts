import { describe, expect, it } from 'vitest';
import { greeting, LINES_BY_MOOD } from './lines.js';
import { askSystemPrompt } from './film/prompts.js';

describe('moods (PROJECT.md 2.4)', () => {
  it('greets by name in each mood, with lines that vary', () => {
    expect(greeting('playful', 'Leo', 0)).toContain('Leo');
    expect(greeting('sassy', 'Leo', 0)).not.toBe(greeting('sassy', 'Leo', 1));
    expect(greeting('chill', 'Gran', 4)).toContain('Gran');
  });

  it('has every fixed line in every mood, each short and without emoji', () => {
    for (const lines of Object.values(LINES_BY_MOOD)) {
      for (const line of Object.values(lines)) {
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(80);
        expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it('changes only the persona between moods, never the rules', () => {
    const rules = (prompt: string) => prompt.slice(prompt.indexOf('Answer using only'));
    expect(rules(askSystemPrompt('sassy'))).toBe(rules(askSystemPrompt('chill')));
    expect(askSystemPrompt('sassy')).toContain('never mean');
    expect(askSystemPrompt('chill', true)).toContain('Never say or guess what happens next');
  });
});
