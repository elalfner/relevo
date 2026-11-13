import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksFromReceipt, limitReset, replicaReasonsFromJson, withReplicaReasons, limitsExceeded, parseUsageMarker, quotaOf, reachedUsageLimit, readUsage, runnerCut, sumUsage, usageLine, usageMarker } from '../scripts/lib/run-usage.mjs';

const dir = mkdtempSync(join(tmpdir(), 'relevo-usage-'));
const write = (name, text) => { writeFileSync(join(dir, name), text); return join(dir, name); };
const result = { type: 'result', subtype: 'success', num_turns: 37, total_cost_usd: 1.8234, usage: { input_tokens: 90000, output_tokens: 33000 } };
const ARRAY = JSON.stringify([{ type: 'system' }, { type: 'assistant', message: 'x' }, result]);
const LINES = [{ type: 'system' }, result].map((e) => JSON.stringify(e)).join('\n');
const CLI = (script) => new URL(`../scripts/${script}`, import.meta.url).pathname;

test('Scenario: Log with usage - turns, cost and tokens are read from a JSON array, from JSON lines and from a single object', () => {
  const expected = { turns: 37, cost: 1.8234, tokens: 123000, cached: null };
  assert.deepEqual(readUsage(ARRAY), expected);
  assert.deepEqual(readUsage(LINES), expected);
  assert.deepEqual(readUsage(JSON.stringify(result)), expected);
  assert.equal(usageLine(readUsage(ARRAY)), 'This run used 37 turns, about $1.82, 123,000 tokens.');
});

test('the last result wins, and a result without tokens or cost still reports the turns', () => {
  const two = JSON.stringify([result, { type: 'result', num_turns: 1 }]);
  assert.equal(usageLine(readUsage(two)), 'This run used 1 turn.');
  assert.deepEqual(readUsage(JSON.stringify([{ type: 'result', usage: { output_tokens: 5 } }])), { turns: null, cost: null, tokens: 5, cached: null });
});

test('Scenario: Log without usage - missing, empty, garbled or without a result gives nothing', () => {
  ['', '   ', 'not json at all', JSON.stringify([{ type: 'assistant' }]), JSON.stringify({ type: 'result' }), null, undefined].forEach((t) => {
    assert.equal(readUsage(t), null);
    assert.equal(usageLine(readUsage(t)), '');
  });
});

test('with a subscription the cost is said to be notional', () => {
  assert.match(usageLine(readUsage(ARRAY), { subscription: true }), /about \$1\.82 \(notional: a subscription is not billed per run\)/);
});

test('run-usage.mjs prints the line, prints nothing for an unreadable file, and always exits 0', () => {
  const ok = spawnSync('node', [CLI('run-usage.mjs'), '--file', write('a.json', ARRAY), '--subscription'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /37 turns.*notional.*123,000 tokens/);
  const missing = spawnSync('node', [CLI('run-usage.mjs'), '--file', join(dir, 'nope.json')], { encoding: 'utf8' });
  assert.deepEqual([missing.status, missing.stdout], [0, '']);
  assert.deepEqual([spawnSync('node', [CLI('run-usage.mjs')], { encoding: 'utf8' }).status], [0]);
});

test('Scenario: Limit reached - the log of a failed run is recognised, in an array, in lines or as plain text', () => {
  assert.equal(reachedUsageLimit(JSON.stringify([{ type: 'result', is_error: true, result: 'Claude AI usage limit reached|1760000000' }])), true);
  assert.equal(reachedUsageLimit('Your credit balance is too low to access the Anthropic API'), true);
  assert.equal(reachedUsageLimit('429 rate_limit_error: this request would exceed your rate limit'), true);
  assert.equal(reachedUsageLimit('You exceeded your current quota'), true);
});

test('Scenario: Another failure - a log without such text is not a limit', () => {
  assert.equal(reachedUsageLimit(ARRAY), false);
  assert.equal(reachedUsageLimit('flutter analyze reported 3 errors'), false);
  assert.equal(reachedUsageLimit(''), false);
  assert.equal(reachedUsageLimit(undefined), false);
});

test('Scenario: Another failure - rate-limit events that report allowed are not a limit', () => {
  const log = [
    { type: 'system', subtype: 'init' },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour', utilization: 0.02 } },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', rateLimitType: 'five_hour', utilization: 0.01 } },
    { type: 'result', subtype: 'success', is_error: false, result: 'The shell failed', num_turns: 2 },
  ];
  assert.equal(reachedUsageLimit(JSON.stringify(log)), false);
  assert.equal(reachedUsageLimit(log.map((e) => JSON.stringify(e)).join('\n')), false);
});

test('Scenario: Limit reached - a rejected rate-limit event or an error result about a limit is recognised', () => {
  const rejected = [{ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour' } }];
  assert.equal(reachedUsageLimit(JSON.stringify(rejected)), true);
  const failed = [
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } },
    { type: 'result', is_error: true, result: 'You have reached your usage limit' },
  ];
  assert.equal(reachedUsageLimit(JSON.stringify(failed)), true);
  const notError = [{ type: 'result', is_error: false, result: 'I explained the usage limit of the API' }];
  assert.equal(reachedUsageLimit(JSON.stringify(notError)), false);
});

test('usage-limit.mjs exits 0 for a limit and 1 for anything else, including a missing file', () => {
  const run = (...args) => spawnSync('node', [CLI('usage-limit.mjs'), ...args], { encoding: 'utf8' }).status;
  assert.equal(run('--file', write('limit.txt', 'Claude AI usage limit reached')), 0);
  assert.equal(run('--file', write('fine.txt', 'all fine')), 1);
  assert.equal(run('--file', join(dir, 'missing')), 1);
  assert.equal(run(), 1);
});

test('tokens served from the prompt cache are reported apart, so a long run does not look tiny', () => {
  const log = JSON.stringify({ type: 'result', num_turns: 14, total_cost_usd: 0.43, usage: { input_tokens: 40, output_tokens: 5231, cache_read_input_tokens: 400000, cache_creation_input_tokens: 20000 } });
  assert.equal(readUsage(log).cached, 420000);
  assert.equal(usageLine(readUsage(log)), 'This run used 14 turns, about $0.43, 5,271 tokens (plus 420,000 from the cache).');
  assert.doesNotMatch(usageLine(readUsage(ARRAY)), /cache/, 'nothing about the cache when the log has none');
});

const figuresOf = (marker) => JSON.parse(/<!-- relevo:usage (\{.*\}) -->/.exec(marker)[1]);

