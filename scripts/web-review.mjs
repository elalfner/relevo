#!/usr/bin/env node
// Runs a review script in a browser of its own and reports what it checked. Usage:
//   node scripts/web-review.mjs --script evidence/review-web.mjs --url http://localhost:5173 \
//        [--allow-origins https://staging.example.com] [--secret-env TEST_USER,TEST_PASS] [--out evidence] [--headed]
// The script is the agent's, written from the scenarios and reviewed by QA. Its default export receives
// { page, context, baseUrl, line, credentials }: line(n, how, fn) runs fn and records the checklist line n as
// auto-ok or auto-fail; credentials(name) gives a test credential taken from the environment variable `name`,
// which must be in --secret-env. The browser has a clean profile and can reach only localhost, the page under
// review and the allowed origins; every secret value is redacted from what is written.
// Writes <out>/web-log.txt (the log the audit reads, with --package web) and <out>/web-result.json.
//   exit 0: the script ran (lines can still have failed)   exit 1: the script was refused, Playwright is missing,
//   the browser could not start, or the script failed outside a line   exit 2: bad arguments

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatBrowserLog, isAllowedOrigin, redact, scanReviewScript } from './lib/web-review.mjs';

const RUN_LIMIT_MS = 120000;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const list = (name) => (arg(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const stop = (code, message) => {
  console.error(message);
  process.exit(code);
};

const scriptPath = arg('script');
const baseUrl = arg('url');
if (!scriptPath || !baseUrl || !existsSync(scriptPath)) stop(2, 'usage: web-review.mjs --script <file> --url <url> [--allow-origins a,b] [--secret-env A,B] [--out evidence] [--headed]');
let origin;
try {
  origin = new URL(baseUrl);
} catch {
  stop(2, `--url is not a URL: ${baseUrl}`);
}
const allowed = list('allow-origins');
const secretNames = list('secret-env');
const out = resolve(arg('out') ?? 'evidence');

const problems = scanReviewScript(readFileSync(scriptPath, 'utf8'));
if (problems.length > 0) stop(1, `the review script was refused before any browser started:\n${problems.map((p) => `  - ${p}`).join('\n')}`);

const secrets = Object.fromEntries(secretNames.filter((n) => process.env[n]).map((n) => [n, process.env[n]]));
const hide = (text) => redact(text, secrets);

function loadPlaywright() {
  for (const base of [join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return createRequire(base)('playwright');
    } catch { /* try the next place */ }
  }
  return null;
}
const playwright = loadPlaywright();
if (!playwright) stop(1, 'Playwright cannot be resolved from this project: install it with "npm install -D playwright" and "npx playwright install chromium"');

const events = [];
const results = [];
let scriptError = null;
let pagesLoaded = 0;
let browser;

const line = async (n, how, fn) => {
  if (!Number.isInteger(n) || n < 1) throw new Error('line(n, how, fn) needs the number of a checklist line');
  try {
    await fn();
    results.push({ n, status: 'auto-ok', how: String(how) });
  } catch (error) {
    results.push({ n, status: 'auto-fail', how: String(how), error: String(error?.message ?? error).split('\n')[0] });
  }
};
const credentials = (name) => {
  if (!secretNames.includes(name)) throw new Error(`credentials("${name}"): the name is not in --secret-env`);
  if (!(name in secrets)) throw new Error(`credentials("${name}"): the environment variable is not set`);
  return secrets[name];
};

async function run() {
  try {
    browser = await playwright.chromium.launch({ headless: !process.argv.includes('--headed') });
  } catch (error) {
    stop(1, `the browser could not start: ${String(error.message).split('\n')[0]}`);
  }
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const request = route.request();
    if (isAllowedOrigin(request.url(), { baseUrl, allowed })) return route.continue();
    events.push({ type: 'blocked', text: `${request.method()} ${request.url()}` });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  // "Failed to load resource" repeats what the request and response events already say (and the blocked ones).
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) events.push({ type: 'console', text: m.text() }); });
  page.on('pageerror', (e) => events.push({ type: 'pageerror', text: `${e.name}: ${e.message}` }));
  page.on('requestfailed', (r) => {
    const reason = r.failure()?.errorText ?? 'failed';
    if (!reason.includes('BLOCKED_BY_CLIENT')) events.push({ type: 'requestfailed', text: `${r.method()} ${r.url()} ${reason}` });
  });
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame() && r.status() < 400) pagesLoaded += 1;
  });
  page.on('response', (r) => { if (r.status() >= 400) events.push({ type: 'response', text: `${r.status()} ${r.request().method()} ${r.url()}` }); });

  try {
    const mod = await import(pathToFileURL(resolve(scriptPath)).href);
    if (typeof mod.default !== 'function') throw new Error('the script must export a default async function');
    await mod.default({ page, context, baseUrl, line, credentials });
  } catch (error) {
    scriptError = String(error?.message ?? error).split('\n')[0];
  }
}

const timer = setTimeout(() => {
  scriptError = `the run took more than ${RUN_LIMIT_MS / 1000} seconds and was stopped`;
}, RUN_LIMIT_MS);
let backstop;
await Promise.race([run(), new Promise((r) => { backstop = setTimeout(r, RUN_LIMIT_MS + 500); })]);
clearTimeout(timer);
clearTimeout(backstop);
if (browser) await browser.close().catch(() => {});

mkdirSync(out, { recursive: true });
// A browser that never loaded a page proves nothing: the log is left empty so the audit is inconclusive.
writeFileSync(join(out, 'web-log.txt'), pagesLoaded === 0 ? '' : hide(formatBrowserLog(events, { origin: origin.host })));
writeFileSync(join(out, 'web-result.json'), hide(`${JSON.stringify({ url: baseUrl, lines: results, blocked: events.filter((e) => e.type === 'blocked').length, pagesLoaded, scriptError }, null, 2)}\n`));
results.sort((a, b) => a.n - b.n).forEach((r) => console.log(hide(`line ${r.n}: ${r.status} - ${r.how}${r.error ? ` (${r.error})` : ''}`)));
console.log(`${events.length} event(s) written to ${join(out, 'web-log.txt')}; audit it with: review-state.mjs audit --package web`);
if (scriptError) stop(1, hide(`the script failed outside a line: ${scriptError}`));
process.exit(0);
