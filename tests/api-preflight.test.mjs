import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiPreflight, lockMatches, phpunitEnv, testDatabase } from '../scripts/lib/api-preflight.mjs';

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
