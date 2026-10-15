import { describe, expect, it } from 'vitest';
import { pickTvCode } from './pairing.js';

const KEY = 'a'.repeat(32);
const live = (code: string) => (code === 'ABCD' ? KEY : undefined);

describe('pickTvCode', () => {
  it('reuses a live code when the key matches', () => {
    expect(pickTvCode({ previousCode: 'ABCD', tvKey: KEY }, live)).toEqual({
      kind: 'reuse',
      code: 'ABCD',
    });
  });

  it('gives a new code when the key does not match or is missing', () => {
    expect(pickTvCode({ previousCode: 'ABCD', tvKey: 'b'.repeat(32) }, live).kind).toBe('new');
    expect(pickTvCode({ previousCode: 'ABCD', tvKey: null }, live).kind).toBe('new');
  });

  it('restores a valid code that no session has (after a server restart)', () => {
    expect(pickTvCode({ previousCode: 'WXYZ', tvKey: KEY }, live)).toEqual({
      kind: 'restore',
      code: 'WXYZ',
    });
  });

  it('gives a new code on a first start or an invalid code', () => {
    expect(pickTvCode({ previousCode: null, tvKey: null }, live).kind).toBe('new');
    expect(pickTvCode({ previousCode: 'AB0D', tvKey: KEY }, live).kind).toBe('new');
  });
});
