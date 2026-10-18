import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

// The README is the cover and the documentation lives in docs/. Every page exists in English and in Spanish, and the
// Spanish one is a translation, so it must not drift: same sections in the same order, the same commands, links and
// demo, and no link that points nowhere. Text is free to differ; structure is not.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');

const PAGES = ['install', 'how-it-works', 'commands', 'configuration', 'built-with'];
const pairs = [['README.md', 'README.es.md'], ['docs/README.md', 'docs/README.es.md'], ...PAGES.map((n) => [`docs/${n}.md`, `docs/${n}.es.md`])];
const files = [...pairs.flat(), 'docs/brand/guia-de-uso.md'];

const noCode = (s) => s.replace(/```[\s\S]*?```/g, '');
const headings = (s) => [...noCode(s).matchAll(/^#{1,6} (.+)$/gm)].map((m) => m[1]);
const slug = (h) => h.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const blocks = (s) => [...s.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], text: m[2] }));
const urls = (s) => new Set([...s.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]));
const docCommands = (s) => [...s.matchAll(/^\| (`\/relevo:[a-z]+`) \|/gm)].map((m) => m[1]);
const coverCommands = (s) => [...s.matchAll(/^\|[^|\n]*\| (`\/relevo:[a-z]+`) \|/gm)].map((m) => m[1]);

test('each page links to its other language as the language switch', () => {
  for (const [en, es] of pairs) {
    const enName = en.split('/').pop().replace(/\./g, '\\.');
    const esName = es.split('/').pop().replace(/\./g, '\\.');
    assert.match(read(en), new RegExp(`English · \\[Español\\]\\(${esName}\\)`), `${en} links to ${es}`);
    assert.match(read(es), new RegExp(`\\[English\\]\\(${enName}\\) · Español`), `${es} links to ${en}`);
  }
});

test('both languages of every page have the same sections, tables, lists, pictures, links and commands blocks', () => {
  // Compare a fingerprint of each section: the number of shell blocks, pictures, table rows, list items and links.
  const fingerprint = (s) => s.split(/^#{1,6} /m).map((sec) => [
    (sec.match(/```bash/g) ?? []).length,
    (sec.match(/<picture>/g) ?? []).length,
    (sec.match(/^\|/gm) ?? []).length,
    (sec.match(/^- /gm) ?? []).length,
    (sec.match(/\]\(http/g) ?? []).length,
  ].join('|'));
  for (const [en, es] of pairs) {
    assert.equal(headings(read(es)).length, headings(read(en)).length, `${es}: same number of headings as ${en}`);
    assert.deepEqual(fingerprint(read(es)), fingerprint(read(en)), `${es} drifted from ${en}`);
  }
});

test('the install commands and every other shell block are identical', () => {
  const sh = (s) => blocks(s).filter((b) => b.lang === 'bash').map((b) => b.text);
  for (const [en, es] of pairs) assert.deepEqual(sh(read(es)), sh(read(en)), `${es}`);
  for (const p of ['README.md', 'docs/install.md']) assert.ok(sh(read(p)).join('').includes('claude plugin install relevo@relevo'), p);
});

test('the commands page lists the nine commands in the same order in both languages', () => {
  assert.deepEqual(docCommands(read('docs/commands.es.md')), docCommands(read('docs/commands.md')));
  assert.equal(docCommands(read('docs/commands.md')).length, 9);
});

test('the cover shows the seven commands of the flow, in order, with the same picture for each', () => {
  const flow = ['init', 'think', 'issue', 'go', 'review', 'fix', 'ship'].map((c) => `\`/relevo:${c}\``);
  for (const p of ['README.md', 'README.es.md']) {
    const text = read(p);
    assert.deepEqual(coverCommands(text), flow, p);
    assert.match(text, /`\/relevo:status`/);
    assert.match(text, /`\/relevo:doctor`/);
  }
  const pictures = (s) => [...s.matchAll(/relevo-state-([a-z]+)-black\.svg/g)].map((m) => m[1]);
  assert.deepEqual(pictures(read('README.md')), ['init', 'feature', 'think', 'issue', 'go', 'review', 'fix', 'ship']);
  assert.deepEqual(pictures(read('README.es.md')), pictures(read('README.md')));
});

test('the external links are the same set in both languages', () => {
  for (const [en, es] of pairs) assert.deepEqual([...urls(read(es))].sort(), [...urls(read(en))].sort(), es);
});

test('the demo has the same steps, times and hand-off message in both languages', () => {
  const demo = (s) => s.slice(s.search(/^## (See it work|Velo funcionar)/m)).split(/^## /m)[1];
  const en = read('docs/how-it-works.md');
  const es = read('docs/how-it-works.es.md');
  const times = (s) => [...demo(s).matchAll(/\| (\d+ s|\d+ min \d+ s) \|/g)].map((m) => m[1]);
  assert.deepEqual(times(es), times(en));
  assert.deepEqual(times(en), ['17 s', '3 min 35 s']);
  const rows = (s) => [...demo(s).matchAll(/^\| (\d) \|/gm)].map((m) => m[1]);
  assert.deepEqual(rows(es), rows(en));
  assert.deepEqual(rows(en), ['1', '2', '3', '4', '5']);
  const handoff = (s) => blocks(s).find((b) => b.text.startsWith('@elalfner')).text;
  assert.equal(handoff(es), handoff(en));
});

test('every relative link, every in-page anchor and every picture resolves, in every page', () => {
  for (const f of files) {
    const text = noCode(read(f));
    const dir = dirname(f);
    const target = (rel) => normalize(join(dir, rel));
    const own = new Set(headings(text).map(slug));
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = m[1];
      if (/^(https?:|mailto:)/.test(link)) continue;
      const [path, anchor] = link.split('#');
      if (path === '') { assert.ok(own.has(anchor), `${f}: #${anchor} matches no heading`); continue; }
      assert.ok(existsSync(`${root}${target(path)}`), `${f}: ${link} does not exist`);
      if (anchor && path.endsWith('.md')) {
        const slugs = new Set(headings(read(target(path))).map(slug));
        assert.ok(slugs.has(anchor), `${f}: ${link} matches no heading in ${path}`);
      }
    }
    for (const m of text.matchAll(/\b(?:src|srcset|href)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:)/.test(m[1])) continue;
      assert.ok(existsSync(`${root}${target(m[1])}`), `${f}: ${m[1]} does not exist`);
    }
  }
});

test('the README stays a cover: it links the documentation, and the documentation index links every page', () => {
  assert.match(read('README.md'), /\]\(docs\/README\.md\)/);
  assert.match(read('README.es.md'), /\]\(docs\/README\.es\.md\)/);
  for (const n of PAGES) {
    assert.match(read('docs/README.md'), new RegExp(`\\]\\(${n}\\.md\\)`), `docs/README.md links ${n}.md`);
    assert.match(read('docs/README.es.md'), new RegExp(`\\]\\(${n}\\.es\\.md\\)`), `docs/README.es.md links ${n}.es.md`);
  }
});

test('no page promises something the repository contradicts', () => {
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, /sk-ant-|ghp_|github_pat_/, f);
    assert.ok(!/\/Users\//.test(text), `${f}: no local path`);
  }
  // The demo is about the real sandbox run, so what it cites must exist in the findings document.
  assert.match(read('docs/pilot-findings.md'), /Second pilot/);
});
