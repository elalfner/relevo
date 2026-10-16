import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// The Spanish README (task 8.1) is a translation, so it must not drift: same sections in the same order, the same
// commands, links and demo, and no link that points nowhere. Text is free to differ; structure is not.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const en = read('README.md');
const es = read('README.es.md');

const headings = (s) => [...s.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
const slug = (h) => h.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const blocks = (s) => [...s.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], text: m[2] }));
const urls = (s) => new Set([...s.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]));
const relLinks = (s) => [...s.matchAll(/\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l));
const commands = (s) => [...s.matchAll(/^\| (`\/relevo:[a-z]+`) \|/gm)].map((m) => m[1]);

test('each README links to the other as its language switch', () => {
  assert.match(en, /English · \[Español\]\(README\.es\.md\)/);
  assert.match(es, /\[English\]\(README\.md\) · Español/);
});

test('both READMEs have the same number of sections, in the same order of content', () => {
  assert.equal(headings(es).length, headings(en).length);
  // The sections that carry a command or a link keep their position: compare a fingerprint of each section.
  const fingerprint = (s) => s.split(/^## /m).slice(1).map((sec) => `${(sec.match(/```bash/g) ?? []).length}|${(sec.match(/^\| `/gm) ?? []).length}|${(sec.match(/\]\(http/g) ?? []).length}`);
  assert.deepEqual(fingerprint(es), fingerprint(en));
});

test('the install commands and every other shell block are identical', () => {
  const sh = (s) => blocks(s).filter((b) => b.lang === 'bash').map((b) => b.text);
  assert.deepEqual(sh(es), sh(en));
  assert.ok(sh(en).join('').includes('claude plugin install relevo@relevo'));
});

test('the commands table lists the same commands in the same order', () => {
  assert.deepEqual(commands(es), commands(en));
  assert.equal(commands(en).length, 9);
});

test('the external links are the same set', () => {
  assert.deepEqual([...urls(es)].sort(), [...urls(en)].sort());
});

test('the demo has the same steps, times and hand-off message in both languages', () => {
  const demo = (s) => s.slice(s.search(/^## (See it work|Velo funcionar)/m)).split(/^## /m)[1];
  const times = (s) => [...demo(s).matchAll(/\| (\d+ s|\d+ min \d+ s) \|/g)].map((m) => m[1]);
  assert.deepEqual(times(es), times(en));
  assert.deepEqual(times(en), ['17 s', '3 min 35 s']);
  const rows = (s) => [...demo(s).matchAll(/^\| (\d) \|/gm)].map((m) => m[1]);
  assert.deepEqual(rows(es), rows(en));
  assert.deepEqual(rows(en), ['1', '2', '3', '4', '5']);
  const handoff = (s) => blocks(s).find((b) => b.text.startsWith('@elalfner')).text;
  assert.equal(handoff(es), handoff(en));
});

test('every relative link and every in-page anchor resolves, in both READMEs', () => {
  for (const [name, text] of [['README.md', en], ['README.es.md', es]]) {
    relLinks(text).forEach((l) => assert.ok(existsSync(`${root}${l}`), `${name}: ${l} does not exist`));
    const slugs = new Set(headings(text).map(slug));
    [...text.matchAll(/\]\(#([^)]+)\)/g)].forEach((m) => assert.ok(slugs.has(m[1]), `${name}: #${m[1]} matches no heading`));
  }
});

test('neither README promises something the repository contradicts', () => {
  for (const text of [en, es]) {
    assert.doesNotMatch(text, /sk-ant-|ghp_|github_pat_/);
    assert.ok(!/\/Users\//.test(text), 'no local path');
  }
  // The demo is about the real sandbox run, so what it cites must exist in the findings document.
  assert.match(read('docs/pilot-findings.md'), /Second pilot/);
});
