import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BLOCKS, agentWorkflow, blockRange, blocksOf } from '../scripts/lib/agent-workflow.mjs';

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
