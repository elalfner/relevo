import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RECEIPT_DIR, TAIL_CAP, checkReceipt, couldNotStart, diffHash, excludeSpecs, overallStatus, redSummary, tailOf, toolOf } from '../scripts/lib/validation-gate.mjs';

const GATE = new URL('../scripts/validation-gate.mjs', import.meta.url).pathname;
const CHECK = new URL('../scripts/receipt-check.mjs', import.meta.url).pathname;
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// A repository with a base branch and a platform whose checks are shell commands the test writes.
function repo({ analyze = 'true', test: testCmd = 'true', generated = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-gate-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  const checks = `    checks:\n      analyze: ${JSON.stringify(analyze)}\n      test: ${JSON.stringify(testCmd)}\n`;
  writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: flutter\n    targets: [android]\n${checks}`);
  mkdirSync(join(dir, '.relevo/stacks'), { recursive: true });
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return dir;
}
const gate = (dir, ...extra) => spawnSync('node', [GATE, '--base', 'origin/main', '--config', join(dir, 'relevo.yml'), ...extra], { cwd: dir, encoding: 'utf8' });
const receiptOf = (dir) => JSON.parse(readFileSync(join(dir, RECEIPT_DIR, 'receipt.json'), 'utf8'));
const checkIn = (dir) => spawnSync('node', [CHECK, '--root', dir], { encoding: 'utf8' });

test('Scenario: A green run - analysis and tests pass and the scans find nothing', () => {
  const dir = repo();
  writeFileSync(join(dir, 'new.txt'), 'hello\n');
  const r = gate(dir, '--files', 'new.txt');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.split('\n')[0], 'green');
  const receipt = receiptOf(dir);
  assert.equal(receipt.status, 'green');
  assert.deepEqual(receipt.commands.map((c) => [c.name, c.exit_code]), [['analyze', 0], ['test', 0]]);
});

test('Scenario: A failing test - red, and it names the command', () => {
  const dir = repo({ test: 'echo "1 failing: total is wrong" && exit 1' });
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  const r = gate(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.split('\n')[0], 'red');
  assert.match(r.stdout, /test failed: echo/);
  const receipt = receiptOf(dir);
  assert.match(receipt.commands[1].output_tail, /1 failing: total is wrong/);
  assert.match(redSummary(receipt), /exited 1:\n1 failing: total is wrong/);
});

test('Scenario: A missing tool - could-not-run, and it names the tool', () => {
  const dir = repo({ test: 'relevo-no-such-tool --run' });
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  const r = gate(dir);
  assert.equal(r.status, 2);
  assert.equal(r.stdout.split('\n')[0], 'could-not-run');
  assert.match(r.stdout, /automated validation could not run: relevo-no-such-tool is missing/);
  assert.equal(receiptOf(dir).status, 'could-not-run');
});

test('a failing test is not mistaken for a missing tool, and a tool that exits 127 on its own is', () => {
  assert.equal(couldNotStart({ status: 1, output: 'tests failed' }), false);
  assert.equal(couldNotStart({ status: 127, output: '' }), true);
  assert.equal(couldNotStart({ status: null, error: new Error('spawn') }), true);
  assert.equal(overallStatus([{ status: 1, output: 'x' }], []), 'red');
  assert.equal(overallStatus([{ status: 127, output: 'x' }, { status: 1, output: '' }], []), 'could-not-run');
  assert.equal(overallStatus([{ status: 0, output: '' }], [{ ok: false }]), 'red');
  assert.equal(toolOf('npx --no-install vue-tsc --build && eslint .'), 'vue-tsc');
  assert.equal(toolOf('FOO=1 flutter analyze'), 'flutter');
});

test('Scenario: the scans make the gate red - a credential in the diff, a temporary marker', () => {
  const dir = repo();
  writeFileSync(join(dir, 'new.txt'), `// NOCOMMIT remove\nconst key = "AKIAIOSFODNN7EXAMPLE";\n`);
  const r = gate(dir, '--files', 'new.txt');
  assert.equal(r.status, 1, r.stdout);
  assert.equal(receiptOf(dir).scans.find((s) => s.name === 'temporary markers and credentials').ok, false);
});

test('Scenario: A restricted file - the gate is red and never prints its content', () => {
  const dir = repo();
  writeFileSync(join(dir, '.env'), 'SECRET=hunter2\n');
  git(dir, 'add', '-f', '.env');
  const r = gate(dir);
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr + JSON.stringify(receiptOf(dir)), /hunter2/);
});

