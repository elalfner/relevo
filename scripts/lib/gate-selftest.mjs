// The cases, the verdicts and the texts of scripts/gate-selftest.mjs. Implements the gate-selftest specification.
// No file is read or written here: the command does that, so everything below is tested without a repository.

/** The failing unit test of each stack, in a file that the `test` check of the stack's profile runs. */
export const UNIT_SEEDS = {
  vue: { path: 'src/relevo-selftest.unit.test.js', content: "import { expect, test } from 'vitest';\n\ntest('relevo selftest: a seeded failure', () => {\n  expect(1).toBe(2);\n});\n" },
  flutter: { path: 'test/relevo_selftest_test.dart', content: "import 'package:flutter_test/flutter_test.dart';\n\nvoid main() {\n  test('relevo selftest: a seeded failure', () {\n    expect(1, 2);\n  });\n}\n" },
  laravel: { path: 'tests/Unit/RelevoSelftestTest.php', content: "<?php\n\nnamespace Tests\\Unit;\n\nuse PHPUnit\\Framework\\TestCase;\n\nclass RelevoSelftestTest extends TestCase\n{\n    public function test_a_seeded_failure(): void\n    {\n        $this->assertSame(1, 2);\n    }\n}\n" },
  supabase: { path: 'supabase/tests/database/relevo_selftest.test.sql', content: "begin;\nselect plan(1);\nselect is(1, 2, 'relevo selftest: a seeded failure');\nselect * from finish();\nrollback;\n" },
};

/** The failing browser story: seeded only where the `test` check runs Playwright. */
export const STORY_SEED = { path: 'e2e/relevo-selftest.spec.mjs', content: "import { expect, test } from '@playwright/test';\n\ntest('relevo selftest: a seeded failing story', async ({ page }) => {\n  await page.setContent('<h1>relevo selftest</h1>');\n  await expect(page.locator('h1')).toHaveText('this text is not on the page');\n});\n" };

/** The docs-only change. */
export const DOCS_SEED = { path: 'docs/relevo-selftest.md', content: '# Relevo selftest\n\nA documentation-only change, made by `scripts/gate-selftest.mjs` in a scratch worktree.\n' };

export const CASE_IDS = ['unit', 'story', 'docs'];
const TITLES = { unit: 'a failing unit test', story: 'a failing browser story', docs: 'a docs-only change' };
const EXPECT = { unit: 'red', story: 'red', docs: 'green' };
const EXPECT_TEXT = {
  red: 'the gate is red and names the check that failed',
  green: 'the gate is green: the diff holds only documentation',
};

/** Is the gate usable here? `test` is the resolved `test` command of the platform, or undefined. */
export function relevoCi({ configLoaded, platformResolved, testCommand }) {
  if (!configLoaded) return { ok: false, reason: 'there is no valid relevo.yml' };
  if (!platformResolved) return { ok: false, reason: 'the platform has no resolvable stack profile' };
  if (!testCommand) return { ok: false, reason: 'the platform has no `test` check' };
  return { ok: true };
}

/**
 * The three cases for a stack: { id, title, expect, seed } where seed is { path, content } relative to the platform folder,
 * or { id, title, skipped } with the reason the case cannot be seeded.
 */
export function planCases({ stack, testCommand }) {
  const unit = UNIT_SEEDS[stack];
  const runsBrowser = /playwright/i.test(String(testCommand ?? ''));
  return CASE_IDS.map((id) => {
    const base = { id, title: TITLES[id], expect: EXPECT[id] };
    if (id === 'unit') return unit ? { ...base, seed: unit } : { ...base, skipped: `there is no unit-test seed for the stack "${stack}"` };
    if (id === 'story') return runsBrowser ? { ...base, seed: STORY_SEED } : { ...base, skipped: 'the `test` check of the platform does not run Playwright, so a browser story would never be seen' };
    return { ...base, seed: DOCS_SEED };
  });
}

/** One case's verdict from the gate: `ok`, `unexpected` or `could-not-run`. */
export function verdict(c, gateStatus) {
  if (gateStatus === 'could-not-run') return 'could-not-run';
  return gateStatus === c.expect ? 'ok' : 'unexpected';
}

const HINTS = {
  unit: { red: '', green: 'the `test` check does not run the seeded unit test' },
  story: { red: '', green: 'the `test` check does not run the seeded browser story (check its directory in the Playwright config)' },
  docs: { red: 'a docs-only change should not fail the gate; read the receipt for the check that failed', green: '' },
};

/** The report. results: [{ id, title, expect, skipped?, status?, failed?: string[], verdict? }]. */
export function renderReport({ base, platform, results }) {
  const lines = [`Gate selftest on ${platform} against ${base} (a scratch worktree, no branch, nothing pushed)`, ''];
  for (const r of results) {
    if (r.skipped) { lines.push(`- ${r.id}: ${r.title} - skipped: ${r.skipped}`); continue; }
    const hint = r.verdict === 'unexpected' ? HINTS[r.id]?.[r.status] : '';
    const failed = r.failed?.length ? ` (${r.failed.join('; ')})` : '';
    lines.push(`- ${r.id}: ${r.title} - gate ${r.status}${failed}, expected ${r.expect}: ${r.verdict}${hint ? `. ${hint}` : ''}`);
    if (r.id === 'docs' && r.verdict === 'ok') lines.push('  The gate runs every check even for a docs-only change. If your CI skips tests for one, check that with the steps below.');
  }
  lines.push('', remoteRecipe({ results, base }));
  return `${lines.join('\n')}\n`;
}

const branchOf = (id) => `relevo-selftest/${id}`;

/** The steps to see the remote CI aggregate by hand on the same cases. They are printed, never run. */
export function remoteRecipe({ results, base = '<base>' }) {
  const lines = ['To see the CI aggregate on the same cases (these commands are not run here; the base branch is never pushed):'];
  for (const r of results) {
    lines.push(`  ${r.id}: git switch --detach ${base} && <add ${r.seed?.path ?? 'the file'}> && git commit -am selftest && git push origin HEAD:refs/heads/${branchOf(r.id)}`);
    lines.push(`       read the checks of that commit, then: git push origin --delete ${branchOf(r.id)}`);
  }
  return lines.join('\n');
}

/** The cases as instructions, for a repository whose CI is not Relevo's. */
export function renderInstructions({ reason, stack, testCommand }) {
  const lines = [`Nothing was run: ${reason}. To check your own CI, use a scratch branch and delete it afterwards:`, ''];
  for (const c of planCases({ stack, testCommand })) {
    lines.push(`- ${c.id}: ${c.title}`);
    if (c.skipped) lines.push(`  cannot be seeded here: ${c.skipped}`);
    else lines.push(`  add ${c.seed.path}, commit it on a scratch branch and push it. Expect: ${EXPECT_TEXT[c.expect]}.`);
  }
  lines.push('', remoteRecipe({ results: CASE_IDS.map((id) => ({ id })) }));
  return `${lines.join('\n')}\n`;
}
