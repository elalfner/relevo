import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSource, splitFrontmatter } from '../scripts/lib/adapters/source.mjs';
import { adaptText, hooksManifest, renderAntigravity } from '../scripts/lib/adapters/antigravity.mjs';
import { ANTIGRAVITY_TOOLS, UnmappedToolError, antigravityToolsOf } from '../scripts/lib/adapters/tools.mjs';
import { reservedForPerson } from '../scripts/lib/role-skills.mjs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pluginDir = '/home/someone/.gemini/config/plugins/relevo';
const source = readSource(root);
const out = renderAntigravity(source, { pluginDir });
const file = (p) => out.files.find((f) => f.path === p);
const head = (p) => parse(splitFrontmatter(file(p).content).head);
const LENS_AGENTS = ['qa-spec', 'qa-security', 'qa-code', 'qa-interface', 'qa-bugs'];

test('Scenario: Rendering for Antigravity - a manifest, root hooks.json, every skill, all agents and what to copy', () => {
  const paths = out.files.map((f) => f.path);
  assert.ok(paths.includes('plugin.json'));
  assert.ok(paths.includes('hooks.json'), 'native Antigravity plugins load hooks from root hooks.json');
  assert.ok(!paths.includes('hooks/hooks.json'), 'never write hooks/hooks.json for a native Antigravity plugin');
  for (const s of source.skills) assert.ok(paths.includes(`skills/${s.name}/SKILL.md`), `skill ${s.name}`);
  assert.ok(paths.includes('agents/relevo-dev.md') && LENS_AGENTS.every((l) => paths.includes(`agents/relevo-${l}.md`)));
  assert.ok(!paths.includes('agents/relevo-qa.md'), 'the former QA agent is gone');
  assert.ok(paths.includes('skills/issue/references/update.md'), 'the references of a skill travel with it');
  assert.deepEqual(out.copy.dirs, ['scripts', 'stacks', 'knowledge', 'templates']);
  const manifest = JSON.parse(file('plugin.json').content);
  assert.equal(manifest.name, 'relevo');
  assert.equal(manifest.version, source.version);
  assert.deepEqual(Object.keys(manifest).sort(), ['author', 'description', 'displayName', 'name', 'version'], 'the manifest schema is strict');
  const hooks = JSON.parse(file('hooks.json').content);
  assert.deepEqual(hooks, hooksManifest(pluginDir));
  assert.equal(hooks['relevo-time-guard'].PreToolUse[0].matcher, '*');
  assert.equal(hooks['relevo-time-guard'].PreToolUse[0].hooks[0].type, 'command');
  assert.equal(hooks['relevo-time-guard'].PreToolUse[0].hooks[0].command, `node ${pluginDir}/scripts/time-guard.mjs`);
});

test('Scenario: No Claude token or Claude-only workflow phrase remains', () => {
  for (const f of out.files.filter((x) => x.path.endsWith('.md'))) {
    assert.ok(!f.content.includes('${CLAUDE_PLUGIN_ROOT}'), `${f.path} keeps the script path variable`);
    assert.ok(!/relevo:(dev|qa(?:-(?:spec|security|code|interface|bugs))?)(?![\w-])/.test(f.content), `${f.path} keeps a Claude agent name`);
  }
  for (const p of ['agents/relevo-dev.md', ...LENS_AGENTS.map((l) => `agents/relevo-${l}.md`)]) {
    const meta = head(p);
    for (const k of ['model', 'effort', 'disallowedTools']) assert.ok(!(k in meta), `${p} keeps ${k}`);
  }
  const adaptedWorkflowFiles = [
    'skills/go/SKILL.md',
    'skills/go/references/qa-run.md',
    'skills/fix/SKILL.md',
    'skills/review/SKILL.md'
  ];
  for (const p of adaptedWorkflowFiles) {
    const text = file(p).content;
    assert.doesNotMatch(text, /\bAgent tool\b|\bAgent call\b|Agent `description`/, `${p} keeps Claude Agent tool wording`);
    assert.doesNotMatch(text, /as parameters of the Agent tool|keep the effort of the plan|pass them as the `model` and `effort`/, `${p} keeps Claude effort launch params`);
    assert.doesNotMatch(text, /<usage>/, `${p} keeps mandatory Claude <usage> block wording`);
    assert.doesNotMatch(text, /one at a time, never two together/, `${p} keeps sequential lens wording`);
  }
});