test('generated files are left out of the hash: changing one does not change it', () => {
  assert.deepEqual(excludeSpecs(['dist/**', '*.g.dart']), [':(exclude)dist/**', ':(exclude)*.g.dart']);
  const dir = repo();
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist/out.js'), 'one\n');
  git(dir, 'add', '-f', 'dist/out.js');
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  // the flutter profile lists generated files such as *.g.dart
  writeFileSync(join(dir, 'x.g.dart'), 'one\n');
  const first = gate(dir, '--files', 'x.g.dart');
  const h1 = receiptOf(dir).hash;
  writeFileSync(join(dir, 'x.g.dart'), 'two\n');
  gate(dir, '--files', 'x.g.dart');
  assert.equal(receiptOf(dir).hash, h1, first.stdout);
  writeFileSync(join(dir, 'a.txt'), 'changed again\n');
  gate(dir);
  assert.notEqual(receiptOf(dir).hash, h1);
});

test('Scenario: A receipt exists - the hash, the base commit, the commands with exit code, duration and tail, and the status', () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  gate(dir);
  const r = receiptOf(dir);
  assert.match(r.hash, /^[0-9a-f]{64}$/);
  assert.equal(r.base_commit, git(dir, 'rev-parse', 'origin/main').trim());
  assert.equal(r.base_ref, 'origin/main');
  r.commands.forEach((c) => ['name', 'command', 'exit_code', 'duration_ms', 'output_tail'].forEach((f) => assert.ok(f in c, f)));
  assert.equal(r.status, 'green');
});

test('Scenario: The receipt is not committed - git ignores it, it is not in the diff and not in a commit', () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  gate(dir);
  assert.ok(existsSync(join(dir, RECEIPT_DIR, 'receipt.json')));
  assert.equal(git(dir, 'status', '--porcelain').includes(RECEIPT_DIR), false);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'work');
  assert.equal(git(dir, 'ls-files').includes(RECEIPT_DIR), false);
  assert.equal(git(dir, 'diff', 'origin/main').includes('receipt'), false);
  assert.match(readFileSync(join(dir, '.git/info/exclude'), 'utf8'), /\.relevo-receipt\//);
});

test('Scenario: A matching receipt / The diff changed / A receipt that is red - the check', () => {
  const dir = repo();
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  gate(dir);
  assert.equal(checkIn(dir).status, 0);
  writeFileSync(join(dir, 'a.txt'), 'changed after the receipt\n');
  const changed = checkIn(dir);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /the diff changed after the receipt was written, so the gate has to run again/);
  const red = repo({ test: 'exit 1' });
  writeFileSync(join(red, 'a.txt'), 'changed\n');
  gate(red);
  assert.equal(checkIn(red).status, 1);
  assert.match(checkIn(red).stdout, /the receipt is red, so no lens starts/);
});

test('no receipt, or a broken one, is not valid', () => {
  const dir = repo();
  assert.equal(checkIn(dir).status, 1);
  mkdirSync(join(dir, RECEIPT_DIR));
  writeFileSync(join(dir, RECEIPT_DIR, 'receipt.json'), '{nope');
  assert.equal(checkIn(dir).status, 1);
  assert.equal(checkReceipt(null, 'x').ok, false);
  assert.equal(checkReceipt({ hash: 'a', status: 'green' }, 'a').ok, true);
});

test('Scenario: the tail of the output is capped, with a marker that says how much was left out', () => {
  const long = `${'x'.repeat(20000)}END`;
  const tail = tailOf(long);
  assert.ok(tail.length < TAIL_CAP + 100);
  assert.match(tail, /^\[\.\.\. output truncated: 16003 characters omitted \.\.\.\]\n/);
  assert.ok(tail.endsWith('xxxEND'));
  assert.equal(tailOf('short'), 'short');
  assert.equal(diffHash('a'), diffHash('a'));
  assert.notEqual(diffHash('a'), diffHash('b'));
  const dir = repo({ test: `node -e "console.log('y'.repeat(30000)); process.exit(1)"` });
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  gate(dir);
  assert.ok(receiptOf(dir).commands[1].output_tail.length < TAIL_CAP + 100);
  assert.match(receiptOf(dir).commands[1].output_tail, /output truncated/);
});

test('bad arguments exit with 3', () => {
  assert.equal(spawnSync('node', [GATE], { encoding: 'utf8' }).status, 3);
  const dir = repo();
  assert.equal(spawnSync('node', [GATE, '--base', 'origin/main', '--config', join(dir, 'missing.yml')], { encoding: 'utf8' }).status, 3);
});
