import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkUrl, envNames, lockOf, moduleScripts, npmStale, startCommand, webPreflight } from '../scripts/lib/web-preflight.mjs';

const CLI = new URL('../scripts/web-preflight.mjs', import.meta.url).pathname;
const URL_ = 'http://localhost:5173/';
const HTML = '<!doctype html><script type="module" src="/@vite/client"></script><script type="module" src="/src/main.ts"></script><script src="/legacy.js"></script><script type="module" src="https://cdn.example.com/x.js"></script>';

// A project on disk, as the injected functions see it.
function project({ files = {}, nodeModules = true, playwright = true, browser = true } = {}) {
  const read = [];
  const all = { '/p/package.json': '{"scripts":{"build":"vite build","dev":"vite"}}', '/p/.env.example': 'VITE_REGION=jalisco\n# comment\nexport VITE_ENV=dev\n', ...files };
  return {
    read,
    deps: {
      exists: (p) => (p === '/p/node_modules' ? nodeModules : p === '/chromium' ? browser : p in all),
      readFile: (p) => {
        read.push(p);
        return all[p] ?? null;
      },
      loadPlaywright: () => (playwright ? { chromium: { executablePath: () => '/chromium' } } : null),
      sleep: async () => {},
    },
  };
}
// A fetch that answers from a table of address -> status (or an Error), with HTML for the page.
const fetchFrom = (table) => async (address) => {
  const answer = table[address] ?? 200;
  if (answer instanceof Error) throw answer;
  return { status: answer, text: async () => (address === URL_ ? HTML : '') };
};

test('the start command and the variable names come from package.json and .env.example', () => {
  assert.equal(startCommand('{"scripts":{"serve":"x","start":"y"}}'), 'npm run serve');
  assert.equal(startCommand('{"scripts":{"dev":"vite","start":"y"}}'), 'npm run dev');
  assert.equal(startCommand('{"scripts":{}}'), null);
  assert.equal(startCommand('not json'), null);
  assert.deepEqual(envNames('A=1\n# B=2\nexport C="x"\n  D =\nnot a line\n'), ['A', 'C', 'D']);
});

test('only same-origin module scripts of the page are checked', () => {
  assert.deepEqual(moduleScripts(HTML, URL_), ['http://localhost:5173/@vite/client', 'http://localhost:5173/src/main.ts']);
});

test('Scenario: Dependencies missing / Browser library missing - each stops with its own code', async () => {
  const fetch = fetchFrom({});
  assert.deepEqual((({ ok, check, code }) => ({ ok, check, code }))(await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ nodeModules: false }).deps, fetch })), { ok: false, check: 'node_modules', code: 3 });
  assert.equal((await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ playwright: false }).deps, fetch })).code, 4);
  assert.equal((await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ browser: false }).deps, fetch })).code, 5);
});

test('Scenario: App not answering - a module that answers 500 fails with the address, the start command and the variable names', async () => {
  const { deps, read } = project({ files: { '/p/.env': 'SECRET=1', '/p/.env.local': 'SECRET=2' } });
  const r = await webPreflight({ cwd: '/p', url: URL_ }, { ...deps, fetch: fetchFrom({ 'http://localhost:5173/src/main.ts': 500 }) });
  assert.deepEqual([r.ok, r.check, r.code], [false, 'url', 6]);
  assert.equal(r.detail, 'http://localhost:5173/src/main.ts answered 500');
  assert.equal(r.start, 'npm run dev');
  assert.deepEqual(r.env, ['VITE_REGION', 'VITE_ENV']);
  assert.ok(!read.some((p) => /\.env(\.local)?$/.test(p)), 'the real environment files are never read');
  const down = await webPreflight({ cwd: '/p', url: URL_ }, { ...deps, fetch: fetchFrom({ [URL_]: Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }) }) });
  assert.match(down.detail, /does not answer \(ECONNREFUSED\)/);
  assert.equal((await webPreflight({ cwd: '/p', url: URL_ }, { ...deps, fetch: fetchFrom({ [URL_]: 404 }) })).detail, `${URL_} answered 404`);
});

test('a page whose modules answer is ready', async () => {
  const r = await webPreflight({ cwd: '/p', url: URL_ }, { ...project().deps, fetch: fetchFrom({}) });
  assert.deepEqual([r.ok, r.check, r.code], [true, null, 0]);
});

test('with --wait the address is retried until it answers, and gives up when the time is over', async () => {
  let calls = 0;
  let clock = 0;
  const fetch = async (address) => {
    if (address === URL_) calls += 1;
    if (calls < 3) throw new Error('not yet');
    return { status: 200, text: async () => '' };
  };
  const deps = { ...project().deps, fetch, now: () => clock, sleep: async (ms) => { clock += ms; } };
  assert.equal((await webPreflight({ cwd: '/p', url: URL_, wait: 30000 }, deps)).ok, true);
  assert.equal(calls, 3);
  calls = -1000;
  clock = 0;
  const late = await webPreflight({ cwd: '/p', url: URL_, wait: 1000 }, deps);
  assert.equal(late.code, 6);
  assert.ok(clock >= 1000);
});

