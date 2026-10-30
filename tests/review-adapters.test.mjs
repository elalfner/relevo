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

test('Scenario: Laravel - a stack with no targets is the api adapter, and the review needs no autopilot', () => {
  const a = adapterFor({ stack: 'laravel', target: null });
  assert.deepEqual([a.supported, a.kind, a.driver, a.capture, a.needs], [true, 'api', 'php artisan test', null, ['php', 'composer']]);
  assert.equal(needsAutopilot(a), false);
  assert.equal(adapterFor({ stack: 'laravel', target: 'api' }).supported, false);
});

test('Scenario: No adapter - the message names the adapters that exist, that the issue stays built and how to tune', () => {
  const r = adapterFor({ stack: 'supabase', target: null }).reason;
  assert.match(r, /names no target to review/);
  assert.match(r, /flutter on android.*vue on web.*laravel \(api\)/);
  assert.match(r, /issue stays built/);
  assert.match(r, /"review" block of \.relevo\/stacks/);
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

test('Scenario: Web with autopilot off - the advice recommends verify, names precheck, in the language of relevo.yml', async () => {
  const { autopilotAdvice } = await import('../scripts/lib/review-adapters.mjs');
  const vue = adapterFor({ stack: 'vue', target: 'web' });
  const en = autopilotAdvice(vue, { autopilot: 'off', language: 'en' });
  assert.match(en, /review\.autopilot to verify/);
  assert.match(en, /precheck is the cautious option/);
  assert.match(en, /You still confirm every line, and lines about appearance are never marked automatically/);
  assert.match(en, /commit it to the base branch/);
  assert.match(autopilotAdvice(vue, { autopilot: 'off', language: 'es-MX' }), /review\.autopilot en verify.*precheck es la opción prudente.*apariencia nunca se marcan/s);
  assert.equal(autopilotAdvice(vue, { autopilot: 'precheck' }), null);
  assert.equal(autopilotAdvice(adapterFor({ stack: 'flutter', target: 'android' }), { autopilot: 'off' }), null);
  assert.match(vue.capture, /capture\(name, check\)/);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-ad-'));
  const config = join(dir, 'relevo.yml');
  writeFileSync(config, 'language: es\nlimits:\n  run_max_cost: 5\nplatforms:\n  site:\n    stack: vue\n    targets: [web]\n');
  const out = JSON.parse(spawnSync('node', [CLI, '--config', config, '--platform', 'site'], { encoding: 'utf8' }).stdout);
  assert.match(out.advice, /precheck es la opción prudente/);
  writeFileSync(config, 'language: es\nreview:\n  autopilot: verify\nlimits:\n  run_max_cost: 5\nplatforms:\n  site:\n    stack: vue\n    targets: [web]\n');
  assert.equal(JSON.parse(spawnSync('node', [CLI, '--config', config, '--platform', 'site'], { encoding: 'utf8' }).stdout).advice, null);
});
