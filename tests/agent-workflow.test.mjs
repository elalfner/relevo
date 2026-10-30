import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BLOCKS, agentWorkflow, blockRange, blocksOf, restrictedLines, withRestricted } from '../scripts/lib/agent-workflow.mjs';
import { BASE_PATTERNS, restrictedList } from '../scripts/lib/restricted-paths.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const go = read('templates/workflows/relevo-go.yml');
const queue = read('templates/workflows/relevo-queue.yml');
const blocks = read('templates/agents/antigravity-step.yml');

test('the shared workflow marks the credential and the agent step once each, and the queue marks the credential', () => {
  const lines = go.split('\n');
  for (const name of BLOCKS) assert.ok(blockRange(lines, name), `relevo-go.yml marks ${name}`);
  assert.ok(blockRange(queue.split('\n'), 'credential'));
  assert.equal(blockRange(queue.split('\n'), 'agent-step'), null);
});

test('a block that is repeated, unbalanced or reversed is an error', () => {
  assert.throws(() => blockRange(['# relevo:agent-step begin', 'x'], 'agent-step'), /one begin line followed by one end line/);
  assert.throws(() => blockRange(['# relevo:credential end', '# relevo:credential begin'], 'credential'), /followed by one end/);
  assert.throws(() => blockRange(['# relevo:credential begin', '# relevo:credential end', '# relevo:credential begin', '# relevo:credential end'], 'credential'), /one begin/);
});

test('Scenario: One source - Claude is the workflow as it is, and Antigravity differs only inside the marked blocks', () => {
  assert.equal(agentWorkflow(go, 'claude', blocks), go);
  assert.equal(agentWorkflow(go, undefined, blocks), go);
  const out = agentWorkflow(go, 'antigravity', blocks);
  assert.notEqual(out, go);
  const strip = (text) => {
    const lines = text.split('\n');
    for (const name of BLOCKS) {
      const r = blockRange(lines, name);
      if (r) lines.splice(r.begin + 1, r.end - r.begin - 1);
    }
    return lines.join('\n');
  };
  assert.equal(strip(out), strip(go), 'outside the blocks the two workflows are the same text');
  assert.equal(strip(agentWorkflow(queue, 'antigravity', blocks)), strip(queue));
  for (const name of BLOCKS) assert.deepEqual(blocksOf(out)[name], blocksOf(blocks)[name], `${name} is the one of the agent`);
});

