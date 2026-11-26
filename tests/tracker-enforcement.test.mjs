// Every read or write of an issue or a pull request goes through the tracker (scripts/tracker.mjs), so that a files project
// never reaches GitHub by accident. A file may keep the `gh issue` / `gh pr` calls listed here (GitHub-only features of a team
// or the cloud, or a skill not migrated yet) and no more: adding a call to any file fails, and so does migrating one without
// lowering its number, so the list only shrinks. Implements decision 2 of the design of local-tracker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const VERB = '(?:view|list|create|edit|comment|close|merge|checks|ready|reopen|diff)';
const PATTERNS = [new RegExp(`'(?:issue|pr)'\\s*,\\s*'${VERB}'`, 'g'), new RegExp(`\\bgh (?:issue|pr) ${VERB}\\b`, 'g'), new RegExp(`gh-web\\.mjs (?:issue|pr) ${VERB}\\b`, 'g')];
// The backends and the clients that speak to GitHub are where the calls belong.
const BACKENDS = new Set(['scripts/lib/tracker/github.mjs', 'scripts/lib/gh-web.mjs', 'scripts/lib/gh-client.mjs', 'scripts/gh-web.mjs']);

// file -> how many calls it may still have.
const ALLOWED = {
  // GitHub-only features of a team or the cloud: a files project never runs them.
  'scripts/digest.mjs': 1,
  'scripts/lib/doctor.mjs': 1,
  'scripts/lib/ship-github.mjs': 2,
  'scripts/lib/ship-unattended.mjs': 9,
  'scripts/lib/sla.mjs': 2,
  'scripts/needs-reviewer.mjs': 2,
  'scripts/review-event.mjs': 2,
  'scripts/can-edit-issue.mjs': 1,
  // To migrate with the tasks of the groups 4 to 6 of local-tracker (go, issue, think, status, review, ship).
  'scripts/lib/github.mjs': 3,
  'scripts/lib/go-local.mjs': 1,
  'skills/fix/SKILL.md': 1, // the re-request of a reviewer on a pull request, which only exists on GitHub
  'skills/go/SKILL.md': 2, // the web-session branch, which only exists on GitHub
  'skills/review/SKILL.md': 4, // review-who, the pull request of a github project and its reviewer
  'skills/ship/SKILL.md': 6,
  'skills/status/SKILL.md': 3,
};

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const isCode = (file) => file.endsWith('.mjs');
const count = (file) => readFileSync(join(ROOT, file), 'utf8').split('\n')
  .filter((line) => !(isCode(file) && /^\s*(\/\/|\*|\/\*)/.test(line)))
  .reduce((n, line) => n + PATTERNS.reduce((m, re) => m + (line.match(re) ?? []).length, 0), 0);

const actual = () => Object.fromEntries(
  [...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'skills'))]
    .map((p) => relative(ROOT, p))
    .filter((f) => (f.endsWith('.mjs') || f.endsWith('.md')) && !BACKENDS.has(f))
    .map((f) => [f, count(f)])
    .filter(([, n]) => n > 0),
);

test('no file calls gh issue or gh pr beyond what is listed', () => {
  const found = actual();
  const over = Object.entries(found).filter(([f, n]) => n > (ALLOWED[f] ?? 0)).map(([f, n]) => `${f}: ${n} (allowed ${ALLOWED[f] ?? 0})`);
  assert.deepEqual(over, [], 'go through scripts/tracker.mjs instead of calling gh issue / gh pr');
});

test('the list shrinks as files are migrated', () => {
  const found = actual();
  const stale = Object.entries(ALLOWED).filter(([f, n]) => (found[f] ?? 0) < n).map(([f, n]) => `${f}: allowed ${n}, has ${found[f] ?? 0}`);
  assert.deepEqual(stale, [], 'lower these numbers in ALLOWED (or remove the file)');
});

test('the check sees a call added to a skill', () => {
  const sample = 'run `gh issue view 4` then node ${CLAUDE_PLUGIN_ROOT}/scripts/gh-web.mjs pr list';
  assert.equal(PATTERNS.reduce((m, re) => m + (sample.match(re) ?? []).length, 0), 2);
});

test('print the current counts when asked', { skip: !process.env.RELEVO_PRINT_TRACKER_COUNTS }, () => {
  console.log(JSON.stringify(actual(), null, 2));
});
