import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chooseBase, conflictsOf, distance, pinOf, planUpgrades, publishedTemplates, stampOf, unifiedDiff, upgradeWorkflow } from '../scripts/lib/workflow-upgrade.mjs';
import { runnerLine } from '../scripts/lib/init.mjs';
import { withRestricted } from '../scripts/lib/agent-workflow.mjs';
import { restrictedList } from '../scripts/lib/restricted-paths.mjs';

// Implements the scenarios of "Init updates a workflow by a three-way merge", "A merged workflow is written only when
// clean and confirmed" and "The pin and the stamp are set, not merged".
const root = new URL('../', import.meta.url).pathname;
const render = (labels) => (template) => runnerLine(template, labels);
const plain = render(undefined);

const tpl = (version, { install = 'npm install --global openspec', extra = '' } = {}) => `# relevo-template: ${version}
# Relevo: a test workflow.

env:
  RELEVO_VERSION: '${version}'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo one
      # relevo:credential begin
          anthropic_api_key: KEY
          # token: TOKEN
      # relevo:credential end
      - run: ${install}
${extra}      - run: echo last
`;
const V1 = tpl('0.5.0');
const V2 = tpl('0.7.0', { install: 'npm install --global openspec@1' });
const V3 = tpl('0.9.0', { install: 'npm install --prefix "$T" openspec@2', extra: '      - run: echo cleanup\n' });
const candidates = [{ version: '0.5.0', template: V1 }, { version: '0.7.0', template: V2 }];
const current = { template: V3 };
// The person's own choices: the token instead of the key, another runner, and the pin raised by hand.
const own = (text, { pin = '0.7.0', labels = '[self-hosted, linux-build]' } = {}) => text
  .replace('          anthropic_api_key: KEY\n          # token: TOKEN', '          # anthropic_api_key: KEY\n          token: TOKEN')
  .replace('runs-on: ubuntu-latest', `runs-on: ${labels}`)
  .replace(/RELEVO_VERSION: '[^']+'/, `RELEVO_VERSION: '${pin}'`);

test('Scenario: A clean merge - the 0.5.0 text with the person\'s choices becomes the new text and keeps the choices', () => {
  const r = upgradeWorkflow({ ours: own(V1), current, candidates, render: plain });
  assert.equal(r.status, 'update');
  assert.equal(r.from, '0.5.0');
  assert.equal(r.to, '0.9.0');
  assert.match(r.text, /^ {10}token: TOKEN$/m, 'the credential choice is kept');
  assert.match(r.text, /runs-on: \[self-hosted, linux-build\]/);
  assert.match(r.text, /echo cleanup/, 'the new text is there');
  assert.match(r.text, /openspec@2/);
});

test('Scenario: The pin was raised by hand - the base is the text, the pin and the stamp read the current version, no conflict', () => {
  const ours = own(V1, { pin: '0.7.0' });
  assert.equal(pinOf(ours), '0.7.0');
  assert.equal(stampOf(ours), '0.5.0');
  const r = upgradeWorkflow({ ours, current, candidates, render: plain });
  assert.equal(r.status, 'update', 'the person\'s pin does not conflict with the release');
  assert.equal(r.from, '0.5.0', 'the base follows the text, not the pin');
  assert.equal(pinOf(r.text), '0.9.0');
  assert.equal(stampOf(r.text), '0.9.0');
});

test('Scenario: The settings of the repository - the runner of relevo.yml is the same on both sides and raises nothing', () => {
  const labels = ['self-hosted', 'linux-build'];
  const r = upgradeWorkflow({ ours: own(V1), current, candidates, render: render(labels) });
  assert.equal(r.status, 'update');
  assert.equal((r.text.match(/runs-on: \[self-hosted, linux-build\]/g) ?? []).length, 1);
});

test('Scenario: A conflict - a line both sides changed writes nothing and shows both versions', () => {
  const ours = own(V1).replace('npm install --global openspec', 'npm install --global openspec --loglevel error');
  const r = upgradeWorkflow({ ours, current, candidates, render: plain });
  assert.equal(r.status, 'conflict');
  assert.equal(r.text, undefined, 'there is no text to write');
  assert.equal(r.conflicts.length, 1);
  assert.match(r.conflicts[0].yours, /--loglevel error/);
  assert.match(r.conflicts[0].theirs, /openspec@2/);
});

