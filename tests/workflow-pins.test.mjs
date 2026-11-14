// Implements, for the workflow templates, "The workflow templates pin the actions that run on a current Node.js, by commit",
// "The downloads of a build are cached by the version that is pinned", "A cache written by a build is saved before the agent
// starts" and "The light job only reads the runs" (issue #132).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const TEMPLATES = [
  ...readdirSync(`${root}templates/workflows`).map((f) => `templates/workflows/${f}`),
  'templates/deploy-supabase.yml',
  ...readdirSync(`${root}templates/agents`).map((f) => `templates/agents/${f}`),
];
const text = (file) => readFileSync(`${root}${file}`, 'utf8');
const go = text('templates/workflows/relevo-go.yml');

// The commit of each release, read from the repository of each action (git ls-remote --tags, and a clone at the tag to read
// `runs.using` of its action.yml). A pin is raised by changing this table and the templates together.
const PINS = {
  'actions/checkout': { version: 'v7.0.1', sha: '3d3c42e5aac5ba805825da76410c181273ba90b1' },
  'actions/setup-node': { version: 'v7.1.0', sha: '949feb2413d6458794dcd2491c4babbbce0c15c1' },
  'actions/create-github-app-token': { version: 'v3.3.0', sha: '64ab729a6294000f5aa4a4bc0b73d1f32bc45510' },
  'actions/cache': { version: 'v6.1.0', sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9' },
  'oven-sh/setup-bun': { version: 'v2.2.0', sha: '0c5077e51419868618aeaa5fe8019c62421857d6' },
  'supabase/setup-cli': { version: 'v3.2.0', sha: '689adcfb80d947100a1eab127289b97d1fb07b13' },
};

// Every `uses:` of the templates, active or in an example comment: [{ file, action, ref, comment, line }].
function usesOf(file) {
  return text(file).split('\n').flatMap((line, i) => {
    const m = /uses:\s*([\w.-]+\/[\w.-]+)(\/[\w./-]+)?@(\S+)(?:\s+#\s*(.*))?$/.exec(line);
    return m ? [{ file, action: m[1], sub: m[2] ?? '', ref: m[3], comment: m[4] ?? '', line: i + 1, active: !/^\s*#/.test(line) }] : [];
  });
}
const ALL = TEMPLATES.flatMap(usesOf);

test('Scenario: A template renders - each pinned action is a full commit SHA followed by its version, the SHA of that release', () => {
  const found = new Set();
  ALL.filter((u) => PINS[u.action]).forEach((u) => {
    found.add(u.action);
    const pin = PINS[u.action];
    assert.equal(u.ref, pin.sha, `${u.file}:${u.line} ${u.action} is not pinned to the commit of ${pin.version}`);
    assert.equal(u.comment.trim(), pin.version, `${u.file}:${u.line} ${u.action} does not say its version`);
  });
  assert.deepEqual([...found].sort(), Object.keys(PINS).sort(), 'every action of the table is used by a template');
});

test('Scenario: A floating tag is introduced - no template uses a tag or a branch for these actions', () => {
  ALL.filter((u) => PINS[u.action]).forEach((u) => assert.match(u.ref, /^[0-9a-f]{40}$/, `${u.file}:${u.line} ${u.action}@${u.ref} is not a full commit SHA`));
});

test('no template uses an action that still runs on Node.js 20 (the ones that did are replaced)', () => {
  const old = [/actions\/checkout@v[1-4]\b/, /actions\/setup-node@v[1-4]\b/, /create-github-app-token@v[12]\b/, /supabase\/setup-cli@v[12]\b/];
  TEMPLATES.forEach((file) => old.forEach((re) => assert.doesNotMatch(text(file), re, `${file} has ${re}`)));
});

test('setup-node never turns on the automatic cache of npm, which would be saved after the agent', () => {
  ALL.filter((u) => u.action === 'actions/setup-node' && u.active).forEach((u) => {
    const lines = text(u.file).split('\n');
    const block = lines.slice(u.line - 1, u.line + 6).join('\n');
    assert.match(block, /package-manager-cache: false/, `${u.file}:${u.line} lacks package-manager-cache: false`);
  });
});

// ---------- The caches of the build job

const build = go.slice(go.indexOf('\n  build:'), go.indexOf('\n  requeue:'));
const at = (needle) => {
  const i = build.indexOf(needle);
  assert.ok(i !== -1, `the build job has no "${needle}"`);
  return i;
};

test('Scenario: Second run with the same pins - Bun and OpenSpec are cached under a key with the version, the system and the architecture', () => {
  assert.match(go, /\n  BUN_VERSION: '\d+\.\d+\.\d+'\n/, 'Bun has an exact version');
  assert.match(go, /\n  OPENSPEC_VERSION: '\d+\.\d+\.\d+'\n/);
  const keys = [...build.matchAll(/^\s+key: ([^\n]+)/gm)].map((m) => m[1]);
  assert.equal(keys.length, 4, 'a restore and a save for each of the two tools');
  keys.forEach((key) => {
    assert.match(key, /\$\{\{ env\.(BUN|OPENSPEC)_VERSION \}\}/, `the key ${key} has no pinned version`);
    assert.match(key, /\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}$/, `the key ${key} has no system and architecture`);
  });
  assert.equal(keys.filter((k) => k.startsWith('bun-')).length, 2);
  assert.equal(keys.filter((k) => k.startsWith('openspec-')).length, 2);
  assert.equal(new Set(keys).size, 2, 'the restore and the save of a tool share one key');
});

test('Scenario: A pin is raised - the install is the exact pinned version, and the cache of setup-bun is off', () => {
  assert.match(build, /bun-version: \$\{\{ env\.BUN_VERSION \}\}/);
  assert.match(build, /npm install --prefix "\$RUNNER_TEMP\/openspec" "@fission-ai\/openspec@\$OPENSPEC_VERSION"/);
  assert.match(build, /bun-version: [^\n]+\n\s+# [^\n]*\n\s+no-cache: true/, 'setup-bun would save its own cache when the job ends');
});

test('Scenario: A restored Bun reports another version - the job stops before the agent', () => {
  const check = build.slice(at('name: Check the version of Bun'), at('name: Save Bun to the cache'));
  assert.match(check, /actual=\$\("\$RUNNER_TEMP\/bun\/bun" --version\)/);
  assert.match(check, /\[ "\$actual" = "\$BUN_VERSION" \] \|\| \{ echo "::error::[^\n]*\$actual[^\n]*\$BUN_VERSION[^\n]*"; exit 1; \}/);
  assert.ok(at('name: Check the version of Bun') < at('id: agent'));
  assert.match(build, /path_to_bun_executable: \$\{\{ steps\.bun\.outputs\.path \}\}/);
});

test('Scenario: The cache is unavailable - a restore or a save that fails never fails the build, and an install runs without a hit', () => {
  ['Restore OpenSpec from the cache', 'Save OpenSpec to the cache', 'Restore Bun from the cache', 'Save Bun to the cache'].forEach((name) => {
    const start = at(`name: ${name}`);
    const step = build.slice(start, build.indexOf('\n\n', start));
    assert.match(step, /continue-on-error: true/, name);
  });
  assert.match(build, /name: Install Bun\n\s+id: bun_install\n\s+if: steps\.bun_cache\.outputs\.cache-hit != 'true'/);
  assert.match(build, /name: Save Bun to the cache\n\s+if: steps\.bun_cache\.outputs\.cache-hit != 'true'/);
  assert.match(build, /name: Save OpenSpec to the cache\n\s+if: steps\.openspec_cache\.outputs\.cache-hit != 'true'/);
});

test('Scenario: The agent changes a binary - every cache is restored and saved before the agent step starts', () => {
  const agent = at('id: agent');
  ['Restore OpenSpec from the cache', 'Install OpenSpec', 'Save OpenSpec to the cache', 'Restore Bun from the cache', 'Install Bun', 'Check the version of Bun', 'Save Bun to the cache'].forEach((name) => {
    assert.ok(at(`name: ${name}`) < agent, `${name} is after the agent`);
  });
  // Install, then save, in this order, for each tool.
  assert.ok(at('name: Restore OpenSpec from the cache') < at('name: Install OpenSpec') && at('name: Install OpenSpec') < at('name: Save OpenSpec to the cache'));
  assert.ok(at('name: Restore Bun from the cache') < at('name: Install Bun') && at('name: Install Bun') < at('name: Check the version of Bun') && at('name: Check the version of Bun') < at('name: Save Bun to the cache'));
  assert.ok(at('name: Save Bun to the cache') < at('name: Check the toolchain'));
});

test('Scenario: A template saves a cache late - no step that can save a cache comes after the agent', () => {
  TEMPLATES.filter((f) => f.startsWith('templates/workflows/')).forEach((file) => {
    const body = text(file);
    const agent = body.indexOf('uses: anthropics/claude-code-action');
    if (agent === -1) return;
    const after = body.slice(agent + 10).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    // Only run steps follow the agent: an action's post step is what would save a cache when the job ends.
    assert.doesNotMatch(after, /^\s+(?:- )?uses: (?!anthropics\/claude-code-action)/m, `${file} has an action after the agent`);
    assert.doesNotMatch(after, /actions\/cache|cache\/save/, file);
  });
  // The tools whose post step saves a cache are never given a cache input in an active step.
  ALL.filter((u) => u.active && ['actions/setup-node', 'oven-sh/setup-bun'].includes(u.action)).forEach((u) => {
    const block = text(u.file).split('\n').slice(u.line - 1, u.line + 8).join('\n').split(/\n\s*- /)[0];
    assert.doesNotMatch(block, /^\s+cache: /m, `${u.file}:${u.line}`);
  });
});

// ---------- Permissions

test('Scenario: Permissions of the jobs - actions: read in decide only, actions: write only where the queue is started', () => {
  const code = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const decide = code(go.slice(go.indexOf('\n  decide:'), go.indexOf('\n  build:')));
  assert.match(decide, /permissions:\n      contents: read\n      issues: write\n      pull-requests: read\n      actions: read\n/);
  assert.doesNotMatch(decide, /actions: write/);
  assert.doesNotMatch(code(build), /actions: (read|write)/, 'the job that runs the agent holds neither');
  const requeue = go.slice(go.indexOf('\n  requeue:'));
  assert.match(code(requeue), /actions: write/);
  // The workflows that start the queue (the queue itself, and ship after a merge) hold actions: write; no other one does.
  TEMPLATES.filter((f) => f.startsWith('templates/workflows/')).forEach((file) => {
    if (['relevo-go.yml', 'relevo-queue.yml', 'relevo-ship.yml'].some((name) => file.endsWith(name))) return;
    assert.doesNotMatch(text(file), /actions: write/, file);
  });
});
