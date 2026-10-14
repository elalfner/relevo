import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
