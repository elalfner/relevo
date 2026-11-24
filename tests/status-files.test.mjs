import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { renderStatusFiles, statusFiles } from '../scripts/lib/status-files.mjs';
import { filesBackend } from '../scripts/lib/tracker/files.mjs';

const YML = 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nlanguage: en\n';
const { config } = loadConfig(YML);
const L = (...n) => n.map((name) => ({ name }));

test('Scenario: Mixed states - status lists /relevo:review 1 and /relevo:go 2 as the next commands', () => {
  const report = statusFiles({ config, issues: [{ number: 2, title: 'Two', labels: L('relevo:ready') }, { number: 1, title: 'One', labels: L('relevo:built') }], branches: ['feature/1-one'] });
  const text = renderStatusFiles(report).join('\n');
  assert.match(text, /#1 One \[built\] -> \/relevo:review 1/);
  assert.match(text, /#2 Two \[ready\] -> \/relevo:go 2/);
  assert.ok(text.indexOf('#1') < text.indexOf('#2'), 'in order of number');
  assert.match(text, /Branches waiting to be shipped:\n {2}feature\/1-one \(#1\)/);
  assert.doesNotMatch(text, /reviewer|deadline|milestone|capacity|SLA/i);
});

test('Scenario: Nothing waiting - every issue shipped says so', () => {
  assert.deepEqual(renderStatusFiles(statusFiles({ config, issues: [] })), ['Nothing is waiting: every issue is shipped.']);
});

test('the next command follows the state, and a failed build with a branch goes to fix', () => {
  const issues = [
    { number: 1, title: 'a', labels: [] },
    { number: 2, title: 'b', labels: L('relevo:building', 'relevo:local') },
    { number: 3, title: 'c', labels: L('relevo:build-failed') },
    { number: 4, title: 'd', labels: L('relevo:build-failed') },
    { number: 5, title: 'e', labels: L('relevo:needs-spec') },
    { number: 6, title: 'f', labels: L('relevo:queued') },
  ];
  const text = renderStatusFiles(statusFiles({ config, issues, branches: ['feature/4-d'] })).join('\n');
  assert.match(text, /#1 a \[draft\] -> approve it with \/relevo:issue 1/);
  assert.match(text, /#2 b \[building\] -> being built: node scripts\/go-local\.mjs status 2/);
  assert.match(text, /#3 c \[build failed\] -> \/relevo:go 3 --retry/);
  assert.match(text, /#4 d \[build failed\] -> \/relevo:fix 4/);
  assert.match(text, /#5 e \[needs a better text\] -> \/relevo:issue 5/);
  assert.match(text, /#6 f \[ready\] -> \/relevo:go 6/);
});

test('in Spanish the report is in Spanish', () => {
  const es = loadConfig(`${YML}`.replace('language: en', 'language: es')).config;
  assert.match(renderStatusFiles(statusFiles({ config: es, issues: [] }), es.language)[0], /No hay nada en espera/);
});

test('status.mjs on a files project reads the files with no repo, no gh and no person', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-status-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  const t = filesBackend({ repoRoot: dir });
  t.issueCreate({ title: 'Counter', body: '## Summary\n\nx\n' });
  t.stateSet(1, { add: ['relevo:built'] });
  const run = (...args) => execFileSync(process.execPath, [new URL('../scripts/status.mjs', import.meta.url).pathname, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin', GITHUB_REPOSITORY: '', GH_TOKEN: '' } });
  assert.match(run(), /#1 Counter \[built\] -> \/relevo:review 1/);
  assert.equal(JSON.parse(run('--json')).items[0].state, 'built');
  rmSync(dir, { recursive: true });
});

test('the status skill says how a files project is read', async () => {
  const { readFileSync } = await import('node:fs');
  const skill = readFileSync(new URL('../skills/status/SKILL.md', import.meta.url), 'utf8');
  const section = skill.split('## Files project')[1].split('\n## ')[0];
  assert.match(section, /`tracker` in `relevo\.yml` is `files`/);
  assert.match(section, /status\.mjs` with no `--repo`/);
  assert.match(section, /no reviewers, review deadlines, milestones or capacity/);
});
