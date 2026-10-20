import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapterFor, needsAutopilot, targetOf } from '../scripts/lib/review-adapters.mjs';

const CLI = new URL('../scripts/review-adapter.mjs', import.meta.url).pathname;

test('Scenario: Android device - Flutter on android is a device with adb that a driver can drive', () => {
  const a = adapterFor({ stack: 'flutter', target: 'android' });
  assert.deepEqual([a.supported, a.kind, a.log, a.driver, a.needs], [true, 'device', 'adb logcat', 'flutter_driver', ['adb']]);
  assert.equal(needsAutopilot(a), false);
});

test('Scenario: Web - Vue and Flutter on web are a browser, and the review needs the autopilot', () => {
  const vue = adapterFor({ stack: 'vue', target: 'web' });
  assert.deepEqual([vue.supported, vue.kind, vue.driver], [true, 'browser', 'playwright']);
  assert.equal(needsAutopilot(vue), true);
  const flutterWeb = adapterFor({ stack: 'flutter', target: 'web' });
  assert.deepEqual([flutterWeb.kind, flutterWeb.driver], ['browser', 'flutter_driver']);
});

test('Scenario: No adapter - iOS says it is not available yet, and unknown combinations say why', () => {
  const ios = adapterFor({ stack: 'flutter', target: 'ios' });
  assert.equal(ios.supported, false);
  assert.match(ios.reason, /iOS is not available yet.*macOS/);
  assert.match(adapterFor({ stack: 'laravel', target: 'api' }).reason, /no review adapter for the stack "laravel" on the target "api"/);
  assert.match(adapterFor({ stack: 'django', target: null }).reason, /names no target/);
});

test('the target is the first of the platform, or the usual one of the stack', () => {
  assert.equal(targetOf({ stack: 'flutter', targets: ['web', 'android'] }), 'web');
  assert.equal(targetOf({ stack: 'flutter', targets: [] }), 'android');
  assert.equal(targetOf({ stack: 'vue', targets: [] }), 'web');
  assert.equal(targetOf({ stack: 'laravel', targets: [] }), null);
});

test('the script resolves the platform from relevo.yml, takes --target, and exits 1 when not supported', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-ad-'));
  const config = join(dir, 'relevo.yml');
  writeFileSync(config, 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: flutter\n    targets: [android, ios, web]\n  site:\n    stack: vue\n    path: apps/site\n    targets: [web]\n');
  const run = (...a) => spawnSync('node', [CLI, '--config', config, ...a], { encoding: 'utf8' });
  const app = run('--platform', 'app');
  assert.equal(app.status, 0, app.stderr);
  assert.equal(JSON.parse(app.stdout).target, 'android');
  assert.equal(JSON.parse(run('--platform', 'app', '--target', 'web').stdout).kind, 'browser');
  const ios = run('--platform', 'app', '--target', 'ios');
  assert.equal(ios.status, 1);
  assert.match(JSON.parse(ios.stdout).reason, /not available yet/);
  const site = JSON.parse(run('--platform', 'site').stdout);
  assert.deepEqual([site.platform, site.needs_autopilot], ['site', true]);
  assert.equal(run('--platform', 'nope').status, 2);
  assert.equal(run().status, 2);
});
