import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSource, splitFrontmatter } from '../scripts/lib/adapters/source.mjs';
import { adaptText, renderAntigravity } from '../scripts/lib/adapters/antigravity.mjs';
import { ANTIGRAVITY_TOOLS, UnmappedToolError, antigravityToolsOf } from '../scripts/lib/adapters/tools.mjs';
import { reservedForPerson } from '../scripts/lib/role-skills.mjs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pluginDir = '/home/someone/.gemini/config/plugins/relevo';
const source = readSource(root);
const out = renderAntigravity(source, { pluginDir });
const file = (p) => out.files.find((f) => f.path === p);
const head = (p) => parse(splitFrontmatter(file(p).content).head);

test('Scenario: Rendering for Antigravity - a manifest, every skill, both agents and what to copy', () => {
  const paths = out.files.map((f) => f.path);
  assert.ok(paths.includes('plugin.json'));
  for (const s of source.skills) assert.ok(paths.includes(`skills/${s.name}/SKILL.md`), `skill ${s.name}`);
  assert.ok(paths.includes('agents/relevo-dev.md') && paths.includes('agents/relevo-qa.md'));
  assert.ok(paths.includes('skills/issue/references/update.md'), 'the references of a skill travel with it');
  assert.deepEqual(out.copy.dirs, ['scripts', 'stacks', 'templates']);
  const manifest = JSON.parse(file('plugin.json').content);
  assert.equal(manifest.name, 'relevo');
  assert.equal(manifest.version, source.version);
  assert.deepEqual(Object.keys(manifest).sort(), ['author', 'description', 'displayName', 'name', 'version'], 'the manifest schema is strict');
});

test('Scenario: No Claude token remains', () => {
  for (const f of out.files.filter((x) => x.path.endsWith('.md'))) {
    assert.ok(!f.content.includes('${CLAUDE_PLUGIN_ROOT}'), `${f.path} keeps the script path variable`);
    assert.ok(!/relevo:(dev|qa)(?![\w-])/.test(f.content), `${f.path} keeps a Claude agent name`);
  }
  for (const p of ['agents/relevo-dev.md', 'agents/relevo-qa.md']) {
    const meta = head(p);
    for (const k of ['model', 'effort', 'disallowedTools']) assert.ok(!(k in meta), `${p} keeps ${k}`);
  }
});

test('Scenario: Script calls - the same arguments, the absolute path of the plugin', () => {
  const before = source.skills.flatMap((s) => [s.body, ...s.files.map((f) => f.content)]).join('\n');
  const calls = before.match(/\$\{CLAUDE_PLUGIN_ROOT\}/g).length;
  const after = out.files.filter((f) => f.path.startsWith('skills/')).map((f) => f.content).join('\n');
  assert.equal(after.split(pluginDir).length - 1, calls, 'every use of the variable became the path');
  assert.match(adaptText('run `node ${CLAUDE_PLUGIN_ROOT}/scripts/go-plan.mjs 12 --claim`', { pluginDir }), new RegExp(`node ${pluginDir}/scripts/go-plan.mjs 12 --claim`));
});

test('a label that looks like an agent name is not renamed', () => {
  const text = adaptText('labels relevo:qa-failed and relevo:built; agents relevo:dev and relevo:qa.', { pluginDir });
  assert.equal(text, 'labels relevo:qa-failed and relevo:built; agents relevo-dev and relevo-qa.');
});

test('Scenario: A reserved skill - the key is kept, and only for the skills that had it', () => {
  const reserved = source.skills.filter((s) => reservedForPerson(readFileSync(join(root, 'skills', s.name, 'SKILL.md'), 'utf8')));
  assert.ok(reserved.length >= 5, 'the reserved skills are found');
  for (const s of source.skills) {
    const meta = head(`skills/${s.name}/SKILL.md`);
    assert.equal(meta['disable-model-invocation'] === true || meta['disable-model-invocation'] === 'true', reserved.includes(s), s.name);
    assert.equal(meta.description, s.meta.description, `${s.name}: the description survives quoting`);
    assert.equal(meta.name, s.name);
  }
});

test('Scenario: QA is read-only - it can run commands and has no write or edit tool', () => {
  const qa = String(head('agents/relevo-qa.md').tools);
  const dev = String(head('agents/relevo-dev.md').tools);
  assert.match(qa, /run_command/);
  for (const t of [...ANTIGRAVITY_TOOLS.Write, ...ANTIGRAVITY_TOOLS.Edit]) {
    assert.ok(!qa.includes(t), `qa has ${t}`);
    assert.ok(dev.includes(t), `dev lacks ${t}`);
  }
  assert.match(file('agents/relevo-qa.md').content, /tools: \[[a-z_, ]+\]\n/, 'the list is a YAML list: a string makes the agent fail to load');
});

test('Scenario: Unknown tool - the render stops and names it', () => {
  assert.throws(() => antigravityToolsOf({ tools: 'Read, TodoWrite' }), (e) => e instanceof UnmappedToolError && /TodoWrite/.test(e.message));
  assert.throws(() => antigravityToolsOf({ disallowedTools: 'Write, Teleport' }), UnmappedToolError);
});

test('the subagent wait of go is said the way Antigravity works', () => {
  const go = file('skills/go/SKILL.md').content;
  assert.match(go, /`invoke_subagent`[\s\S]*the report arrives later as a message/);
  assert.ok(!/Launch `relevo/.test(go));
  assert.throws(() => adaptText('## Subagents run in the foreground\n## Next\n', { pluginDir }), /no longer followed by one paragraph/);
});

test('a plugin folder that a shell command cannot carry is refused', () => {
  for (const bad of ['relative/path', '/Users/with space/plugin', '/tmp/a;b']) {
    assert.throws(() => renderAntigravity(source, { pluginDir: bad }), /plugin folder/, bad);
  }
});

// These two need the installed `agy` and an account; they are off unless asked for.
const withAgy = process.env.RELEVO_AGY_CHECK === '1';
test('the rendered plugin passes `agy plugin validate`', { skip: !withAgy }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-plugin-'));
  const target = join(dir, 'relevo');
  const rendered = renderAntigravity(source, { pluginDir: target });
  for (const f of rendered.files) {
    mkdirSync(join(target, f.path, '..'), { recursive: true });
    writeFileSync(join(target, f.path), f.content);
  }
  for (const d of rendered.copy.dirs) cpSync(join(root, d), join(target, d), { recursive: true });
  const r = spawnSync('agy', ['plugin', 'validate', target], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});

test('every tool of the table is a tool the installed agy reports', { skip: !withAgy }, () => {
  const r = spawnSync('agy', ['-p', 'Reply with the word ok.', '--output-format', 'stream-json'], { encoding: 'utf8', input: '', timeout: 120000 });
  const init = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.event === 'init');
  const known = new Set(init.init.tools);
  for (const t of Object.values(ANTIGRAVITY_TOOLS).flat()) assert.ok(known.has(t), `${t} is not a tool of this agy`);
});
