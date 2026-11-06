#!/usr/bin/env node
// The model and the effort of each agent of a run. Usage:
//   node scripts/model-plan.mjs [--config relevo.yml] [--issue-file issue.md] [--title "..."] [--tasks tasks.md] [--lenses spec,security,code]
// Prints one line of JSON { dev, qa: { <lens>: ... }, signals, notes }; each role is { model, effort, source, why } with the
// source `config`, `auto` or `issue`. With $RELEVO_PROGRESS_DIR it also saves the plan there as model-plan.json (outside the
// working tree), for the report of the run. `go` launches every agent with what this prints and never chooses a model itself.
//
// It never fails the run: exit 0 always. When it cannot make the plan it prints the plan of the configuration alone (a role on
// `auto` gets the default model of the role) with the reason; when even the configuration cannot be read it prints
// { "failed": true, "reason": ... } and `go` goes on with the configuration.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { QA_LENSES, loadConfig } from './lib/config.mjs';
import { configPlan, planModels } from './lib/model-plan.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

function emit(plan) {
  console.log(JSON.stringify(plan));
  const dir = process.env.RELEVO_PROGRESS_DIR;
  if (!dir) return;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'model-plan.json'), JSON.stringify(plan));
  } catch { /* the report simply has no plan */ }
}

try {
  const configPath = resolve(arg('config') ?? 'relevo.yml');
  const loaded = existsSync(configPath) ? loadConfig(readFileSync(configPath, 'utf8')) : { ok: false, errors: [{ message: `relevo.yml not found at ${configPath}` }] };
  if (!loaded.ok) {
    console.log(JSON.stringify({ failed: true, reason: `relevo.yml is not valid: ${loaded.errors.map((e) => e.message).join('; ').slice(0, 300)}` }));
  } else {
    const lenses = arg('lenses') ? arg('lenses').split(',').map((l) => l.trim()).filter((l) => QA_LENSES.includes(l)) : QA_LENSES;
    try {
      const read = (p) => (p && existsSync(resolve(p)) ? readFileSync(resolve(p), 'utf8') : null);
      emit(planModels({ config: loaded.config, issue: { title: arg('title') ?? '', body: read(arg('issue-file')) ?? '' }, tasksText: read(arg('tasks')), lenses }));
    } catch (error) {
      emit(configPlan(loaded.config, `the model plan failed (${String(error.message).slice(0, 120)}), so the configuration is used`, lenses));
    }
  }
} catch (error) {
  console.log(JSON.stringify({ failed: true, reason: `the model plan failed: ${String(error.message).slice(0, 200)}` }));
}
process.exit(0);