test('Scenario: Log with usage - the marker carries the figures of the sentence, and says whether the cost is notional', () => {
  const usage = readUsage(ARRAY);
  assert.deepEqual(figuresOf(usageMarker(usage)), { turns: 37, cost: 1.8234, tokens: 123000, notional: false });
  assert.equal(figuresOf(usageMarker(usage, { subscription: true })).notional, true);
  const cached = readUsage(JSON.stringify({ type: 'result', num_turns: 2, usage: { output_tokens: 5, cache_read_input_tokens: 90 } }));
  assert.equal(figuresOf(usageMarker(cached)).cached, 90);
});

test('Scenario: Log with partial usage - what the log does not report is left out of the sentence and of the marker', () => {
  const usage = readUsage(JSON.stringify({ type: 'result', num_turns: 4 }));
  assert.equal(usageLine(usage), 'This run used 4 turns.');
  assert.deepEqual(figuresOf(usageMarker(usage)), { turns: 4, notional: false });
  assert.equal(usageMarker(null), '');
});

test('Scenario: Log without usage - no marker, and run-usage.mjs prints nothing', () => {
  assert.equal(usageMarker(readUsage('not json')), '');
  const none = spawnSync('node', [CLI('run-usage.mjs'), '--file', write('empty.json', JSON.stringify([{ type: 'assistant' }]))], { encoding: 'utf8' });
  assert.deepEqual([none.status, none.stdout], [0, '']);
});

test('run-usage.mjs prints the sentence, a blank line and the marker, with notional true under a subscription', () => {
  const run = (...flags) => spawnSync('node', [CLI('run-usage.mjs'), '--file', write('b.json', ARRAY), ...flags], { encoding: 'utf8' });
  const [sentence, blank, marker, ...rest] = run().stdout.split('\n');
  assert.match(sentence, /^This run used 37 turns/);
  assert.equal(blank, '');
  assert.deepEqual(figuresOf(marker), { turns: 37, cost: 1.8234, tokens: 123000, notional: false });
  assert.deepEqual(rest, ['']);
  assert.equal(figuresOf(run('--subscription').stdout).notional, true);
});

const comment = (body, extra = {}) => ({ user: { type: 'Bot' }, created_at: '2026-03-10T10:00:00Z', body, ...extra });
const M = (o) => `This run used 1 turn.\n\n<!-- relevo:usage ${JSON.stringify(o)} -->`;

test('Scenario: Digest with usage - the marker of a comment of a bot is read back with its date', () => {
  assert.deepEqual(parseUsageMarker(comment(M({ turns: 3, cost: 0.5, tokens: 100, notional: true }))), { created_at: '2026-03-10T10:00:00Z', notional: true, turns: 3, cost: 0.5, tokens: 100 });
  assert.equal(parseUsageMarker(comment(M({ turns: 0, cost: 0 }))).cost, 0, 'a zero is a figure');
  assert.equal(parseUsageMarker(comment(usageMarker(readUsage(ARRAY)))).turns, 37, 'what the script writes is what the digest reads');
});

test('Scenario: Runs without a marker - a person, a malformed marker, two markers or a string for a number count for nothing', () => {
  assert.equal(parseUsageMarker(comment(M({ turns: 3 }), { user: { type: 'User' } })), null, 'a person typed it');
  assert.equal(parseUsageMarker({ body: M({ turns: 3 }) }), null, 'no author');
  assert.equal(parseUsageMarker(comment('This run used 3 turns, about $0.50.')), null, 'the sentence alone is never read');
  assert.equal(parseUsageMarker(comment('<!-- relevo:usage {"turns": -->')), null);
  assert.equal(parseUsageMarker(comment('<!-- relevo:usage [1,2] -->')), null);
  assert.equal(parseUsageMarker(comment(`${M({ turns: 3 })}\n${M({ turns: 4 })}`)), null);
  assert.equal(parseUsageMarker(comment(M({ turns: '3' }))), null);
  assert.equal(parseUsageMarker(comment(M({ notional: true }))), null, 'no figure at all');
  assert.equal(parseUsageMarker(comment(null)), null);
});

test('sumUsage adds the figures over the runs that report each, and counts the notional costs', () => {
  const runs = [
    { turns: 10, cost: 1, tokens: 100, notional: true },
    { turns: 20, cost: 2, notional: true },
    { turns: 5, notional: false },
  ];
  assert.deepEqual(sumUsage(runs), { runs: 3, turns: 35, cost: 3, tokens: 100, costRuns: 2, notionalRuns: 2 });
  assert.deepEqual(sumUsage([{ turns: 1, cost: 0.5, notional: false }, { turns: 1, cost: 0.5, notional: true }]).notionalRuns, 1);
  assert.deepEqual(sumUsage([{ turns: 1, notional: false }]), { runs: 1, turns: 1, cost: null, tokens: null, costRuns: 0, notionalRuns: 0 });
  assert.equal(sumUsage([]).runs, 0);
});

// ---- the turns of the subagents (specialist-review-lenses, task 9.1)
const lensNotice = (calls) => ({ type: 'system', subtype: 'task_notification', status: 'completed', usage: { total_tokens: 3000, tool_uses: calls, duration_ms: 5000 } });
const WITH_LENSES = JSON.stringify([{ type: 'system' }, lensNotice(3), lensNotice(0), { ...result, num_turns: 90 }]);

test('Scenario: Lenses use turns - the turns of the subagents are added to those of the run, and the sentence says so', () => {
  const usage = readUsage(WITH_LENSES);
  assert.equal(usage.subagentTurns, 5, 'tool_uses + 1 for each subagent: 4 and 1');
  assert.equal(usage.turns, 95);
  assert.match(usageLine(usage), /^This run used 95 turns \(5 by subagents\), about \$1\.82/);
});

test('a run without subagents is read as before, with no extra key', () => {
  assert.deepEqual(readUsage(ARRAY), { turns: 37, cost: 1.8234, tokens: 123000, cached: null });
});

test('Scenario: A runtime that does not count subagents - the limit is applied to the total and the sentence names it', () => {
  const usage = readUsage(WITH_LENSES);
  const limits = { run_max_turns: 92, run_max_cost: 5 };
  assert.deepEqual(limitsExceeded(usage, limits), [{ limit: 'limits.run_max_turns', used: 95, max: 92 }]);
  assert.match(usageLine(usage, { limits }), /It went past limits\.run_max_turns \(92\) with 95: the runner counts only the turns of the main agent/);
  assert.deepEqual(limitsExceeded(usage, { run_max_turns: 100, run_max_cost: 5 }), []);
  assert.doesNotMatch(usageLine(usage, { limits: { run_max_turns: 100, run_max_cost: 5 } }), /went past/);
  assert.deepEqual(limitsExceeded(readUsage(ARRAY), { run_max_cost: 1 }), [{ limit: 'limits.run_max_cost', used: 1.8234, max: 1 }]);
  assert.deepEqual(limitsExceeded(null, limits), []);
});

