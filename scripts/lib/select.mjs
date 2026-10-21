// A list in the terminal that is chosen with the arrows, and nothing else: no dependency, so that the package stays
// small. The input and the output are injected, so a test drives it with a simulated keyboard. The terminal is put
// back (raw mode off, cursor shown) on every way out, including a cancel and an error.
import { emitKeypressEvents } from 'node:readline';

const HIDE = '\u001b[?25l';
const SHOW = '\u001b[?25h';
const UP = (n) => `\u001b[${n}A`;
const CLEAR = '\u001b[0J';

/**
 * choices: [{ value, label }]; defaultIndex: the one selected at the start.
 * Resolves the chosen value, or null when the person cancels (Esc, Ctrl-C, Ctrl-D, q).
 * Keys: up/down (or k/j), Enter, the digits 1 to 9 as a shortcut that chooses at once.
 */
export function select({ title, choices, defaultIndex = 0, input, output, hint = 'Arrows and Enter to choose, a number to pick one, Esc to cancel' }) {
  if (!input?.isTTY || typeof input.setRawMode !== 'function') return Promise.reject(new Error('the list needs a terminal'));
  if (!Array.isArray(choices) || choices.length === 0) return Promise.reject(new Error('the list has no choices'));
  return new Promise((resolve) => {
    let index = Math.min(Math.max(defaultIndex, 0), choices.length - 1);
    let drawn = 0;
    const draw = () => {
      const lines = [title, ...choices.map((c, i) => `${i === index ? '>' : ' '} ${i + 1}. ${c.label}`), hint];
      output.write(`${drawn ? UP(drawn) : ''}\r${CLEAR}${lines.join('\n')}\n`);
      drawn = lines.length;
    };
    const finish = (value) => {
      input.removeListener('keypress', onKey);
      try {
        input.setRawMode(false);
      } finally {
        input.pause?.();
        output.write(SHOW);
      }
      resolve(value);
    };
    function onKey(str, key = {}) {
      try {
        if (key.ctrl && (key.name === 'c' || key.name === 'd')) return finish(null);
        if (key.name === 'escape' || str === 'q') return finish(null);
        if (key.name === 'return' || key.name === 'enter') return finish(choices[index].value);
        if (key.name === 'up' || str === 'k') index = (index + choices.length - 1) % choices.length;
        else if (key.name === 'down' || str === 'j') index = (index + 1) % choices.length;
        else if (/^[1-9]$/.test(str ?? '') && Number(str) <= choices.length) return finish(choices[Number(str) - 1].value);
        else return undefined;
        draw();
      } catch (err) {
        finish(null);
        throw err;
      }
      return undefined;
    }
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume?.();
    input.on('keypress', onKey);
    output.write(HIDE);
    draw();
  });
}

/**
 * Like `select`, but several choices can be ticked: Space (or the digit of a choice) toggles, Enter confirms.
 * choices: [{ value, label }]; initial: the values ticked at the start. Resolves the array of ticked values in the
 * order of `choices` (possibly empty), or null when the person cancels.
 */
export function selectMany({ title, choices, initial = [], input, output, hint = 'Arrows to move, Space or a number to tick, Enter to confirm, Esc to cancel' }) {
  if (!input?.isTTY || typeof input.setRawMode !== 'function') return Promise.reject(new Error('the list needs a terminal'));
  if (!Array.isArray(choices) || choices.length === 0) return Promise.reject(new Error('the list has no choices'));
  return new Promise((resolve) => {
    const ticked = new Set(initial);
    let index = 0;
    let drawn = 0;
    const draw = () => {
      const lines = [title, ...choices.map((c, i) => `${i === index ? '>' : ' '} [${ticked.has(c.value) ? 'x' : ' '}] ${i + 1}. ${c.label}`), hint];
      output.write(`${drawn ? UP(drawn) : ''}\r${CLEAR}${lines.join('\n')}\n`);
      drawn = lines.length;
    };
    const finish = (value) => {
      input.removeListener('keypress', onKey);
      try {
        input.setRawMode(false);
      } finally {
        input.pause?.();
        output.write(SHOW);
      }
      resolve(value);
    };
    const toggle = (i) => {
      const v = choices[i].value;
      if (ticked.has(v)) ticked.delete(v);
      else ticked.add(v);
    };
    function onKey(str, key = {}) {
      try {
        if (key.ctrl && (key.name === 'c' || key.name === 'd')) return finish(null);
        if (key.name === 'escape' || str === 'q') return finish(null);
        if (key.name === 'return' || key.name === 'enter') return finish(choices.map((c) => c.value).filter((v) => ticked.has(v)));
        if (key.name === 'up' || str === 'k') index = (index + choices.length - 1) % choices.length;
        else if (key.name === 'down' || str === 'j') index = (index + 1) % choices.length;
        else if (key.name === 'space' || str === ' ') toggle(index);
        else if (/^[1-9]$/.test(str ?? '') && Number(str) <= choices.length) toggle(Number(str) - 1);
        else return undefined;
        draw();
      } catch (err) {
        finish(null);
        throw err;
      }
      return undefined;
    }
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume?.();
    input.on('keypress', onKey);
    output.write(HIDE);
    draw();
  });
}
