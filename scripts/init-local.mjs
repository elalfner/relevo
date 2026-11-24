#!/usr/bin/env node
// Plans and applies the setup of a project of one person with no GitHub (`/relevo:init --local`). Usage:
//   node scripts/init-local.mjs plan  [--answers answers.json] [--json]
//   node scripts/init-local.mjs apply [--answers answers.json] [--json]
// answers.json: { "platforms": { "app": { "stack": "vue", "path": ".", "targets": ["web"] } }, "cost": 5, "language": "en" }
// `plan` changes nothing. `apply` carries out the changes except installs (the skill asks first). It never calls gh and never touches the network.
//   exit 0: done (or nothing to do)   exit 1: the plan needs answers, or a step failed   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { loadConfig } from './lib/config.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { renderPlan } from './lib/init.mjs';
import { applyLocalPlan, ISSUES_KEEP, planLocalInit } from './lib/init-local.mjs';
import { REQUIRED_SKILLS } from './lib/doctor.mjs';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? undefined : process.argv[i + 1]; };
const fail = (m, code = 2) => { console.error(m); process.exit(code); };
const mode = process.argv[2];
if (!['plan', 'apply'].includes(mode)) fail('usage: init-local.mjs <plan|apply> [--answers file] [--json]');

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ok = (cmd, args) => { try { run(cmd, args); return true; } catch { return false; } };
const answers = arg('answers') ? JSON.parse(readFileSync(arg('answers'), 'utf8')) : {};

const isRepo = ok('git', ['rev-parse', '--git-dir']);
const configText = existsSync('relevo.yml') ? readFileSync('relevo.yml', 'utf8') : null;
const loaded = configText === null ? null : loadConfig(configText);
const skillDirs = ['.claude/skills', '.agents/skills', `${homedir()}/.claude/skills`];
const folderNames = skillDirs.flatMap((d) => (existsSync(d) ? readdirSync(d) : []));
const openspec = (() => { try { return run('openspec', ['--version']).trim(); } catch { return null; } })();
const facts = {
  isRepo,
  hasCommit: isRepo && ok('git', ['rev-parse', '--verify', '-q', 'HEAD']),
  branch: isRepo ? (run('git', ['branch', '--show-current']).trim() || null) : null,
  configText,
  config: loaded?.ok ? loaded.config : null,
  issuesKeep: existsSync(ISSUES_KEEP),
  gitignoreText: existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : null,
  openspec,
  openspecRoot: existsSync('openspec/config.yaml'),
  skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, folderNames.includes(n)])),
};

let plan;
try { plan = planLocalInit({ facts, answers }); } catch (error) { fail(error.message); }
const json = process.argv.includes('--json');
const needs = plan.questions.length > 0;

if (mode === 'plan' || needs || plan.blocked) {
  console.log(json ? JSON.stringify(plan, null, 2) : [renderPlan(plan.items), ...(needs ? [`Needs answers: ${plan.questions.join(', ')}`] : [])].join('\n'));
  process.exit(needs || plan.blocked ? 1 : 0);
}
const io = {
  git: (a) => run('git', a),
  write: (p, t) => writeFileSync(p, t),
  append: (p, line) => appendFileSync(p, `${existsSync(p) && !readFileSync(p, 'utf8').endsWith('\n') ? '\n' : ''}${line}\n`),
  mkdir: (p) => mkdirSync(p, { recursive: true }),
};
const results = applyLocalPlan(plan.items, { io });
console.log(json ? JSON.stringify(results, null, 2) : results.map((r) => `${r.ok ? 'done  ' : 'FAILED'} ${r.message}`).join('\n') || 'Nothing to do.');
process.exit(results.some((r) => !r.ok) ? 1 : 0);