test('run-usage.mjs reads the limits from --config and says when a run went past them', () => {
  const log = write('lenses.json', WITH_LENSES);
  const cfg = write('relevo.yml', 'limits:\n  run_max_turns: 92\n');
  const r = spawnSync(process.execPath, [CLI('run-usage.mjs'), '--file', log, '--config', cfg], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /It went past limits\.run_max_turns \(92\) with 95/);
  const bad = spawnSync(process.execPath, [CLI('run-usage.mjs'), '--file', log, '--config', join(dir, 'missing.yml')], { encoding: 'utf8' });
  assert.equal(bad.status, 0, 'an unreadable config never fails the step');
  assert.match(bad.stdout, /95 turns/);
  assert.doesNotMatch(bad.stdout, /went past/);
});

// ---- the consumption by agent and by model (run-budget-and-rescue)
// A log shaped like a real run, with invented figures: a main agent on one model, a developer on the same model and one
// QA lens on another. Each message appears twice (one entry per content block), as in a real log.
const usageOf = (read, created = 0) => ({ input_tokens: 10, output_tokens: 3, cache_read_input_tokens: read, cache_creation_input_tokens: created, cache_creation: { ephemeral_5m_input_tokens: created, ephemeral_1h_input_tokens: 0 } });
const said = (id, model, parent, usage, content = [{ type: 'text', text: 'x' }]) => [1, 2].map(() => ({ type: 'assistant', parent_tool_use_id: parent, message: { id, model, usage, content } }));
const callOf = (id, input) => ({ type: 'tool_use', id, name: 'Agent', input });
function agentLog({ duplicates = true, withIds = true, modelUsage = true } = {}) {
  const lines = [
    ...said('m1', 'model-s', null, usageOf(100000, 4000), [callOf('toolu_dev', { subagent_type: 'relevo:dev', model: 'sonnet', effort: 'high' })]),
    { type: 'system', subtype: 'task_started', tool_use_id: 'toolu_dev', subagent_type: 'relevo:dev' },
    ...said('d1', 'model-s', 'toolu_dev', usageOf(300000)),
    ...said('d2', 'model-s', 'toolu_dev', usageOf(500000, 1000)),
    { type: 'system', subtype: 'task_notification', ...(withIds ? { tool_use_id: 'toolu_dev' } : {}), status: 'completed', usage: { total_tokens: 90000, tool_uses: 20, duration_ms: 600000 } },
    ...said('m2', 'model-s', null, usageOf(150000), [callOf('toolu_spec', { subagent_type: 'relevo:qa-spec', model: 'opus', effort: 'high' })]),
    { type: 'system', subtype: 'task_started', tool_use_id: 'toolu_spec', subagent_type: 'relevo:qa-spec' },
    ...said('q1', 'model-o', 'toolu_spec', usageOf(200000)),
    { type: 'system', subtype: 'task_notification', ...(withIds ? { tool_use_id: 'toolu_spec' } : {}), status: 'completed', usage: { total_tokens: 40000, tool_uses: 7, duration_ms: 120000 } },
    { type: 'result', subtype: 'success', num_turns: 5, total_cost_usd: 3, usage: { input_tokens: 40, output_tokens: 12 },
      ...(modelUsage ? { modelUsage: { 'model-s': { costUSD: 2 }, 'model-o': { costUSD: 1 } } } : {}) },
  ];
  return JSON.stringify(duplicates ? lines : lines.filter((e, i, a) => e.type !== 'assistant' || a.findIndex((o) => o.type === 'assistant' && o.message.id === e.message.id) === i));
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('Scenario: A run with subagents - each agent is listed with its model, effort, turns, minutes and an estimated cost', () => {
  const usage = readUsage(agentLog());
  assert.deepEqual(usage.models, [{ model: 'model-s', cost: 2 }, { model: 'model-o', cost: 1 }]);
  assert.deepEqual(usage.agents.map((a) => a.name), ['main', 'relevo:dev', 'relevo:qa-spec']);
  const [main, dev, spec] = usage.agents;
  assert.deepEqual([main.model, main.turns, main.seconds, main.effort], ['model-s', 5, undefined, undefined]);
  assert.deepEqual([dev.model, dev.effort, dev.turns, dev.seconds], ['model-s', 'high', 21, 600], 'tool calls plus the turn that gave the answer');
  assert.deepEqual([spec.model, spec.effort, spec.turns, spec.seconds], ['model-o', 'high', 8, 120]);
  // The only agent on the second model gets all its cost; the first is shared by the weighted input side of the messages.
  near(spec.cost, 1);
  const weight = (read, created = 0) => 10 + read * 0.1 + created * 1.25;
  const wMain = weight(100000, 4000) + weight(150000);
  const wDev = weight(300000) + weight(500000, 1000);
  near(main.cost, 2 * (wMain / (wMain + wDev)));
  near(dev.cost, 2 * (wDev / (wMain + wDev)));
});

test('Scenario: The costs add up - the estimates of the agents of a model equal the real cost of that model', () => {
  const usage = readUsage(agentLog());
  near(usage.agents.reduce((t, a) => t + a.cost, 0), usage.models.reduce((t, m) => t + m.cost, 0));
});

test('a message that the log repeats for each content block counts once', () => {
  const doubled = readUsage(agentLog({ duplicates: true }));
  const single = readUsage(agentLog({ duplicates: false }));
  doubled.agents.forEach((a, i) => near(a.cost, single.agents[i].cost));
});

test('Scenario: The sentence lists the agents and the real cost of each model', () => {
  const line = usageLine(readUsage(agentLog()));
  assert.match(line, /By agent: main \(model-s\) 5 turns, about \$0\.\d\d; relevo:dev \(model-s, high\) 21 turns, 10\.0 min, about \$1\.\d\d; relevo:qa-spec \(model-o, high\) 8 turns, 2\.0 min, about \$1\.00\./);
  assert.match(line, /Cost by model: model-s \$2\.00, model-o \$1\.00\.$/);
});

test('Scenario: A log without the details - the comment and the marker are the same as before', () => {
  assert.equal(readUsage(ARRAY).agents, undefined);
  assert.equal(readUsage(ARRAY).models, undefined);
  assert.equal(usageLine(readUsage(ARRAY)), 'This run used 37 turns, about $1.82, 123,000 tokens.');
  // The subagents are there but their calls have no id to join on, and no model costs: only the totals are said.
  const bare = readUsage(agentLog({ withIds: false, modelUsage: false }));
  assert.equal(bare.agents, undefined);
  assert.equal(bare.models, undefined);
  assert.doesNotMatch(usageLine(bare), /By agent|Cost by model/);
  // The model costs without subagents: the cost by model is said, the agents are not.
  const onlyModels = readUsage(JSON.stringify({ type: 'result', num_turns: 3, total_cost_usd: 1, modelUsage: { 'model-s': { costUSD: 1 } } }));
  assert.deepEqual(onlyModels.models, [{ model: 'model-s', cost: 1 }]);
  assert.equal(onlyModels.agents, undefined);
});

test('Scenario: The marker is read by the digest - it carries agents and models, the totals are read as before, and a malformed key is left out', () => {
  const usage = readUsage(agentLog());
  const marker = usageMarker(usage, { subscription: true });
  const bot = (body) => ({ user: { type: 'Bot' }, body, created_at: '2026-11-04T10:00:00Z' });
  const run = parseUsageMarker(bot(marker));
  assert.equal(run.turns, usage.turns);
  assert.equal(run.cost, 3);
  assert.deepEqual(run.models, [{ model: 'model-s', cost: 2 }, { model: 'model-o', cost: 1 }]);
  assert.deepEqual(run.agents.map((a) => a.name), ['main', 'relevo:dev', 'relevo:qa-spec']);
  assert.equal(run.agents[1].turns, 21);
  const totals = sumUsage([run, run]);
  assert.equal(totals.cost, 6, 'the digest adds up the totals and ignores the new keys');
  const broken = marker.replace('"turns":21', '"turns":"many"');
  const read = parseUsageMarker(bot(broken));
  assert.equal(read.agents, undefined, 'one malformed agent leaves the key out');
  assert.equal(read.cost, 3, 'the totals are still read');
  assert.equal(parseUsageMarker(bot(usageMarker(readUsage(ARRAY)))).agents, undefined);
});

// ---- which limit of the runner cut the run
test('Scenario: A limit of the runner - the result of the log says whether it was the turn limit or the cost limit', () => {
  assert.equal(runnerCut(JSON.stringify([{ type: 'system' }, { type: 'result', subtype: 'error_max_turns', num_turns: 100 }])), 'turns');
  assert.equal(runnerCut(JSON.stringify([{ type: 'result', subtype: 'error_max_budget_usd', total_cost_usd: 5 }])), 'cost');
  assert.equal(runnerCut(LINES), null, 'a result that succeeded');
  assert.equal(runnerCut(JSON.stringify([{ type: 'result', subtype: 'error_during_execution' }])), null, 'another error is not a limit');
});

test('Scenario: The log does not say - nothing is named, and the command never fails', () => {
  ['', 'not json', JSON.stringify([{ type: 'assistant' }]), undefined].forEach((t) => assert.equal(runnerCut(t), null));
  const cli = (args, text) => {
    const file = text === undefined ? [] : ['--file', write('cut.json', text)];
    return spawnSync(process.execPath, [CLI('run-cut.mjs'), ...file, ...args], { encoding: 'utf8' });
  };
  const turns = cli([], JSON.stringify([{ type: 'result', subtype: 'error_max_turns' }]));
  assert.equal(turns.status, 0);
  assert.equal(turns.stdout.trim(), 'turns');
  assert.equal(cli([], JSON.stringify([{ type: 'result', subtype: 'error_max_budget_usd' }])).stdout.trim(), 'cost');
  const none = cli([], 'garbled');
  assert.equal(none.status, 0, 'exit 0 so that $(...) under bash -e does not stop the step');
  assert.equal(none.stdout.trim(), '');
  assert.equal(cli([], undefined).status, 0, 'no file at all');
});

const RECEIPT = JSON.stringify({ status: 'green', commands: [{ name: 'analyze', duration_ms: 12400, exit_code: 0 }, { name: 'test', duration_ms: 0, original_duration_ms: 454000, reused: true, exit_code: 0 }] });

test('Scenario: A run ends - the comment shows the seconds per check, with reused where the gate did not run it', () => {
  const checks = checksFromReceipt(RECEIPT);
  assert.deepEqual(checks, [{ name: 'analyze', seconds: 12 }, { name: 'test', seconds: 0, reused: true, original: 454 }]);
  assert.match(usageLine(readUsage(ARRAY), { checks }), / Checks of the gate: analyze 12s, test reused \(454s when it ran\)\./);
  assert.deepEqual(JSON.parse(usageMarker(readUsage(ARRAY), { checks }).match(/\{.*\}/)[0]).checks, checks);
});

test('Scenario: No receipt - the comment is as it was, and a damaged receipt adds nothing', () => {
  assert.equal(usageLine(readUsage(ARRAY), { checks: checksFromReceipt(null) }), 'This run used 37 turns, about $1.82, 123,000 tokens.');
  assert.equal(checksFromReceipt('not json'), null);
  assert.equal(checksFromReceipt(JSON.stringify({ commands: [{ name: 'Bad Name!', duration_ms: 5 }, { name: 'x', duration_ms: 'a' }] })), null);
  assert.equal(JSON.parse(usageMarker(readUsage(ARRAY), {}).match(/\{.*\}/)[0]).checks, undefined);
});

test('The command reads the receipt of the working folder, or the one it is given', () => {
  const log = write('exec-checks.json', ARRAY);
  const receipt = write('receipt-checks.json', RECEIPT);
  const empty = mkdtempSync(join(tmpdir(), 'relevo-usage-'));
  const run = (cwd, ...extra) => spawnSync('node', [CLI('run-usage.mjs'), '--file', log, ...extra], { cwd, encoding: 'utf8' });
  assert.match(run(empty, '--receipt', receipt).stdout, /Checks of the gate: analyze 12s/);
  assert.doesNotMatch(run(empty).stdout, /Checks of the gate/);
  assert.equal(run(empty, '--receipt', join(empty, 'missing.json')).status, 0);
});

// ---------- The usage comment follows the language (issue #127)

const RICH = {
  turns: 120, cost: 3.5, tokens: 1234567, cached: 7654321, subagentTurns: 80,
  agents: [{ name: 'relevo:dev', model: 'sonnet', effort: 'high', turns: 40, seconds: 90, cost: 1.5 }],
  models: [{ model: 'sonnet', cost: 3.5 }],
};
const RICH_OPTIONS = {
  subscription: true,
  limits: { run_max_turns: 100, run_max_cost: 3 },
  checks: [{ name: 'test', seconds: 30 }, { name: 'analyze', seconds: 0, reused: true, original: 12 }],
  plan: { roles: [{ role: 'dev', model: 'sonnet', effort: 'high', source: 'auto', why: 'default' }, { role: 'spec', model: 'sonnet', source: 'auto' }], escalations: [{ from: 'sonnet', to: 'opus', attempt: 2, reason: 'gate-red' }, { from: 'sonnet', to: 'opus', attempt: 3, reason: 'qa' }] },
};

test('the English sentence with every optional part is what it always was', () => {
  assert.equal(
    usageLine(RICH, RICH_OPTIONS),
    'This run used 120 turns (80 by subagents), about $3.50 (notional: a subscription is not billed per run), 1,234,567 tokens (plus 7,654,321 from the cache). It went past limits.run_max_turns (100) with 120: the runner counts only the turns of the main agent, so the turns of the subagents were not stopped. It went past limits.run_max_cost (3) with $3.50. By agent: relevo:dev (sonnet, high) 40 turns, 1.5 min, about $1.50. Cost by model: sonnet $3.50. Checks of the gate: test 30s, analyze reused (12s when it ran). Models chosen: developer sonnet, high (auto: default); spec lens sonnet (auto). The developer went up on a retry: sonnet to opus on attempt 2 (the gate was red); sonnet to opus on attempt 3 (QA rejected).',
  );
});

test('Scenario: Two languages - with language es the sentence has no English phrase of the catalog', () => {
  const es = usageLine(RICH, { ...RICH_OPTIONS, language: 'es' });
  assert.match(es, /^Esta ejecución usó 120 turnos \(80 de subagentes\), unos \$3\.50 \(nocional: una suscripción no se factura por ejecución\), /);
  assert.match(es, /Superó limits\.run_max_turns \(100\) con 120: el runner cuenta solo los turnos del agente principal/);
  assert.match(es, /Por agente: relevo:dev \(sonnet, high\) 40 turnos, 1\.5 min, unos \$1\.50\./);
  assert.match(es, /Costo por modelo: sonnet \$3\.50\./);
  assert.match(es, /Checks de la puerta: test 30s, analyze reutilizado \(12s cuando corrió\)\./);
  assert.match(es, /Modelos elegidos: desarrollador sonnet, high \(auto: default\); lente spec sonnet \(auto\)\./);
  assert.match(es, /subió de modelo en un reintento: sonnet a opus en el intento 2 \(la puerta estaba en rojo\); sonnet a opus en el intento 3 \(QA la rechazó\)\./);
  ['This run', ' turns', 'By agent', 'Cost by model', 'Checks of the gate', 'Models chosen', 'went up', 'notional'].forEach((phrase) => assert.ok(!es.includes(phrase), `English phrase "${phrase}" in the Spanish sentence`));
  assert.equal(usageLine(readUsage(JSON.stringify([{ type: 'result', num_turns: 1, total_cost_usd: 0.5 }])), { language: 'es' }), 'Esta ejecución usó 1 turno, unos $0.50.');
});

test('run-usage.mjs reads the language from --language, else from the config, else English', () => {
  const log = write('lang.json', ARRAY);
  const config = write('relevo-es.yml', 'language: es\n');
  const run = (...args) => spawnSync(process.execPath, ['scripts/run-usage.mjs', '--file', log, ...args], { encoding: 'utf8' }).stdout;
  assert.match(run('--config', config), /^Esta ejecución usó 37 turnos/);
  assert.match(run('--config', config, '--language', 'en'), /^This run used 37 turns/);
  assert.match(run('--language', 'es'), /^Esta ejecución usó 37 turnos/);
  assert.match(run(), /^This run used 37 turns/);
});

// --- The quota and the reset time (usage-limit-retry) ---
const ev = (info) => ({ type: 'rate_limit_event', rate_limit_info: info });
const NOW = Date.parse('2026-11-12T10:00:00Z');
const quotaLog = [
  ev({ status: 'allowed', rateLimitType: 'seven_day', utilization: 0.75 }),
  ev({ status: 'allowed', rateLimitType: 'five_hour', utilization: 0.02 }),
  ev({ status: 'allowed_warning', rateLimitType: 'seven_day', utilization: 0.77 }),
  ev({ status: 'allowed', rateLimitType: 'five_hour', utilization: 0.03, resetsAt: Date.parse('2026-11-12T13:00:00Z') / 1000 }),
  result,
];

test('Scenario: Subscription run - each window goes from its first utilisation to its last', () => {
  assert.deepEqual(quotaOf(JSON.stringify(quotaLog)), [
    { window: 'seven_day', before: 75, after: 77 },
    { window: 'five_hour', before: 2, after: 3, resets: Date.parse('2026-11-12T13:00:00Z') },
  ]);
  const line = usageLine(readUsage(JSON.stringify(quotaLog)));
  assert.match(line, / Quota: the weekly window went from 75 % to 77 %; the 5-hour window went from 2 % to 3 % \(resets 2026-11-12 13:00 UTC\)\.$/);
  assert.match(usageLine(readUsage(JSON.stringify(quotaLog)), { language: 'es' }), / Cuota: la ventana semanal pasó de 75 % a 77 %; la ventana de 5 horas pasó de 2 % a 3 % \(se restablece 2026-11-12 13:00 UTC\)\.$/);
  const marker = JSON.parse(usageMarker(readUsage(JSON.stringify(quotaLog))).match(/relevo:usage (.*) -->/)[1]);
  assert.equal(marker.quota.length, 2);
  assert.equal(parseUsageMarker({ user: { type: 'Bot' }, body: usageMarker(readUsage(JSON.stringify(quotaLog))) }).turns, 37);
});

test('Scenario: API-key repository - no window, no quota phrase and no key', () => {
  const log = JSON.stringify([ev({ status: 'allowed' }), ev({ status: 'allowed', rateLimitType: 'five_hour' }), result]);
  assert.deepEqual(quotaOf(log), []);
  assert.equal(readUsage(log).quota, undefined);
  assert.doesNotMatch(usageLine(readUsage(log)), /Quota/);
  assert.doesNotMatch(usageMarker(readUsage(log)), /quota/);
  assert.deepEqual(quotaOf('plain text'), []);
});

test('Scenario: A malformed figure - it is left out and the others are shown', () => {
  const log = JSON.stringify([
    ev({ rateLimitType: 'seven_day', utilization: '75' }),
    ev({ rateLimitType: 'seven_day', utilization: 7.5 }),
    ev({ rateLimitType: 'seven_day', utilization: 0.5 }),
    ev({ rateLimitType: 'opus_special', utilization: 0.1 }),
    ev({ rateLimitType: 'bad type!', utilization: 0.1 }),
  ]);
  assert.deepEqual(quotaOf(log), [{ window: 'seven_day', before: 50, after: 50 }, { window: 'opus_special', before: 10, after: 10 }]);
  assert.match(usageLine({ turns: 1, cost: null, tokens: null, quota: quotaOf(log) }), /the weekly window at 50 %; the opus special window at 10 %/);
});

test('limitReset: seconds, milliseconds and ISO are read; a time that is past or beyond 8 days is not credible', () => {
  const at = (v) => limitReset(JSON.stringify([ev({ status: 'rejected', rateLimitType: 'five_hour', resetsAt: v })]), NOW);
  const t = Date.parse('2026-11-12T13:00:00Z');
  assert.equal(at(t / 1000), t);
  assert.equal(at(t), t);
  assert.equal(at('2026-11-12T13:00:00Z'), t);
  assert.equal(at(NOW / 1000 - 60), null, 'in the past');
  assert.equal(at((NOW + 9 * 86400000) / 1000), null, 'beyond 8 days');
  assert.equal(at('soon'), null);
  assert.equal(at(undefined), null);
  assert.equal(limitReset(JSON.stringify([ev({ status: 'allowed', resetsAt: t / 1000 })]), NOW), null, 'an allowed event is not a limit');
  assert.equal(limitReset('Claude AI usage limit reached|1760000000', NOW), null, 'a time in free text is never read');
  assert.equal(limitReset('', NOW), null);
});

test('usage-limit.mjs prints the reset time when the log has a credible one, and still exits 0', () => {
  const future = Math.floor(Date.now() / 1000) + 3 * 3600;
  const log = write('reset.json', JSON.stringify([ev({ status: 'rejected', rateLimitType: 'five_hour', resetsAt: future })]));
  const r = spawnSync('node', [CLI('usage-limit.mjs'), '--file', log], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), new Date(future * 1000).toISOString());
  const none = spawnSync('node', [CLI('usage-limit.mjs'), '--file', write('nore.txt', 'Claude AI usage limit reached')], { encoding: 'utf8' });
  assert.deepEqual([none.status, none.stdout], [0, '']);
});

