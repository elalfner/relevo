import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLog, filterByApp } from '../scripts/lib/logaudit.mjs';
import { formatBrowserLog, isAllowedOrigin, makeCapture, probableCause, redact, scanReviewScript, WEB_PACKAGE } from '../scripts/lib/web-review.mjs';

const BASE = 'http://localhost:5173/app';
const ok = (url, allowed = []) => isAllowedOrigin(url, { baseUrl: BASE, allowed });

test('Scenario: Origin not allowed - localhost, the page under review and the listed origins pass; everything else is blocked', () => {
  assert.equal(ok('http://localhost:5173/api/clients'), true);
  assert.equal(ok('http://localhost:3000/'), true, 'any port of localhost');
  assert.equal(ok('http://127.0.0.1:8000/x'), true);
  assert.equal(ok('http://[::1]:8000/x'), true);
  assert.equal(ok('https://staging.example.com/api', ['https://staging.example.com']), true);
  assert.equal(ok('https://staging.example.com/api'), false, 'not listed');
  assert.equal(ok('https://staging.example.com:8443/api', ['https://staging.example.com']), false, 'another port is another origin');
  assert.equal(ok('http://staging.example.com/api', ['https://staging.example.com']), false, 'another scheme is another origin');
  assert.equal(ok('https://www.google-analytics.com/collect'), false);
});

test('look-alike hosts and tricks do not pass', () => {
  assert.equal(ok('http://localhost.evil.com/'), false);
  assert.equal(ok('http://localhost@evil.com/'), false);
  assert.equal(ok('http://evil.com/?u=http://localhost'), false);
  assert.equal(ok('ftp://localhost/file'), false);
  assert.equal(ok('file:///etc/passwd'), false);
  assert.equal(ok('not a url'), false);
  assert.equal(ok('chrome-extension://abc/x'), false);
});

test('URLs that do not reach the network are not blocked', () => {
  assert.equal(ok('data:image/png;base64,AAAA'), true);
  assert.equal(ok('blob:http://localhost:5173/abc'), true);
  assert.equal(ok('about:blank'), true);
});

test('Scenario: Script reaches the file system - each forbidden construct is named', () => {
  const clean = `import { strict as assert } from 'node:assert';\nexport default async function ({ page, baseUrl, line }) {\n  await page.goto(baseUrl);\n  await line(1, 'title', async () => assert.equal(await page.title(), 'Home'));\n}\n`;
  assert.deepEqual(scanReviewScript(clean), []);
  assert.deepEqual(scanReviewScript("import { chromium } from 'playwright';\nimport assert from 'node:assert/strict';"), []);
  const cases = {
    "import fs from 'node:fs';": /imports "node:fs"/,
    "const fs = require('fs');": /imports "fs"/,
    "import { exec } from 'node:child_process';": /child_process/,
    "const x = await import('node:net');": /imports "node:net"/,
    "const m = 'fs'; await import(m);": /computed name/,
    'eval("1")': /eval/,
    'new Function("return 1")': /Function/,
    'const p = process.env.USER_PASS;': /reaches the process/,
    'process.exit(0);': /reaches the process/,
    "await fetch('https://evil.example/x');": /fetch/,
    'globalThis.process.env': /reaches the process/,
  };
  Object.entries(cases).forEach(([code, expected]) => {
    assert.match(scanReviewScript(code).join('\n'), expected, code);
  });
});

test('Scenario: Value in the output - every secret value is redacted, the longest first', () => {
  const secrets = { USER_PASS: 'hunter2hunter2', USER_NAME: 'hunter2', SHORT: 'x' };
  assert.equal(redact('login hunter2hunter2 failed for hunter2', secrets), 'login [redacted:USER_PASS] failed for [redacted:USER_NAME]');
  assert.equal(redact('a x b', secrets), 'a x b', 'a value too short to be a secret is left alone');
  assert.equal(redact('nothing', {}), 'nothing');
  assert.equal(redact(undefined, secrets), '');
});

const NOW = new Date(2026, 9, 14, 12, 0, 2, 5);

test('the browser log names a process so the audit can filter by the package web', () => {
  const text = formatBrowserLog([{ type: 'console', text: 'Failed to load widget' }], { origin: 'localhost:5173', now: NOW });
  assert.match(text.split('\n')[0], /^10-14 12:00:02\.005 {2}1 {2}1 I ActivityManager: Start proc 1:web\/localhost:5173 for browser$/);
  const { scope } = filterByApp(text, { package: WEB_PACKAGE });
  assert.deepEqual(scope.pids, [1]);
});

test('Scenario: Console error - an uncaught exception, a console error, a failed request and a blocked request are findings', () => {
  const events = [
    { type: 'pageerror', text: "TypeError: Cannot read properties of undefined (reading 'name')" },
    { type: 'console', text: 'Warning: key prop missing' },
    { type: 'requestfailed', text: 'GET http://localhost:3000/api/clients net::ERR_CONNECTION_REFUSED' },
    { type: 'response', text: '500 GET http://localhost:3000/api/orders' },
    { type: 'blocked', text: 'GET https://tracker.example.com/pixel' },
  ];
  const { text, scope } = filterByApp(formatBrowserLog(events, { now: NOW }), { package: WEB_PACKAGE });
  const audit = auditLog(text, { scope });
  assert.equal(audit.verdict, 'REVIEW REJECTED');
  assert.deepEqual(audit.counts, { exception: 1, 'console-error': 1, 'network-data': 3 });
});