test('Scenario: Script calls - the same arguments, the absolute path of the plugin', () => {
  // The "Where it runs" block of `go` and section 3 of `qa-run.md` are replaced whole for Antigravity, so leave them
  // out of both sides; everything else must keep every call.
  const withoutReplaced = (t) => t
    .replace(/## Where it runs\n\n[\s\S]*?(?=\n\n## OpenSpec commands)/, '')
    .replace(/## 3\. Launch the active lenses[^\n]*\n\n[\s\S]*?(?=\n\n## 4\. Aggregate)/, '')
    .replace(/When it prints `failed`, or anything that is not that JSON, launch every agent with the model and the effort of the configuration \(`node [^`]+`[^)]*\)/, '');
  const before = withoutReplaced(source.skills.flatMap((s) => [s.body, ...s.files.map((f) => f.content)]).join('\n'));
  const calls = before.match(/\$\{CLAUDE_PLUGIN_ROOT\}/g).length;
  const after = withoutReplaced(out.files.filter((f) => f.path.startsWith('skills/')).map((f) => f.content).join('\n'));
  assert.equal(after.split(pluginDir).length - 1, calls, 'every use of the variable became the path');
  assert.match(adaptText('run `node ${CLAUDE_PLUGIN_ROOT}/scripts/go-plan.mjs 12 --claim`', { pluginDir }), new RegExp(`node ${pluginDir}/scripts/go-plan.mjs 12 --claim`));
});

test('Scenario: The Claude Code worktree instructions of go do not reach the Antigravity plugin', () => {
  const go = file('skills/go/SKILL.md').content;
  assert.ok(!/EnterWorktree|ExitWorktree|go-worktree\.mjs/.test(go), 'the Claude tools and script are named in the Antigravity go skill');
  assert.match(go, /Workspace: 'share'/);
});

test('a label that looks like an agent name is not renamed', () => {
  const text = adaptText('labels relevo:build-failed and relevo:built; agents relevo:dev and relevo:qa.', { pluginDir });
  assert.equal(text, 'labels relevo:build-failed and relevo:built; agents relevo-dev and relevo-qa.');
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
  const qa = LENS_AGENTS.map((l) => String(head(`agents/relevo-${l}.md`).tools)).join(' ');
  const dev = String(head('agents/relevo-dev.md').tools);
  assert.match(qa, /run_command/);
  for (const t of [...ANTIGRAVITY_TOOLS.Write, ...ANTIGRAVITY_TOOLS.Edit]) {
    assert.ok(!qa.includes(t), `qa has ${t}`);
    assert.ok(dev.includes(t), `dev lacks ${t}`);
  }
  for (const l of LENS_AGENTS) assert.match(file(`agents/relevo-${l}.md`).content, /tools: \[[a-z_, ]+\]\n/, 'the list is a YAML list: a string makes the agent fail to load');
});

test('Scenario: Unknown tool - the render stops and names it', () => {
  assert.throws(() => antigravityToolsOf({ tools: 'Read, TodoWrite' }), (e) => e instanceof UnmappedToolError && /TodoWrite/.test(e.message));
  assert.throws(() => antigravityToolsOf({ disallowedTools: 'Write, Teleport' }), UnmappedToolError);
});

test('Scenario: Multiple active lenses run in parallel with a schedule batch watchdog and single-lens recovery', () => {
  const go = file('skills/go/SKILL.md').content;
  const qaRun = file('skills/go/references/qa-run.md').content;
  assert.match(go, /relevo-qa-spec.*relevo-qa-security.*relevo-qa-code.*relevo-qa-interface.*relevo-qa-bugs[\s\S]*in parallel in one turn.*`invoke_subagent`/);
  assert.match(go, /`schedule` batch watchdog/);
  assert.match(go, /terminate that finished subagent using `manage_subagents` \(`Action: "kill"/);
  assert.match(go, /retry only the stalled or failed lens once while keeping all completed sibling reports/);
  assert.match(qaRun, /## 3\. Launch the active lenses in parallel/);
  assert.match(qaRun, /\*\*in parallel in one turn\*\* via `invoke_subagent`/);
  assert.match(qaRun, /`schedule` \(`DurationSeconds:/);
  assert.match(qaRun, /do \*\*not\*\* poll with `manage_subagents`/);
  assert.match(qaRun, /`manage_subagents` \(`Action: "kill"/);
  assert.match(qaRun, /`manage_task` \(`Action: "kill"`\)/);
  assert.match(qaRun, /keep every completed sibling report, kill only the stalled or failed lens subagent\(s\) with `manage_subagents`.*retry only the stalled or failed lens once alone/);
  assert.throws(() => adaptText('## Subagents run in the foreground\n## Next\n', { pluginDir }), /no longer followed by one paragraph/);
  assert.throws(() => adaptText('drifted qa-run text', { pluginDir, path: 'skills/go/references/qa-run.md' }), /could not be matched/);
});

test('Scenario: Synced local and interactive go instructions in Antigravity', () => {
  const go = file('skills/go/SKILL.md').content;
  assert.match(go, /go-local\.mjs <issue>` \(forwarding `--retry` or `--resume` when `\$ARGUMENTS` has it\) as a background command/);
  assert.match(go, /go-local\.mjs status <issue>/);
  assert.match(go, /next-step\.mjs \.\.\. --conversation/);
  assert.match(go, /next-step\.mjs --build-warning --issue <issue>/);
  assert.match(go, /invoke_subagent[\s\S]*TypeName: "self"[\s\S]*Role: "relevo-builder"[\s\S]*Workspace: 'share'/);
  assert.match(go, /schedule[\s\S]*DurationSeconds: 1200[\s\S]*TimerCondition:/);
  assert.match(go, /manage_subagents[\s\S]*Action: "kill"/);
  assert.match(go, /multiple chat tabs share this workspace and will collide/);
});

test('Scenario: Global skill discovery in Antigravity think without changing Claude source', () => {
  const renderedThink = file('skills/think/SKILL.md').content;
  const sourceThink = readFileSync(join(root, 'skills/think/SKILL.md'), 'utf8');
  assert.match(renderedThink, /~\/\.agents\/skills\//);
  assert.match(renderedThink, /~\/\.gemini\/config\/skills\//);
  assert.doesNotMatch(sourceThink, /~\/\.gemini\/config\/skills\//, 'Claude Code source think stays untouched');
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

// ---- the QA lenses (specialist-review-lenses)

test('Scenario: the five lens agents are rendered with valid names and read-only tool lists', () => {
  for (const lens of LENS_AGENTS) {
    const path = `agents/relevo-${lens}.md`;
    assert.ok(file(path), `${path} is rendered`);
    assert.equal(head(path).name, `relevo-${lens}`);
    const tools = String(head(path).tools);
    assert.doesNotMatch(tools, /write_to_file|replace_file_content/, `${lens} has a write tool`);
    assert.match(tools, /view_file/);
  }
});

test('every agent file of the plugin renders to a valid Antigravity name', () => {
  for (const f of out.files.filter((x) => /^agents\//.test(x.path))) {
    assert.match(head(f.path).name, /^relevo-[a-z]+(-[a-z]+)?$/, f.path);
    assert.equal(`agents/${head(f.path).name}.md`, f.path);
  }
});

test('Scenario: No Claude token remains - no relevo:qa-<lens> name is left in any rendered file', () => {
  for (const f of out.files.filter((x) => x.path.endsWith('.md'))) {
    assert.doesNotMatch(f.content, /relevo:qa-(spec|security|code|interface|bugs)/, f.path);
  }
});

test('the rewrite of agent names turns the lens names and leaves other text alone', async () => {
  const { adaptText: adapt } = await import('../scripts/lib/adapters/antigravity.mjs');
  const text = adapt('Launch relevo:dev, relevo:qa, relevo:qa-security and relevo:qa-interface; not relevo:qa-other or relevo:developer.', { pluginDir });
  assert.equal(text, 'Launch relevo-dev, relevo-qa, relevo-qa-security and relevo-qa-interface; not relevo:qa-other or relevo:developer.');
});
