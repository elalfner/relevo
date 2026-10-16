import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

// One place that checks the shape of everything the plugin ships, so that a new skill, agent or template cannot
// be added without passing the same rules (task 7.3). Claude Code ignores unknown frontmatter fields without any
// warning, so a typo would disable a setting unnoticed.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const KNOWN_SKILL_FIELDS = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell', 'metadata', 'license', 'compatibility']);

// Skills that change a repository, spend money or start a build must never start on Claude's own initiative.
// Read-only skills may. A new skill has to be classified here, which forces the decision to be made.
const USER_ONLY = ['create', 'fix', 'go', 'init', 'review', 'ship', 'think'];
const READ_ONLY = ['doctor', 'status'];

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, 'must start with YAML frontmatter');
  return { meta: parse(m[1]), body: m[2] };
}
const skillNames = readdirSync(`${root}skills`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

test('every skill is classified as user-only or read-only, and the lists name no skill that does not exist', () => {
  assert.deepEqual([...USER_ONLY, ...READ_ONLY].sort(), skillNames, 'classify each new skill in USER_ONLY or READ_ONLY');
});

for (const name of skillNames) {
  test(`skill ${name}: frontmatter is valid and the name matches the folder`, () => {
    assert.ok(existsSync(`${root}skills/${name}/SKILL.md`), 'SKILL.md is missing');
    const { meta, body } = frontmatter(read(`skills/${name}/SKILL.md`));
    Object.keys(meta).forEach((k) => assert.ok(KNOWN_SKILL_FIELDS.has(k), `unknown skill field "${k}"`));
    assert.equal(meta.name, name);
    assert.ok(typeof meta.description === 'string' && meta.description.length > 40, 'a real description is needed');
    assert.ok(meta.description.length <= 1536, 'the description is too long');
    if ('argument-hint' in meta) assert.equal(typeof meta['argument-hint'], 'string');
    assert.ok(body.trim().length > 200, 'the skill has no instructions');
  });

  test(`skill ${name}: ${USER_ONLY.includes(name) ? 'only the person can start it' : 'it is read-only and says so'}`, () => {
    const { meta, body } = frontmatter(read(`skills/${name}/SKILL.md`));
    if (USER_ONLY.includes(name)) assert.equal(meta['disable-model-invocation'], true, `${name} changes things and must not start on its own`);
    else {
      assert.notEqual(meta['disable-model-invocation'], true);
      assert.match(`${meta.description} ${body}`, /read-only|only reads|never changes/i, `${name} must state that it is read-only`);
    }
  });

  test(`skill ${name}: every script and template it names exists`, () => {
    const { body } = frontmatter(read(`skills/${name}/SKILL.md`));
    const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+\.mjs)/g)].map((m) => m[1]);
    scripts.forEach((s) => assert.ok(existsSync(`${root}scripts/${s}`), `scripts/${s} is missing`));
    [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/((?:templates|docs)\/[\w./-]+)/g)].forEach((m) => assert.ok(existsSync(`${root}${m[1]}`), `${m[1]} is missing`));
  });
}

test('the plugin manifest and the marketplace entry are consistent', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const market = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(plugin.name, 'relevo');
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].source, './');
  if (plugin.version !== undefined) assert.match(plugin.version, /^\d+\.\d+\.\d+$/, 'a fixed version must be semver');
  assert.ok(!('version' in market.plugins[0]) || plugin.version === undefined || market.plugins[0].version === plugin.version);
});

test('every agent has valid frontmatter and a body', () => {
  readdirSync(`${root}agents`).filter((f) => f.endsWith('.md')).forEach((f) => {
    const { meta, body } = frontmatter(read(`agents/${f}`));
    assert.equal(meta.name, f.replace(/\.md$/, ''));
    assert.ok(meta.description && meta.description.length > 40, `${f} needs a real description`);
    assert.ok(body.trim().length > 200, `${f} has no instructions`);
  });
});

test('the shipped relevo.yml template is a valid configuration with no credential in it', () => {
  const text = read('templates/relevo.yml');
  const loaded = loadConfig(text);
  assert.ok(loaded.ok, JSON.stringify(loaded.errors));
  assert.ok(!/sk-ant-|ghp_|github_pat_/.test(text));
});

test('every workflow template has a name, an event, a job and least-privilege permissions', () => {
  const files = readdirSync(`${root}templates/workflows`).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length >= 5);
  files.forEach((f) => {
    const text = read(`templates/workflows/${f}`);
    assert.match(text, /^name: relevo-/m, `${f}: name`);
    assert.match(text, /^on:/m, `${f}: event`);
    assert.match(text, /^jobs:/m, `${f}: jobs`);
    assert.match(text, /^permissions:/m, `${f}: permissions`);
    assert.doesNotMatch(text, /permissions:\s*write-all/, `${f}: write-all`);
    assert.doesNotMatch(text, /^\s+(\t)/m, `${f}: tabs`);
  });
});

test('the repository CI runs the tests and validates the OpenSpec specifications and changes', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /run: npm test/);
  assert.match(ci, /run: openspec validate --all/);
  assert.match(ci, /^permissions:\n {2}contents: read/m);
  assert.doesNotMatch(ci, /pull_request_target/);
  assert.match(ci, /OPENSPEC_TELEMETRY: '0'/);
});
