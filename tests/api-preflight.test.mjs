import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiPreflight, findOnPath, lockMatches, needsPreflight, phpunitEnv, testDatabase } from '../scripts/lib/api-preflight.mjs';

const CLI = new URL('../scripts/api-preflight.mjs', import.meta.url).pathname;
// The test environment of a new Laravel project, as phpunit.xml declares it (checked on a project from composer create-project).
const SQLITE = '<phpunit><php>\n<env name="APP_ENV" value="testing"/>\n<env name="DB_CONNECTION" value="sqlite"/>\n<env name="DB_DATABASE" value=":memory:"/>\n<env name="DB_URL" value=""/>\n</php></phpunit>';
const MYSQL = '<phpunit><php><env name="DB_CONNECTION" value="mysql"/><env name="DB_DATABASE" value="app_test"/></php></phpunit>';
const LOCK = JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v13.1.0' }], 'packages-dev': [{ name: 'phpunit/phpunit', version: '12.0.0' }] });
const INSTALLED = (extra = {}) => JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v13.1.0' }, { name: 'phpunit/phpunit', version: '12.0.0', ...extra }] });

function world({ tools = ['php', 'composer'], files = {} } = {}) {
  return {
    which: (t) => tools.includes(t),
    exists: (p) => p in files,
    read: (p) => files[p] ?? null,
  };
}
const READY = { '/p/vendor/autoload.php': '', '/p/composer.lock': LOCK, '/p/vendor/composer/installed.json': INSTALLED(), '/p/phpunit.xml': SQLITE };

test('the env entries of a PHPUnit configuration are read, empty values included', () => {
  assert.deepEqual(phpunitEnv(SQLITE), { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_URL: '' });
});

test('Scenario: In-memory SQLite - the check passes and no confirmation is asked', () => {
  const r = apiPreflight({ cwd: '/p' }, world({ files: READY }));
  assert.deepEqual([r.ok, r.check, r.exit, r.needs_confirm], [true, 'ready', 0, false]);
});

test('Scenario: Another database - the review names it and asks for the confirmation', () => {
  const r = apiPreflight({ cwd: '/p' }, world({ files: { ...READY, '/p/phpunit.xml': MYSQL } }));
  assert.deepEqual([r.ok, r.check, r.exit, r.needs_confirm], [true, 'database', 6, true]);
  assert.match(r.detail, /mysql connection \(app_test\), not in-memory SQLite/);
});

test('Scenario: No database declared - the database is unknown and needs the same confirmation', () => {
  const none = apiPreflight({ cwd: '/p' }, world({ files: { ...READY, '/p/phpunit.xml': '<phpunit/>' } }));
  assert.deepEqual([none.check, none.exit], ['database', 6]);
  assert.match(none.detail, /declares no DB_CONNECTION/);
  const missing = { ...READY };
  delete missing['/p/phpunit.xml'];
  assert.match(apiPreflight({ cwd: '/p' }, world({ files: missing })).detail, /neither phpunit\.xml nor phpunit\.xml\.dist/);
  assert.equal(testDatabase(null).safe, false);
});

test('phpunit.xml.dist is read when there is no phpunit.xml', () => {
  const files = { ...READY, '/p/phpunit.xml.dist': MYSQL };
  delete files['/p/phpunit.xml'];
  assert.equal(apiPreflight({ cwd: '/p' }, world({ files })).check, 'database');
});

test('Scenario: Missing dependencies - the review stops, installs nothing and gives the Composer command', () => {
  const files = { ...READY };
  delete files['/p/vendor/autoload.php'];
  const r = apiPreflight({ cwd: '/p' }, world({ files }));
  assert.deepEqual([r.ok, r.check, r.exit, r.install], [false, 'vendor', 4, 'composer install']);
});

test('installed packages that differ from composer.lock are stale; what cannot be read is not', () => {
  const stale = apiPreflight({ cwd: '/p' }, world({ files: { ...READY, '/p/vendor/composer/installed.json': INSTALLED({ version: '11.0.0' }) } }));
  assert.deepEqual([stale.check, stale.exit], ['deps_stale', 5]);
  assert.equal(lockMatches(LOCK, 'not json'), null);
  assert.equal(apiPreflight({ cwd: '/p' }, world({ files: { ...READY, '/p/vendor/composer/installed.json': 'x' } })).check, 'ready');
});

test('PHP or Composer missing stops first and names which', () => {
  const r = apiPreflight({ cwd: '/p' }, world({ tools: ['php'], files: READY }));
  assert.deepEqual([r.check, r.exit], ['tool', 3]);
  assert.match(r.detail, /composer not found/);
});

