#!/usr/bin/env node
// Runs the checks that need no judgement, once, and writes a receipt tied to the exact diff. Usage:
//   node scripts/validation-gate.mjs --base <ref> [--platform name] [--config relevo.yml] [--files a,b,c]
// --base is the base branch as `go` has it (origin/dev). --files are the files the developer agent reported: they are made
// visible to the diff first (`git add --intent-to-add`), as intent-to-add.mjs does. The gate then hashes the diff against
// the base without the generated files of the profile, runs `analyze` and `test` of the profile from the folder of the
// platform, runs the diff scanner and the restricted-file check, and writes the receipt under .relevo-receipt/, which git
// ignores. No agent runs this.
//   exit 0: green   exit 1: red   exit 2: could not run (a tool is missing)   exit 3: bad arguments

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { intentToAdd } from './lib/intent-to-add.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { checkRestricted, formatRestricted, restrictedInDiff, restrictedListFromText } from './lib/restricted-paths.mjs';
import { formatFindings } from './lib/scan.mjs';
import { EXCEPTIONS_FILE, formatExceptionReport, scanWithExceptions } from './lib/scan-exceptions.mjs';
import { EXIT, RECEIPT_DIR, RECEIPT_FILE, buildReceipt, diffHash, excludeSpecs, overallStatus, toolOf } from './lib/validation-gate.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const bad = (m) => { console.error(m); process.exit(EXIT.usage); };

const base = opt('base');
if (!base) bad('usage: validation-gate.mjs --base <ref> [--platform name] [--config relevo.yml] [--files a,b,c]');
const configPath = resolve(opt('config') ?? 'relevo.yml');
if (!existsSync(configPath)) bad(`relevo.yml not found at ${configPath}`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) bad(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
const names = Object.keys(loaded.config.platforms);
const name = opt('platform') ?? (names.length === 1 ? names[0] : undefined);
if (!name || !loaded.config.platforms[name]) bad(`give --platform <${names.join('|')}>`);
const platform = loaded.config.platforms[name];

const root = dirname(configPath);
const read = (p) => { const f = p.startsWith('/') ? p : resolve(root, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resolved = resolveProfile({ platform, pluginRoot, read });
if (!resolved.ok) bad(resolved.errors.join('\n'));
const { profile } = resolved;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
const list = restrictedListFromText(readFileSync(configPath, 'utf8'));

try {
  const files = (opt('files') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (files.length) intentToAdd({ git: (a) => git(a), exists: (p) => existsSync(join(root, p)), paths: files, list });
  const baseCommit = git(['rev-parse', base]).trim();
  const diff = git(['diff', base, '--', '.', ...excludeSpecs(profile.generated)]);
  const hash = diffHash(diff);

  const commands = [];
  for (const key of ['analyze', 'test']) {
    const command = profile.commands[key];
    if (!command) continue;
    const started = Date.now();
    const r = spawnSync('sh', ['-c', command], { cwd: resolve(root, platform.path), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    commands.push({ name: key, command, status: r.status ?? (r.error ? null : 1), output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`, error: r.error, duration_ms: Date.now() - started });
  }

  const scans = [];
  const restricted = restrictedInDiff(diff, list);
  scans.push({ name: 'restricted files in the diff', ok: restricted.length === 0, detail: restricted.length ? formatRestricted(restricted) : 'none' });
  // The reviewed exceptions come from the base ref, which the run cannot have changed.
  let exceptionsText = null;
  try { exceptionsText = git(['show', `${base}:${EXCEPTIONS_FILE}`]); } catch { /* no list on the base: nothing is excused */ }
  const { findings, applied, refused } = restricted.length ? { findings: [], applied: [], refused: [] } : scanWithExceptions(diff, exceptionsText);
  const report = formatExceptionReport({ applied, refused });
  const scanDetail = [findings.length ? formatFindings(findings) : 'none', report].filter(Boolean).join('\n');
  scans.push({ name: 'temporary markers and credentials', ok: findings.length === 0, detail: scanDetail });
  const versioned = checkRestricted(git(['ls-files']).split('\n').filter(Boolean), list).violations.map((v) => v.path);
  scans.push({ name: 'restricted files versioned', ok: versioned.length === 0, detail: versioned.length ? versioned.join('\n') : 'none' });

  const status = overallStatus(commands, scans);
  const receipt = buildReceipt({ hash, base: baseCommit, baseRef: base, generated: profile.generated, platformPath: platform.path, commands, scans, status });
  const dir = join(root, RECEIPT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    const exclude = resolve(root, git(['rev-parse', '--git-path', 'info/exclude']).trim());
    const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
    if (!current.split('\n').includes(`${RECEIPT_DIR}/`)) { mkdirSync(dirname(exclude), { recursive: true }); appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}${RECEIPT_DIR}/\n`); }
  } catch { /* not a git repository: nothing to exclude */ }

  console.log(status);
  if (status === 'could-not-run') console.log(`automated validation could not run: ${commands.filter((c) => c.status === 126 || c.status === 127 || c.error || /not found/i.test(c.output)).map((c) => toolOf(c.command)).join(', ')} is missing`);
  if (status === 'red') receipt.commands.filter((c) => c.exit_code !== 0).forEach((c) => console.log(`${c.name} failed: ${c.command}`));
  process.exit(EXIT[status]);
} catch (err) {
  bad(`the gate could not read the repository: ${String(err.stderr || err.message).trim()}`);
}
