#!/usr/bin/env node
// Runs the checks that need no judgement, once, and writes a receipt tied to the exact diff. Usage:
//   node scripts/validation-gate.mjs --base <ref> [--platform name] [--config relevo.yml] [--files a,b,c] [--fresh]
// --base is the base branch as `go` has it (origin/dev). --files are the files the developer agent reported: they are made
// visible to the diff first (`git add --intent-to-add`), as intent-to-add.mjs does. The gate then hashes the diff against
// the base without the generated files of the profile, runs `analyze` and `test` of the profile from the folder of the
// platform, runs the diff scanner and the restricted-file check, and writes the receipt under .relevo-receipt/, which git
// ignores. No agent runs this.
//   exit 0: green   exit 1: red   exit 2: could not run (a tool is missing)   exit 3: bad arguments

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { intentToAdd } from './lib/intent-to-add.mjs';
import { checkKey, currentDiff, treeHash, ensureExcluded, gitIn, readStore, recordResult, resolveContext, reusable } from './lib/check-store.mjs';
import { checkRestricted, formatRestricted, restrictedInDiff, restrictedListFromText } from './lib/restricted-paths.mjs';
import { formatFindings } from './lib/scan.mjs';
import { EXCEPTIONS_FILE, formatExceptionReport, scanWithExceptions } from './lib/scan-exceptions.mjs';
import { EXIT, RECEIPT_DIR, RECEIPT_FILE, buildReceipt, couldNotStart, overallStatus, toolOf } from './lib/validation-gate.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const bad = (m) => { console.error(m); process.exit(EXIT.usage); };

const base = opt('base');
if (!base) bad('usage: validation-gate.mjs --base <ref> [--platform name] [--config relevo.yml] [--files a,b,c] [--fresh]');
const ctx = resolveContext({ configPath: opt('config'), platformName: opt('platform') });
if (!ctx.ok) bad(ctx.error);
const { platform, profile, root, configPath } = ctx;

const git = (args) => gitIn(root, args);
const list = restrictedListFromText(readFileSync(configPath, 'utf8'));

try {
  const files = (opt('files') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (files.length) intentToAdd({ git: (a) => git(a), exists: (p) => existsSync(join(root, p)), paths: files, list });
  const baseCommit = git(['rev-parse', base]).trim();
  const { diff, hash } = currentDiff({ root, base, profile });
  // The key of a result uses the fingerprint of the tree, which counts the new files the same way `long-run.mjs` does.
  const tree = treeHash({ root, base, profile });
  const store = has('fresh') ? {} : readStore(root);

  const commands = [];
  for (const key of ['analyze', 'test']) {
    const command = profile.commands[key];
    if (!command) continue;
    const id = checkKey({ hash: tree, command, path: platform.path });
    // The same diff, command and folder passed before and never failed: do not run it again, and say so in the receipt.
    if (reusable(store, id)) {
      const last = store[id].last;
      commands.push({ name: key, command, status: 0, output: last.output_tail, duration_ms: 0, reused: true, original_duration_ms: last.duration_ms });
      continue;
    }
    const started = Date.now();
    const r = spawnSync('sh', ['-c', command], { cwd: resolve(root, platform.path), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const done = { name: key, command, status: r.status ?? (r.error ? null : 1), output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`, error: r.error, duration_ms: Date.now() - started };
    commands.push(done);
    // A command that could not start says nothing about the code, so it is not recorded.
    if (!couldNotStart(done)) recordResult(root, { key: id, name: key, command, exit_code: done.status, duration_ms: done.duration_ms, output: done.output });
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
  ensureExcluded(root, RECEIPT_DIR);

  console.log(status);
  if (status === 'could-not-run') console.log(`automated validation could not run: ${commands.filter((c) => c.status === 126 || c.status === 127 || c.error || /not found/i.test(c.output)).map((c) => toolOf(c.command)).join(', ')} is missing`);
  if (status === 'red') receipt.commands.filter((c) => c.exit_code !== 0).forEach((c) => console.log(`${c.name} failed: ${c.command}`));
  process.exit(EXIT[status]);
} catch (err) {
  bad(`the gate could not read the repository: ${String(err.stderr || err.message).trim()}`);
}
