import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, LIMITS } from '../shared/protocol.js';
import { isValidCode, newCode } from './codes.js';

describe('codes', () => {
  it('makes codes of the right length from the alphabet', () => {
    const code = newCode();
    expect(code).toHaveLength(LIMITS.codeLength);
    expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
  });

  it('makes 10,000 codes that are all valid', () => {
    for (let i = 0; i < 10_000; i += 1) expect(isValidCode(newCode())).toBe(true);
  });

  it('uses the random function it is given, including its edges', () => {
    expect(newCode(() => 0)).toBe('AAAA');
    expect(newCode(() => 0.999999)).toBe('9999');
  });

  it('rejects codes with letters that are easy to misread, or the wrong length', () => {
    for (const bad of ['AB0D', 'ABOD', 'AB1D', 'ABID', 'abcd', 'ABC', 'ABCDE', 42, null]) {
      expect(isValidCode(bad)).toBe(false);
    }
  });
});
