// The checks `go` makes before it claims work or creates a branch, in one place.
// Implements "Go checks its environment before changing anything" of the go specification.
//
// Everything outside the process is injected, so the checks can be tested without OpenSpec, git or GitHub:
//   readConfig() -> the text of relevo.yml (throws when it cannot be read)
//   run(command, args) -> { status, stdout, stderr }

import { loadConfig } from './config.mjs';

export const CHECKS = ['config', 'openspec', 'openspec-root', 'clean-tree', 'gh'];
export const DEFAULT_CHECKS = ['config', 'openspec', 'openspec-root', 'clean-tree'];

const pass = (check) => ({ check, ok: true });
const fail = (check, message, fix) => ({ check, ok: false, message, fix });

function checkConfig({ readConfig }) {
  let text;
  try {
    text = readConfig();
  } catch {
    return fail('config', 'relevo.yml was not found', 'run /relevo:init to create it');
  }
  const loaded = loadConfig(text);
  if (loaded.ok) return pass('config');
  return fail('config', `relevo.yml is not valid:\n${loaded.errors.map((e) => `  - ${e.message}`).join('\n')}`, 'fix it, and check it with node scripts/validate-config.mjs relevo.yml');
}

function checkOpenspec({ run }) {
  const r = run('openspec', ['--version']);
  return r.status === 0 ? pass('openspec') : fail('openspec', 'the OpenSpec command line does not run', 'run /relevo:doctor');
}

function checkOpenspecRoot({ run }) {
  const r = run('openspec', ['list', '--json']);
  let root = null;
  try {
    root = JSON.parse(r.stdout || '{}').root ?? null;
  } catch {
    root = null;
  }
  // `root: null` is OpenSpec's own answer for "no openspec/ directory here"; it also exits with an error.
  return root && typeof root === 'object' ? pass('openspec-root') : fail('openspec-root', 'OpenSpec finds no root for this repository', 'run /relevo:doctor (and openspec init if the project is not set up)');
}

function checkCleanTree({ run }) {
  const r = run('git', ['status', '--porcelain']);
  if (r.status !== 0) return fail('clean-tree', 'git could not read the working tree', 'run it inside the repository');
  const lines = r.stdout.split('\n').filter(Boolean);
  if (lines.length === 0) return pass('clean-tree');
  const shown = lines.slice(0, 5).map((l) => `  ${l}`).join('\n');
  return fail('clean-tree', `the working tree has uncommitted changes:\n${shown}${lines.length > 5 ? `\n  ... and ${lines.length - 5} more` : ''}`, 'commit or stash them first');
}

function checkGh({ run }) {
  return run('gh', ['auth', 'status']).status === 0 ? pass('gh') : fail('gh', 'the GitHub command line is not signed in', 'run gh auth login');
}

const IMPLEMENTATION = { config: checkConfig, openspec: checkOpenspec, 'openspec-root': checkOpenspecRoot, 'clean-tree': checkCleanTree, gh: checkGh };

/** Run the named checks, in order. Returns { ok, results: [{ check, ok, message?, fix? }] }. */
export function runPreflight({ checks = DEFAULT_CHECKS, readConfig, run }) {
  const unknown = checks.filter((c) => !IMPLEMENTATION[c]);
  if (unknown.length > 0) throw new Error(`unknown check "${unknown[0]}": expected one of ${CHECKS.join(', ')}`);
  const results = checks.map((check) => IMPLEMENTATION[check]({ readConfig, run }));
  return { ok: results.every((r) => r.ok), results };
}

export function formatPreflight({ ok, results }) {
  if (ok) return `preflight ok (${results.map((r) => r.check).join(', ')})`;
  return results.filter((r) => !r.ok).map((r) => `${r.check}: ${r.message}\n  fix: ${r.fix}`).join('\n');
}
