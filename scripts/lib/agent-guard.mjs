// The run guard: what Relevo adds around an agent that has no turn limit, no cost limit and an exit code that hides a
// refused tool. Antigravity CLI is that agent (see docs/pilot-findings.md). The guard reads the event stream of
// `agy -p --output-format stream-json` while it runs, counts the agent's turns and tokens, stops the process group at a
// limit, and turns a refusal into a failure. Everything that touches the outside (the child process, the clock, the
// files) is injected, so a test drives it with a fake child.

import { extractEffortSuffix } from './config.mjs';

// Exit codes of the guard. 0 is the agent's own success; each stop has its own number so a workflow can tell them apart.
export const EXIT = { ok: 0, failed: 1, usage: 2, refused: 10, turns: 11, tokens: 12, time: 13, silent: 14 };

const STOP_TEXT = {
  turns: (n) => `the agent reached the limit of ${n} turns (limits.run_max_turns)`,
  tokens: (n) => `the agent reached the limit of ${n} tokens (limits.run_max_tokens)`,
  time: (n) => `the agent reached the time limit of ${n} minutes`
};

/**
 * Builds the `agy` CLI arguments for a guarded run. Passes `--model` and `--effort` for base slugs, omits `--effort` when
 * the model slug already carries an effort suffix (`-low`/`-medium`/`-high`/`-xhigh`/`-max`) so `agy 1.5.18` does not exit 1
 * on a conflict, forwards per-session `--settings` when given, and never enables `--sandbox` (which blocks `gh`).
 */
export function buildAgyArgs({ prompt, timeoutMinutes, model = null, effort = null, settings = null }) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--print-timeout', `${Math.ceil(timeoutMinutes) + 1}m`];
  if (typeof model === 'string' && model.trim()) args.push('--model', model.trim());
  if (typeof effort === 'string' && effort.trim() && !extractEffortSuffix(model)) args.push('--effort', effort.trim());
  if (typeof settings === 'string' && settings.trim()) args.push('--settings', settings.trim());
  return args;
}

/**
 * Folds the events of one run into its counts. A step is counted once, when it is DONE, however many times it was
 * reported; a turn is a model response (`agent_response`), of the main agent or of a subagent. Tracks per-conversation
 * turns and tokens so the summary includes a per-subagent breakdown.
 */
export class Tracker {
  constructor() {
    this.seen = new Set();
    this.turns = 0;
    this.tokens = 0;
    this.input = 0;
    this.output = 0;
    this.cached = 0;
    this.denied = [];
    this.result = null;
    this.errors = 0;
    this.mainConversationId = null;
    this.mainModel = null;
    this.subagentMeta = new Map();
    this.byConversation = new Map();
  }