test('the script reads the folder it runs in and never an environment file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-apip-'));
  mkdirSync(join(dir, 'vendor'));
  writeFileSync(join(dir, 'vendor', 'autoload.php'), '');
  writeFileSync(join(dir, 'phpunit.xml'), SQLITE);
  writeFileSync(join(dir, '.env'), 'DB_CONNECTION=mysql\nSECRET=do-not-read');
  const r = spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
  assert.doesNotMatch(r.stdout, /do-not-read|mysql/);
  const out = JSON.parse(r.stdout);
  assert.equal(out.install, 'composer install');
  assert.ok([0, 3].includes(r.status), `exit ${r.status}: PHP and Composer are found on a machine that has them`);
});

// ---------- the Supabase branch (supabase-review-adapter)

import { supabasePreflight } from '../scripts/lib/api-preflight.mjs';

const sbDeps = ({ tools = ['supabase', 'docker'], config = true, docker = 0, stack = 0 } = {}) => ({
  which: (t) => tools.includes(t),
  exists: () => config,
  run: (command) => ({ status: command === 'docker' ? docker : stack }),
});

test('Scenario: Supabase ready - the CLI, Docker, the config and a running stack pass with exit 0 and no confirmation', () => {
  const r = supabasePreflight({ cwd: '/p' }, sbDeps());
  assert.deepEqual([r.ok, r.check, r.exit], [true, 'ready', 0]);
});

test('Scenario: Supabase tool missing - exit 3 names the tool and the command for the person', () => {
  const cli = supabasePreflight({ cwd: '/p' }, sbDeps({ tools: ['docker'] }));
  assert.deepEqual([cli.ok, cli.exit], [false, 3]);
  assert.match(cli.detail, /supabase not found/);
  assert.match(cli.install, /brew install supabase/);
  const docker = supabasePreflight({ cwd: '/p' }, sbDeps({ tools: ['supabase'] }));
  assert.match(docker.install, /Docker/);
});

test('Scenario: Missing config - exit 5 and nothing else runs', () => {
  const r = supabasePreflight({ cwd: '/p' }, { ...sbDeps({ config: false }), run: () => { throw new Error('must not run a command'); } });
  assert.deepEqual([r.ok, r.check, r.exit, r.install], [false, 'config', 5, 'supabase init']);
});

test('Scenario: Docker not running - exit 4 before any test', () => {
  const r = supabasePreflight({ cwd: '/p' }, sbDeps({ docker: 1 }));
  assert.deepEqual([r.ok, r.check, r.exit], [false, 'docker', 4]);
  assert.match(r.detail, /start Docker/);
});

test('Scenario: Local stack stopped - exit 7 is ready but asks before supabase start', () => {
  const r = supabasePreflight({ cwd: '/p' }, sbDeps({ stack: 1 }));
  assert.deepEqual([r.ok, r.check, r.exit, r.install], [true, 'stack_stopped', 7, 'supabase start']);
});

test('the script takes --stack, refuses an unknown one, and Laravel stays the default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-sbpre-'));
  const bad = spawnSync('node', [CLI, '--stack', 'django'], { cwd: dir, encoding: 'utf8' });
  assert.equal(bad.status, 2);
  const none = spawnSync(process.execPath, [CLI, '--stack', 'supabase'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(none.status, 3);
  assert.equal(JSON.parse(none.stdout).check, 'tool');
  const laravel = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(laravel.status, 3);
  assert.match(JSON.parse(laravel.stdout).detail, /php and composer/);
});

// ---- a declared adapter (declared-review-adapter): --needs a,b

const needsWorld = ({ tools = [], docker = 0 } = {}) => ({ find: (n) => tools.includes(n), run: () => ({ status: docker }) });

test('Scenario: Missing tool - the preflight names it, exits 3 and installs nothing', () => {
  const r = needsPreflight({ needs: ['nhost', 'docker'] }, needsWorld({ tools: ['docker'] }));
  assert.deepEqual([r.ok, r.check, r.exit, r.missing], [false, 'tool', 3, ['nhost']]);
  assert.match(r.detail, /nhost not found/);
  assert.equal(r.install, null, 'it has no hint for a tool it does not know');
  assert.match(needsPreflight({ needs: ['docker'] }, needsWorld()).install, /Docker/);
});

