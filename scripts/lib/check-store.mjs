// The results of the checks of the profile that the gate may reuse, and what both the gate and `long-run.mjs` need to
// run one: the platform and profile of a config, the hash of the diff, the key of a result. Implements the
// "reuses a green check" requirement of the validation-gate specification.
//
// Only a code path that ran a command writes here (`recordResult`), and no argument of any script reaches it without a run
// (constraint C2). The file lives in the working folder like the receipt, so it is a convenience and not a security
// boundary (constraint C1): the guards of the commit and the CI of the pull request remain the enforcement.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { resolveProfile } from './stack-profile.mjs';
import { RECEIPT_DIR, TAIL_CAP, diffHash, excludeSpecs, tailOf } from './validation-gate.mjs';
import { readFileSync } from './guarded-fs.mjs';

export const CHECKS_FILE = 'checks.json';
export const CHECK_NAMES = ['analyze', 'test'];

/** The key of a result: the same diff, the same command and the same folder of the platform. */
export const checkKey = ({ hash, command, path }) => createHash('sha256').update(`${hash}\n${command}\n${path ?? '.'}`, 'utf8').digest('hex');

/**
 * The config, platform and profile of a project, as the gate resolves them.
 * Returns { ok: true, root, platform, name, profile, configPath } or { ok: false, error }.
 */
export function resolveContext({ configPath: given, platformName }) {
  const configPath = resolve(given ?? 'relevo.yml');
  if (!existsSync(configPath)) return { ok: false, error: `relevo.yml not found at ${configPath}` };
  const text = readFileSync(configPath, 'utf8');
  const loaded = loadConfig(text);
  if (!loaded.ok) return { ok: false, error: `relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}` };
  const names = Object.keys(loaded.config.platforms);
  const name = platformName ?? (names.length === 1 ? names[0] : undefined);
  if (!name || !loaded.config.platforms[name]) return { ok: false, error: `give --platform <${names.join('|')}>` };
  const platform = loaded.config.platforms[name];
  const root = dirname(configPath);
  const read = (p) => { const f = p.startsWith('/') ? p : resolve(root, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
  const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const resolved = resolveProfile({ platform, pluginRoot, read });
  if (!resolved.ok) return { ok: false, error: resolved.errors.join('\n') };
  return { ok: true, root, platform, name, profile: resolved.profile, configPath, configText: text };
}

export const gitIn = (root, args) => execFileSync('git', args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });

/** The diff against the base without the generated files, and its hash. */
export function currentDiff({ root, base, profile }) {
  const diff = gitIn(root, ['diff', base, '--', '.', ...excludeSpecs(profile.generated)]);
  return { diff, hash: diffHash(diff) };
}

const storePath = (root) => resolve(root, RECEIPT_DIR, CHECKS_FILE);

/** The store, or an empty one when it is missing or not valid JSON (nothing is then reused). */
export function readStore(root) {
  try {
    const data = JSON.parse(readFileSync(storePath(root), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

/**
 * May the gate skip the command? Only when it passed, and that key never failed: a flaky test that passed once and failed
 * once is run every time, so reuse never hides a red result.
 */
export function reusable(store, key) {
  const rec = store[key];
  return Boolean(rec && rec.passes >= 1 && rec.failures === 0 && rec.last && rec.last.exit_code === 0);
}

/** Records what a command really did. A pass is counted in `passes`, anything else in `failures`. */
export function recordResult(root, { key, name, command, exit_code, duration_ms, output, now = new Date() }) {
  const store = readStore(root);
  const prev = store[key] ?? { name, command, passes: 0, failures: 0 };
  const ok = exit_code === 0;
  store[key] = { name, command, passes: prev.passes + (ok ? 1 : 0), failures: prev.failures + (ok ? 0 : 1), last: { exit_code: exit_code ?? null, duration_ms: duration_ms ?? 0, output_tail: tailOf(output, TAIL_CAP), at: now.toISOString() } };
  mkdirSync(dirname(storePath(root)), { recursive: true });
  const tmp = `${storePath(root)}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 1)}\n`);
  renameSync(tmp, storePath(root));
  ensureExcluded(root, RECEIPT_DIR);
}

/** Adds `dir/` to .git/info/exclude so git ignores it; does nothing outside a git repository. */
export function ensureExcluded(root, dir) {
  try {
    const exclude = resolve(root, gitIn(root, ['rev-parse', '--git-path', 'info/exclude']).trim());
    const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
    if (current.split('\n').includes(`${dir}/`)) return;
    mkdirSync(dirname(exclude), { recursive: true });
    appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}${dir}/\n`);
  } catch { /* not a git repository: nothing to exclude */ }
}
