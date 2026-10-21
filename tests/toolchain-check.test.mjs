import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { missingTools } from '../scripts/lib/toolchain-check.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';
import { nextStep } from '../scripts/lib/next-step.mjs';

const script = new URL('../scripts/toolchain-check.mjs', import.meta.url).pathname;
const template = new URL('../templates/relevo.yml', import.meta.url).pathname;

test('Scenario: A runner without the Flutter SDK - the missing tools are listed in the order of the profile, without repeats', () => {
  assert.deepEqual(missingTools(['flutter'], () => false), ['flutter']);
  assert.deepEqual(missingTools(['php', 'composer', 'php'], (t) => t === 'php'), ['composer']);
  assert.deepEqual(missingTools(['flutter'], () => true), []);
});

test('Scenario: A stack with no tools listed - nothing is checked', () => {
  assert.deepEqual(missingTools([], () => false), []);
  assert.deepEqual(missingTools(undefined, () => false), []);
});

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-tc-'));
  copyFileSync(template, join(dir, 'relevo.yml'));
  mkdirSync(join(dir, 'bin'));
  return dir;
}
const run = (dir, args, extraPath = '') => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${extraPath}${extraPath ? ':' : ''}${join(dir, 'empty')}:/usr/bin/nonexistent` } });

test('the script exits 1 and names the missing tool when flutter is not on the path', () => {
  const dir = project();
  const r = run(dir, ['--platform', 'app']);
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout), { platform: 'app', stack: 'flutter', tools: ['flutter'], missing: ['flutter'] });
});

test('Scenario: A complete toolchain - the script exits 0 and the missing list is empty', () => {
  const dir = project();
  writeFileSync(join(dir, 'bin', 'flutter'), '#!/bin/sh\necho Flutter 3\n');
  chmodSync(join(dir, 'bin', 'flutter'), 0o755);
  const r = run(dir, ['--platform', 'app'], join(dir, 'bin'));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).missing, []);
});

test('an unknown platform, a missing relevo.yml and a bad usage are refused with their own messages', () => {
  const dir = project();
  assert.equal(run(dir, ['--platform', 'nope']).status, 2);
  assert.match(run(dir, ['--platform', 'nope']).stderr, /unknown platform "nope"/);
  const empty = mkdtempSync(join(tmpdir(), 'relevo-tc-none-'));
  assert.equal(run(empty, ['--platform', 'app']).status, 2);
  assert.match(run(empty, ['--platform', 'app']).stderr, /relevo\.yml not found/);
});

test('the profile of the repository can add a tool and it is checked too', () => {
  const dir = project();
  mkdirSync(join(dir, '.relevo', 'stacks'), { recursive: true });
  writeFileSync(join(dir, '.relevo', 'stacks', 'flutter.md'), '---\nstack: flutter\ntools: [melos]\n---\n\n# Flutter, with melos\n');
  writeFileSync(join(dir, 'bin', 'flutter'), '#!/bin/sh\necho ok\n');
  chmodSync(join(dir, 'bin', 'flutter'), 0o755);
  const r = run(dir, ['--platform', 'app'], join(dir, 'bin'));
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout).missing, ['melos']);
});

test('the comment names the tools, says nothing was built and no turns were spent, and gives the fix, in both languages', () => {
  const data = { assignee: 'ana', issue: 41, title: 'Show a message', tools: 'flutter', platform: 'app' };
  const en = renderMessage('toolchain_missing', data);
  assert.match(en, /^@ana #41 "Show a message" was not built: the runner has no flutter/);
  assert.match(en, /Nothing was built and no model turns were spent\./);
  assert.match(en, /Your next step: install the toolchain in the build job of relevo-go\.yml .*remove relevo:qa-failed and label the issue relevo:ready again\./);
  const es = renderMessage('toolchain_missing', data, 'es');
  assert.match(es, /no se construyó: el runner no tiene flutter/);
  assert.match(es, /no se gastó ningún turno del modelo/);
  assert.match(es, /Tu siguiente paso: instala el toolchain en el job de build de relevo-go\.yml/);
  assert.throws(() => renderMessage('toolchain_missing', { assignee: 'ana', issue: 41, title: 'T', platform: 'app' }), /tools/);
  assert.equal(nextStep({ state: 'qa-failed', reason: 'toolchain', issue: 41 }).command, null);
});
