#!/usr/bin/env node
// Prints, as JSON, what a run shows and saves of the agent's output. Usage:
//   node scripts/run-output.mjs [--config relevo.yml] [--input true|false]
// --input is the `full_output` input of a manual start. Exit 0 always, so a step that reads it cannot fail a run.

import { decideOutput } from './lib/run-output.mjs';
import { loadConfig } from './lib/config.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

let config = null;
try {
  const result = loadConfig(readFileSync(arg('config') ?? 'relevo.yml', 'utf8'));
  config = result.ok ? result.config : null;
} catch {
  config = null;
}
console.log(JSON.stringify(decideOutput({ config, input: arg('input') })));
process.exit(0);
