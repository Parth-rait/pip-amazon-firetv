// Pairing codes: 4 characters a family can read off the TV (PROJECT.md section 4.8).
import { CODE_ALPHABET, LIMITS } from '../shared/protocol.js';

/** A random code from CODE_ALPHABET. Pass `random` in tests. */
export function newCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < LIMITS.codeLength; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? CODE_ALPHABET[0];
  }
  return code;
}

/** True when the value has the code length and uses only the code alphabet. */
export function isValidCode(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== LIMITS.codeLength) return false;
  return [...value].every((char) => CODE_ALPHABET.includes(char));
}
