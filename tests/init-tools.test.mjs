import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECORD, editedFiles, findRecords, hashTree, installAntigravity, pluginDirFor, readRecord } from '../scripts/lib/adapters/install.mjs';
import { initScopeChoices, parseInitArgs, resolveInitScope, runInit, runUpdate } from '../scripts/lib/init-tools.mjs';
import { selectMany } from '../scripts/lib/select.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
const tmp = () => mkdtempSync(join(tmpdir(), 'relevo-init-'));

// An `agy` that installs the way the real one does: it copies the folder it is given into home/.gemini/config/plugins.
function fakeTools({ home, hasAgy = true, hasClaude = true, agyFails = false, landsElsewhere = false, claudeFails = false }) {
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'agy' && args[1] === 'install') {
      if (agyFails) return { code: 1, output: 'agy: boom\n' };
      const target = landsElsewhere ? join(home, 'elsewhere', 'relevo') : join(home, '.gemini', 'config', 'plugins', 'relevo');
      mkdirSync(join(target, '..'), { recursive: true });
      cpSync(args[2], target, { recursive: true });
      return { code: 0, output: '  [ok]    relevo\n' };
    }
    if (cmd === 'agy' && args[1] === 'uninstall') {
      rmSync(join(home, '.gemini', 'config', 'plugins', 'relevo'), { recursive: true, force: true });
      return { code: 0, output: 'Uninstalled plugin "relevo"\n' };
    }
    if (cmd === 'claude') return claudeFails ? { code: 1, output: 'claude: boom\n' } : { code: 0, output: '' };
    return { code: 0, output: '' };
  };
  return { calls, run, has: (c) => (c === 'agy' ? hasAgy : c === 'claude' ? hasClaude : false) };
}

test('the arguments of init are checked: tools and scope', () => {
  assert.deepEqual(parseInitArgs([]), { command: 'init', tools: null, scope: null });
  assert.deepEqual(parseInitArgs(['--tools', 'claude,antigravity', '--scope=project', '--yes', '--force']), { command: 'init', tools: ['claude', 'antigravity'], scope: 'project', yes: true, force: true });
  assert.equal(parseInitArgs(['--scope', 'user']).scope, 'machine', 'user is the machine');
  assert.match(parseInitArgs(['--tools', 'emacs']).error, /unknown tool "emacs"/);
  assert.match(parseInitArgs(['--scope', 'local']).error, /project or machine/);
  assert.match(parseInitArgs(['--wat']).error, /unknown option/);
});

test('Scenario: No terminal - the scope is the project in a repository and the machine outside one, without asking', () => {
  assert.deepEqual(resolveInitScope({ given: 'machine', interactive: true, inRepo: true }), { scope: 'machine' });
  assert.deepEqual(resolveInitScope({ interactive: true, inRepo: true }), { ask: true, preferred: 'project' });
  assert.deepEqual(resolveInitScope({ interactive: true, inRepo: false }), { ask: true, preferred: 'machine' });
  assert.match(resolveInitScope({ interactive: false, inRepo: true }).reason, /project is used/);
  assert.equal(resolveInitScope({ interactive: false, inRepo: false }).scope, 'machine');
  assert.match(initScopeChoices({ cwd: '/x', inRepo: false })[0].label, /not a git repository/);
});

test('project scope writes the plugin, the copies and a record of every file', () => {
  const root = tmp();
  const r = installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), ...fakeTools({ home: tmp() }) });
  assert.equal(r.code, 0, r.lines.join('\n'));
  const dir = pluginDirFor({ scope: 'project', root });
  for (const p of ['plugin.json', 'skills/go/SKILL.md', 'agents/relevo-qa.md', 'scripts/go-plan.mjs', 'stacks', 'templates', 'LICENSE']) assert.ok(existsSync(join(dir, p)), p);
  const record = readRecord(dir);
  assert.equal(record.tool, 'antigravity');
  assert.equal(record.package, version);
  assert.deepEqual(record.files, hashTree(dir), 'the record lists every file with its hash');
  assert.ok(!(RECORD in record.files));
  assert.match(readFileSync(join(dir, 'skills/go/SKILL.md'), 'utf8'), new RegExp(`node ${dir}/scripts/`), 'the path written in the text is the real folder');
  assert.match(r.lines.join('\n'), /commit it to share it/);
});

