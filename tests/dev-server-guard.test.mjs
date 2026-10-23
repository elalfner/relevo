import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cwdOf, guard, listeners, portOf } from '../scripts/lib/dev-server-guard.mjs';

const CLI = new URL('../scripts/dev-server-guard.mjs', import.meta.url).pathname;
const hasLsof = spawnSync('lsof', ['-v']).error === undefined;

// lsof for a table of port -> [{ pid, cwd }].
const lsofFor = (table) => (args) => {
  const t = args.find((a) => a.startsWith('-tiTCP:'));
  if (t) {
    const pids = (table[Number(t.slice(7))] ?? []).map((s) => s.pid);
    return { status: pids.length ? 0 : 1, stdout: pids.join('\n') };
  }
  const pid = Number(args[args.indexOf('-p') + 1]);
  const server = Object.values(table).flat().find((s) => s.pid === pid);
  return server?.cwd ? { status: 0, stdout: `p${pid}\nfcwd\nn${server.cwd}\n` } : { status: 1, stdout: '' };
};
const realpath = (p) => p.replace(/^\/var\//, '/private/var/');

test('ports, listeners and folders are read from lsof', () => {
  assert.equal(portOf('http://localhost:5173/app'), 5173);
  assert.equal(portOf('https://localhost/'), 443);
  assert.equal(portOf('http://localhost/'), 80);
  const lsof = lsofFor({ 5173: [{ pid: 10, cwd: '/repo' }] });
  assert.deepEqual(listeners(5173, lsof), [10]);
  assert.deepEqual(listeners(5174, lsof), []);
  assert.equal(listeners(5173, () => ({ status: 127, stdout: '' })), null);
  assert.equal(cwdOf(10, lsof), '/repo');
  assert.equal(cwdOf(11, lsof), null);
});

test('Scenario: The person\'s dev server runs from the working tree - do not switch', () => {
  const r = guard({ url: 'http://localhost:5173', repoRoot: '/var/repo' }, { lsof: lsofFor({ 5173: [{ pid: 10, cwd: '/private/var/repo/apps/site' }] }), realpath });
  assert.equal(r.code, 1);
  assert.deepEqual(r.servers, [{ pid: 10, cwd: '/private/var/repo/apps/site', inside: true }]);
});

test('Scenario: Pull request opened successfully - a server elsewhere, or none, allows the switch', () => {
  assert.equal(guard({ url: 'http://localhost:5173', repoRoot: '/repo' }, { lsof: lsofFor({ 5173: [{ pid: 10, cwd: '/repo-other' }] }), realpath: (p) => p }).code, 0);
  assert.equal(guard({ url: 'http://localhost:5173', repoRoot: '/repo' }, { lsof: lsofFor({}), realpath: (p) => p }).code, 0);
});

test('Scenario: The server\'s folder cannot be known - no lsof, or an unreadable folder, does not switch', () => {
  assert.equal(guard({ url: 'http://localhost:5173', repoRoot: '/repo' }, { lsof: () => ({ status: 127, stdout: '' }), realpath: (p) => p }).code, 3);
  assert.equal(guard({ url: 'http://localhost:5173', repoRoot: '/repo' }, { lsof: lsofFor({ 5173: [{ pid: 10, cwd: null }] }), realpath: (p) => p }).code, 3);
});

test('the CLI finds a real server running from the repository', { skip: hasLsof ? false : 'lsof is not available' }, async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-guard-')));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  const port = await new Promise((done) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port: p } = s.address();
      s.close(() => done(p));
    });
  });
  const child = spawn(process.execPath, ['-e', `require('net').createServer().listen(${port}, '127.0.0.1')`], { cwd: dir, stdio: 'ignore' });
  try {
    const deadline = Date.now() + 5000;
    let r;
    do {
      r = spawnSync('node', [CLI, '--url', `http://localhost:${port}`], { cwd: dir, encoding: 'utf8' });
    } while (r.status === 0 && Date.now() < deadline);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).servers[0].inside, true);
    const other = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-guard-')));
    spawnSync('git', ['init', '-q'], { cwd: other });
    assert.equal(spawnSync('node', [CLI, '--url', `http://localhost:${port}`], { cwd: other, encoding: 'utf8' }).status, 0);
  } finally {
    child.kill();
  }
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
});
