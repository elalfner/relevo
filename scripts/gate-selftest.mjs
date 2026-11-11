#!/usr/bin/env node
// Exercises the validation gate on three seeded cases (a failing unit test, a failing browser story, a docs-only change)
// in a scratch worktree, so nobody opens throwaway pull requests. Usage:
//   node scripts/gate-selftest.mjs [--base <ref>] [--platform name] [--config relevo.yml]
// The worktree is detached from the base ref and removed at the end: no branch is created, the base is never written to,
// nothing is pushed. A repository whose CI is not Relevo's (no relevo.yml, no stack profile, no `test` check) gets the cases
// printed as instructions and nothing runs.
//   exit 0: every case agreed (or the instructions were printed)   exit 1: a case was unexpected or could not run
//   exit 3: bad arguments

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { planCases, relevoCi, renderInstructions, renderReport, verdict } from './lib/gate-selftest.mjs';
import { isRestricted, restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const bad = (m) => { console.error(m); process.exit(3); };
const known = new Set(['--base', '--platform', '--config']);
argv.forEach((a, i) => { if (a.startsWith('--') && !known.has(a)) bad(`unknown option ${a}\nusage: gate-selftest.mjs [--base <ref>] [--platform name] [--config relevo.yml]`); else if (!a.startsWith('--') && !known.has(argv[i - 1])) bad(`unexpected argument ${a}`); });

const configPath = resolve(opt('config') ?? 'relevo.yml');
const root = dirname(configPath);
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, cwd = root) => execFileSync('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] });

// 1. Is there a gate to exercise here?
const loaded = existsSync(configPath) ? loadConfig(readFileSync(configPath, 'utf8')) : { ok: false };
const names = loaded.ok ? Object.keys(loaded.config.platforms ?? {}) : [];
const name = opt('platform') ?? (names.length === 1 ? names[0] : undefined);
if (loaded.ok && opt('platform') && !loaded.config.platforms[name]) bad(`give --platform <${names.join('|')}>`);
const platform = name ? loaded.config.platforms[name] : undefined;
const read = (p) => { const f = p.startsWith('/') ? p : resolve(root, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const resolved = platform ? resolveProfile({ platform, pluginRoot, read }) : { ok: false };
const testCommand = resolved.ok ? resolved.profile.commands.test : undefined;
const ci = relevoCi({ configLoaded: loaded.ok && names.length > 0, platformResolved: resolved.ok, testCommand });
if (!ci.ok) {
  console.log(renderInstructions({ reason: ci.reason, stack: platform?.stack, testCommand }));
  process.exit(0);
}
if (!name) bad(`give --platform <${names.join('|')}>`);

// 2. The base ref; nothing is written before it is known.
const base = opt('base') ?? `origin/${loaded.config.branches?.base ?? 'dev'}`;
let baseCommit;
try { baseCommit = git(['rev-parse', '--verify', `${base}^{commit}`]).trim(); } catch { bad(`the base ref ${base} does not exist; give --base <ref>`); }

// 3. The cases, in a detached worktree that is always removed.
const toplevel = git(['rev-parse', '--show-toplevel']).trim();
const scratch = mkdtempSync(join(tmpdir(), 'relevo-selftest-'));
const wt = join(scratch, 'wt');
const restricted = restrictedListFromText(readFileSync(configPath, 'utf8'));
const results = [];
let code = 0;
try {
  git(['worktree', 'add', '--detach', '-q', wt, baseCommit], toplevel);
  const wtRoot = join(wt, root === toplevel ? '' : root.slice(toplevel.length + 1));
  for (const rel of resolved.profile.installed ?? []) {
    const from = join(root, platform.path, rel);
    const to = join(wtRoot, platform.path, rel);
    // A restricted path is never linked into the scratch worktree.
    if (!isRestricted(join(platform.path, rel), restricted) && existsSync(from) && !existsSync(to)) { mkdirSync(dirname(to), { recursive: true }); symlinkSync(from, to); }
  }
  // The gate runs from the worktree: a relevo.yml the base does not have yet is copied in (it is removed with the worktree).
  const cfg = join(wtRoot, 'relevo.yml');
  if (!existsSync(cfg) && !isRestricted('relevo.yml', restricted)) copyFileSync(configPath, cfg);
  for (const c of planCases({ stack: platform.stack, testCommand })) {
    if (c.skipped) { results.push(c); continue; }
    const rel = join(platform.path, c.seed.path);
    const file = join(wtRoot, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, c.seed.content);
    const r = spawnSync('node', [join(pluginRoot, 'scripts/validation-gate.mjs'), '--base', baseCommit, '--platform', name, '--config', cfg, '--files', rel], { cwd: wtRoot, encoding: 'utf8' });
    const lines = r.stdout.split('\n').filter(Boolean);
    const status = ['green', 'red', 'could-not-run'].includes(lines[0]) ? lines[0] : 'could-not-run';
    const failed = lines.slice(1).filter((l) => /failed:|missing|could not/.test(l));
    if (status === 'could-not-run' && !failed.length) failed.push((r.stderr || r.stdout).trim().split('\n')[0] ?? 'the gate did not run');
    results.push({ ...c, status, failed, verdict: verdict(c, status) });
    // The next case starts from the base again.
    git(['reset', '-q', '--hard', baseCommit], wt);
    git(['clean', '-qfdx', '-e', 'node_modules'], wt);
  }
} catch (err) {
  console.error(`the scratch worktree could not be used: ${String(err.stderr || err.message).trim()}`);
  code = 1;
} finally {
  try { git(['worktree', 'remove', '--force', wt], toplevel); } catch { /* already gone */ }
  try { git(['worktree', 'prune'], toplevel); } catch { /* nothing to prune */ }
  rmSync(scratch, { recursive: true, force: true });
}

if (results.length) {
  console.log(renderReport({ base, platform: name, results }));
  if (results.some((r) => !r.skipped && r.verdict !== 'ok')) code = 1;
}
process.exit(code);