  /** Feeds one line of the stream; returns the event, or null when the line is not JSON. */
  feed(line) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      return null;
    }
    if (!e || typeof e !== 'object') return null;
    if (e.event === 'init') {
      const cid = e.conversation_id ?? e.init?.conversation_id;
      if (typeof cid === 'string' && cid) this.mainConversationId = cid;
      const model = e.model ?? e.init?.model;
      if (typeof model === 'string' && model) this.mainModel = model;
      return e;
    }
    if (e.event === 'result') this.result = e.result ?? {};
    if (e.event !== 'step_update' || !e.step_update) return e;
    const s = e.step_update;
    if (!this.mainConversationId && typeof s.conversation_id === 'string' && s.conversation_id) {
      this.mainConversationId = s.conversation_id;
    }
    if (s.step_type === 'tool' && s.state === 'ERROR' && /permission check failed/i.test(JSON.stringify(s.tool_info ?? {}))) {
      const what = String(s.tool_info?.parameters?.CommandLine ?? s.tool_name ?? 'a tool').split(/\s+/)[0];
      if (!this.denied.includes(what)) this.denied.push(what);
    }
    if (s.state !== 'DONE') return e;
    if (s.step_type === 'subagent') {
      const params = s.tool_info?.parameters ?? {};
      const subs = Array.isArray(s.subagent_info?.subagents) ? s.subagent_info.subagents : [];
      subs.forEach((sub) => {
        if (typeof sub?.conversation_id !== 'string' || !sub.conversation_id) return;
        this.subagentMeta.set(sub.conversation_id, {
          name: typeof params.TypeName === 'string' && params.TypeName ? params.TypeName : 'subagent',
          launch: typeof params.Role === 'string' && params.Role ? params.Role : null,
          model: typeof params.Model === 'string' && params.Model ? params.Model : null,
        });
      });
    }
    const key = `${s.conversation_id}:${s.step_index}`;
    if (this.seen.has(key)) return e;
    this.seen.add(key);
    const cid = typeof s.conversation_id === 'string' && s.conversation_id ? s.conversation_id : (this.mainConversationId ?? 'main');
    const record = () => {
      if (!this.byConversation.has(cid)) this.byConversation.set(cid, { turns: 0, tokens: 0, input: 0, output: 0, cached: 0 });
      return this.byConversation.get(cid);
    };
    if (s.step_type === 'agent_response') {
      this.turns += 1;
      record().turns += 1;
    }
    if (s.usage) {
      const input = Number(s.usage.input_tokens) || 0;
      const output = Number(s.usage.output_tokens) || 0;
      const cached = Number(s.usage.cache_read_tokens) || 0;
      const total = Number(s.usage.total_tokens);
      const stepTokens = Number.isFinite(total) ? total : input + output;
      this.tokens += stepTokens;
      this.input += input;
      this.output += output;
      this.cached += cached;
      const entry = record();
      entry.input += input;
      entry.output += output;
      entry.cached += cached;
      entry.tokens += (Number.isFinite(Number(s.usage.input_tokens)) || Number.isFinite(Number(s.usage.output_tokens))) ? input + output : stepTokens;
    }
    return e;
  }

  /** Per-agent breakdown when subagents participated: [{ name, launch?, model?, turns, tokens, cached? }], or null. */
  agentBreakdown() {
    if (this.byConversation.size <= 1 && this.subagentMeta.size === 0) return null;
    const orderedIds = [];
    if (this.mainConversationId && this.byConversation.has(this.mainConversationId)) orderedIds.push(this.mainConversationId);
    for (const cid of this.byConversation.keys()) if (!orderedIds.includes(cid)) orderedIds.push(cid);
    return orderedIds.map((cid) => {
      const stats = this.byConversation.get(cid);
      const isMain = cid === this.mainConversationId;
      const meta = isMain ? null : this.subagentMeta.get(cid);
      const entry = {
        name: isMain ? 'main' : (meta?.name ?? 'subagent'),
        turns: stats.turns,
        tokens: stats.tokens,
      };
      if (meta?.launch) entry.launch = meta.launch;
      const model = isMain ? this.mainModel : meta?.model;
      if (model) entry.model = model;
      if (stats.cached > 0) entry.cached = stats.cached;
      return entry;
    });
  }

  /** What the final event says was refused, joined with what the steps showed. */
  allDenied() {
    const fromResult = (this.result?.denied_actions ?? []).map((d) => d.display_name ?? d.action ?? 'a tool');
    return [...new Set([...this.denied, ...fromResult])];
  }
}

/** One line per step for the log: the tool and, for a command, only its program, never its output or arguments. */
export function logLine(event) {
  const s = event?.step_update;
  if (!s || s.state !== 'DONE') return null;
  if (s.step_type === 'tool') return `tool ${s.tool_name}${s.tool_name === 'run_command' ? ` (${String(s.tool_info?.parameters?.CommandLine ?? '').trim().split(/\s+/)[0]})` : ''}`;
  if (s.step_type === 'agent_response') return 'model turn';
  if (s.step_type === 'subagent') return 'subagent started';
  return null;
}

/**
 * Runs the agent under the limits. `spawn(command, args)` returns { pid, stdout, stderr, kill(signal), on }, with
 * stdout and stderr readable streams and `on('close', (code) => ...)`. `limits`: { turns, tokens, minutes }.
 * Resolves { code, summary }: the guard's exit code and the summary to write.
 */
