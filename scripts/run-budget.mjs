#!/usr/bin/env node
// The budget of a run between its agents. Usage:
//   node scripts/run-budget.mjs record --agent <name> --tool-uses <n> [--duration-ms <n>] [--tokens <n>]
//       records what an agent used when it finished; `go` copies the numbers from the usage block that ends its report
//   node scripts/run-budget.mjs check [--config relevo.yml] [--max-turns <n>] [--max-minutes <n>]
//       prints one line of JSON and exits 1 only when a limit it can read was reached: the turns of the subagents
//       together (limits.run_max_turns) or the minutes since the run began (limits.run_max_minutes)
// Everything is kept under $RELEVO_PROGRESS_DIR, outside the working tree. Without that variable (a local run) `record`
// does nothing and `check` says it does not know and exits 0.
// The guard never stops a run on a figure it cannot read, and an error of its own exits 0: it must not fail a build.

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { budgetStatus, recordAgent, wholeNumber } from './lib/run-budget.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const [command, ...args] = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const dir = process.env.RELEVO_PROGRESS_DIR;

function limitsOf() {
  const fromFlags = { run_max_turns: wholeNumber(arg('max-turns')), run_max_minutes: wholeNumber(arg('max-minutes')) };
  const path = resolve(arg('config') ?? 'relevo.yml');
  let fromConfig = {};
  try {
    if (existsSync(path)) {
      const loaded = loadConfig(readFileSync(path, 'utf8'));
      if (loaded.ok) fromConfig = loaded.config.limits ?? {};
    }
  } catch {
    fromConfig = {};
  }
  return {
    run_max_turns: fromFlags.run_max_turns ?? fromConfig.run_max_turns,
    run_max_minutes: fromFlags.run_max_minutes ?? fromConfig.run_max_minutes,
  };
}

try {
  if (command === 'record') {
    if (dir) {
      mkdirSync(dir, { recursive: true });
      recordAgent(dir, { agent: arg('agent'), toolUses: arg('tool-uses'), durationMs: arg('duration-ms'), tokens: arg('tokens') });
    }
  } else if (command === 'check') {
    const status = budgetStatus({ dir, limits: limitsOf() });
    console.log(JSON.stringify(status));
    process.exit(status.stop ? 1 : 0);
  } else {
    process.stderr.write('run-budget: use `record` or `check`\n');
    process.exit(2);
  }
} catch (error) {
  process.stderr.write(`run-budget: ${error.message}\n`);
  if (command === 'check') console.log(JSON.stringify({ known: false, stop: false, reason: null }));
}
