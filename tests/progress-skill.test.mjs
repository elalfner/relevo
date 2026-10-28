import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSource } from '../scripts/lib/adapters/source.mjs';
import { renderAntigravity } from '../scripts/lib/adapters/antigravity.mjs';
import { PHASES } from '../scripts/lib/progress.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = readFileSync(`${root}skills/go/SKILL.md`, 'utf8');
const CALL = /node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/progress\.mjs phase ([a-z]+)((?: --attempt \S+(?: \S+)* --of [^`\n]+)?)/g;

/** The step ("### N. Title") of the skill that holds each call. */
function callsByStep(text) {
  const out = [];
  let step = 'intro';
  text.split('\n').forEach((line) => {
    const h = line.match(/^#{2,3} (.+)$/);
    if (h) step = h[1];
    [...line.matchAll(CALL)].forEach((m) => out.push({ step, phase: m[1], flags: m[2].trim() }));
  });
  return out;
}

test('Scenario: QA starts / Retry after a rejection - go announces each phase at the start of its step, and the attempt of QA and of every retry', () => {
  const calls = callsByStep(skill).filter((c) => c.step !== 'Progress on the issue');
  const byStep = (title) => calls.filter((c) => c.step.startsWith(title)).map((c) => c.phase);
  assert.deepEqual(byStep('1. Plan and claim'), ['planning']);
  assert.deepEqual(byStep('3. Specification'), ['specification']);
  assert.deepEqual(byStep('4. Build'), ['development']);
  assert.ok(byStep('5. QA').includes('qa'));
  assert.deepEqual(byStep('6. Commit'), ['delivery']);
  assert.deepEqual([...new Set(calls.map((c) => c.phase))].sort(), [...PHASES].sort(), 'every phase of the specification is announced, and no other');
  const qa = calls.find((c) => c.step.startsWith('5. QA'));
  assert.match(qa.flags, /--attempt 1 --of <qa_retries \+ 1>/);
  assert.match(skill, /announce `phase development --attempt <k> --of <qa_retries>`, and before the QA that follows it `phase qa --attempt <k \+ 1> --of <qa_retries \+ 1>`/);
});

test('the announcement is best effort: the skill says so and never makes it a reason to stop', () => {
  assert.match(skill, /prints nothing and does nothing outside that workflow/);
  assert.match(skill, /never take the failure path because of it/);
  assert.ok(existsSync(`${root}scripts/progress.mjs`));
});

test('Scenario: Script calls - the Antigravity skill keeps every announcement, with the absolute path of the plugin', () => {
  const pluginDir = '/home/someone/.gemini/config/plugins/relevo';
  const out = renderAntigravity(readSource(root), { pluginDir });
  const go = out.files.find((f) => f.path === 'skills/go/SKILL.md').content;
  const calls = [...go.matchAll(new RegExp(`node ${pluginDir}/scripts/progress\\.mjs phase ([a-z]+)`, 'g'))].map((m) => m[1]);
  assert.deepEqual(calls.length, callsByStep(skill).length, 'every call of the Claude skill is in the Antigravity one');
  assert.deepEqual([...new Set(calls)].sort(), [...PHASES].sort());
  assert.ok(!go.includes('${CLAUDE_PLUGIN_ROOT}/scripts/progress.mjs'), 'no variable is left');
});
