import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRules, quoteMatches, ruleAt } from '../scripts/lib/rules-file.mjs';

const TEXT = `# Rules

Every list must offer export.
- Prefer small files. [advice]

## Style [advice]

- Use tabs.
### Deeper

- Use two spaces.

## Back to hard

\`\`\`
Every fence line must be skipped.
\`\`\`
- Never push to main.
`;

test('lines are numbered from 1, blank lines and fenced code are left out', () => {
  const r = parseRules('CLAUDE.md', TEXT);
  assert.equal(ruleAt(r, 'CLAUDE.md', 3).text, 'Every list must offer export.');
  assert.equal(r.some((x) => /fence line/.test(x.text)), false);
  assert.equal(ruleAt(r, 'CLAUDE.md', 2), null);
});

test('advice on a line marks only that line', () => {
  const r = parseRules('CLAUDE.md', TEXT);
  assert.equal(ruleAt(r, 'CLAUDE.md', 4).advice, true);
  assert.equal(ruleAt(r, 'CLAUDE.md', 3).advice, false);
});

test('advice on a heading holds until the next heading of the same or a higher level', () => {
  const r = parseRules('CLAUDE.md', TEXT);
  assert.equal(ruleAt(r, 'CLAUDE.md', 8).advice, true);
  assert.equal(ruleAt(r, 'CLAUDE.md', 11).advice, true, 'a deeper heading stays inside');
  assert.equal(ruleAt(r, 'CLAUDE.md', 13).advice, false);
  assert.equal(r.find((x) => x.text.startsWith('- Never push')).advice, false);
});

test('an empty file has no lines, and a quote must be on the line (case and spacing ignored)', () => {
  assert.deepEqual(parseRules('x.md', ''), []);
  const rule = ruleAt(parseRules('CLAUDE.md', TEXT), 'CLAUDE.md', 3);
  assert.equal(quoteMatches(rule, 'every  LIST must'), true);
  assert.equal(quoteMatches(rule, 'delete'), false);
  assert.equal(quoteMatches(rule, ''), false);
});
