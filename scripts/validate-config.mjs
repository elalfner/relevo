#!/usr/bin/env node
// Validates relevo.yml. Usage: node scripts/validate-config.mjs [path] [--json] [--effective]
//   exit 0: valid   exit 1: invalid   exit 2: file not found

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { profileLookups } from './lib/stack-profile.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const target = resolve(args.find((a) => !a.startsWith('--')) ?? 'relevo.yml');

if (!existsSync(target)) {
  console.error(`relevo.yml not found at ${target}. Run /relevo:init to create it.`);
  process.exit(2);
}

// Targets and `checks` are checked against the profile of each stack, when a profile can be read.
const read = (path) => {
  const file = path.startsWith('/') ? path : resolve(dirname(target), path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = loadConfig(readFileSync(target, 'utf8'), profileLookups({ pluginRoot, read }));

if (result.ok) {
  result.config.qa.rules_from.forEach((file) => {
    if (!existsSync(resolve(dirname(target), file))) {
      result.warnings.push({ path: 'qa.rules_from', message: `qa.rules_from points to "${file}", which does not exist` });
    }
  });
}

if (flags.has('--json')) {
  console.log(JSON.stringify({ ok: result.ok, errors: result.errors, warnings: result.warnings }, null, 2));
} else {
  result.errors.forEach((e) => console.error(`error: ${e.message}`));
  result.warnings.forEach((w) => console.error(`warning: ${w.message}`));
  if (result.ok) console.log(`${target} is valid`);
}
if (result.ok && flags.has('--effective')) console.log(JSON.stringify(result.config, null, 2));
process.exit(result.ok ? 0 : 1);
