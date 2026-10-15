import { describe, expect, it } from 'vitest';
import { cleanText } from './clean-text.js';

describe('cleanText', () => {
  it('removes markdown, collapses whitespace and strips wrapping quotes', () => {
    expect(cleanText('"**The bunny**   wakes\n up."')).toBe('The bunny wakes up.');
  });

  it('keeps at most 2 sentences', () => {
    expect(cleanText('One. Two! Three? Four.')).toBe('One. Two!');
  });

  it('keeps at most 240 characters of whole sentences', () => {
    const first = `${'a'.repeat(150)}.`;
    const second = `${'b'.repeat(150)}.`;
    expect(cleanText(`${first} ${second}`)).toBe(first);
  });

  it('cuts one long sentence at a word and adds an ellipsis', () => {
    const long = `${'word '.repeat(80)}end.`;
    const result = cleanText(long);
    expect(result.length).toBeLessThanOrEqual(240);
    expect(result.endsWith('word…')).toBe(true);
  });

  it('returns an empty string for nothing usable', () => {
    expect(cleanText(' ** ')).toBe('');
  });
});