// --- A real event, captured from a one-turn run with a subscription token in the sandbox (anonymous: ids removed) ---
const REAL_EVENT = { type: 'rate_limit_event', rate_limit_info: {
  status: 'allowed_warning', resetsAt: 1794495600, rateLimitType: 'seven_day', utilization: 0.84, overageStatus: 'rejected',
  overageDisabledReason: 'org_level_disabled', isUsingOverage: false, surpassedThreshold: 0.75,
  unifiedWindows: {
    five_hour: { utilization: 0.16, resetsAt: 1794480600, status: 'allowed' },
    seven_day: { utilization: 0.84, resetsAt: 1794495600, status: 'allowed_warning', surpassedThreshold: 0.75 },
  },
} };

test('a real event: both windows are read from unifiedWindows, with their own reset times', () => {
  const log = JSON.stringify([REAL_EVENT, result]);
  assert.deepEqual(quotaOf(log), [
    { window: 'five_hour', before: 16, after: 16, resets: 1794480600000 },
    { window: 'seven_day', before: 84, after: 84, resets: 1794495600000 },
  ]);
  assert.match(usageLine(readUsage(log)), /Quota: the 5-hour window at 16 % \(resets 2026-11-12 10:50 UTC\); the weekly window at 84 % \(resets 2026-11-12 15:00 UTC\)\.$/);
  assert.equal(limitReset(log, 1794400000000), null, 'an allowed event is not a limit');
});