test('Scenario: Daemon stopped - exit 4', () => {
  const r = needsPreflight({ needs: ['nhost', 'docker'] }, needsWorld({ tools: ['nhost', 'docker'], docker: 1 }));
  assert.deepEqual([r.ok, r.check, r.exit], [false, 'docker', 4]);
  assert.match(r.detail, /Docker daemon does not answer/);
});

test('Scenario: Everything present - ready with exit 0, and the daemon is asked only when docker is listed', () => {
  const calls = [];
  const deps = { find: () => true, run: (c, a) => { calls.push([c, a]); return { status: 0 }; } };
  assert.deepEqual([needsPreflight({ needs: ['nhost', 'docker'] }, deps).ok, calls], [true, [['docker', ['info']]]]);
  calls.length = 0;
  assert.equal(needsPreflight({ needs: ['nhost'] }, deps).exit, 0);
  assert.deepEqual(calls, []);
  assert.equal(needsPreflight({ needs: [] }, deps).exit, 0);
});

test('a name with a path or a shell character is refused before anything is looked for', () => {
  let looked = false;
  const deps = { find: () => { looked = true; return true; }, run: () => ({ status: 0 }) };
  ['./tools/run', '/bin/sh', 'a b', 'x;rm'].forEach((name) => {
    const r = needsPreflight({ needs: [name] }, deps);
    assert.deepEqual([r.ok, r.exit], [false, 2], name);
  });
  assert.equal(looked, false);
});

test('findOnPath looks in the directories of PATH without running anything', () => {
  const deps = { isExecutable: (f) => f === '/b/nhost' };
  assert.equal(findOnPath('nhost', '/a:/b', deps), true);
  assert.equal(findOnPath('nhost', '/a', deps), false);
  assert.equal(findOnPath('nhost', '', deps), false);
});

test('the command looks on PATH: a stub tool is found, a missing one exits 3, a stopped daemon exits 4, a path exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-needs-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = (name, status) => { writeFileSync(join(bin, name), `#!/bin/sh\necho ran >> "${dir}/${name}.ran"\nexit ${status}\n`); chmodSync(join(bin, name), 0o755); };
  stub('nhost', 0);
  stub('docker', 0);
  const run = (needs, PATH = bin) => spawnSync(process.execPath, [CLI, '--needs', needs], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH } });
  const ok = run('nhost,docker');
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(JSON.parse(ok.stdout).check, 'ready');
  const missing = run('nhost,gateway');
  assert.equal(missing.status, 3);
  assert.deepEqual(JSON.parse(missing.stdout).missing, ['gateway']);
  assert.equal(run('./nhost').status, 2);
  stub('docker', 1);
  assert.equal(run('docker').status, 4);
  // the tool named only to be found was never run, and docker was run once for `info`
  assert.equal(spawnSync('test', ['-e', join(dir, 'nhost.ran')]).status, 1);
});

test('the Laravel and Supabase modes are unchanged by --needs', () => {
  const r = apiPreflight({ cwd: '/p' }, world({ files: READY }));
  assert.equal(r.exit, 0);
  const none = spawnSync(process.execPath, [CLI, '--stack', 'supabase'], { cwd: mkdtempSync(join(tmpdir(), 'relevo-needs-')), encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(none.status, 3);
});

// ---- harden-api-review-audit: the checkout of a declared adapter, by the existence of paths

const checkout = (...present) => ({ find: () => true, run: () => ({ status: 0 }), exists: (p) => present.includes(p) });

test('Scenario: Checkout without dependencies - node_modules is named with the install command, exit 5 and nothing installed', () => {
  const r = needsPreflight({ needs: ['npm'], cwd: '/p' }, checkout('/p/package.json'));
  assert.deepEqual([r.ok, r.check, r.exit, r.warnings.map((w) => w.path), r.install], [true, 'checkout', 5, ['node_modules'], 'npm ci']);
  assert.match(r.detail, /lacks node_modules/);
  assert.equal(needsPreflight({ needs: ['docker'], cwd: '/p' }, checkout('/p/package.json')).exit, 0, 'without npm in needs the dependencies are not asked for');
});

test('Scenario: Checkout without environment file - .env is named, and neither file is opened', () => {
  const opened = [];
  const deps = { ...checkout('/p/.env.example'), read: (f) => opened.push(f) };
  const r = needsPreflight({ needs: ['npm'], cwd: '/p/' }, deps);
  assert.deepEqual([r.exit, r.warnings.map((w) => w.path)], [5, ['.env']]);
  assert.deepEqual(opened, []);
  assert.equal(needsPreflight({ needs: [], cwd: '/p' }, checkout('/p/.env.sample')).warnings[0].path, '.env');
});

test('Scenario: No example file, and Everything present - nothing is said about an environment file, and a complete checkout is ready', () => {
  assert.equal(needsPreflight({ needs: ['npm'], cwd: '/p' }, checkout()).exit, 0);
  assert.equal(needsPreflight({ needs: ['npm'], cwd: '/p' }, checkout('/p/package.json', '/p/node_modules', '/p/.env.example', '/p/.env')).exit, 0);
  const both = needsPreflight({ needs: ['npm'], cwd: '/p' }, checkout('/p/package.json', '/p/.env.example'));
  assert.deepEqual(both.warnings.map((w) => w.path), ['node_modules', '.env']);
});

test('the command exits 5 on a checkout with a package.json and no node_modules, and 0 once it has them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-checkout-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'npm'), 0o755);
  writeFileSync(join(dir, 'package.json'), '{}');
  writeFileSync(join(dir, '.env.example'), 'A=1');
  const run = () => spawnSync(process.execPath, [CLI, '--needs', 'npm'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: bin } });
  const first = run();
  assert.equal(first.status, 5, first.stdout);
  assert.deepEqual(JSON.parse(first.stdout).warnings.map((w) => w.path), ['node_modules', '.env']);
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, '.env'), 'A=1');
  assert.equal(run().status, 0);
});