test('Scenario: A hand-edited file - update reports it and leaves it, and --force overwrites it', () => {
  const root = tmp();
  const tools = fakeTools({ home: tmp() });
  installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), ...tools });
  const dir = pluginDirFor({ scope: 'project', root });
  writeFileSync(join(dir, 'skills/go/SKILL.md'), 'mine\n');
  assert.deepEqual(editedFiles(dir), ['skills/go/SKILL.md']);
  const blocked = installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), update: true, ...tools });
  assert.equal(blocked.code, 1);
  assert.match(blocked.lines.join('\n'), /skills\/go\/SKILL\.md[\s\S]*--force/);
  assert.equal(readFileSync(join(dir, 'skills/go/SKILL.md'), 'utf8'), 'mine\n', 'nothing was changed');
  const forced = installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), update: true, force: true, ...tools });
  assert.equal(forced.code, 0);
  assert.deepEqual(editedFiles(dir), []);
  assert.match(forced.lines.join('\n'), /updated Relevo/);
});

test('Scenario: Update after a new version - a file the new version no longer makes is removed', () => {
  const root = tmp();
  const tools = fakeTools({ home: tmp() });
  installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), ...tools });
  const dir = pluginDirFor({ scope: 'project', root });
  mkdirSync(join(dir, 'skills/old'), { recursive: true });
  writeFileSync(join(dir, 'skills/old/SKILL.md'), 'stale\n');
  const record = readRecord(dir);
  record.package = '0.0.1';
  writeFileSync(join(dir, RECORD), JSON.stringify(record));
  assert.equal(installAntigravity({ packageRoot, scope: 'project', root, home: tmp(), update: true, ...tools }).code, 0);
  assert.ok(!existsSync(join(dir, 'skills/old')));
  assert.equal(readRecord(dir).package, version, 'the record has the version of the package that rendered it');
});

test('the project scope needs a git repository, and says so without writing', () => {
  const r = installAntigravity({ packageRoot, scope: 'project', root: null, home: tmp(), ...fakeTools({ home: tmp() }) });
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /not inside one; nothing was changed/);
});

test('Scenario: Antigravity is not installed - the machine scope stops and changes nothing', () => {
  const home = tmp();
  const t = fakeTools({ home, hasAgy: false });
  const r = installAntigravity({ packageRoot, scope: 'machine', root: null, home, ...t });
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /"agy" was not found[\s\S]*nothing was changed/);
  assert.deepEqual(t.calls, []);
  assert.ok(!existsSync(join(home, '.gemini')));
});

test('machine scope stages the plugin with the final path in its text and installs it with agy', () => {
  const home = tmp();
  const t = fakeTools({ home });
  const r = installAntigravity({ packageRoot, scope: 'machine', root: null, home, ...t });
  assert.equal(r.code, 0, r.lines.join('\n'));
  assert.equal(t.calls.length, 1);
  assert.match(t.calls[0], /^agy plugin install .*relevo-stage-.*\/relevo$/);
  const dir = join(home, '.gemini', 'config', 'plugins', 'relevo');
  assert.match(readFileSync(join(dir, 'skills/go/SKILL.md'), 'utf8'), new RegExp(`node ${dir}/scripts/`));
  assert.equal(readRecord(dir).scope, 'machine');
  assert.ok(!existsSync(t.calls[0].split(' ').at(-1)), 'the staging folder is removed');
  const again = fakeTools({ home });
  installAntigravity({ packageRoot, scope: 'machine', root: null, home, update: true, ...again });
  assert.deepEqual(again.calls.map((c) => c.split(' ').slice(0, 3).join(' ')), ['agy plugin uninstall', 'agy plugin install']);
});

test('a failing agy, or a plugin that lands elsewhere, is reported with what was done', () => {
  const failing = installAntigravity({ packageRoot, scope: 'machine', root: null, home: tmp(), ...fakeTools({ home: tmp(), agyFails: true }) });
  assert.equal(failing.code, 1);
  assert.match(failing.lines.join('\n'), /agy: boom[\s\S]*safe to repeat/);
  const home = tmp();
  const elsewhere = installAntigravity({ packageRoot, scope: 'machine', root: null, home, ...fakeTools({ home, landsElsewhere: true }) });
  assert.equal(elsewhere.code, 1);
  assert.match(elsewhere.lines.join('\n'), /not in .*plugins\/relevo/);
});

