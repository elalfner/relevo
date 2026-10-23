#!/usr/bin/env node
// Runs a review script in a browser of its own and reports what it checked. Usage:
//   node scripts/web-review.mjs --script evidence/review-web.mjs --url http://localhost:5173 \
//        [--allow-origins https://staging.example.com] [--secret-env TEST_USER,TEST_PASS] [--out evidence]
//        [--state evidence/review-state.json] [--headed]
// The script is the agent's, written from the scenarios and reviewed by QA. Its default export receives
// { page, context, baseUrl, line, credentials, capture }: line(n, how, fn) runs fn and records the checklist line n as
// auto-ok or auto-fail; credentials(name) gives a test credential taken from the environment variable `name`,
// which must be in --secret-env; capture(name, check, { fullPage }) runs the assertion `check` and, when it holds,
// saves <out>/<name>.png and records it in the review state (nothing of the image is given back or printed).
// Before anything runs, the review state must say the autopilot is on, the data was confirmed, the review is not
// agreed yet, and QA passed this exact script (review-state.mjs qa-pass). The browser has a clean profile and can
// reach only localhost, the page under review and the allowed origins; every secret value is redacted from what is
// written, and the script's own console goes to <out>/script-console.txt, never to this output.
// Writes <out>/web-log.txt (the log the audit reads, with --package web) and <out>/web-result.json. Each run against
// another server uses an --out of its own; only the log of the normal run is audited.
//   exit 0: the script ran (lines and captures can still have failed)   exit 1: the review state refused the run,
//   the script was refused, Playwright is missing, the browser could not start, or the script failed outside a line
//   exit 2: bad arguments

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format } from 'node:util';
import { assertDriving, recordCapture, scriptHash } from './lib/review-state.mjs';
import { formatBrowserLog, isAllowedOrigin, loadPlaywright, makeCapture, probableCause, redact, scanReviewScript } from './lib/web-review.mjs';

const RUN_LIMIT_MS = 120000;
// The runner's own output. The script's console is taken over while it runs, so these are kept apart.
const say = console.log.bind(console);
const tell = console.error.bind(console);

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const list = (name) => (arg(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const stop = (code, message) => {
  tell(message);
  process.exit(code);
};

const scriptPath = arg('script');
const baseUrl = arg('url');
if (!scriptPath || !baseUrl || !existsSync(scriptPath)) stop(2, 'usage: web-review.mjs --script <file> --url <url> [--allow-origins a,b] [--secret-env A,B] [--out evidence] [--state evidence/review-state.json] [--headed]');
let origin;
try {
  origin = new URL(baseUrl);
} catch {
  stop(2, `--url is not a URL: ${baseUrl}`);
}
const allowed = list('allow-origins');
const secretNames = list('secret-env');
const out = resolve(arg('out') ?? 'evidence');
const statePath = resolve(arg('state') ?? 'evidence/review-state.json');

const readState = () => JSON.parse(readFileSync(statePath, 'utf8'));
if (!existsSync(statePath)) stop(1, `no review in progress (${statePath} not found): the runner drives only a review started with review-state.mjs init`);
try {
  assertDriving(readState(), { open: true });
} catch (error) {
  stop(1, `the review state refused the run before any browser started: ${error.message}`);
}

const source = readFileSync(scriptPath, 'utf8');
const problems = scanReviewScript(source);
if (problems.length > 0) stop(1, `the review script was refused before any browser started:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
if (readState().qaScript?.sha256 !== scriptHash(source)) {
  stop(1, `the review script is not the one QA passed: launch relevo:qa on it, and after QA PASSED run review-state.mjs qa-pass ${scriptPath}`);
}

const secrets = Object.fromEntries(secretNames.filter((n) => process.env[n]).map((n) => [n, process.env[n]]));
const hide = (text) => redact(text, secrets);

const playwright = loadPlaywright();
if (!playwright) stop(1, 'Playwright cannot be resolved from this project: with the person\'s permission, install it with "npm install --no-save playwright" and "npx playwright install chromium", then restore package-lock.json if npm changed it');

if (arg('out') === undefined && existsSync(join(out, 'web-log.txt'))) {
  tell(`warning: ${join(out, 'web-log.txt')} is replaced; a run against another server uses an --out of its own (evidence/run-<port>)`);
}
mkdirSync(out, { recursive: true });

const events = [];
const results = [];
const captures = [];
const scriptConsole = [];
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

// From here on the script's console goes to a file, also after a timeout: the runner prints with say and tell.
function takeOverConsole() {
  ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'].forEach((level) => {
    console[level] = (...args) => { scriptConsole.push(`${level} ${format(...args)}`); };
  });
}

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
  // The real path, so a capture is recorded relative to the working directory even through a symbolic link.
  const capture = makeCapture({ page, out: realpathSync(out), captures });

  try {
    takeOverConsole();
    const mod = await import(pathToFileURL(resolve(scriptPath)).href);
    if (typeof mod.default !== 'function') throw new Error('the script must export a default async function');
    await mod.default({ page, context, baseUrl, line, credentials, capture });
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

// A browser that never loaded a page proves nothing: the log is left empty so the audit is inconclusive.
writeFileSync(join(out, 'web-log.txt'), pagesLoaded === 0 ? '' : hide(formatBrowserLog(events, { origin: origin.host })));
writeFileSync(join(out, 'web-result.json'), hide(`${JSON.stringify({ url: baseUrl, lines: results, captures, blocked: events.filter((e) => e.type === 'blocked').length, pagesLoaded, scriptError }, null, 2)}\n`));
writeFileSync(join(out, 'script-console.txt'), hide(scriptConsole.map((l) => `${l}\n`).join('')));

// The state is read again, so a line set while the browser ran is not lost.
const saved = captures.filter((c) => c.ok);
if (saved.length > 0) {
  try {
    const state = readState();
    saved.forEach((c) => recordCapture(state, c.path));
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    tell(`the captures could not be recorded in ${statePath}: ${error.message}`);
  }
}

results.sort((a, b) => a.n - b.n).forEach((r) => say(hide(`line ${r.n}: ${r.status} - ${r.how}${r.error ? ` (${r.error})` : ''}`)));
captures.forEach((c) => say(hide(c.ok ? `captured ${c.path}` : `capture ${c.name}: failed (${c.error})`)));
say(`${events.length} event(s) written to ${join(out, 'web-log.txt')}; audit it with: review-state.mjs audit --package web`);
if (scriptError) {
  const cause = probableCause(events, baseUrl);
  if (cause) tell(hide(`the page itself failed: ${cause}`));
  stop(1, hide(`the script failed outside a line: ${scriptError}`));
}
process.exit(0);