test('Scenario: A file that is current - the merge gives the file as it is', () => {
  assert.deepEqual(upgradeWorkflow({ ours: V3, current, candidates: [...candidates, { version: '0.9.0', template: V3 }], render: plain }), { status: 'current' });
});

test('Scenario: No base is close enough - nothing is merged, and --from names the base', () => {
  const stranger = Array.from({ length: 60 }, (_, i) => `line ${i} of another workflow`).join('\n');
  assert.deepEqual(upgradeWorkflow({ ours: stranger, current, candidates, render: plain }), { status: 'nobase' });
  const forced = upgradeWorkflow({ ours: stranger, current, candidates, from: '0.5.0', render: plain });
  assert.notEqual(forced.status, 'nobase', 'the person named the base');
  assert.equal(upgradeWorkflow({ ours: V1, current, candidates, from: '9.9.9', render: plain }).status, 'nobase', 'an unknown version is no base');
});

test('the closest published text is the base, and the newest among equals', () => {
  const rendered = (list) => list.map((c) => ({ ...c, rendered: c.template }));
  assert.equal(chooseBase(V2, rendered(candidates)).version, '0.7.0');
  assert.equal(chooseBase(V1, rendered(candidates)).version, '0.5.0');
  const same = rendered([{ version: '0.5.0', template: V1 }, { version: '0.6.0', template: V1 }]);
  assert.equal(chooseBase(V1, same).version, '0.6.0', 'a tie goes to the newest');
  assert.equal(distance(V1, V1.replace("'0.5.0'", "'0.8.0'").replace('# relevo-template: 0.5.0', '# relevo-template: 0.8.0')), 0, 'the pin and the stamp do not count');
});

test('a merge that lost a marker the template has is not safe, whatever git says', () => {
  const broken = { status: 0, stdout: V3.replace('      # relevo:credential end\n', '') };
  const r = upgradeWorkflow({ ours: own(V1), current, candidates, render: plain, merge: () => broken });
  assert.equal(r.status, 'conflict');
  assert.match(r.message, /not safe: the block "credential"/);
  const twice = upgradeWorkflow({ ours: own(V1), current, candidates, render: plain, merge: () => ({ status: 0, stdout: `${V3}\nenv:\n  RELEVO_VERSION: '0.9.0'\n` }) });
  assert.match(twice.message, /exactly one RELEVO_VERSION/);
});

test('the exit status of git merge-file: 1 to 127 are conflicts, anything else is an error and writes nothing', () => {
  const run = (status) => upgradeWorkflow({ ours: own(V1), current, candidates, render: plain, merge: () => ({ status, stdout: '<<<<<<< a\nx\n=======\ny\n>>>>>>> b\n' }) });
  assert.equal(run(1).status, 'conflict');
  assert.equal(run(127).status, 'conflict');
  assert.equal(run(255).status, 'error');
  assert.equal(run(128).status, 'error');
  assert.deepEqual(conflictsOf('<<<<<<< a\nx\n=======\ny\n>>>>>>> b\nrest\n<<<<<<< a\n1\n=======\n2\n>>>>>>> b\n'), [{ yours: 'x', theirs: 'y' }, { yours: '1', theirs: '2' }]);
});

