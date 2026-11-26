import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// What the cover says first, what it may claim and how the package describes itself (documentation spec).
// Only what the requirements name is compared, so the wording around it stays free.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const COVERS = {
  'README.md': { category: /AI agent orchestrator, from issue to merge/, status: /Status: in use on real projects\..*Before 1\.0.*\(CHANGELOG\.md\)/, provider: /sent to the model provider, even when the build runs on your own runner/ },
  'README.es.md': { category: /Orquestador de agentes de IA, del issue al merge/, status: /Estado: en uso en proyectos reales\..*Antes de la 1\.0.*\(CHANGELOG\.md\)/, provider: /se envía al proveedor del modelo, también si el build corre en tu propio runner/ },
};
const RECORD = 'use-on-real-projects-measured-2026-11-25';
const usage = () => read('docs/pilot-findings.md').split(/^# Use on real projects.*$/m)[1];

test('Scenario: a visitor wants to install, and asks what it is', () => {
  for (const [file, { category }] of Object.entries(COVERS)) {
    const text = read(file);
    const intro = text.slice(0, text.search(/^## /m));
    assert.match(intro, category, file);
    assert.match(intro, /relevo-logo-animated-black\.svg/, file);
    assert.match(intro, /claude plugin marketplace add .*\nclaude plugin install relevo@relevo/, file);
    assert.match(intro.slice(intro.indexOf('claude plugin install')), /`\/relevo:doctor`/, file);
  }
});

test('Scenario: status, with no early development', () => {
  for (const [file, { status }] of Object.entries(COVERS)) {
    assert.match(read(file), status, file);
    assert.doesNotMatch(read(file), /early development|desarrollo temprano/i, file);
  }
});

test('Scenario: a figure is recorded and linked', () => {
  for (const file of Object.keys(COVERS)) assert.ok(read(file).includes(`(docs/pilot-findings.md#${RECORD})`), file);
  assert.match(usage(), /Merged pull requests: 102\.\*\* Counted:/);
  assert.match(usage(), /about 120,000 hand-written lines/);
});

test('Scenario: where code goes', () => {
  for (const [file, { provider }] of Object.entries(COVERS)) assert.match(read(file), provider, file);
});

test('Scenario: the usage record names no private repository or person', () => {
  // No list of private names is kept here, since the list itself would publish them.
  assert.doesNotMatch(usage(), /github\.com|bitbucket|[\w.-]+\/[\w.-]+#\d|@[a-z]/i);
});

test('Scenario: Antigravity is not on the cover and the install page keeps it', () => {
  for (const file of Object.keys(COVERS)) assert.doesNotMatch(read(file), /antigravity/i, file);
  for (const page of ['docs/install.md', 'docs/install.es.md']) assert.match(read(page), /relevo init[\s\S]*Antigravity|Antigravity[\s\S]*relevo init/, page);
});

test('Scenario: looking for a command, in the collapsed section about the logo', () => {
  for (const file of Object.keys(COVERS)) {
    const section = read(file).split('<details>').pop();
    assert.match(section, /<summary>.*logo.*(commands|comandos).*<\/summary>/i, file);
    assert.match(section, /`\/relevo:ship` \|/, file);
  }
});

test('Scenario: dark theme, every picture has a source for it and exists', () => {
  for (const file of Object.keys(COVERS)) {
    const text = read(file);
    const pictures = [...text.matchAll(/<picture>[\s\S]*?<\/picture>/g)].map((m) => m[0]);
    assert.equal([...text.matchAll(/<img /g)].length, pictures.length, `${file}: no image outside a picture`);
    for (const p of pictures) assert.match(p, /prefers-color-scheme: dark\)" srcset="[^"]+-white\.svg"[\s\S]*src="[^"]+-black\.svg"/, `${file}: ${p}`);
  }
});

test('Scenario: the three descriptions', () => {
  const words = 'AI agent orchestrator, from issue to merge: agents build and review, people decide.';
  assert.equal(JSON.parse(read('package.json')).description, `Relevo: ${words}`);
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).description, words);
  assert.equal(JSON.parse(read('.claude-plugin/marketplace.json')).plugins[0].description, words);
});
