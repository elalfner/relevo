import { describe, expect, it } from 'vitest';
import { cartLabel, cartTotalCents } from './cart.js';

describe('cart', () => {
  it('labels an empty cart', () => {
    expect(cartLabel([])).toBe('Total: 0.00');
  });

  it('labels a cart with a line', () => {
    expect(cartLabel([{ cents: 1250, qty: 2 }])).toBe('Total: 25.00');
  });

  it('adds the lines of a cart in cents', () => {
    expect(cartTotalCents([{ cents: 1250, qty: 2 }, { cents: 300, qty: 1 }])).toBe(2800);
  });
});
