#!/usr/bin/env node
// Prints the next step of an issue, in the language of the repository. Usage:
//   node scripts/next-step.mjs --state built --issue 42 [--reason <reason>] [--language es] [--config relevo.yml] [--json]
//   node scripts/next-step.mjs --labels "relevo:pr-open,bug" --issue 42 [--reason <reason>]
//   node scripts/next-step.mjs --after init
// States: the lifecycle labels without the prefix (built, in-review, pr-open, needs-spec, build-failed, ...), draft and closed.
// --labels: the labels of an open issue, comma separated and possibly empty; the state is read from them (the configured names
//   count), `needs-reviewer` adds its own line, and needs-spec or build-failed with no --reason points to the last comment.
// --reason: the variant of building, in-review, needs-spec or build-failed (see NEXT_STEP_REASONS).
// --after init: the step that ends the report of `init`.
// The language comes from --language, else from relevo.yml (if found), else English.
//   exit 0: printed   exit 2: unknown state or reason, a missing issue number, or bad arguments

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { NEXT_STEP_STATES, afterInit, nextStep, stepsOfLabels } from './lib/next-step.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const labels = arg('labels');
const after = arg('after');
if ((!arg('state') && labels === undefined && after !== 'init') || (arg('state') && labels !== undefined)) {
  console.error(`usage: next-step.mjs --state <${NEXT_STEP_STATES.join('|')}> --issue <number> [--reason <reason>] [--language xx] [--json]\n       next-step.mjs --labels "<label,label>" --issue <number> [--reason <reason>]\n       next-step.mjs --after init`);
  process.exit(2);
}

let language = arg('language');
let overrides = {};
const path = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(path)) {
  const loaded = loadConfig(readFileSync(path, 'utf8'));
  if (loaded.ok) {
    language ??= loaded.config.language;
    overrides = loaded.config.labels;
  }
}

try {
  const json = process.argv.includes('--json');
  const options = { reason: arg('reason') ?? null, issue: arg('issue') ?? null, language: language ?? 'en' };
  if (after === 'init') {
    console.log(afterInit(options.language));
  } else if (labels !== undefined) {
    const result = stepsOfLabels({ ...options, labels: labels.split(',').map((l) => l.trim()).filter(Boolean), overrides });
    const [first, ...also] = result.steps;
    const heading = String(options.language).startsWith('es') ? 'Estado' : 'State';
    console.log(json ? JSON.stringify({ ...first, also }, null, 2) : [`${heading}: ${result.state}`, ...result.steps.map((s) => s.line)].join('\n'));
  } else {
    const step = nextStep({ ...options, state: arg('state') });
    console.log(json ? JSON.stringify(step, null, 2) : step.line);
  }
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