test('the real go template: the text of 0.5.0 with a token, a runner and a pin of its own becomes the current text plus those choices', () => {
  const now = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
  // What 0.5.0 had that the current template replaced: a global install of OpenSpec, no cleanup step, no stamp.
  const install = /        # Under the temporary folder[^\n]*\n        run: \|\n[^\n]*\n[^\n]*\n/;
  assert.match(now, install);
  const old = now.replace(install, '        run: npm install --global @fission-ai/openspec\n')
    .replace(/\n      # A runner may keep its workspace[\s\S]*?rm -rf \.relevo-plugin\n/g, '\n')
    .replace(/^# relevo-template: .*\n/, '').replace(/RELEVO_VERSION: '[^']+'/, "RELEVO_VERSION: '0.5.0'").replace(/\n  # The version of OpenSpec that the job installs for itself\.\n  OPENSPEC_VERSION: '[^']+'/, '');
  const ours = old.replace('          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}', '          # anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}')
    .replace('          # claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}', '          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}')
    .replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, linux-build]').replace("RELEVO_VERSION: '0.5.0'", "RELEVO_VERSION: '0.7.0'");
  const r = upgradeWorkflow({ ours, current: { template: now }, candidates: [{ version: '0.5.0', template: old }], render: render(['self-hosted', 'linux-build']) });
  assert.equal(r.status, 'update', JSON.stringify(r.conflicts));
  const expected = runnerLine(now, ['self-hosted', 'linux-build'])
    .replace('          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}', '          # anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}')
    .replace('          # claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}', '          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}');
  assert.equal(r.text, expected, 'the current text plus the person\'s three choices, and nothing else');
  assert.match(unifiedDiff(ours, r.text), /^[+-]/m, 'the plan has a difference to show');
});

test('the published templates are fetched with npm, once per version, and a version without the file is skipped', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'npm' && args[0] === 'view') return JSON.stringify(['0.0.0', '0.0.0-stage', '0.3.0', '0.5.0']);
    if (cmd === 'npm' && args[0] === 'pack' && args[1].endsWith('@0.3.0')) throw new Error('no such version');
    return '';
  };
  const tmp = mkdtempSync(join(tmpdir(), 'relevo-published-test-'));
  const source = publishedTemplates({ exec, tmp });
  assert.deepEqual(source.versions(), ['0.3.0', '0.5.0'], 'a prerelease and 0.0.0 are not candidates');
  assert.equal(source.read('0.3.0', 'templates/workflows/relevo-go.yml'), null);
  assert.equal(source.read('0.5.0', 'templates/workflows/relevo-go.yml'), null, 'a file the package lacks is null');
  source.read('0.5.0', 'templates/workflows/relevo-sla.yml');
  assert.equal(calls.filter((c) => c.startsWith('npm pack') && c.includes('@0.5.0')).length, 1, 'packed once');
  rmSync(tmp, { recursive: true, force: true });
});

test('planUpgrades gives a state only for the files that exist', () => {
  const source = { versions: () => ['0.5.0'], read: (v, path) => (path.endsWith('relevo-go.yml') ? V1 : null) };
  const out = planUpgrades({ files: ['relevo-go.yml', 'relevo-sla.yml'], ours: { 'relevo-go.yml': own(V1), 'relevo-sla.yml': null }, templates: { 'relevo-go.yml': V3, 'relevo-sla.yml': V3 }, agentBlocks: null, labels: undefined, build: 'claude', source });
  assert.deepEqual(Object.keys(out), ['relevo-go.yml']);
  assert.equal(out['relevo-go.yml'].status, 'update');
});

test('Scenario: The list changes - a workflow with the old restricted block is updated to the block of the new list, with no conflict', () => {
  const go = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
  const before = restrictedList({});
  const after = restrictedList({ restricted_paths: ['infra/prod.tfvars'] });
  const ours = withRestricted(go, before);
  const source = { versions: () => ['0.5.0'], read: () => go };
  const out = planUpgrades({ files: ['relevo-go.yml'], ours: { 'relevo-go.yml': ours }, templates: { 'relevo-go.yml': go }, agentBlocks: null, labels: undefined, build: 'claude', source, restricted: after })['relevo-go.yml'];
  assert.equal(out.status, 'update');
  assert.equal(out.text, withRestricted(go, after), 'the block is written from the list, not merged');
  assert.match(out.text, /Read\(\/\$\{\{ github\.workspace \}\}\/infra\/prod\.tfvars\)/);
  const same = planUpgrades({ files: ['relevo-go.yml'], ours: { 'relevo-go.yml': withRestricted(go, after) }, templates: { 'relevo-go.yml': go }, agentBlocks: null, labels: undefined, build: 'claude', source, restricted: after })['relevo-go.yml'];
  assert.equal(same.status, 'current');
});

test('a merge that drops the relevo:restricted block is not safe to write', async () => {
  const { upgradeWorkflow } = await import('../scripts/lib/workflow-upgrade.mjs');
  const tpl = '# relevo-template: 0.1.0\nenv:\n  RELEVO_VERSION: \'0.1.0\'\n# relevo:restricted begin\nsettings: x\n# relevo:restricted end\n';
  const dropped = '# relevo-template: 0.1.0\nenv:\n  RELEVO_VERSION: \'0.1.0\'\n';
  const r = upgradeWorkflow({ ours: dropped, current: { version: '0.2.0', template: tpl, blocks: null }, candidates: [{ version: '0.1.0', template: dropped, blocks: null }], render: (t) => t, merge: () => ({ ok: true, text: dropped }) });
  assert.notEqual(r.status, 'update');
});