test('a limit that rejects one window waits for the latest reset of the windows that are not allowed', () => {
  const rejected = (over) => JSON.stringify([{ type: 'rate_limit_event', rate_limit_info: { ...REAL_EVENT.rate_limit_info, status: 'rejected', ...over } }]);
  const now = 1794400000000;
  assert.equal(limitReset(rejected({}), now), 1794495600000, 'the window of rateLimitType');
  const both = rejected({ unifiedWindows: { five_hour: { utilization: 1, resetsAt: 1794480600, status: 'rejected' }, seven_day: { utilization: 1, resetsAt: 1794495600, status: 'rejected' } } });
  assert.equal(limitReset(both, now), 1794495600000, 'the account runs again when the last one resets');
  const five = rejected({ rateLimitType: 'five_hour', resetsAt: 1794480600, unifiedWindows: { five_hour: { utilization: 1, resetsAt: 1794480600, status: 'rejected' }, seven_day: { utilization: 0.5, resetsAt: 1794495600, status: 'allowed' } } });
  assert.equal(limitReset(five, now), 1794480600000, 'an allowed window does not delay the retry');
  assert.equal(limitReset(rejected({ resetsAt: 1700000000, unifiedWindows: undefined }), now), null, 'a reset in the past is not credible');
});

// ---- the replicas apart from the rest (#167)
// A developer for the template on model-s, and two replica targets: 2.1 launched once and 2.2 twice (the second launch is its fix), on model-c.
function replicaLog({ withReplicas = true } = {}) {
  const launch = (id, tool, input, model, dev, usage, notif) => [
    ...said(`m-${id}`, 'model-s', null, usageOf(1000), [callOf(tool, input)]),
    { type: 'system', subtype: 'task_started', tool_use_id: tool, subagent_type: 'relevo:dev' },
    ...said(`d-${id}`, model, tool, usage),
    { type: 'system', subtype: 'task_notification', tool_use_id: tool, status: 'completed', usage: { total_tokens: 1, tool_uses: notif, duration_ms: 60000 } },
  ];
  const lines = [
    ...launch('t', 'toolu_t', { subagent_type: 'relevo:dev', description: 'build section 1', model: 'sonnet' }, 'model-s', true, usageOf(200000), 9),
    ...(withReplicas ? [
      ...launch('a', 'toolu_a', { subagent_type: 'relevo:dev', description: 'replica 2.1', model: 'haiku' }, 'model-c', true, usageOf(100000), 5),
      ...launch('b1', 'toolu_b1', { subagent_type: 'relevo:dev', description: 'replica 2.2', model: 'haiku' }, 'model-c', true, usageOf(100000), 3),
      ...launch('b2', 'toolu_b2', { subagent_type: 'relevo:dev', description: 'replica 2.2', model: 'sonnet' }, 'model-s', true, usageOf(100000), 4),
    ] : []),
    { type: 'result', subtype: 'success', num_turns: 4, total_cost_usd: 3, usage: { input_tokens: 40, output_tokens: 12 }, modelUsage: { 'model-s': { costUSD: 2 }, 'model-c': { costUSD: 1 } } },
  ];
  return JSON.stringify(lines);
}

