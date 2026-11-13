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

// ---------- optional-agent-output: the agent output is shown redacted and a transcript is saved when a run ends abnormally
const goLines = go.split('\n');
const stepOf = (name) => {
  // The last match: the light `decide` job has a step with the same name as the one of `build`.
  const start = goLines.map((l, i) => (new RegExp(`^ {6}- (?:name: ${name}|id: ${name})\\s*$`).test(l) ? i : -1)).filter((i) => i !== -1).pop() ?? -1;
  assert.ok(start !== -1, `step "${name}" exists`);
  const rest = goLines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {6}(?:- |#)/.test(l));
  return goLines.slice(start, end === -1 ? undefined : start + 1 + end).join('\n');
};

test('Scenario: Output off - the template never sets the action\'s own show_full_output, which cannot be redacted', () => {
  const active = goLines.filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(active, /show_full_output\s*:/);
});

test('Scenario: Output turned on for one run - a manual start has a full_output boolean that is off by default', () => {
  assert.match(go, /full_output:\n\s+description: [^\n]+\n\s+required: false\n\s+default: false\n\s+type: boolean/);
});

test('the steps that print and prepare the transcript run whatever happened and never fail the job', () => {
  ['Show the agent output', 'Prepare the transcript'].forEach((name) => {
    const step = stepOf(name);
    assert.match(step, /if: always\(\)/, name);
    assert.match(step, /continue-on-error: true/, name);
    assert.match(step, /exit 0\s*$/, name);
  });
});

test('Scenario: The rendering is printed only when the decision says so, in a log group', () => {
  const step = stepOf('Show the agent output');
  assert.match(step, /run-output\.mjs --config relevo\.yml --input "\$INPUT_FULL_OUTPUT"/);
  assert.match(step, /if \[ "\$\(field output\)" = "true" \] && \[ -n "\$EXECUTION_FILE" \]/);
  assert.match(step, /::group::[^\n]*redacted/);
  assert.match(step, /transcript\.mjs --file "\$EXECUTION_FILE" --results/);
});

test('the input of a manual start reaches the script through the environment, not through the shell text', () => {
  const step = stepOf('Show the agent output');
  assert.match(step, /INPUT_FULL_OUTPUT: \$\{\{ inputs\.full_output \}\}/);
  assert.ok(!/run: \|[\s\S]*\$\{\{ inputs\./.test(step.slice(step.indexOf('run: |'))), 'no expression inside the script text');
});

test('the secrets of the job are given to the redactor, and results only when the full output is on', () => {
  [stepOf('Show the agent output'), stepOf('Prepare the transcript')].forEach((step) => {
    assert.match(step, /RELEVO_REDACT: \|/);
    assert.match(step, /secrets\.ANTHROPIC_API_KEY/);
    assert.match(step, /secrets\.CLAUDE_CODE_OAUTH_TOKEN/);
    assert.match(step, /github\.token/);
  });
  const prepare = stepOf('Prepare the transcript');
  assert.match(prepare, /\[ "\$RESULTS" = "true" \] && flag="--results"/);
  assert.match(prepare, /\[ "\$ALLOWED" = "true" \]/, 'nothing is written for trust public');
});

test('Scenario: Run cancelled at the time limit - the transcript is uploaded for an abnormal end and for no other', () => {
  const upload = stepOf('Save the transcript');
  assert.match(upload, /if: always\(\) && steps\.transcript\.outputs\.saved == 'true' && \(steps\.no_outcome\.outputs\.reported == 'true' \|\| job\.status != 'success'\)/);
  assert.match(upload, /uses: actions\/upload-artifact@v4/);
  assert.match(upload, /retention-days: 7/);
  assert.match(upload, /continue-on-error: true/);
});

test('the transcript is prepared before the comment that links it, and uploaded before the progress report closes', () => {
  const at = (name) => goLines.map((l, i) => (l.includes(`name: ${name}`) ? i : -1)).filter((i) => i !== -1).pop();
  assert.ok(at('Prepare the transcript') < at('Report a run that ended without an outcome'));
  assert.ok(at('Report a run that ended without an outcome') < at('Save the transcript'));
  assert.ok(at('Save the transcript') < at('Stop the progress report'));
});

test('the comment of a run without an outcome says whether a transcript exists and where', () => {
  const step = stepOf('Report a run that ended without an outcome');
  assert.match(step, /TRANSCRIPT_SAVED: \$\{\{ steps\.transcript\.outputs\.saved \}\}/);
  assert.match(step, /artifact \\`relevo-transcript\\`/);
  assert.match(step, /No transcript of the agent was saved/);
});

test('the new steps change no permission of the job and need no new script outside the package check', () => {
  const build = go.slice(go.indexOf('  build:'));
  assert.match(build, /permissions:\n {6}contents: write\n {6}issues: write\n {6}pull-requests: read/);
  assert.match(go, /for f in scripts\/run-usage\.mjs scripts\/usage-limit\.mjs scripts\/transcript\.mjs scripts\/run-output\.mjs; do/);
});