// ---- harden-api-review-audit: the Compose project is compared with the checkout

import { composeNote, composeWorkdir } from '../scripts/lib/compose-dir.mjs';

const compose = ({ ps = ['abc'], dirs = ['/other/backend'], psStatus = 0, inspectStatus = 0 } = {}) => ({
  capture: (command, args) => (args[0] === 'compose' ? { status: psStatus, stdout: ps.join('\n') } : { status: inspectStatus, stdout: dirs.join('\n') }),
  real: (p) => p,
  branchOf: (d) => ({ '/other/backend': 'feature/21', '/p/backend': 'dev' })[d] ?? null,
});

test('Scenario: Instance from another worktree - both folders and branches are named, as a warning', () => {
  const r = composeWorkdir({ cwd: '/p/backend' }, compose());
  assert.deepEqual([r.state, r.dirs], ['other', ['/other/backend']]);
  const note = composeNote(r);
  assert.match(note, /running from \/other\/backend \(branch feature\/21\), not from \/p\/backend \(branch dev\)/);
  assert.match(note, /may be another branch/);
});

test('Scenario: Same folder - nothing to say', () => {
  const r = composeWorkdir({ cwd: '/p/backend' }, compose({ dirs: ['/p/backend', '/p/backend'] }));
  assert.equal(r.state, 'same');
  assert.equal(composeNote(r), null);
  assert.equal(composeWorkdir({ cwd: '/link' }, { ...compose({ dirs: ['/p/backend'] }), real: () => '/p/backend' }).state, 'same', 'links are resolved before comparing');
});

test('Scenario: Not running - it is said, and a failure to read is a note, not an error', () => {
  const none = composeWorkdir({ cwd: '/p/backend' }, compose({ ps: [] }));
  assert.equal(none.state, 'not-running');
  assert.match(composeNote(none), /no running Compose project was found/);
  assert.equal(composeWorkdir({ cwd: '/p' }, compose({ psStatus: 1 })).state, 'unknown');
  assert.equal(composeWorkdir({ cwd: '/p' }, compose({ dirs: [] })).state, 'unknown', 'no label recorded');
  assert.match(composeNote(composeWorkdir({ cwd: '/p' }, compose({ inspectStatus: 1 }))), /could not tell where the Compose project runs from/);
});

test('the command with --compose warns with exit 5 when the instance runs from another folder, and says nothing when it is the same', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-compose-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), `#!/bin/sh\ncase "$1" in compose) echo c1;; inspect) echo "$WORKDIR";; info) ;; esac\nexit 0\n`);
  chmodSync(join(bin, 'docker'), 0o755);
  const run = (workdir) => spawnSync(process.execPath, [CLI, '--needs', 'docker', '--compose'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WORKDIR: workdir } });
  const other = run('/somewhere/else');
  assert.equal(other.status, 5, other.stdout);
  assert.match(JSON.parse(other.stdout).compose.warning, /running from \/somewhere\/else/);
  const same = run(dir);
  assert.equal(same.status, 0, same.stdout);
  assert.equal(JSON.parse(same.stdout).compose, undefined);
});