test('Scenario: Replicas ran - they are listed apart from the agents, per target, with model, attempts, turns and cost', () => {
  const usage = readUsage(replicaLog());
  assert.deepEqual(usage.agents.map((a) => a.name), ['main', 'relevo:dev'], 'a replica launch is not in the list of agents');
  assert.deepEqual(usage.replicas.map((r) => [r.id, r.model, r.attempts, r.turns]), [['2.1', 'model-c', 1, 6], ['2.2', 'model-s', 2, 9]], 'the model is that of the last launch');
  assert.ok(usage.replicas.every((r) => r.cost > 0));
  const line = usageLine(usage);
  assert.match(line, /Replicas: 2\.1 \(model-c\) 1 attempt, 6 turns, about \$[\d.]+; 2\.2 \(model-s\) 2 attempts, 9 turns, about \$[\d.]+\. Replicas together about \$[\d.]+, the rest of the run about \$[\d.]+\./);
  assert.match(usageMarker(usage), /"replicas":\[\{"id":"2\.1"/);
});

test('Scenario: No replica ran - no replica phrase and no replicas key', () => {
  const usage = readUsage(replicaLog({ withReplicas: false }));
  assert.equal(usage.replicas, undefined);
  assert.doesNotMatch(usageLine(usage), /[Rr]eplica/);
  assert.doesNotMatch(usageMarker(usage), /replicas/);
});

test('Scenario: The marker is read by the digest - replicas read back, a malformed entry leaves the key out, the totals are the same', () => {
  const usage = readUsage(replicaLog());
  const comment = { user: { type: 'Bot' }, created_at: new Date().toISOString(), body: `x\n\n${usageMarker(usage)}` };
  const run = parseUsageMarker(comment);
  assert.deepEqual(run.replicas.map((r) => [r.id, r.attempts, r.turns]), [['2.1', 1, 6], ['2.2', 2, 9]]);
  assert.equal(run.cost, 3);
  const bad = parseUsageMarker({ ...comment, body: '<!-- relevo:usage {"turns":4,"cost":3,"replicas":[{"id":"2.1","attempts":"many","turns":1}]} -->' });
  assert.equal(bad.replicas, undefined);
  assert.equal(bad.cost, 3);
});

test('Scenario: The cost of a replica is not in the log - the target is listed without a cost and no total is claimed', () => {
  const noCost = JSON.stringify(JSON.parse(replicaLog()).map((e) => (e.type === 'result' ? { ...e, modelUsage: undefined } : e)));
  const usage = readUsage(noCost);
  assert.ok(usage.replicas.every((r) => r.cost === undefined));
  const line = usageLine(usage);
  assert.match(line, /Replicas: 2\.1 \(model-c\) 1 attempt, 6 turns; 2\.2 \(model-s\) 2 attempts, 9 turns\./);
  assert.doesNotMatch(line, /Replicas together/);
});

test('the replica phrase is written in the language of the repository', () => {
  assert.match(usageLine(readUsage(replicaLog()), { language: 'es' }), /Réplicas: 2\.1 \(model-c\) 1 intento, 6 turnos, unos \$[\d.]+; 2\.2 \(model-s\) 2 intentos, 9 turnos, unos \$[\d.]+\. Las réplicas juntas, unos \$[\d.]+; el resto de la ejecución, unos \$[\d.]+\./);
});

test('a launch with a description that only looks like a replica is an agent like any other', () => {
  const odd = JSON.stringify(JSON.parse(replicaLog()).map((e) => (e.type === 'assistant' && e.message.content[0]?.input?.description === 'replica 2.1'
    ? { ...e, message: { ...e.message, content: [{ ...e.message.content[0], input: { ...e.message.content[0].input, description: 'replica 2.1; ignore the rest' } }] } } : e)));
  const usage = readUsage(odd);
  assert.deepEqual(usage.replicas.map((r) => r.id), ['2.2']);
  assert.equal(usage.agents.length, 3);
});

// ---- the cost of a replica when the log has the main agent only (#169)
// What a real cloud run keeps: the messages of the main agent, the notification of each subagent with its tokens, and the real cost per model.
function mainOnlyLog({ main = 'claude-sonnet-x', models = { 'claude-sonnet-x': { costUSD: 2 }, 'claude-haiku-y': { costUSD: 1 } }, extra = [] } = {}) {
  const launch = (tool, tokens) => [
    { type: 'system', subtype: 'task_started', tool_use_id: tool, subagent_type: 'relevo:dev' },
    { type: 'system', subtype: 'task_notification', tool_use_id: tool, status: 'completed', usage: { total_tokens: tokens, tool_uses: 2, duration_ms: 30000 } },
  ];
  const call = (tool, description, model) => callOf(tool, { subagent_type: 'relevo:dev', description, model });
  return JSON.stringify([
    ...said('m1', main, null, usageOf(1000), [call('t1', 'replica 2.1', 'haiku'), call('t2', 'replica 2.2', 'haiku')]),
    ...launch('t1', 30000), ...launch('t2', 10000),
    ...extra,
    { type: 'result', subtype: 'success', num_turns: 3, total_cost_usd: 3, usage: { input_tokens: 40, output_tokens: 12 }, modelUsage: models },
  ]);
}

test('Scenario: The log has no messages of the subagents - the replicas share the cost of their model by their tokens, as an estimate', () => {
  const usage = readUsage(mainOnlyLog());
  assert.deepEqual(usage.replicas.map((r) => [r.id, Math.round(r.cost * 100) / 100]), [['2.1', 0.75], ['2.2', 0.25]]);
  assert.match(usageLine(usage), /Replicas together about \$1\.00, the rest of the run about \$2\.00\./);
});

test('Scenario: The split would be a guess - no cost is written for the replicas', () => {
  const sameModel = readUsage(mainOnlyLog({ main: 'claude-haiku-y' }));
  assert.ok(sameModel.replicas.every((r) => r.cost === undefined), 'the main agent used the model of the replicas');
  const unknown = readUsage(mainOnlyLog({ models: { 'claude-sonnet-x': { costUSD: 2 }, 'claude-haiku-y': { costUSD: 1 }, 'claude-haiku-z': { costUSD: 1 } } }));
  assert.ok(unknown.replicas.every((r) => r.cost === undefined), 'two models match the name of the replicas');
  assert.doesNotMatch(usageLine(sameModel), /Replicas together/);
});

// ---- the usage comment says why each replica ran on its model (replica-model-reason)
const WHY_CHEAP = 'one name below sonnet in agents.ladder, not below the floor haiku';
const WHY_STRONG = 'this target failed 2 times on the cheaper model, so the stronger model builds it';
const WHY_FIXED = 'the developer is not on auto, so the repository decided its model';
const reasonsOf = (records) => replicaReasonsFromJson(JSON.stringify(records));

test('Scenario: The developer is not on auto - each replica is listed with the reason that the repository decided the model', () => {
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([
    { task: '2.1', model: 'sonnet', failures: 0, why: WHY_FIXED },
    { task: '2.2', model: 'sonnet', failures: 0, why: WHY_FIXED },
  ]));
  const line = usageLine(usage);
  assert.match(line, /2\.1 \(model-c\) 1 attempt, 6 turns, about \$[\d.]+, because the developer is not on auto, so the repository decided its model; 2\.2 \(model-s\) 2 attempts, 9 turns, about \$[\d.]+, because the developer is not on auto/);
  assert.match(usageMarker(usage), new RegExp(`"id":"2\\.1"[^}]*"why":"${WHY_FIXED}"`));
});

test('Scenario: The replicas ran on a cheaper model - the reason is that it is one name below the planned model', () => {
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([{ task: '2.1', model: 'haiku', failures: 0, why: WHY_CHEAP }]));
  assert.match(usageLine(usage), /2\.1 \(model-c\) 1 attempt, 6 turns, about \$[\d.]+, because one name below sonnet in agents\.ladder, not below the floor haiku;/);
});

