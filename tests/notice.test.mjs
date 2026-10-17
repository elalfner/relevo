import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('NOTICE reproduces the copyright and permission notices of the works Relevo works together with', () => {
  const notice = read('NOTICE');
  assert.match(notice, /Copyright \(c\) 2026 Matt Pocock/);
  assert.match(notice, /Copyright \(c\) 2024 OpenSpec Contributors/);
  assert.match(notice, /Permission is hereby granted, free of charge/);
  assert.match(notice, /THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.match(notice, /skills\/think\/SKILL\.md/);
});

test('the README credits both works and points to NOTICE', () => {
  const readme = read('README.md');
  assert.match(readme, /mattpocock\/skills/);
  assert.match(readme, /Fission-AI\/OpenSpec/);
  assert.match(readme, /\[NOTICE\]\(NOTICE\)/);
});

test('the notice names no private origin', () => {
  assert.ok(!/jira|urban|metlife/i.test(read('NOTICE')));
});


test('the commands page and NOTICE say plainly that this repository keeps copies of the skills it works with', () => {
  const readme = read('docs/commands.md');
  const notice = read('NOTICE');
  assert.ok(existsSync(new URL('../.agents/skills', import.meta.url)), 'the copies are tracked');
  assert.match(notice, /does keep copies of them as\s+development tooling/);
  assert.match(notice, /\.agents\/skills\//);
  assert.match(notice, /\.claude\//);
  assert.match(readme, /This repository does keep copies for working on it/);
  assert.match(readme, /`\.agents\/skills\/`/);
  assert.doesNotMatch(readme, /Relevo does not bundle or copy them/);
  assert.match(readme, /The plugin does not contain them/);
});

test('the documentation says Relevo was built with OpenSpec and points at its design, history and pilots', () => {
  const readme = read('docs/built-with.md');
  assert.match(readme, /^# Built with OpenSpec and mattpocock\/skills/m);
  assert.match(readme, /openspec\/changes\/archive\/2026-10-16-relevo-v1/);
  assert.match(readme, /\]\(\.\.\/openspec\/specs\)/);
  assert.match(readme, /\]\(pilot-findings\.md\)/);
  assert.match(readme, /relevo-sandbox/);
  ['openspec/changes/archive/2026-10-16-relevo-v1', 'openspec/specs', 'docs/pilot-findings.md'].forEach((p) => assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} exists`));
});
