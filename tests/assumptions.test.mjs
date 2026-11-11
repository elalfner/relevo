import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assumedLine, assumptionWarning, assumptionsOf, externalAssumptions, repoSearch, settleAssumptions } from '../scripts/lib/assumptions.mjs';

const doc = (bullets, heading = '## Assumptions') => `# Design\n\n${heading}\n\n${bullets}\n\n## Other\n\n- the \`foo.read\` permission is in this list but not an assumption\n`;

test('the bullets of the Assumptions heading are read, and nothing else', () => {
  const a = assumptionsOf(doc('- the permission `orders.export` exists in the backend\n- the list sorts by date'));
  assert.deepEqual(a.map((x) => x.text), ['the permission `orders.export` exists in the backend', 'the list sorts by date']);
  assert.deepEqual(a[0].names, ['orders.export']);
});

test('the headings of design.md are read: its own and the one copied from the issue; continuation lines join the bullet', () => {
  assert.equal(assumptionsOf(doc('- a `x.y` field\n  continues here', '### From the issue: Assumptions'))[0].text, 'a `x.y` field continues here');
  assert.equal(assumptionsOf(doc('- an assumption', '## Assumptions')).length, 1);
});

test('the template placeholder, comments and code are not assumptions', () => {
  assert.deepEqual(assumptionsOf('## Assumptions\n\n<!-- Optional. -->\n\n- <an assumption>\n\n```\n- `a.b` permission\n```\n'), []);
});

test('Scenario: An assumption about the repository itself - not external', () => {
  assert.deepEqual(externalAssumptions(doc('- the list sorts by date\n- `sortBy` keeps the order')), []);
});

test('Spanish words count as outside', () => {
  assert.equal(externalAssumptions(doc('- el permiso `orders.export` existe en el servidor')).length, 1);
});

test('settle: a name found is dropped with its file, a name not found stays, no name stays', () => {
  const items = externalAssumptions(doc('- the permission `orders.export` exists\n- the field `total` is numeric\n- the backend returns the total as a number'));
  const r = settleAssumptions(items, { search: (n) => (n === 'total' ? 'src/types.ts' : null) });
  assert.deepEqual(r.settled.map((s) => [s.text.slice(0, 10), s.found]), [['the field ', { total: 'src/types.ts' }]]);
  assert.deepEqual(r.confirm.map((c) => c.missing), [['orders.export'], []]);
  assert.match(assumedLine(r.confirm), /"the permission `orders.export` exists" \(not in the repository: `orders.export`\); "the backend returns the total as a number" \(no name to check\)/);
  assert.match(assumptionWarning(r.confirm[0]), /`orders\.export`, which no file of the repository holds[^]*manual input[^]*Open questions \(the build waits/);
});

test('a name that is a file of the repository is not an outside thing', () => {
  const r = settleAssumptions(externalAssumptions(doc('- the endpoint file `api/routes.ts` has the route')), { search: () => null, exists: (n) => n === 'api/routes.ts' });
  assert.deepEqual([r.settled.length, r.confirm.length], [0, 1], 'with no name left to check it stays to confirm');
});

test('repoSearch finds a name in a tracked file outside openspec, and nothing in a folder that is not a git repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asm-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'openspec'));
  writeFileSync(join(dir, 'src', 'perms.ts'), "export const P = 'orders.read';\n");
  writeFileSync(join(dir, 'openspec', 'design.md'), 'orders.export\n');
  git('add', '-A');
  const search = repoSearch(dir);
  assert.equal(search('orders.read'), 'src/perms.ts');
  assert.equal(search('orders.export'), null, 'openspec is left out');
  assert.equal(search('-nonsense'), null, 'a name that looks like an option is a pattern');
  assert.equal(repoSearch(mkdtempSync(join(tmpdir(), 'nogit-')))('anything'), null);
});
