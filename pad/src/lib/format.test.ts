import { describe, expect, it } from 'vitest';
import { initialOf } from './format';

describe('initialOf', () => {
  it('is the first letter of the name as a capital', () => {
    expect(initialOf('leo')).toBe('L');
    expect(initialOf('  émile ')).toBe('É');
  });

  it('is a question mark when there is no name yet', () => {
    expect(initialOf('   ')).toBe('?');
  });
});
