// The rules of a driven web review that must not vary: which origins a page may reach, what a review script may
// contain, how a secret is kept out of the output, and the log the audit reads.
// Implements "The agent operates the app only within fixed limits", "A web review script is reviewed before it runs",
// "Credentials of a driven review are names, not values", "The audit understands a browser",
// "A browser review takes captures through the runner" and "A failing page is reported as such" of openspec/specs/review/spec.md.

import { createRequire } from 'node:module';
import { isAbsolute, join, relative } from 'node:path';
import { safeCaptureName } from './device.mjs';

export const WEB_PACKAGE = 'web';

/** Playwright as the project resolves it, else as the plugin does; null when neither has it. */
export function loadPlaywright(cwd = process.cwd()) {
  for (const base of [join(cwd, 'package.json'), import.meta.url]) {
    try {
      return createRequire(base)('playwright');
    } catch { /* try the next place */ }
  }
  return null;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// URLs that do not reach the network.
const OFFLINE_PROTOCOLS = new Set(['data:', 'blob:', 'about:']);

/**
 * May a request to `url` leave the browser? Only localhost, the origin under review and the listed origins.
 * `allowed` is the list of origins (review.allowed_origins); `baseUrl` is the page under review.
 */
export function isAllowedOrigin(url, { baseUrl, allowed = [] } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (OFFLINE_PROTOCOLS.has(u.protocol)) return true;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (LOCAL_HOSTS.has(u.hostname)) return true;
  const origins = new Set(allowed);
  if (baseUrl) {
    try {
      origins.add(new URL(baseUrl).origin);
    } catch { /* an unusable base adds nothing */ }
  }
  return origins.has(u.origin);
}

const ALLOWED_MODULES = new Set(['node:assert', 'node:assert/strict', 'assert', 'assert/strict', 'playwright', '@playwright/test']);
const FORBIDDEN = [
  [/\bchild_process\b/, 'it reaches child_process'],
  [/\beval\s*\(/, 'it calls eval'],
  [/\bnew\s+Function\b|\bFunction\s*\(/, 'it builds code with Function'],
  [/\bprocess\s*\.\s*(env|exit|kill|binding|argv)\b/, 'it reaches the process (credentials come from credentials(name))'],
  [/\bglobalThis\s*\.\s*process\b/, 'it reaches the process'],
  [/\bfetch\s*\(/, 'it makes a request outside the browser with fetch'],
  [/\brequire\.resolve\b|\bimport\.meta\b/, 'it inspects the module system'],
  [/\bscreenshot\s*\(|\[\s*['"`]screenshot['"`]\s*\]/, 'it takes a screenshot itself; take it with capture(name, check), which saves it in the output folder'],
  [/\.\s*pdf\s*\(/, 'it saves a PDF of the page'],
  [/\btracing\b/, 'it records a trace'],
  [/\brecord(?:Video|Har)\b/, 'it records a video or a HAR'],
  [/\brouteFromHAR\b/, 'it reads a HAR file'],
  [/\.\s*saveAs\s*\(/, 'it saves a download'],
  [/\.\s*storageState\s*\(/, 'it saves the storage state'],
  [/\.\s*setInputFiles\s*\(/, 'it uploads a local file to the page'],
  [/(?:^|[{,\s])['"]?path['"]?\s*:/m, 'it passes a file path to a browser call (a "path:" option)'],
];

/**
 * A tripwire for a review script written by the agent: it lists what the script must not do. It is not a sandbox;
 * the real protections are the review by QA, the origin guard and the clean profile.
 */
export function scanReviewScript(text) {
  const source = String(text ?? '');
  const problems = [];
  const modules = [
    ...[...source.matchAll(/\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  [...new Set(modules)].filter((m) => !ALLOWED_MODULES.has(m)).forEach((m) => problems.push(`it imports "${m}"; only the assertion and browser libraries are allowed`));
  if (/\bimport\s*\(\s*[^'"\s)]/.test(source) || /\brequire\s*\(\s*[^'"\s)]/.test(source)) problems.push('it loads a module by a computed name');
  FORBIDDEN.forEach(([re, why]) => {
    if (re.test(source)) problems.push(why);
  });
  return problems;
}

/**
 * The capture(name, check, { fullPage }) helper given to a review script. `check` asserts the state the shot shows and
 * runs first: when it fails no screenshot is taken and the capture is recorded as failed, without throwing into the
 * script. A good capture is saved as <out>/<name>.png. Nothing is returned, so the image never reaches the script.
 * `captures` collects { name, ok, path | error }, the path relative to `cwd` when the file is under it; a repeated
 * name replaces the earlier entry, as its file does.
 */
export function makeCapture({ page, out, captures, cwd = process.cwd() }) {
  const keep = (entry) => {
    const i = captures.findIndex((c) => c.name === entry.name);
    if (i === -1) captures.push(entry);
    else captures[i] = entry;
  };
  return async (name, check, options = {}) => {
    const safe = safeCaptureName(name);
    if (typeof check !== 'function') throw new Error(`capture("${safe}", check): check is the assertion of the state the shot shows, and it is required`);
    const unknown = Object.keys(options ?? {}).filter((k) => k !== 'fullPage');
    if (unknown.length > 0) throw new Error(`capture("${safe}"): the only option is fullPage (got ${unknown.join(', ')})`);
    try {
      await check();
    } catch (error) {
      keep({ name: safe, ok: false, error: String(error?.message ?? error).split('\n')[0] });
      return undefined;
    }
    const file = join(out, `${safe}.png`);
    await page.screenshot({ path: file, fullPage: options?.fullPage === true });
    const near = relative(cwd, file);
    keep({ name: safe, ok: true, path: near && !near.startsWith('..') && !isAbsolute(near) ? near : file });
    return undefined;
  };
}

/**
 * The page's own failure during a run, to name before a script error: the first uncaught error of the page or the
 * first response of 400 or more from the origin under review. `events` are those of formatBrowserLog. Returns a
 * string or null.
 */
export function probableCause(events, baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  const hit = events.find((e) => {
    if (e.type === 'pageerror') return true;
    if (e.type !== 'response') return false;
    try {
      return new URL(String(e.text).split(' ').pop()).origin === origin;
    } catch {
      return false;
    }
  });
  if (!hit) return null;
  return hit.type === 'pageerror' ? `uncaught ${hit.text}` : `response ${hit.text}`;
}

/** Replace the value of every secret by [redacted:NAME]. `secrets` maps a variable name to its value. */
export function redact(text, secrets = {}) {
  let out = String(text ?? '');
  Object.entries(secrets)
    .filter(([, value]) => typeof value === 'string' && value.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([name, value]) => {
      out = out.split(value).join(`[redacted:${name}]`);
    });
  return out;
}

const pad = (n, width = 2) => String(n).padStart(width, '0');
const stamp = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

/**
 * The browser's errors as a log in the format the audit reads. `events` are { type, text } with type
 * `console` (a console error), `pageerror` (an uncaught exception), `requestfailed`, `response` (a 4xx or 5xx) or
 * `blocked` (a request the origin guard stopped). The first line names the "process", so the audit can filter by
 * the package `web`. Returns '' only when there were no events at all, which the caller still writes with the header.
 */
export function formatBrowserLog(events, { origin = 'page', now = new Date() } = {}) {
  const line = (level, tag, text) => `${stamp(now)}  1  1 ${level} ${tag}: ${String(text).replace(/\s*\n\s*/g, ' ').trim()}`;
  const out = [line('I', 'ActivityManager', `Start proc 1:${WEB_PACKAGE}/${origin} for browser`)];
  events.forEach((e) => {
    if (e.type === 'pageerror') out.push(line('E', WEB_PACKAGE, `Uncaught ${e.text}`));
    else if (e.type === 'console') out.push(line('E', WEB_PACKAGE, `console.error ${e.text}`));
    else if (e.type === 'requestfailed') out.push(line('E', WEB_PACKAGE, `requestfailed ${e.text}`));
    else if (e.type === 'response') out.push(line('E', WEB_PACKAGE, `response ${e.text}`));
    else if (e.type === 'blocked') out.push(line('E', WEB_PACKAGE, `blocked request ${e.text}`));
  });
  return `${out.join('\n')}\n`;
}
