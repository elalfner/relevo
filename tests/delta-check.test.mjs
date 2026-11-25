import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDelta, describeClashes } from '../scripts/lib/delta-check.mjs';

// Implements "The delta is checked against the base before the archive" and the two requirements after it in
// openspec/specs/ship/spec.md, and "The specification must still fit the base branch before the person tests" of review.

const FIXTURES = new URL('./fixtures/delta-check/', import.meta.url).pathname;
const SCRIPT = new URL('../scripts/delta-check.mjs', import.meta.url).pathname;
const cases = readdirSync(FIXTURES).filter((n) => statSync(join(FIXTURES, n)).isDirectory()).sort();
const load = (name) => ({
  main: existsSync(join(FIXTURES, name, 'main.md')) ? readFileSync(join(FIXTURES, name, 'main.md'), 'utf8') : null,
  delta: readFileSync(join(FIXTURES, name, 'delta.md'), 'utf8'),
  expect: JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8')),
});

test('the fixtures cover every rule of the archive', () => {
  ['added-exists-other-text', 'added-same-text', 'added-variant-spacing', 'modified-missing', 'modified-drops-scenario', 'removed-absent', 'removed-variant',
    'rename-source-missing', 'rename-target-exists', 'rename-ok', 'rename-already-applied', 'added-after-rename-away', 'no-main-added', 'no-main-modified']
    .forEach((n) => assert.ok(cases.includes(n), `missing fixture ${n}`));
});

cases.forEach((name) => {
  test(`fixture ${name}: the clashes are the ones the archive would stop on`, () => {
    const { main, delta, expect } = load(name);
    const { clashes } = checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main });
    assert.deepEqual(clashes.map(({ operation, header, reason }) => ({ operation, header, reason })), expect.clashes);
    clashes.forEach((c) => assert.equal(c.capability, 'cap'));
  });
});

test('Scenario: A sibling issue added a scenario to a requirement this change modifies - the dropped scenario is named', () => {
  const { main, delta } = load('modified-drops-scenario');
  const { clashes } = checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main });
  assert.equal(clashes[0].detail, 'Two');
  assert.match(describeClashes(clashes), /scenario "Two"/);
});

test('Scenario: A sibling issue added the same requirement - the message says it must become a modification and names /relevo:fix', () => {
  const { main, delta } = load('added-exists-other-text');
  const { clashes } = checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main });
  const text = describeClashes(clashes, { issue: '31' });
  assert.match(text, /cap/);
  assert.match(text, /ADDED "Alpha"/);
  assert.match(text, /already exists/);
  assert.match(text, /MODIFIED/);
  assert.match(text, /\/relevo:fix 31/);
});

test('several capabilities and several clashes are all reported in one run', () => {
  const a = load('added-exists-other-text');
  const b = load('modified-missing');
  const { clashes } = checkDelta({
    capabilities: [{ capability: 'one', delta: a.delta }, { capability: 'two', delta: b.delta }, { capability: 'three', delta: load('rename-ok').delta }],
    readMain: (cap) => ({ one: a.main, two: b.main, three: load('rename-ok').main })[cap],
  });
  assert.deepEqual(clashes.map((c) => [c.capability, c.reason]), [['one', 'already-exists'], ['two', 'not-found']]);
});

test('a clash in the closing run of a heading is read as the archive reads it', () => {
  const main = '# cap Specification\n\n## Purpose\nx\n\n## Requirements\n\n### Requirement: Alpha\nA.\n\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
  const delta = '## ADDED Requirements\n\n### Requirement: Alpha ###\nB.\n\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
  const { clashes } = checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main });
  assert.deepEqual(clashes.map((c) => c.reason), ['already-exists']);
});

test('headers inside a code fence are not requirements', () => {
  const main = '# cap Specification\n\n## Requirements\n\n### Requirement: Alpha\n```\n### Requirement: Fenced\n```\n\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
  const delta = '## ADDED Requirements\n\n### Requirement: Fenced\nF.\n\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
  assert.deepEqual(checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main }).clashes, []);
});

// ---------- the real archive decides

const hasOpenspec = spawnSync('openspec', ['--version'], { encoding: 'utf8' }).status === 0;

