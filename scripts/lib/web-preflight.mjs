// What a browser review checks before it drives: the project's dependencies, Playwright and its browser, and the
// address under review with the module scripts its page loads. Everything that touches the machine is injected.
// Implements "A browser review checks its tools and the app before driving" of openspec/specs/review/spec.md.

export const EXIT = { node_modules: 3, playwright: 4, browser: 5, url: 6, deps_stale: 7 };

// The frozen install of each lock file, first match wins. None runs package scripts where the tool can skip them.
const LOCKS = [
  { file: 'package-lock.json', install: 'npm ci --ignore-scripts' },
  { file: 'pnpm-lock.yaml', install: 'pnpm install --frozen-lockfile --ignore-scripts' },
  { file: 'yarn.lock', install: 'yarn install --immutable' },
];

const START_SCRIPTS = ['dev', 'serve', 'start'];

/** The command that starts the app, from the scripts of package.json; null when there is none. */
export function startCommand(pkgText) {
  let scripts = {};
  try {
    scripts = JSON.parse(pkgText ?? '{}').scripts ?? {};
  } catch { /* an unreadable package.json names no command */ }
  const name = START_SCRIPTS.find((s) => typeof scripts[s] === 'string');
  return name ? `npm run ${name}` : null;
}

/** The variable names of an example environment file (`NAME=value` lines); values are ignored. */
export function envNames(text) {
  return [...String(text ?? '').matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1]);
}

/** The same-origin module scripts that an HTML page loads, as absolute URLs. */
export function moduleScripts(html, pageUrl) {
  const origin = new URL(pageUrl).origin;
  return [...String(html ?? '').matchAll(/<script\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /\btype\s*=\s*["']?module\b/i.test(tag))
    .map((tag) => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map((src) => new URL(src, pageUrl))
    .filter((u) => u.origin === origin)
    .map((u) => u.href);
}

/** The lock file of the folder and its frozen install command; null when the folder has none. */
export function lockOf(cwd, exists) {
  return LOCKS.find((l) => exists(`${cwd}/${l.file}`)) ?? null;
}

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Do the installed dependencies differ from package-lock.json? Compares each package of the lock file with the one
 * npm recorded in node_modules/.package-lock.json. An optional package that is not installed (a binary for another
 * platform) is not a difference. Returns true, false, or null when it cannot tell (never treated as stale).
 */
export function npmStale(lockText, hiddenText) {
  const lock = parse(lockText)?.packages;
  if (!lock || typeof lock !== 'object') return null;
  if (hiddenText === null) return true;
  const hidden = parse(hiddenText)?.packages;
  if (!hidden || typeof hidden !== 'object') return null;
  return Object.entries(lock).some(([key, wanted]) => {
    if (key === '') return false;
    const installed = hidden[key];
    if (!installed) return !(wanted?.optional || wanted?.devOptional);
    return wanted?.version !== undefined && installed.version !== wanted.version;
  });
}

/** Does the page answer below 400 after redirects, and so do its module scripts? Returns { ok, detail }. */
export async function checkUrl(url, { fetch, timeout = 5000 }) {
  const get = async (address) => {
    try {
      const response = await fetch(address, { redirect: 'follow', signal: AbortSignal.timeout(timeout) });
      return { status: response.status, text: response.status < 400 ? await response.text() : '' };
    } catch (error) {
      return { status: null, error: String(error?.cause?.code ?? error?.name ?? error?.message ?? error) };
    }
  };
  const page = await get(url);
  if (page.status === null) return { ok: false, detail: `${url} does not answer (${page.error})` };
  if (page.status >= 400) return { ok: false, detail: `${url} answered ${page.status}` };
  for (const script of moduleScripts(page.text, url)) {
    const r = await get(script);
    if (r.status === null) return { ok: false, detail: `${script} does not answer (${r.error})` };
    if (r.status >= 400) return { ok: false, detail: `${script} answered ${r.status}` };
  }
  return { ok: true, detail: null };
}

/**
 * Runs the checks in order and stops at the first failure. Returns { ok, check, detail, start, env, install, code }:
 * `install` is the frozen install command of the folder's lock file, or null without one.
 * deps: exists(path), readFile(path) (null when missing), loadPlaywright(), fetch, sleep(ms), now().
 * Only `.env.example` is read for variable names; the real environment files never are.
 * With `wait`, the address is retried every 500 ms until it answers or the time is over.
 */
export async function webPreflight({ cwd, url, timeout = 5000, wait = 0 }, deps) {
  const { exists, readFile, loadPlaywright, fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = deps;
  const at = (name) => `${cwd}/${name}`;
  const start = startCommand(readFile(at('package.json')));
  const env = envNames(readFile(at('.env.example')));
  const lock = lockOf(cwd, exists);
  const install = lock?.install ?? null;
  const result = (check, detail) => ({ ok: check === null, check, detail, start, env, install, code: check === null ? 0 : EXIT[check] });

  if (!exists(at('node_modules'))) return result('node_modules', lock ? 'the project has no node_modules' : 'the project has no node_modules and no lock file to install from');
  // Only npm records what it installed in a form comparable with its lock file; pnpm and yarn are checked for presence.
  if (lock?.file === 'package-lock.json' && npmStale(readFile(at('package-lock.json')), readFile(at('node_modules/.package-lock.json'))) === true) {
    return result('deps_stale', 'the installed dependencies do not match package-lock.json');
  }
  const playwright = loadPlaywright();
  if (!playwright) return result('playwright', 'Playwright does not resolve from the project');
  let executable = null;
  try {
    executable = playwright.chromium.executablePath();
  } catch { /* an unknown browser build has no path */ }
  if (!executable || !exists(executable)) return result('browser', 'the Chromium of Playwright is not installed');

  const deadline = now() + wait;
  for (;;) {
    const answer = await checkUrl(url, { fetch, timeout });
    if (answer.ok) return result(null, null);
    if (now() >= deadline) return result('url', answer.detail);
    await sleep(500);
  }
}
