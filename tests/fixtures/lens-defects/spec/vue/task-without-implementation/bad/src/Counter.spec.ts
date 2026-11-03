import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import Counter from './Counter.vue';

it('shows 0 after reset', async () => {
  const wrapper = mount(Counter);
  const [count, reset] = wrapper.findAll('button');
  for (let i = 0; i < 5; i += 1) await count.trigger('click');
  expect(count.text()).toBe('5');
  await reset.trigger('click');
  expect(count.text()).toBe('0');
});