test('Scenario: Reading the workflow - the Antigravity step shows the allow list, the guard, the timeout and the secret name, and no key', () => {
  const out = agentWorkflow(go, 'antigravity', blocks);
  assert.ok(!out.includes('anthropics/claude-code-action'), 'the Claude action is gone');
  assert.ok(!/ANTHROPIC_API_KEY\s*!=|CLAUDE_CODE_OAUTH_TOKEN\s*!=/.test(blocksOf(blocks).credential.join('\n')));
  assert.match(out, /HAS_CREDENTIAL: \$\{\{ secrets\.GEMINI_API_KEY != '' \}\}/);
  assert.match(out, /GEMINI_API_KEY: \$\{\{ secrets\.GEMINI_API_KEY \}\}/);
  assert.match(out, /sha512sum --check --strict -/);
  assert.match(out, /agent-guard\.mjs" settings --platform "\$PLATFORM"/);
  assert.match(out, /agent-guard\.mjs" run[\s\S]*--config relevo\.yml --timeout-minutes 50/);
  assert.match(out, /init --tools antigravity --scope machine --yes/);
  const active = out.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(!/\bAIza[0-9A-Za-z_-]{20,}/.test(active), 'no key written in the file');
  const run = active.slice(active.indexOf('agent-guard.mjs" run'));
  assert.ok(!run.slice(0, run.indexOf('--summary')).includes('${{'), 'the prompt is built from variables, not from expressions');
});

test('the shell of the agent step uses the variables the env sets, and the binary is pinned by version and checksum', () => {
  const step = blocksOf(blocks)['agent-step'].join('\n');
  assert.match(step, /AGY_VERSION: '\d+\.\d+\.\d+'/);
  assert.match(step, /AGY_SHA512: [0-9a-f]{128}/);
  assert.match(step, /AGY_URL: https:\/\/storage\.googleapis\.com\/antigravity-public\/antigravity-cli\/\d+\.\d+\.\d+-/);
  assert.match(step, /\[ "\$\("\$RUNNER_TEMP\/bin\/agy" --version\)" = "\$AGY_VERSION" \]/);
  assert.match(step, /ISSUE: \$\{\{ github\.event\.issue\.number \|\| inputs\.issue \}\}/);
  assert.match(step, /--prompt "\/relevo:go \$ISSUE --decision \$DECISION"/);
});

test('a marked block that the agent does not define, or an agent with no file, is an error', () => {
  assert.throws(() => agentWorkflow(go, 'antigravity', '# relevo:credential begin\nx\n# relevo:credential end\n'), /does not define the block "agent-step"/);
  assert.throws(() => agentWorkflow(go, 'antigravity', ''), /no file of blocks/);
});

test('Scenario: Antigravity settings - the CLI, the plugin and the settings live in a home folder of the job', () => {
  const step = blocksOf(blocks)['agent-step'].join('\n');
  assert.match(step, /echo "HOME=\$RUNNER_TEMP\/home" >> "\$GITHUB_ENV"/);
  assert.match(step, /install -m 0755 "\$RUNNER_TEMP\/antigravity" "\$RUNNER_TEMP\/bin\/agy"/);
  assert.doesNotMatch(step.replace(/^\s*#.*$/gm, ''), /\$HOME\/\.local/, 'nothing is installed in the home folder of the runner user');
});

// ---------- restricted files

/** The `settings` input between the `relevo:restricted` markers, parsed. */
function restrictedSettings(text) {
  const lines = text.split('\n');
  const r = blockRange(lines, 'restricted');
  assert.ok(r, 'the workflow marks the restricted block');
  const body = lines.slice(r.begin + 1, r.end);
  const at = body.findIndex((l) => /^\s+settings: \|$/.test(l));
  assert.ok(at !== -1, 'the block carries the settings input');
  const indent = /^\s*/.exec(body[at + 1])[0].length;
  return JSON.parse(body.slice(at + 1).map((l) => l.slice(indent)).join('\n'));
}

test('Scenario: The cloud sandbox is not enabled by default - the Read denials and the sandbox read denials are written, sandbox.enabled is not, and the example file is not among them', () => {
  const settings = restrictedSettings(agentWorkflow(go, 'claude', blocks));
  const deny = settings.permissions.deny;
  assert.ok(deny.includes('Read(**/.env)') && deny.includes('Read(**/.env.production)') && deny.includes('Read(**/*.pem)'));
  const read = settings.sandbox.filesystem.denyRead;
  assert.ok(read.includes('**/.env') && read.includes('**/*.pem'));
  assert.equal(settings.sandbox.enabled, undefined, 'the sandbox is not switched on in the cloud');
  assert.equal(settings.sandbox.failIfUnavailable, undefined);
  assert.ok(!/^\s*sandbox:\s*$/m.test(go.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')), 'no sandbox key outside the settings input');
  [...deny, ...read].forEach((rule) => assert.ok(!rule.includes('example'), `${rule} does not name the example file`));
  assert.ok(![...deny, ...read].some((rule) => /\.env\.\*(?!\.local)/.test(rule)), 'no glob that would cover .env.example');
});

test('the template carries the block as the renderer writes it from the base list', () => {
  assert.equal(withRestricted(go, BASE_PATTERNS), go, 'the committed block is the rendering of the base list');
  assert.equal(withRestricted(go), go);
  assert.equal(withRestricted(queue, BASE_PATTERNS), queue, 'a workflow without the markers is left as it is');
});

test('Scenario: The list changes - an entry of restricted_paths shows in the next render of the Claude workflow, and goes away with it', () => {
  const list = restrictedList({ restricted_paths: ['infra/prod.tfvars', '*.secret'] });
  const out = withRestricted(go, list);
  const settings = restrictedSettings(out);
  assert.ok(settings.permissions.deny.includes('Read(/${{ github.workspace }}/infra/prod.tfvars)'));
  assert.ok(settings.permissions.deny.includes('Read(**/*.secret)'));
  assert.ok(settings.sandbox.filesystem.denyRead.includes('**/*.secret'));
  assert.equal(withRestricted(out, BASE_PATTERNS), go, 'rendering again from the base list restores the template: the block is written, not merged');
  assert.deepEqual(out.split('\n').filter((l) => !restrictedLines(list).includes(l)).join('\n'), withRestricted(go, []).split('\n').filter((l) => !restrictedLines([]).includes(l)).join('\n'), 'nothing outside the block changes');
});

test('Scenario: Reading the Antigravity workflow - it has no Claude settings, and its denials come from the settings file the run writes', () => {
  const out = agentWorkflow(go, 'antigravity', blocks);
  assert.ok(!out.includes('relevo:restricted') && !out.includes('Read(**/'), 'the Claude block is gone with the Claude step');
  assert.equal(withRestricted(out, restrictedList({ restricted_paths: ['x.secret'] })), out, 'rendering the list changes nothing for this agent');
  assert.match(blocks, /read_file for each restricted file that exists in the tree, by exact path/, 'the step says what its denial is, and what it is not');
  assert.match(blocks, /the shell is not covered for this agent/);
});

test('the denials are written outside the repository (the settings input of the action) and no ignore file is relied on', () => {
  const active = go.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(`${active}${blocks}`, /\.claudeignore|\.claudecode\.json/);
});