test('checkUrl follows redirects through fetch and treats 3xx results as answers', async () => {
  const seen = [];
  const fetch = async (address, options) => {
    seen.push(options.redirect);
    return { status: 200, text: async () => '' };
  };
  assert.deepEqual(await checkUrl(URL_, { fetch }), { ok: true, detail: null });
  assert.deepEqual(seen, ['follow']);
});

const LOCK = (packages) => JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'app' }, ...packages } });

test('the install command follows the lock file of the folder, and there is none without one', () => {
  const has = (...files) => (p) => files.map((f) => `/p/${f}`).includes(p);
  assert.equal(lockOf('/p', has('package-lock.json', 'yarn.lock')).install, 'npm ci --ignore-scripts');
  assert.equal(lockOf('/p', has('pnpm-lock.yaml')).install, 'pnpm install --frozen-lockfile --ignore-scripts');
  assert.equal(lockOf('/p', has('yarn.lock')).install, 'yarn install --immutable');
  assert.equal(lockOf('/p', has()), null);
});

test('npmStale compares each package of the lock file with what npm installed', () => {
  const lock = LOCK({ 'node_modules/vue': { version: '3.5.0' }, 'node_modules/fsevents': { version: '2.3.3', dev: true, optional: true } });
  assert.equal(npmStale(lock, LOCK({ 'node_modules/vue': { version: '3.5.0' } })), false, 'an optional package for another platform is not a difference');
  assert.equal(npmStale(lock, LOCK({ 'node_modules/vue': { version: '3.4.0' } })), true);
  assert.equal(npmStale(LOCK({ 'node_modules/vue': { version: '3.5.0' }, 'node_modules/pinia': { version: '2.0.0' } }), LOCK({ 'node_modules/vue': { version: '3.5.0' } })), true);
  assert.equal(npmStale(lock, null), true, 'node_modules not installed by npm from this lock');
  assert.equal(npmStale(lock, 'not json'), null);
  assert.equal(npmStale('{"lockfileVersion":1,"dependencies":{}}', LOCK({})), null, 'a shape without packages cannot be told');
});

test('Scenario: Dependencies missing / Dependencies stale - both report the frozen install command', async () => {
  const fetch = fetchFrom({});
  const lock = LOCK({ 'node_modules/vue': { version: '3.5.0' } });
  const missing = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ nodeModules: false, files: { '/p/package-lock.json': lock } }).deps, fetch });
  assert.deepEqual([missing.check, missing.code, missing.install], ['node_modules', 3, 'npm ci --ignore-scripts']);
  const stale = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ files: { '/p/package-lock.json': lock, '/p/node_modules/.package-lock.json': LOCK({ 'node_modules/vue': { version: '3.4.0' } }) } }).deps, fetch });
  assert.deepEqual([stale.check, stale.code, stale.install], ['deps_stale', 7, 'npm ci --ignore-scripts']);
  const current = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ files: { '/p/package-lock.json': lock, '/p/node_modules/.package-lock.json': lock } }).deps, fetch });
  assert.deepEqual([current.ok, current.install], [true, 'npm ci --ignore-scripts']);
  const unknown = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ files: { '/p/package-lock.json': lock, '/p/node_modules/.package-lock.json': '{' } }).deps, fetch });
  assert.equal(unknown.ok, true, 'a hidden lock file it cannot read never blocks the review');
  const pnpm = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ files: { '/p/pnpm-lock.yaml': 'lockfileVersion: 9' } }).deps, fetch });
  assert.deepEqual([pnpm.ok, pnpm.install], [true, 'pnpm install --frozen-lockfile --ignore-scripts'], 'pnpm is checked for presence only');
  const none = await webPreflight({ cwd: '/p', url: URL_ }, { ...project({ nodeModules: false }).deps, fetch });
  assert.deepEqual([none.code, none.install], [3, null]);
  assert.match(none.detail, /no lock file/);
});

test('the CLI refuses bad arguments and reports a project without node_modules', () => {
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [CLI, '--url', 'file:///etc/passwd'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [CLI, '--url', URL_, '--wait', 'soon'], { encoding: 'utf8' }).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wp-'));
  const r = spawnSync('node', [CLI, '--url', 'http://localhost:1'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.equal(JSON.parse(r.stdout).check, 'node_modules');
  assert.equal(JSON.parse(r.stdout).install, null);
});

test('the CLI reports stale dependencies with exit 7 and the npm install command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wp-'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'package-lock.json'), LOCK({ 'node_modules/vue': { version: '3.5.0' } }));
  writeFileSync(join(dir, 'node_modules/.package-lock.json'), LOCK({ 'node_modules/vue': { version: '3.4.0' } }));
  const r = spawnSync('node', [CLI, '--url', 'http://localhost:1'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 7);
  assert.deepEqual((({ check, install }) => ({ check, install }))(JSON.parse(r.stdout)), { check: 'deps_stale', install: 'npm ci --ignore-scripts' });
});
