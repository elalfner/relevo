import { describe, expect, it } from 'vitest';
import { cartLabel } from './cart.js';

describe('cartLabel', () => {
  it('labels an empty cart', () => {
    expect(cartLabel([])).toBe('Total: 0.00');
  });

  it('labels a cart with a line', () => {
    expect(cartLabel([{ cents: 1250, qty: 2 }])).toBe('Total: 25.00');
  });
});
