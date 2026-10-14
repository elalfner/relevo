import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseScalar, YamlLiteError } from '../scripts/lib/yaml-lite.mjs';

test('parses nested maps, lists and scalars', () => {
  const text = `
a:
  b: 1
  c: true
  d: "x # y"   # a comment
  e: [one, "two words", 3]
list:
  - x
  - 'it''s'
empty:
`;
  assert.deepEqual(parse(text), {
    a: { b: 1, c: true, d: 'x # y', e: ['one', 'two words', 3] },
    list: ['x', "it's"],
    empty: null,
  });
});

test('accepts a block list at the same indentation as its key', () => {
  assert.deepEqual(parse('items:\n- a\n- b\n'), { items: ['a', 'b'] });
});

test('scalar types', () => {
  assert.equal(parseScalar('5'), 5);
  assert.equal(parseScalar('0.5'), 0.5);
  assert.equal(parseScalar('null'), null);
  assert.equal(parseScalar('~'), null);
  assert.deepEqual(parseScalar('[]'), []);
  assert.equal(parseScalar('plain text'), 'plain text');
});

test('comments and blank lines are ignored', () => {
  assert.deepEqual(parse('# only a comment\n\nk: v # trailing\n'), { k: 'v' });
  assert.deepEqual(parse(''), {});
});

test('rejects what it does not support, with a line number', () => {
  assert.throws(() => parse('a:\n\tb: 1\n'), /line 2: tabs/);
  assert.throws(() => parse('a: 1\na: 2\n'), /line 2: duplicate key "a"/);
  assert.throws(() => parse('a:\n  - k: v\n'), /lists of maps/);
  assert.throws(() => parse('a: {x: 1}\n'), /inline maps/);
  assert.throws(() => parse('a: "open\n'), /unterminated/);
  assert.throws(() => parse('  a: 1\n'), /top level must not be indented/);
  assert.throws(() => parse('a: 1\n  b: 2\n'), /unexpected indentation/);
  assert.throws(() => parse('just text\n'), YamlLiteError);
});
