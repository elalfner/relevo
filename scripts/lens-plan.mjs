#!/usr/bin/env node
// Says which QA lenses are active for a change, as JSON. Usage:
//   node scripts/lens-plan.mjs [--platform name] [--text-file issue.md] [--config relevo.yml] [--max-parallel n]
// Prints { lenses: [{ lens, active, reason? }], skipped: ["SKIPPED interface: ..."], batches: [[lens, ...]] }. The batches are the
// launch groups: all the active lenses together, or groups of at most --max-parallel when the runtime limits the subagents. The interface lens is active only when the
// stack of the platform has an interface and the change matches at least one interface rule beyond the always-on ones.
// Without the interface knowledge of the plugin the lens is skipped, never an error.
//   exit 0: printed   exit 2: bad arguments or an invalid relevo.yml

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { batchLenses, planLenses, skippedLines } from './lib/lens-plan.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? undefined : process.argv[i + 1]; };
const fail = (m) => { console.error(m); process.exit(2); };

const maxParallel = arg('max-parallel') === undefined ? Infinity : Number(arg('max-parallel'));
if (!(maxParallel === Infinity || (Number.isInteger(maxParallel) && maxParallel > 0))) fail('--max-parallel must be a whole number above 0');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
const names = Object.keys(loaded.config.platforms);
const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
if (!name || !loaded.config.platforms[name]) fail(`give --platform <${names.join('|')}>`);
const platform = loaded.config.platforms[name];
const read = (p) => { const f = p.startsWith('/') ? p : resolve(dirname(configPath), p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const resolved = resolveProfile({ platform, pluginRoot: root, read });
if (!resolved.ok) fail(resolved.errors.join('\n'));

// The interface knowledge belongs to another change: ask for it if it is installed, and treat its absence as "no lens".
let interfaceKind = null;
let extraRules = null;
if (existsSync(resolve(root, 'scripts/lib/interface-rules.mjs')) && typeof resolved.profile.interface === 'string') {
  interfaceKind = resolved.profile.interface;
  if (interfaceKind !== 'none') {
    try {
      const rules = await import('./lib/interface-rules.mjs');
      const knowledge = await import('./lib/interface-knowledge.mjs');
      const k = knowledge.loadKnowledge(root, resolved.profile.stack);
      const text = arg('text-file') ? readFileSync(arg('text-file'), 'utf8') : '';
      const kinds = rules.kindsOf({ interfaceKind, targets: platform.targets });
      const selected = rules.selectRules({ knowledge: k, role: 'qa', stack: resolved.profile.stack, kinds, text, overrides: k.overrides, budget: Infinity });
      extraRules = selected.rules.filter((r) => !r.core).length;
    } catch {
      extraRules = null;
    }
  }
}
const lenses = planLenses({ interfaceKind, extraRules });
console.log(JSON.stringify({ lenses, skipped: skippedLines(lenses), batches: batchLenses(lenses, maxParallel) }, null, 2));
