#!/usr/bin/env node
// Plans and applies the repository setup. Usage:
//   node scripts/init.mjs plan  [--answers answers.json] [--repo owner/name] [--json]
//   node scripts/init.mjs apply [--answers answers.json] [--repo owner/name] [--skip id,id] [--json]
// `plan` changes nothing. `apply` carries out the planned changes except installs (the skill asks first).
// answers.json: { "members": ["a","b"], "specWriter": "a", "reviewMode": "peer", "language": "en", "platform": "flutter-android" }
// It never reads or writes the model API key.
// exit 0: done   exit 2: bad arguments or a failed change

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { gatherFacts, readOnlyGh, WORKFLOW_FILES } from './lib/doctor.mjs';
import { applyPlan, planInit, renderPlan, skipItems } from './lib/init.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const mode = process.argv[2];
if (!['plan', 'apply'].includes(mode)) fail('usage: init.mjs <plan|apply> [--answers file] [--repo owner/name] [--json]');

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const run = (name, args, input) => execFileSync(name, args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const tool = (name, args) => run(name, args);

let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY ?? null;
if (!repo) {
  try {
    repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  } catch {
    fail('could not find the GitHub repository: run inside one, or pass --repo owner/name (and sign in with `gh auth login`)');
  }
}

const answers = arg('answers') ? JSON.parse(readFileSync(arg('answers'), 'utf8')) : {};
const facts = gatherFacts({
  tool,
  gh: readOnlyGh((args) => run('gh', args)),
  exists: existsSync,
  read: (p) => readFileSync(p, 'utf8'),
  listDir: (p) => readdirSync(p),
  skillDirs: ['.claude/skills', '.agents/skills', `${homedir()}/.claude/skills`],
  repo,
  platform: answers.platform ?? (existsSync('relevo.yml') ? (/^platform:\s*(\S+)/m.exec(readFileSync('relevo.yml', 'utf8')) ?? [])[1] : null) ?? 'flutter-android',
});

let admin = false;
try {
  admin = JSON.parse(run('gh', ['api', `repos/${repo}`])).permissions?.admin === true;
} catch {
  admin = false;
}

const templates = {
  config: readFileSync(`${root}/templates/relevo.yml`, 'utf8'),
  workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, readFileSync(`${root}/templates/workflows/${f}`, 'utf8')])),
};
const keepPaths = ['openspec/specs/.gitkeep', 'openspec/changes/archive/.gitkeep'];
const current = {
  workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, existsSync(`.github/workflows/${f}`) ? readFileSync(`.github/workflows/${f}`, 'utf8') : null])),
  gitignore: existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : null,
  keepFiles: Object.fromEntries(keepPaths.map((p) => [p, existsSync(p)])),
};

let items;
try {
  items = planInit({ facts, answers, templates, current, admin });
} catch (err) {
  fail(err.message);
}

if (mode === 'plan') {
  console.log(process.argv.includes('--json') ? JSON.stringify(items, null, 2) : renderPlan(items));
  process.exit(0);
}

const io = {
  gh: (args, input) => run('gh', args, input),
  write: (p, text) => {
    mkdirSync(dirname(resolve(p)), { recursive: true });
    writeFileSync(p, text);
  },
  append: (p, line) => {
    const have = existsSync(p) ? readFileSync(p, 'utf8') : '';
    appendFileSync(p, `${have === '' || have.endsWith('\n') ? '' : '\n'}${line}\n`);
  },
};
const skipped = (arg('skip') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const results = applyPlan(skipItems(items, skipped), { repo, io });
skipped.forEach((id) => console.error(`skipped ${id}: run init again to apply it`));
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else {
  results.forEach((r) => {
    console.log(`${r.ok ? 'done  ' : 'FAILED'} ${r.id}: ${r.message}`);
    (r.checklist ?? []).forEach((c) => console.log(`         by hand: ${c}`));
  });
  items.filter((i) => i.status === 'manual').forEach((i) => {
    console.log(`by hand ${i.id}: ${i.description}`);
    (i.checklist ?? []).forEach((c) => console.log(`         ${c}`));
  });
}
process.exit(results.some((r) => !r.ok && !r.checklist) ? 2 : 0);
