import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countTasks } from '../scripts/lib/tasks-file.mjs';

// Spec: go, "The tasks are counted as OpenSpec counts them" - Scenario: Relevo and OpenSpec agree.
// Each fixture is a tasks.md; the numbers of Relevo must equal the `progress` that `openspec instructions apply --json` reports for it.

const installed = spawnSync('openspec', ['--version'], { encoding: 'utf8' }).status === 0;

const FIXTURES = {
  'plain boxes': '# Tasks\n\n## 1. A\n\n- [ ] 1.1 a\n- [x] 1.2 b\n',
  'padded and upper-case x': '- [ x] 1.1 a\n- [X] 1.2 b\n- [ x ] 1.3 c\n- [ ] 1.4 d\n',
  'other markers are unfinished and counted': '- [~] 1.1 a\n- [-] 1.2 b\n- [] 1.3 c\n- [x] 1.4 d\n',
  'every list marker': '- [ ] 1.1 a\n* [x] 1.2 b\n+ [ ] 1.3 c\n1. [ ] 1.4 d\n2) [x] 1.5 e\n',
  'nested sub-tasks': '- [x] 1.1 a\n  - [ ] 1.1.1 b\n    - [x] 1.1.2 c\n',
  'lines that are not tasks': '- plain bullet\n- [A](http://example.com) link\n- [Some doc](./doc.md)\nprose [ ] here\n- [ ] 1.1 only\n',
  'a task without a number': '- [ ] write the docs\n- [x] 1.1 a\n',
  'a task in a code fence counts like any other': '```\n- [ ] 1.1 example\n```\n- [x] 1.2 real\n',
  'CRLF line endings': '## 1. A\r\n\r\n- [x] 1.1 a\r\n- [ ] 1.2 b\r\n',
  'no tasks at all': '# Tasks\n\nNothing yet.\n',
};

function openspecProgress(tasksText) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-tasks-contract-'));
  try {
    mkdirSync(join(dir, 'openspec', 'changes'), { recursive: true });
    writeFileSync(join(dir, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
    const created = spawnSync('openspec', ['new', 'change', 'probe'], { cwd: dir, encoding: 'utf8' });
    assert.equal(created.status, 0, created.stderr);
    writeFileSync(join(dir, 'openspec', 'changes', 'probe', 'tasks.md'), tasksText);
    const run = spawnSync('openspec', ['instructions', 'apply', '--change', 'probe', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const [name, text] of Object.entries(FIXTURES)) {
  test(`Relevo and OpenSpec agree: ${name}`, { skip: installed ? false : 'openspec is not installed' }, () => {
    const { progress } = openspecProgress(text);
    const mine = countTasks(text);
    assert.equal(mine.total, progress.total, 'total');
    assert.equal(mine.done, progress.complete, 'done');
  });
}

test('the apply instructions give the fields the schema guard reads', { skip: installed ? false : 'openspec is not installed' }, () => {
  const out = openspecProgress('- [ ] 1.1 a\n');
  assert.equal(out.schemaName, 'spec-driven');
  assert.equal(out.taskTrackingConfigured, true);
});
