import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { select } from '../scripts/lib/select.mjs';

// A keyboard and a screen that a test controls.
function terminal() {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, raw: false, paused: false, rawHistory: [], setRawMode(v) { this.raw = v; this.rawHistory.push(v); }, resume() { this.paused = false; }, pause() { this.paused = true; } });
  const out = { text: '', write(t) { this.text += t; } };
  const press = (str, key = {}) => input.emit('keypress', str, { name: str, ...key });
  return { input, out, press };
}
const choices = [{ value: 'project', label: 'Project' }, { value: 'user', label: 'Machine' }, { value: 'local', label: 'Only me' }];
const ask = (t, defaultIndex = 0) => select({ title: 'Where?', choices, defaultIndex, input: t.input, output: t.out });

test('Scenario: Choosing in a terminal - the list shows the project selected, Enter chooses it, and the terminal is restored', async () => {
  const t = terminal();
  const answer = ask(t);
  assert.equal(t.input.raw, true, 'raw mode while the list is open');
  assert.match(t.out.text, /Where\?\n> 1\. Project\n {2}2\. Machine\n {2}3\. Only me\n/);
  t.press('\r', { name: 'return' });
  assert.equal(await answer, 'project');
  assert.deepEqual(t.input.rawHistory, [true, false]);
  assert.equal(t.input.paused, true);
  assert.ok(t.out.text.endsWith('\u001b[?25h'), 'the cursor is shown again');
});

test('the arrows move, wrap around, and Enter confirms where they stopped', async () => {
  let t = terminal();
  let answer = ask(t);
  t.press(undefined, { name: 'down' });
  t.press(undefined, { name: 'down' });
  t.press(undefined, { name: 'return' });
  assert.equal(await answer, 'local');
  t = terminal();
  answer = ask(t);
  t.press(undefined, { name: 'up' });
  t.press('\r', { name: 'return' });
  assert.equal(await answer, 'local', 'up from the first goes to the last');
  t = terminal();
  answer = ask(t, 2);
  t.press(undefined, { name: 'down' });
  t.press('\r', { name: 'return' });
  assert.equal(await answer, 'project', 'down from the last goes to the first');
});

test('a digit chooses at once and a digit past the list does nothing', async () => {
  const t = terminal();
  const answer = ask(t);
  t.press('9');
  t.press('2');
  assert.equal(await answer, 'user');
});

test('Scenario: Cancelling - Esc, Ctrl-C and q resolve null and put the terminal back', async () => {
  for (const [str, key] of [[undefined, { name: 'escape' }], ['\u0003', { name: 'c', ctrl: true }], ['q', { name: 'q' }]]) {
    const t = terminal();
    const answer = ask(t);
    t.press(str, key);
    assert.equal(await answer, null);
    assert.deepEqual(t.input.rawHistory, [true, false]);
    assert.equal(t.input.listenerCount('keypress'), 0, 'the listener is removed');
  }
});

test('a stream that is not a terminal, or a list with no choices, is refused', async () => {
  const t = terminal();
  t.input.isTTY = false;
  await assert.rejects(ask(t), /needs a terminal/);
  await assert.rejects(select({ title: 'x', choices: [], input: terminal().input, output: terminal().out }), /no choices/);
});

test('the default index is kept inside the list', async () => {
  const t = terminal();
  const answer = ask(t, 99);
  t.press('\r', { name: 'return' });
  assert.equal(await answer, 'local');
});