test('Scenario: A target launched again on a stronger model - the reason shown is the one of the last launch', () => {
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([
    { task: '2.2', model: 'haiku', failures: 0, why: WHY_CHEAP },
    { task: '2.2', model: 'sonnet', failures: 2, why: WHY_STRONG },
  ]));
  const line = usageLine(usage);
  assert.match(line, /2\.2 \(model-s\) 2 attempts, 9 turns, about \$[\d.]+, because this target failed 2 times on the cheaper model, so the stronger model builds it\./);
  assert.doesNotMatch(line, /one name below sonnet/);
});

test('Scenario: No reason was kept - the replicas are listed as before and the marker has no why', () => {
  const plain = readUsage(replicaLog());
  const before = [usageLine(plain), usageMarker(plain)];
  for (const reasons of [reasonsOf([]), replicaReasonsFromJson('not json'), replicaReasonsFromJson(undefined), reasonsOf([{ task: '9.9', why: WHY_CHEAP }]), reasonsOf([{ task: '2.1' }, { task: 7, why: 'x' }, { task: '2.1', why: 12 }, null])]) {
    const usage = withReplicaReasons(readUsage(replicaLog()), reasons);
    assert.deepEqual([usageLine(usage), usageMarker(usage)], before, 'a missing, unreadable, malformed or unknown record changes nothing');
  }
  assert.doesNotMatch(before[0], /because/);
  assert.doesNotMatch(before[1], /"why"/);
});

