import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkServer, envFiles, parseSet, serverEnv, startServer, stopServers } from '../scripts/lib/extra-server.mjs';

const CLI = new URL('../scripts/extra-server.mjs', import.meta.url).pathname;
const hasLsof = spawnSync('lsof', ['-v']).error === undefined;

// lsof as it answers for a table of port -> pids listening.
const lsofFor = (table) => (args) => {
  const port = Number(String(args.find((a) => a.startsWith('-tiTCP:'))).slice(7));
  const pids = table[port] ?? [];
  return { status: pids.length ? 0 : 1, stdout: pids.join('\n') };
};
function world({ ports = {}, files = [], records = [] } = {}) {
  const w = { records: [...records], killed: [], spawned: [] };
  w.deps = {
    dir: 'evidence',
    lsof: lsofFor(ports),
    listDir: () => files,
    baseEnv: { PATH: '/bin', VITE_REGION: 'jalisco' },
    load: () => [...w.records],
    save: (r) => { w.records = r; },
    spawn: (command, env, log) => { w.spawned.push({ command, env, log }); return 4242; },
    pgidOf: (pid) => (pid === 5000 ? 4242 : pid),
    kill: (pgid) => w.killed.push(pgid),
  };
  return w;
}

test('environment files are told apart by name only, without the examples', () => {
  assert.deepEqual(envFiles(['.env.example', 'package.json', '.env.local', '.env', '.env.production.local', '.envrc', '.env.sample']), ['.env', '.env.local', '.env.production.local']);
  assert.deepEqual(serverEnv({ A: '1', B: '2' }, { set: { C: '3' }, unset: ['A'] }), { B: '2', C: '3' });
  assert.deepEqual(parseSet(['VITE_ENV=production', 'X=a=b']), { VITE_ENV: 'production', X: 'a=b' });
  assert.throws(() => parseSet(['nope']), /NAME=value/);
  assert.throws(() => parseSet(['1A=x']), /NAME=value/);
});

test('Scenario: Missing variable - a free port starts the command without the variable and records it', () => {
  const w = world();
  const r = startServer({ port: 5174, unset: ['VITE_REGION'], set: { VITE_ENV: 'dev' }, command: ['npx', 'vite', '--port', '5174', '--strictPort'] }, w.deps);
  assert.equal(r.code, 0, r.message);
  assert.deepEqual(w.spawned[0].command, ['npx', 'vite', '--port', '5174', '--strictPort']);
  assert.deepEqual(w.spawned[0].env, { PATH: '/bin', VITE_ENV: 'dev' });
  assert.equal(w.spawned[0].log, join('evidence', 'servers', '5174.log'));
  assert.deepEqual(w.records, [{ port: 5174, pgid: 4242, command: 'npx vite --port 5174 --strictPort', set: ['VITE_ENV'], unset: ['VITE_REGION'] }]);
});

test('Scenario: Busy port - nothing starts, and the server there is not touched', () => {
  const w = world({ ports: { 5173: [777] } });
  const r = startServer({ port: 5173, command: ['npx', 'vite'] }, w.deps);
  assert.equal(r.code, 3);
  assert.match(r.message, /port 5173 is busy \(pid 777\)/);
  assert.deepEqual([w.spawned, w.records, w.killed], [[], [], []]);
});

test('Scenario: An environment file exists - --unset is refused, naming the files; --set alone still works', () => {
  const w = world({ files: ['.env.local', '.env.example'] });
  const r = startServer({ port: 5174, unset: ['VITE_REGION'], command: ['npx', 'vite'] }, w.deps);
  assert.equal(r.code, 4);
  assert.match(r.message, /while \.env\.local exists: the dev server loads them by itself/);
  assert.equal(w.spawned.length, 0);
  assert.equal(startServer({ port: 5174, set: { VITE_ENV: 'production' }, command: ['npx', 'vite'] }, w.deps).code, 0);
});

