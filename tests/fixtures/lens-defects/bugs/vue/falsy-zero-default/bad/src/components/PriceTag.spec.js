import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PriceTag from './PriceTag.vue';

describe('PriceTag', () => {
  it('shows the price with two decimals', () => {
    expect(mount(PriceTag, { props: { price: 12.5 } }).text()).toBe('12.50');
  });

  it('shows the fallback when the product has no price yet', () => {
    expect(mount(PriceTag, { props: { price: null, fallback: 5 } }).text()).toBe('5.00');
  });
});