export function runGuard({ command, args, limits, spawn, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now, log = () => {} }) {
  return new Promise((resolve) => {
    const tracker = new Tracker();
    const started = now();
    let stoppedBy = null;
    let stderr = '';
    let buffered = '';
    let finished = false;
    const child = spawn(command, args);

    const stop = (why) => {
      if (stoppedBy || finished) return;
      stoppedBy = why;
      log(`relevo guard: ${STOP_TEXT[why](limits[why === 'time' ? 'minutes' : why])}; stopping the agent`);
      try {
        child.kill('SIGTERM');
      } catch {
        /* already gone */
      }
      killer = setTimer(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }, 5000);
    };
    let killer = null;
    const timer = limits.minutes ? setTimer(() => stop('time'), limits.minutes * 60 * 1000) : null;

    const onLine = (line) => {
      if (!line.trim()) return;
      const event = tracker.feed(line);
      const text = event ? logLine(event) : null;
      if (text) log(text);
      if (limits.turns && tracker.turns > limits.turns) stop('turns');
      else if (limits.tokens && tracker.tokens > limits.tokens) stop('tokens');
    };
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      const lines = buffered.split('\n');
      buffered = lines.pop();
      lines.forEach(onLine);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    child.on('close', (exit) => {
      finished = true;
      if (timer) clearTimer(timer);
      if (killer) clearTimer(killer);
      if (buffered.trim()) onLine(buffered);
      const denied = tracker.allDenied();
      const r = tracker.result;
      let code = EXIT.ok;
      if (stoppedBy) code = EXIT[stoppedBy];
      else if (denied.length > 0) code = EXIT.refused;
      else if (!r) code = EXIT.silent;
      else if (r.status !== 'SUCCESS' || exit !== 0) code = EXIT.failed;
      const agents = tracker.agentBreakdown();
      const summary = {
        type: 'result',
        status: r?.status ?? 'NO_RESULT',
        stopped_by: stoppedBy,
        num_turns: tracker.turns,
        usage: { input_tokens: tracker.input, output_tokens: tracker.output, cache_read_input_tokens: tracker.cached },
        ...(agents ? { agents } : {}),
        ...(code !== EXIT.ok && r?.error ? { error: r.error } : {}),
        ...(code !== EXIT.ok && typeof r?.response === 'string' && r.response ? { response: r.response.slice(-2000) } : {}),
        denied,
        duration_seconds: Math.round((now() - started) / 1000),
        exit_code: code,
        stderr_tail: stderr
      };
      if (code === EXIT.refused) log(`relevo guard: the agent exited normally but a tool was refused (${denied.join(', ')}); failing the run`);
      if (code === EXIT.silent) log('relevo guard: the agent ended without a result, so nothing was built');
      resolve({ code, summary, response: r?.response ?? '' });
    });
  });
}

// ---------------------------------------------------------------- the settings of the run

// Programs an unattended build may run beyond the tools of its stack: the ones the skill `go` and the agents call, and
// the plain file utilities a developer uses. Nothing that talks to the network on its own is here (curl and wget are
// denied by name). `node` can run any script, as Bash can for Claude: a prefix list is not an operating-system boundary.
export const BASE_PROGRAMS = ['node', 'git', 'gh', 'openspec', 'echo', 'printf', 'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find', 'sort', 'uniq', 'diff', 'sed', 'awk', 'jq', 'tr', 'cut', 'mkdir', 'mv', 'cp', 'rm', 'touch', 'test', 'pwd'];
export const DENIED = ['read_url(*)', 'execute_url(*)', 'command(curl)', 'command(wget)'];

/** The first word of a command, which is the program a prefix rule names. */
const programOf = (command) => String(command ?? '').trim().split(/\s+/)[0];

/**
 * The settings file of `agy` for a run: optional `modelProvider` (`gemini` in cloud or when `GEMINI_API_KEY` is set;
 * omitted locally so cached subscription login works), the denied web, the restricted files and the commands that are
 * allowed. `profile` or `profiles` are resolved stack profiles ({ commands, tools }); their programs are added.
 * `agy` is never added to `permissions.allow` (Constraint C2).
 * `restricted` are the `read_file(...)` rules of the restricted files that exist in the tree (`agyReadDenials`): the tool
 * matches no glob, so each is an absolute path, and a rule stops its file tool but not a command such as `cat`.
 */
export function agySettings({ profile = null, profiles = null, extra = [], restricted = [], includeProvider = true } = {}) {
  const programs = new Set(BASE_PROGRAMS);
  const allProfiles = [...(profile ? [profile] : []), ...(Array.isArray(profiles) ? profiles : [])];
  for (const p of allProfiles) {
    for (const c of Object.values(p?.commands ?? {})) if (programOf(c)) programs.add(programOf(c));
    for (const t of p?.tools ?? []) if (t) programs.add(t);
  }
  for (const x of extra) programs.add(x);
  DENIED.filter((d) => d.startsWith('command(')).forEach((d) => programs.delete(d.slice(8, -1)));
  // C2: Never allow unattended nested `agy` invocations.
  programs.delete('agy');
  return {
    ...(includeProvider ? { modelProvider: 'gemini' } : {}),
    permissions: { deny: [...DENIED, ...restricted], allow: [...programs].sort().map((p) => `command(${p})`) }
  };
}
