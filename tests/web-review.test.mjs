import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLog, filterByApp } from '../scripts/lib/logaudit.mjs';
import { formatBrowserLog, isAllowedOrigin, redact, scanReviewScript, WEB_PACKAGE } from '../scripts/lib/web-review.mjs';

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
