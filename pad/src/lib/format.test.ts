import { describe, expect, it } from 'vitest';
import { formatClock, initialOf } from './format';

describe('initialOf', () => {
  it('is the first letter of the name as a capital', () => {
    expect(initialOf('leo')).toBe('L');
    expect(initialOf('  émile ')).toBe('É');
  });

  it('is a question mark when there is no name yet', () => {
    expect(initialOf('   ')).toBe('?');
  });
});

describe('formatClock', () => {
  it('is minutes and two-digit seconds, never negative', () => {
    expect(formatClock(245.7)).toBe('4:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });
});