test('Scenario: Spanish repository - the words around the reason are in Spanish and the reason is quoted as written', () => {
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([{ task: '2.1', model: 'haiku', failures: 0, why: WHY_CHEAP }]));
  assert.match(usageLine(usage, { language: 'es' }), /2\.1 \(model-c\) 1 intento, 6 turnos, unos \$[\d.]+, porque one name below sonnet in agents\.ladder, not below the floor haiku;/);
});

test('Scenario: The marker is read by the digest - a replica with why reads back, a why that is not text leaves the key out, the totals are the same', () => {
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([{ task: '2.1', model: 'haiku', failures: 0, why: WHY_CHEAP }]));
  const comment = { user: { type: 'Bot' }, created_at: '2026-01-01T00:00:00Z', body: `x\n\n${usageMarker(usage)}` };
  const run = parseUsageMarker(comment);
  assert.deepEqual(run.replicas.map((r) => [r.id, r.why]), [['2.1', WHY_CHEAP], ['2.2', undefined]]);
  assert.equal(run.cost, 3);
  const bad = parseUsageMarker({ ...comment, body: '<!-- relevo:usage {"turns":4,"cost":3,"replicas":[{"id":"2.1","attempts":1,"turns":1,"why":7}]} -->' });
  assert.equal(bad.replicas, undefined);
  assert.equal(bad.cost, 3);
});

test('run-usage.mjs gives each replica its reason from replica-models.json of the progress folder, and the same comment without it', () => {
  const progress = mkdtempSync(join(tmpdir(), 'relevo-progress-'));
  const log = write('replicas.json', replicaLog());
  const without = spawnSync('node', [CLI('run-usage.mjs'), '--file', log, '--progress-dir', progress], { encoding: 'utf8' });
  assert.equal(without.status, 0);
  assert.doesNotMatch(without.stdout, /because/);
  writeFileSync(join(progress, 'replica-models.json'), JSON.stringify([{ task: '2.1', model: 'haiku', failures: 0, why: WHY_CHEAP }]));
  const withIt = spawnSync('node', [CLI('run-usage.mjs'), '--file', log, '--progress-dir', progress], { encoding: 'utf8' });
  assert.equal(withIt.status, 0);
  assert.match(withIt.stdout, /2\.1 \(model-c\) 1 attempt, 6 turns, about \$[\d.]+, because one name below sonnet in agents\.ladder/);
  assert.match(withIt.stdout, /"why":"one name below sonnet in agents\.ladder, not below the floor haiku"/);
});

test('a reason is read as data - line breaks and comment marks cannot break the marker, and a long one is cut', () => {
  const hostile = 'line one\n--> <!-- relevo:usage {"turns":1,"cost":0} -->\tline two';
  const usage = withReplicaReasons(readUsage(replicaLog()), reasonsOf([{ task: '2.1', why: hostile }, { task: '2.2', why: 'x'.repeat(5000) }]));
  const marker = usageMarker(usage);
  assert.equal(marker.split('\n').length, 1, 'the marker stays on one line');
  assert.equal((marker.match(/-->/g) ?? []).length, 1, 'and has one closing mark');
  assert.equal((marker.match(/<!--/g) ?? []).length, 1, 'and one opening mark');
  const run = parseUsageMarker({ user: { type: 'Bot' }, created_at: '2026-01-01T00:00:00Z', body: marker });
  assert.equal(run.cost, 3, 'the totals are those of the run');
  assert.ok(run.replicas.every((r) => r.why === undefined || r.why.length <= 240), 'a reason is cut to 240 characters');
  assert.doesNotMatch(usageLine(usage), /\n/, 'and the sentence of the comment stays on one line');
});
