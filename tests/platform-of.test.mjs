import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePlatform } from '../scripts/lib/platform-of.mjs';

const CLI = new URL('../scripts/platform-of.mjs', import.meta.url).pathname;
const ONE = { app: { stack: 'flutter', path: '.', targets: ['android'] } };
const TWO = { web: { stack: 'vue', path: 'apps/web', targets: [] }, api: { stack: 'laravel', path: 'apps/api', targets: [] } };

test('Scenario: One platform, no line - the platform is that one', () => {
  const r = resolvePlatform({ platforms: ONE, body: '## Scenarios\n' });
  assert.equal(r.ok, true);
  assert.equal(r.name, 'app');
  assert.equal(r.entry.stack, 'flutter');
});

test('Scenario: Several platforms, line present', () => {
  const r = resolvePlatform({ platforms: TWO, body: 'Summary\n\nPlatform: api\n' });
  assert.equal(r.ok, true);
  assert.equal(r.name, 'api');
  assert.equal(r.entry.path, 'apps/api');
  assert.equal(resolvePlatform({ platforms: TWO, body: '- Platform: `web`\n' }).name, 'web', 'a bullet and backticks are tolerated');
});

test('Scenario: Several platforms, no line - missing, with the names of the platforms', () => {
  const r = resolvePlatform({ platforms: TWO, body: '## Scenarios\n' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing');
  assert.match(r.message, /Platform: line.*web, api/);
});

test('Scenario: Unknown name - names it and the platforms that exist', () => {
  const r = resolvePlatform({ platforms: TWO, body: 'Platform: mobile\n' });
  assert.equal(r.reason, 'unknown');
  assert.match(r.message, /Platform: mobile.*web, api/);
  assert.equal(resolvePlatform({ platforms: ONE, body: 'Platform: web\n' }).reason, 'unknown', 'with one platform a wrong name is still wrong');
});

test('Scenario: Two different lines - a conflict; the same name twice is not', () => {
  const r = resolvePlatform({ platforms: TWO, body: 'Platform: web\n\nlater...\n\nPlatform: api\n' });
  assert.equal(r.reason, 'conflict');
  assert.match(r.message, /web, api.*split it into one issue per platform/);
  assert.equal(resolvePlatform({ platforms: TWO, body: 'Platform: web\nPlatform: web\n' }).ok, true);
  assert.equal(resolvePlatform({ platforms: TWO, body: 'Platform: web, api\n' }).reason, 'conflict');
});

test('a Platform line inside a code block is only an example and does not count', () => {
  const body = 'Example:\n\n```markdown\nPlatform: api\n```\n';
  assert.equal(resolvePlatform({ platforms: TWO, body }).reason, 'missing');
});

// ---------- the command

const dir = mkdtempSync(join(tmpdir(), 'relevo-platform-of-'));
const CONFIG = (extra) => `limits:\n  run_max_cost: 5\n${extra}`;
const TWO_YML = CONFIG('platforms:\n  web:\n    stack: vue\n    path: apps/web\n  api:\n    stack: laravel\n    path: apps/api\n');
function run(config, body, ...extra) {
  const cfg = join(dir, `c-${Math.random().toString(36).slice(2)}.yml`);
  const input = join(dir, `i-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(cfg, config);
  writeFileSync(input, JSON.stringify({ body }));
  return spawnSync('node', [CLI, '--config', cfg, '--input', input, ...extra], { encoding: 'utf8' });
}

test('the command prints platform, stack, path and targets', () => {
  const r = run(TWO_YML, 'Platform: api\n');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { platform: 'api', stack: 'laravel', path: 'apps/api', targets: [] });
  assert.equal(JSON.parse(run(CONFIG('platform: flutter-android\n'), 'nothing here').stdout).platform, 'app');
});

test('the command exits 1 with the reason when the platform cannot be resolved, and 2 for bad usage', () => {
  const missing = run(TWO_YML, 'no line');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /the issue has no Platform: line naming one of the platforms of relevo\.yml \(web, api\)/);
  assert.equal(run(TWO_YML, 'Platform: mobile\n').status, 1);
  assert.equal(run('oops: 1\n', 'x').status, 2, 'an invalid relevo.yml');
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
});