test('init sets up the tools in order, stops at the first failure and ends with the pointer to the skill', () => {
  const root = tmp();
  const home = tmp();
  const t = fakeTools({ home });
  const deps = { ...t, version, doctorScript: 'd.mjs', cwd: root, packageRoot, home, root };
  const ok = runInit({ tools: ['claude', 'antigravity'], scope: 'project' }, deps);
  assert.equal(ok.code, 0, ok.lines.join('\n'));
  assert.ok(t.calls.findIndex((c) => c.startsWith('claude plugin install relevo@relevo --scope project')) >= 0, 'Claude is installed with the plugin command, for the project');
  assert.ok(ok.lines.indexOf('== Claude Code') < ok.lines.indexOf('== Antigravity'));
  assert.match(ok.lines.at(-1), /\/relevo:init \(the skill\) sets up the labels/);
  assert.ok(!existsSync(join(root, '.claude')), 'nothing is rendered for Claude');
  const bad = runInit({ tools: ['claude', 'antigravity'], scope: 'machine' }, { ...deps, ...fakeTools({ home: tmp(), claudeFails: true }) });
  assert.equal(bad.code, 1);
  assert.ok(!bad.lines.some((l) => l === '== Antigravity'), 'Antigravity was not started after Claude failed');
  assert.ok(!bad.lines.at(-1).includes('/relevo:init'), 'no pointer after a failure');
  const machine = fakeTools({ home });
  runInit({ tools: ['claude'], scope: 'machine' }, { ...deps, ...machine });
  assert.match(machine.calls[0], /--scope user/, 'the machine is the user scope of Claude');
});

test('update without a rendered plugin is the old update; with one it renders again, and Claude failing does not stop it', () => {
  const root = tmp();
  const home = tmp();
  const t = fakeTools({ home });
  const deps = { ...t, version, doctorScript: 'd.mjs', cwd: root, packageRoot, home, root };
  const plain = runUpdate({}, deps);
  assert.equal(plain.code, 0);
  assert.ok(!plain.lines.some((l) => l.startsWith('==')), 'no headings: the output is the one it always was');
  runInit({ tools: ['antigravity'], scope: 'project' }, deps);
  assert.equal(findRecords({ root, home }).length, 1);
  const both = fakeTools({ home, claudeFails: true });
  const r = runUpdate({}, { ...deps, ...both });
  assert.equal(r.code, 1, 'the worst code is returned');
  assert.ok(r.lines.some((l) => /updated Relevo/.test(l)), 'Antigravity was updated anyway');
  const noClaude = runUpdate({}, { ...deps, ...fakeTools({ home, hasClaude: false }) });
  assert.equal(noClaude.code, 0);
  assert.ok(!noClaude.lines.includes('== Claude Code'));
});

function terminal() {
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, raw: false, setRawMode(v) { this.raw = v; }, resume() {}, pause() {} });
  const out = { text: '', write(t) { this.text += t; } };
  return { input, out, press: (str, key = {}) => input.emit('keypress', str, { name: str, ...key }) };
}
const choices = [{ value: 'claude', label: 'Claude Code' }, { value: 'antigravity', label: 'Antigravity' }];

test('Scenario: Asking in a terminal - the tools are ticked with Space or a number and confirmed with Enter', async () => {
  const t = terminal();
  const answer = selectMany({ title: 'Which tools?', choices, initial: ['claude'], input: t.input, output: t.out });
  assert.match(t.out.text, /> \[x\] 1\. Claude Code\n {2}\[ \] 2\. Antigravity/);
  t.press('2');
  t.press('\r', { name: 'return' });
  assert.deepEqual(await answer, ['claude', 'antigravity']);
  assert.equal(t.input.raw, false, 'the terminal is restored');
  const u = terminal();
  const second = selectMany({ title: 'Which tools?', choices, initial: ['claude'], input: u.input, output: u.out });
  u.press(' ', { name: 'space' });
  u.press('\r', { name: 'return' });
  assert.deepEqual(await second, [], 'unticking the only tool leaves none');
});

test('Scenario: Cancelling - Esc and Ctrl-C resolve null and restore the terminal', async () => {
  for (const [str, key] of [['\u001b', { name: 'escape' }], ['c', { name: 'c', ctrl: true }]]) {
    const t = terminal();
    const answer = selectMany({ title: 'Which tools?', choices, input: t.input, output: t.out });
    t.press(str, key);
    assert.equal(await answer, null);
    assert.equal(t.input.raw, false);
  }
  await assert.rejects(selectMany({ title: 'x', choices, input: { isTTY: false }, output: {} }), /needs a terminal/);
});

const bin = join(packageRoot, 'scripts', 'cli.mjs');
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

test('the command: init with --tools in a repository and no terminal writes the project plugin without waiting', () => {
  const repo = tmp();
  git(repo, 'init', '-q', '.');
  const r = spawnSync(process.execPath, [bin, 'init', '--tools', 'antigravity'], { cwd: repo, encoding: 'utf8', input: '' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no --scope given and no terminal: this folder is inside a git repository, so the project is used/);
  assert.ok(existsSync(join(repo, '.agents', 'plugins', 'relevo', 'plugin.json')));
  assert.match(r.stdout, /Open Antigravity and type \/relevo:doctor/);
});

test('the command: init without --tools and without a terminal asks for them instead of waiting', () => {
  const r = spawnSync(process.execPath, [bin, 'init'], { cwd: tmp(), encoding: 'utf8', input: '' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /init needs --tools without a terminal: claude, antigravity/);
});