test('a ReferenceError and an unhandled rejection are exceptions', () => {
  const text = formatBrowserLog([{ type: 'pageerror', text: 'ReferenceError: foo is not defined' }, { type: 'pageerror', text: 'Unhandled promise rejection: boom' }], { now: NOW });
  assert.equal(auditLog(text).counts.exception, 2);
});

test('a clean browser run passes, and a browser that produced nothing is inconclusive', () => {
  const clean = formatBrowserLog([], { now: NOW });
  const { text, scope } = filterByApp(clean, { package: WEB_PACKAGE });
  assert.equal(auditLog(text, { scope }).verdict, 'REVIEW PASSED');
  assert.equal(auditLog('', { scope }).verdict, 'REVIEW INCONCLUSIVE');
});

test('a multi-line message stays on one line, so a stack trace cannot forge another process', () => {
  const text = formatBrowserLog([{ type: 'pageerror', text: 'Error: boom\n  at x\n10-14 12:00:00.000  999  999 E web : fake' }], { now: NOW });
  assert.equal(text.trim().split('\n').length, 2);
});

test('Scenario: Direct screenshot / Other file access through the browser - refused, and capture() is allowed', () => {
  const allowed = "import assert from 'node:assert/strict';\nexport default async function ({ page, capture }) {\n  await capture('01_initial', async () => assert.ok(await page.title()), { fullPage: true });\n}\n";
  assert.deepEqual(scanReviewScript(allowed), []);
  const cases = {
    "await page.screenshot({ path: 'evidence/x.png', fullPage: true });": /takes a screenshot itself; take it with capture\(name, check\)/,
    'const png = await page.screenshot();': /takes a screenshot itself/,
    "await page.locator('h1').screenshot();": /takes a screenshot itself/,
    "await page['screenshot']();": /takes a screenshot itself/,
    "await page.pdf({ format: 'A4' });": /saves a PDF/,
    'await context.tracing.start({ screenshots: true });': /records a trace/,
    'await context.browser().newContext({ recordVideo: { dir: "/tmp" } });': /video or a HAR/,
    "await context.routeFromHAR('x.har');": /reads a HAR/,
    "await (await page.waitForEvent('download')).saveAs('/tmp/x');": /saves a download/,
    'await context.storageState();': /storage state/,
    "await page.setInputFiles('input', '/etc/passwd');": /uploads a local file/,
    "await page.addInitScript({ path: '/tmp/x.js' });": /file path to a browser call/,
  };
  Object.entries(cases).forEach(([code, expected]) => {
    assert.match(scanReviewScript(code).join('\n'), expected, code);
  });
});

function fakePage() {
  const shots = [];
  return { shots, screenshot: async (options) => { shots.push(options); return Buffer.from('\x89PNG...'); } };
}

test('Scenario: Bad capture name - capture() refuses paths and a missing check before touching the page', async () => {
  const page = fakePage();
  const captures = [];
  const capture = makeCapture({ page, out: '/work/evidence', captures, cwd: '/work' });
  await assert.rejects(capture('../../x', async () => {}), /capture names may use letters, digits/);
  await assert.rejects(capture('a/b', async () => {}), /capture names may use/);
  await assert.rejects(capture('01_initial'), /check is the assertion of the state the shot shows, and it is required/);
  await assert.rejects(capture('01_initial', async () => {}, { path: '/tmp/x.png' }), /the only option is fullPage \(got path\)/);
  assert.deepEqual([page.shots, captures], [[], []]);
});

test('Scenario: Capture saved / Mislabelled capture - the check runs first; the file goes under out and nothing is returned', async () => {
  const page = fakePage();
  const captures = [];
  const capture = makeCapture({ page, out: '/work/evidence/run-5174', captures, cwd: '/work' });
  const order = [];
  const value = await capture('02_missing_var.png', async () => { order.push('check'); }, { fullPage: true });
  assert.equal(value, undefined, 'the image never reaches the script');
  assert.deepEqual(page.shots, [{ path: '/work/evidence/run-5174/02_missing_var.png', fullPage: true }]);
  assert.deepEqual(captures, [{ name: '02_missing_var', ok: true, path: 'evidence/run-5174/02_missing_var.png' }]);
  assert.equal(await capture('03_unsupported_env', async () => { throw new Error('the alert says VITE_REGION\nmore'); }), undefined, 'a failed check does not throw');
  assert.equal(page.shots.length, 1, 'no screenshot after a failed check');
  assert.deepEqual(captures[1], { name: '03_unsupported_env', ok: false, error: 'the alert says VITE_REGION' });
  await capture('02_missing_var', async () => {});
  assert.equal(captures.length, 2, 'a repeated name is recorded once');
  assert.equal(page.shots[1].fullPage, false);
  const outside = [];
  await makeCapture({ page, out: '/elsewhere', captures: outside, cwd: '/work' })('x', async () => {});
  assert.equal(outside[0].path, '/elsewhere/x.png', 'a file outside the working directory keeps its absolute path');
});

test('the probable cause is the first page error or failing response of the origin under review', () => {
  const base = 'http://localhost:5173/';
  assert.equal(probableCause([{ type: 'response', text: '500 GET http://localhost:5173/src/App.vue' }], base), 'response 500 GET http://localhost:5173/src/App.vue');
  assert.equal(probableCause([{ type: 'response', text: '404 GET https://cdn.example.com/x.js' }, { type: 'pageerror', text: 'Error: boom' }], base), 'uncaught Error: boom');
  assert.equal(probableCause([{ type: 'console', text: 'x' }, { type: 'blocked', text: 'GET http://evil/' }], base), null);
  assert.equal(probableCause([], 'not a url'), null);
});