test('without lsof, a bad port or no command nothing starts', () => {
  const w = world();
  assert.equal(startServer({ port: 5174, command: ['x'] }, { ...w.deps, lsof: () => ({ status: 127, stdout: '' }) }).code, 5);
  assert.equal(startServer({ port: 80, command: ['x'] }, w.deps).code, 2);
  assert.equal(startServer({ port: 5174, command: [] }, w.deps).code, 2);
  assert.equal(w.spawned.length, 0);
});

test('check: the listener must belong to the recorded group; otherwise the group is stopped and forgotten', () => {
  const record = { port: 5174, pgid: 4242, command: 'x', set: [], unset: [] };
  assert.equal(checkServer({ port: 5174 }, world({ ports: { 5174: [5000] }, records: [record] }).deps).code, 0);
  const moved = world({ ports: { 5174: [] }, records: [record] });
  const r = checkServer({ port: 5174 }, moved.deps);
  assert.equal(r.code, 1);
  assert.match(r.message, /may have moved to another port/);
  assert.deepEqual([moved.killed, moved.records], [[4242], []]);
  assert.equal(checkServer({ port: 5175 }, world().deps).code, 1);
});

test('Scenario: Stopping a server not started by the agent - nothing is stopped', () => {
  const w = world({ ports: { 5173: [777] }, records: [{ port: 5174, pgid: 4242 }, { port: 5175, pgid: 4343 }] });
  const r = stopServers({ port: 5173 }, w.deps);
  assert.equal(r.code, 1);
  assert.match(r.message, /nothing was stopped/);
  assert.deepEqual(w.killed, []);
  assert.equal(stopServers({ port: 5174 }, w.deps).code, 0);
  assert.deepEqual([w.killed, w.records.map((x) => x.port)], [[4242], [5175]]);
  stopServers({ all: true }, w.deps);
  assert.deepEqual([w.killed, w.records], [[4242, 4343], []]);
  assert.equal(stopServers({ all: true }, w.deps).message, 'no server to stop');
});

const freePort = () => new Promise((done) => {
  const s = createServer().listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => done(port));
  });
});
// Waits until the port is (or is no longer) listened on; resolves with whether that happened in time.
const listening = (port, wanted = true) => new Promise((done) => {
  const deadline = Date.now() + 5000;
  const probe = () => {
    const up = spawnSync('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim() !== '';
    if (up === wanted) done(true);
    else if (Date.now() > deadline) done(false);
    else setTimeout(probe, 100);
  };
  probe();
});

test('the CLI starts a real server in its own group, checks it, and stops only what it recorded', { skip: hasLsof ? false : 'lsof is not available' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-xs-'));
  const port = await freePort();
  const cli = (...a) => spawnSync('node', [CLI, ...a], { cwd: dir, encoding: 'utf8', env: { ...process.env, KEEP: '1' } });
  const server = `require('net').createServer().listen(${port}, '127.0.0.1')`;
  const start = cli('start', '--port', String(port), '--unset', 'KEEP', '--', process.execPath, '-e', server);
  assert.equal(start.status, 0, start.stderr);
  assert.ok(await listening(port), 'the server listens');
  assert.equal(cli('check', '--port', String(port)).status, 0);
  assert.equal(cli('start', '--port', String(port), '--', process.execPath, '-e', server).status, 3, 'the port is busy now');
  const records = JSON.parse(readFileSync(join(dir, 'evidence', 'servers.json'), 'utf8'));
  assert.equal(records.length, 1);
  assert.ok(existsSync(join(dir, 'evidence', 'servers', `${port}.log`)));
  assert.equal(cli('stop', '--port', String(port + 1)).status, 1);
  assert.equal(cli('stop', '--all').status, 0);
  assert.ok(await listening(port, false), 'the recorded server was stopped');
  writeFileSync(join(dir, '.env'), 'X=1');
  const refused = cli('start', '--port', String(port), '--unset', 'KEEP', '--', process.execPath, '-e', server);
  assert.equal(refused.status, 4);
  assert.equal(cli('start', '--port', 'x').status, 2);
  assert.equal(cli('stop').status, 2);
});
