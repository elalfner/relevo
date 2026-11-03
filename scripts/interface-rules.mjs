#!/usr/bin/env node
// Prints the interface rules an agent should receive. Usage:
//   node scripts/interface-rules.mjs --role <think|issue|dev|qa|review> [--platform name] [--text "…" | --text-file f]
//                                    [--budget bytes] [--json] [--config relevo.yml] [--plugin-root dir]
//   node scripts/interface-rules.mjs --coverage [--platform name]
// The platform gives the stack and its interface kind (and `web` too when a mobile stack lists the web target). The core
// rules are always printed; the others when a word of the text matches their tags. `dev` and `qa` get examples of the
// stack and a budget; the output says how many rules were left out. `--coverage` lists the blocking rules that have no
// example for the stack, as a warning: it never fails.
//   exit 0: printed   exit 2: bad usage, invalid relevo.yml or a platform without an interface prints nothing and exits 0

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { loadKnowledge, mergeRepositoryRules } from './lib/interface-knowledge.mjs';
import { DEFAULT_BUDGET, ROLES, coverageGaps, kindsOf, renderRules, selectRules } from './lib/interface-rules.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const pluginRoot = resolve(arg('plugin-root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);

const names = Object.keys(loaded.config.platforms);
const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
if (!name) fail(`give --platform <${names.join('|')}>`);
const platform = loaded.config.platforms[name];
if (!platform) fail(`unknown platform "${name}"; the platforms of relevo.yml are: ${names.join(', ')}`);

const base = dirname(configPath);
const read = (path) => {
  const file = path.startsWith('/') ? path : resolve(base, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const resolved = resolveProfile({ platform, pluginRoot, read });
if (!resolved.ok) fail(resolved.errors.join('\n'));
const { profile } = resolved;
const kinds = kindsOf({ interfaceKind: profile.interface, targets: platform.targets });

const knowledge = loadKnowledge(pluginRoot, profile.stack);
const merged = mergeRepositoryRules(knowledge.rules, read('.relevo/interface.json'));
knowledge.rules = merged.rules;

if (process.argv.includes('--coverage')) {
  const gaps = coverageGaps({ knowledge, stack: profile.stack, kinds, overrides: knowledge.overrides });
  console.log(gaps.length ? `warning: ${gaps.length} blocking rule${gaps.length === 1 ? ' has' : 's have'} no example for ${profile.stack}:\n${gaps.map((g) => `  - ${g.id}`).join('\n')}` : `every blocking rule has an example for ${profile.stack}`);
  process.exit(0);
}

const role = arg('role');
if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(', ')}`);
if (kinds.size === 0) process.exit(0);
const text = arg('text-file') ? readFileSync(arg('text-file'), 'utf8') : arg('text') ?? '';
const selection = selectRules({
  knowledge, role, stack: profile.stack, kinds, text, overrides: knowledge.overrides,
  budget: arg('budget') ? Number(arg('budget')) : DEFAULT_BUDGET,
});
console.log(process.argv.includes('--json') ? JSON.stringify(selection, null, 2) : renderRules(selection));
