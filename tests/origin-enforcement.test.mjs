// A files project has no remote, so nothing a build uses may reach for `origin/...` unconditionally. A file may keep the number of
// `origin` git references listed here (GitHub-only features, and the scripts that choose between the remote and the local branches
// through base-ref.mjs) and no more: a new one fails, and so does lowering one without lowering its number here, so the list only
// shrinks. Implements decision 11 of the design of local-tracker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PATTERN = /origin\/|'origin'|\b(?:fetch|pull|push)(?: [-\w]+)* origin\b/g;
const walk = (dir) => readdirSync(dir).flatMap((name) => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = () => ['scripts', 'skills', 'agents'].flatMap((d) => walk(join(ROOT, d))).map((p) => relative(ROOT, p)).filter((f) => /\.(mjs|md)$/.test(f));
const count = (file) => readFileSync(join(ROOT, file), 'utf8').split('\n')
  .filter((l) => !(file.endsWith('.mjs') && /^\s*(\/\/|\*|\/\*)/.test(l)))
  .reduce((n, l) => n + (l.match(PATTERN) ?? []).length, 0);
const actual = () => Object.fromEntries(files().map((f) => [f, count(f)]).filter(([, n]) => n > 0));

// file -> how many it may still have.
const ALLOWED = {
  // Scripts that choose between the remote and the local branches (a files project takes the local ones; tests/no-remote.test.mjs runs them).
  'scripts/branch-state.mjs': 7,
  'scripts/branch-work.mjs': 1,
  'scripts/build-preflight.mjs': 1,
  'scripts/integrate-base.mjs': 2,
  'scripts/lib/base-ref.mjs': 2,
  'scripts/lib/branch-worktree.mjs': 6,
  'scripts/lib/go-local.mjs': 1,
  'scripts/lib/go-worktree.mjs': 1,
  'scripts/lib/rescue-work.mjs': 5,
  'scripts/lib/resume-check.mjs': 3,
  'scripts/replica-plan.mjs': 1,
  'scripts/resume-check.mjs': 2,
  'scripts/role-skills.mjs': 1,
  'scripts/shared-code.mjs': 1, // tries origin/<base> and then <base>
  // GitHub-only features: a files project never runs them.
  'scripts/gate-selftest.mjs': 1,
  'scripts/lib/gate-selftest.mjs': 2,
  'scripts/go-plan.mjs': 1, // the remote branch of a rebuild; the files path looks at local branches
  'scripts/lib/retry-refusal.mjs': 4,
  'scripts/lib/doctor.mjs': 1,
  'scripts/lib/gh-web.mjs': 1,
  'scripts/lib/next-step.mjs': 1,
  'scripts/lib/progress.mjs': 1,
  'scripts/lib/ship-unattended.mjs': 8,
  // Skills and agents: the github text, and the sentence of each that says what a files project reads instead.
  'skills/fix/SKILL.md': 6,
  'skills/go/SKILL.md': 11,
  'skills/go/references/qa-run.md': 4,
  'skills/review/SKILL.md': 10,
  'skills/ship/SKILL.md': 12,
  'agents/dev.md': 2,
  'agents/qa-bugs.md': 2,
  'agents/qa-code.md': 2,
  'agents/qa-security.md': 2,
  'agents/qa-spec.md': 2,
};

test('no file reaches for origin beyond what is listed', () => {
  const found = actual();
  const over = Object.entries(found).filter(([f, n]) => n > (ALLOWED[f] ?? 0)).map(([f, n]) => `${f}: ${n} (allowed ${ALLOWED[f] ?? 0})`);
  assert.deepEqual(over, [], 'use baseRef / branchRef of scripts/lib/base-ref.mjs, so a files project compares with its local branches');
});

test('the list shrinks as files are migrated', () => {
  const found = actual();
  const stale = Object.entries(ALLOWED).filter(([f, n]) => (found[f] ?? 0) < n).map(([f, n]) => `${f}: allowed ${n}, has ${found[f] ?? 0}`);
  assert.deepEqual(stale, [], 'lower these numbers in ALLOWED (or remove the file)');
});

test('the pattern sees the forms a build uses', () => {
  const sample = "git(['fetch', '--quiet', 'origin', base]) and `origin/${base}` and git fetch origin <base> and git push -u origin <branch>";
  assert.ok((sample.match(PATTERN) ?? []).length >= 3);
});

test('print the current counts when asked', { skip: !process.env.RELEVO_PRINT_ORIGIN_COUNTS }, () => { console.log(JSON.stringify(actual(), null, 2)); });
