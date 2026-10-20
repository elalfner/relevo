#!/usr/bin/env node
// Prints the next step of an issue, in the language of the repository. Usage:
//   node scripts/next-step.mjs --state built --issue 42 [--reason <reason>] [--language es] [--config relevo.yml] [--json]
// States: the lifecycle labels without the prefix (built, in-review, pr-open, needs-spec, qa-failed, ...).
// --reason: `missing` or `ambiguous` for needs-spec; `fix` or `delete-branch` for qa-failed.
// The language comes from --language, else from relevo.yml (if found), else English.
//   exit 0: printed   exit 2: unknown state or reason, a missing issue number, or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { NEXT_STEP_STATES, nextStep } from './lib/next-step.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

if (!arg('state')) {
  console.error(`usage: next-step.mjs --state <${NEXT_STEP_STATES.join('|')}> --issue <number> [--reason <reason>] [--language xx] [--json]`);
  process.exit(2);
}

let language = arg('language');
if (!language) {
  const path = resolve(arg('config') ?? 'relevo.yml');
  if (existsSync(path)) {
    const loaded = loadConfig(readFileSync(path, 'utf8'));
    if (loaded.ok) language = loaded.config.language;
  }
}

try {
  const step = nextStep({ state: arg('state'), reason: arg('reason') ?? null, issue: arg('issue') ?? null, language: language ?? 'en' });
  console.log(process.argv.includes('--json') ? JSON.stringify(step, null, 2) : step.line);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
