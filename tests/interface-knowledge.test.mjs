import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const data = JSON.parse(read('knowledge/interface/rules.json'));
const { rules } = data;
const FIELDS = ['id', 'category', 'title', 'principle', 'applies', 'weight', 'check', 'core', 'touches', 'ask', 'build', 'review', 'examples', 'source'];
const STACK_TAGS = ['html', 'tailwind', 'vue', 'flutter', 'neutral'];

test('Scenario: A rule without a field - every rule has every field, and the failure names the rule', () => {
  rules.forEach((r) => FIELDS.forEach((f) => assert.ok(r[f] !== undefined && r[f] !== '', `rule ${r.id ?? '(no id)'} lacks ${f}`)));
});

test('Scenario: A repeated identifier - identifiers are unique kebab-case slugs', () => {
  const ids = rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/));
});

test('weights, checks and platforms take the values of the specification', () => {
  rules.forEach((r) => {
    assert.ok(['blocking', 'advisory'].includes(r.weight), r.id);
    assert.ok(['code', 'render', 'person'].includes(r.check), r.id);
    assert.ok(['all', 'web', 'mobile'].includes(r.applies), r.id);
    assert.equal(typeof r.core, 'boolean', r.id);
    assert.ok(Array.isArray(r.touches) && r.touches.length > 0, r.id);
  });
});

test('Scenario: A blocking rule that cannot be checked - every blocking rule has a check and an example for a stack', () => {
  rules.filter((r) => r.weight === 'blocking').forEach((r) => {
    assert.ok(r.check, r.id);
    assert.ok(r.examples.length > 0, `blocking rule ${r.id} has no example`);
    r.examples.forEach((e) => {
      assert.ok(STACK_TAGS.includes(e.stack), `${r.id}: unknown stack tag ${e.stack}`);
      assert.ok(e.good, `${r.id}: an example without a good variant`);
    });
  });
});

test('the core rules are at most twenty and all blocking', () => {
  const core = rules.filter((r) => r.core);
  assert.ok(core.length > 0 && core.length <= 20, `core: ${core.length}`);
  core.forEach((r) => assert.equal(r.weight, 'blocking', r.id));
});

test('84 source numbers are adopted, none twice, and a merged number is not also adopted', () => {
  const adopted = rules.map((r) => r.source.numbers[0]);
  assert.equal(adopted.length, 84);
  assert.equal(new Set(adopted).size, 84);
  const merged = rules.flatMap((r) => r.source.numbers.slice(1));
  assert.equal(merged.length, 8);
  [...adopted, ...merged].forEach((n) => assert.ok(Number.isInteger(n) && n >= 1 && n <= 119, `source number ${n}`));
  assert.equal(new Set([...adopted, ...merged]).size, 92);
});

test('CURATION.md has every source number from 1 to 119 exactly once, with a decision', () => {
  const rows = read('knowledge/interface/CURATION.md').split('\n').map((l) => /^\| (\d+) \| .* \| (adopted|merged|left out) \| (.+) \|$/.exec(l)).filter(Boolean);
  assert.deepEqual(rows.map((m) => Number(m[1])), Array.from({ length: 119 }, (_, i) => i + 1));
  const decisions = rows.reduce((acc, m) => ({ ...acc, [m[2]]: (acc[m[2]] ?? 0) + 1 }), {});
  assert.deepEqual(decisions, { adopted: 84, merged: 8, 'left out': 27 });
  rows.filter((m) => m[2] === 'left out').forEach((m) => assert.ok(m[3].length > 10, `left out #${m[1]} has a reason`));
  const ids = new Set(rules.map((r) => r.id));
  rows.filter((m) => m[2] !== 'left out').forEach((m) => assert.ok(ids.has(/`([^`]+)`/.exec(m[3])[1]), `#${m[1]} names a rule that exists`));
});

test('Scenario: A source missing from the notice - every cited work is named in NOTICE with its copyright line', () => {
  const notice = read('NOTICE');
  new Set(rules.map((r) => r.source.work)).forEach((work) => assert.ok(notice.includes(work), `NOTICE does not name ${work}`));
  assert.match(notice, /Copyright \(c\) 2024 Next Level Builder/);
  assert.match(notice, /Permission is hereby granted, free of charge/);
});

test('Scenario: An enhanced criterion - a rule that cites an enhanced-level criterion is advisory and says so', () => {
  rules.filter((r) => /\b(AAA|enhanced)\b/i.test(`${r.principle} ${r.build} ${r.review}`)).forEach((r) => {
    assert.equal(r.weight, 'advisory', `${r.id} cites an enhanced criterion`);
  });
});

test('the accessibility check is dated, and every cited criterion is in the record', () => {
  // Empty until task 1.8 is done: the W3C text has to be read before a date is recorded.
  if (data.accessibility_checked !== null) assert.match(String(data.accessibility_checked), /^\d{4}-\d{2}-\d{2}$/);
  const record = read('knowledge/interface/CURATION.md');
  const cited = new Set(rules.flatMap((r) => [...`${r.principle} ${r.build} ${r.review}`.matchAll(/WCAG (\d\.\d\.\d+)/g)].map((m) => m[1])));
  assert.ok(cited.size > 0);
  cited.forEach((c) => assert.ok(record.includes(`WCAG ${c}`), `the record does not list WCAG ${c}`));
});