cases.forEach((name) => {
  test(`fixture ${name}: the real archive agrees with the check`, { skip: !hasOpenspec && 'openspec is not installed' }, () => {
    const { main, delta, expect } = load(name);
    const dir = mkdtempSync(join(tmpdir(), 'relevo-delta-'));
    mkdirSync(join(dir, 'openspec/changes/x/specs/cap'), { recursive: true });
    mkdirSync(join(dir, 'openspec/specs/cap'), { recursive: true });
    if (main !== null) writeFileSync(join(dir, 'openspec/specs/cap/spec.md'), main);
    writeFileSync(join(dir, 'openspec/changes/x/specs/cap/spec.md'), delta);
    const r = spawnSync('openspec', ['archive', 'x', '-y', '--no-validate'], { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
    const archived = r.status === 0 && !existsSync(join(dir, 'openspec/changes/x'));
    assert.equal(archived, expect.archives, `the archive said: ${r.stdout}${r.stderr}`);
    const { clashes } = checkDelta({ capabilities: [{ capability: 'cap', delta }], readMain: () => main });
    assert.equal(clashes.length === 0, archived, 'the check and the archive reach the same verdict');
  });
});

// ---------- the script

const gitIn = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8' }).trim();
function repo({ clash }) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-delta-cli-'));
  gitIn(dir, 'init');
  mkdirSync(join(dir, 'openspec/specs/cap'), { recursive: true });
  mkdirSync(join(dir, 'openspec/changes/31-x/specs/cap'), { recursive: true });
  mkdirSync(join(dir, 'openspec/changes/31-x/specs/fresh'), { recursive: true });
  cpSync(join(FIXTURES, 'added-exists-other-text/main.md'), join(dir, 'openspec/specs/cap/spec.md'));
  cpSync(join(FIXTURES, clash ? 'added-exists-other-text/delta.md' : 'added-new/delta.md'), join(dir, 'openspec/changes/31-x/specs/cap/spec.md'));
  cpSync(join(FIXTURES, 'no-main-added/delta.md'), join(dir, 'openspec/changes/31-x/specs/fresh/spec.md'));
  gitIn(dir, 'add', '.');
  gitIn(dir, 'commit', '-m', 'base');
  return dir;
}
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
const tree = (dir, rel = '') => readdirSync(join(dir, rel)).filter((n) => n !== '.git').sort().flatMap((n) => {
  const p = join(rel, n);
  return statSync(join(dir, p)).isDirectory() ? tree(dir, p) : [`${p}:${readFileSync(join(dir, p), 'utf8')}`];
});

test('the script exits 1 on a clash, names it and prints JSON with --json', () => {
  const dir = repo({ clash: true });
  const plain = run(dir, '--change', '31-x');
  assert.equal(plain.status, 1, plain.stderr);
  assert.match(plain.stdout, /cap: ADDED "Alpha" already exists/);
  const json = run(dir, '--change', '31-x', '--json');
  assert.equal(json.status, 1);
  assert.deepEqual(JSON.parse(json.stdout).clashes.map((c) => [c.capability, c.operation, c.header, c.reason]), [['cap', 'ADDED', 'Alpha', 'already-exists']]);
});

test('the script exits 0 and prints nothing when the delta fits, also for a capability with no main specification', () => {
  const dir = repo({ clash: false });
  const r = run(dir, '--change', '31-x');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, '');
});

test('--base reads the main specifications from a git ref, not from the working tree', () => {
  const dir = repo({ clash: false });
  // The base has the requirement; the working tree does not.
  writeFileSync(join(dir, 'openspec/specs/cap/spec.md'), '# cap Specification\n\n## Requirements\n');
  assert.equal(run(dir, '--change', '31-x').status, 0);
  const based = run(dir, '--change', '31-x', '--base', 'HEAD', '--json');
  assert.equal(based.status, 0, based.stdout + based.stderr);
  writeFileSync(join(dir, 'openspec/changes/31-x/specs/cap/spec.md'), readFileSync(join(FIXTURES, 'added-exists-other-text/delta.md'), 'utf8'));
  assert.equal(run(dir, '--change', '31-x').status, 0, 'the working tree has no such requirement');
  assert.equal(run(dir, '--change', '31-x', '--base', 'HEAD').status, 1, 'the ref does');
});

test('the script stops with exit 2 on a missing change folder, a missing ref or no arguments', () => {
  const dir = repo({ clash: false });
  assert.equal(run(dir, '--change', 'nope').status, 2);
  assert.equal(run(dir, '--change', '31-x', '--base', 'no-such-ref').status, 2);
  assert.equal(run(dir).status, 2);
});

test('Scenario: Nothing is changed - the script leaves every file as it found it', () => {
  const dir = repo({ clash: true });
  const before = tree(dir);
  run(dir, '--change', '31-x');
  run(dir, '--change', '31-x', '--json', '--base', 'HEAD');
  assert.deepEqual(tree(dir), before);
  assert.equal(gitIn(dir, 'status', '--porcelain'), '');
});
