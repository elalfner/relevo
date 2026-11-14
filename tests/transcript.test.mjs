import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { transcript, renderTranscript, MAX_ENTRIES, MAX_BYTES } from '../scripts/lib/transcript.mjs';

const root = new URL('../', import.meta.url).pathname;
const use = (id, name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } });
const res = (id, content) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
const LOG = [
  { type: 'system', subtype: 'init' },
  use('1', 'Bash', { command: 'npm test' }),
  res('1', '42 passed\nTOKEN=abc12345secretvalue'),
  use('2', 'Read', { file_path: 'src/app.js' }),
  res('2', [{ type: 'text', text: 'const a = 1;' }]),
  { type: 'result', subtype: 'success', num_turns: 2 },
];

test('Scenario: Run cancelled at the time limit - commands only, no results', () => {
  const out = renderTranscript(JSON.stringify(LOG));
  assert.match(out, /\$ Bash: npm test/);
  assert.match(out, /\$ Read: src\/app\.js/);
  assert.doesNotMatch(out, /42 passed|const a/);
  assert.doesNotMatch(out, /^ {2}>/m);
});

test('Scenario: Output on - the first part of each result is added, redacted', () => {
  const out = renderTranscript(JSON.stringify(LOG), { results: true });
  assert.match(out, /> 42 passed/);
  assert.match(out, /> const a = 1;/);
  assert.ok(!out.includes('abc12345secretvalue'), out);
});

test('a result is cut to its first characters', () => {
  const log = [use('1', 'Bash', { command: 'cat big' }), res('1', 'x'.repeat(2000))];
  const line = transcript(JSON.stringify(log), { results: true }).lines[1];
  assert.ok(line.length < 320, String(line.length));
  assert.ok(line.endsWith('…'));
});

test('a secret in a command never appears, whether or not it has a known shape', () => {
  const log = [use('1', 'Bash', { command: 'curl -u me:s3cr3t-value-123456 https://x && echo ghp_16C7e42F292c6912E7710c838347Ae178B4a' })];
  const out = renderTranscript(JSON.stringify(log), { secrets: ['s3cr3t-value-123456'] });
  assert.ok(!out.includes('s3cr3t-value-123456'));
  assert.ok(!out.includes('ghp_16C7e42F292c6912E7710c838347Ae178B4a'));
});

test('it accepts JSON lines and a single object, and drops what it does not understand', () => {
  const lines = [JSON.stringify(use('1', 'Bash', { command: 'ls' })), 'not json', JSON.stringify({ weird: true }), JSON.stringify(use('2', 'Bash', { command: 'pwd' }))].join('\n');
  assert.deepEqual(transcript(lines).lines, ['$ Bash: ls', '$ Bash: pwd']);
  assert.deepEqual(transcript(JSON.stringify(use('1', 'Bash', { command: 'ls' }))).lines, ['$ Bash: ls']);
});

test('Scenario: The log is missing - an empty or unreadable log says nothing', () => {
  ['', '   ', 'garbage', '[]', '{}', undefined, null].forEach((t) => {
    assert.equal(renderTranscript(t), '');
    assert.equal(transcript(t).kept, 0);
  });
});

test('only the last entries are kept, and the head says how many were left out', () => {
  const log = Array.from({ length: MAX_ENTRIES + 50 }, (_, i) => use(String(i), 'Bash', { command: `cmd-${i}` }));
  const t = transcript(JSON.stringify(log));
  assert.equal(t.total, MAX_ENTRIES + 50);
  assert.equal(t.kept, MAX_ENTRIES);
  assert.equal(t.lines.at(-1), `$ Bash: cmd-${MAX_ENTRIES + 49}`);
  assert.match(renderTranscript(JSON.stringify(log)), /^\(the last 200 of 250 entries\)/);
});

test('the size is bounded and the end of the run is kept', () => {
  const log = Array.from({ length: MAX_ENTRIES }, (_, i) => use(String(i), 'Bash', { command: `${i}-${'y'.repeat(480)}` }));
  const out = renderTranscript(JSON.stringify(log));
  assert.ok(Buffer.byteLength(out) <= MAX_BYTES + 100);
  assert.match(out, new RegExp(`${MAX_ENTRIES - 1}-y`));
});

test('an input that is not a command or a path is left out', () => {
  const log = [use('1', 'Write', { file_path: 'a.txt', content: 'password=hunter2hunter2' })];
  assert.deepEqual(transcript(JSON.stringify(log)).lines, ['$ Write: a.txt']);
});

test('the script reads the secrets from the environment, prints the summary and always exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-transcript-'));
  const file = join(dir, 'exec.json');
  writeFileSync(file, JSON.stringify([use('1', 'Bash', { command: 'echo my-private-value-1' })]));
  const run = (args, env = {}) => spawnSync('node', [`${root}scripts/transcript.mjs`, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const out = run(['--file', file], { RELEVO_REDACT: 'my-private-value-1' });
  assert.equal(out.status, 0);
  assert.ok(!out.stdout.includes('my-private-value-1'));
  assert.equal(run(['--file', file, '--summary']).stdout.trim(), '1 of 1');
  const missing = run(['--file', join(dir, 'nope.json')]);
  assert.equal(missing.status, 0);
  assert.equal(missing.stdout, '');
});
