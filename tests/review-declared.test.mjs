import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProfile, resolveProfile } from '../scripts/lib/stack-profile.mjs';
import { adapterFor } from '../scripts/lib/review-adapters.mjs';

const CLI = new URL('../scripts/review-adapter.mjs', import.meta.url).pathname;
const CONFIG = 'limits:\n  run_max_cost: 5\nplatforms:\n  backend:\n    stack: nhost\n    path: backend\n';

function repo(profile, config = CONFIG, stack = 'nhost') {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-decl-'));
  writeFileSync(join(dir, 'relevo.yml'), config);
  mkdirSync(join(dir, '.relevo/stacks'), { recursive: true });
  if (profile !== null) writeFileSync(join(dir, `.relevo/stacks/${stack}.md`), profile);
  return dir;
}
const run = (dir, ...args) => spawnSync('node', [CLI, '--config', join(dir, 'relevo.yml'), ...args], { encoding: 'utf8', cwd: dir });
const profile = (review) => `---\nstack: nhost\nreview:\n${review}---\n`;

test('Scenario: Declared adapter - exit 0 with kind api, declared, log, test and needs', () => {
  const r = run(repo(profile('  adapter: api\n  needs: [nhost, docker]\n  log: compose:postgres,auth\n  test: npm run --silent test:integration\n')), '--platform', 'backend');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = JSON.parse(r.stdout);
  assert.deepEqual([out.supported, out.kind, out.declared, out.log, out.test, out.needs, out.platform, out.needs_autopilot], [true, 'api', true, 'compose:postgres,auth', 'npm run --silent test:integration', ['nhost', 'docker'], 'backend', false]);
});

test('Scenario: Declared adapter with an invalid profile - exit 1, the key is named and the issue stays built', () => {
  const r = run(repo(profile('  adapter: api\n  log: compose:\n')), '--platform', 'backend');
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.supported, false);
  assert.match(out.reason, /"review\.test" is missing/);
  assert.match(out.reason, /issue stays built/);
  const remote = JSON.parse(run(repo(profile('  adapter: api\n  log: compose:\n  test: curl https://api.example.com\n')), '--platform', 'backend').stdout);
  assert.match(remote.reason, /"review\.test"/);
});

test('a stack with no profile at all, or with no declaration, stays unsupported with the new sentence', () => {
  [null, profile('  log: compose:\n')].forEach((p) => {
    const r = run(repo(p), '--platform', 'backend');
    assert.equal(r.status, 1);
    assert.match(JSON.parse(r.stdout).reason, /no targets can declare an api adapter/);
  });
});

test('a shipped stack with a broken repository profile still exits 0', () => {
  const dir = repo('---\nstack: laravel\nreview:\n  adapter: nonsense\n---\n', 'limits:\n  run_max_cost: 5\nplatforms:\n  api:\n    stack: laravel\n', 'laravel');
  const r = run(dir, '--platform', 'api');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).kind, 'api');
  assert.equal(JSON.parse(r.stdout).declared, undefined);
});

// ---------- the documentation of the declaration

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const page = (f) => readFileSync(join(ROOT, f), 'utf8');
const exampleOf = (f) => page(f).match(/```markdown\n(---\nstack: backend-api[\s\S]*?\n---\n[\s\S]*?)\n```/)[1];

test('Scenario: The documented example - both languages show the same profile, which parses and resolves to a declared api adapter', () => {
  const en = exampleOf('docs/stacks.md');
  const es = exampleOf('docs/stacks.es.md');
  assert.equal(en, es, 'both languages give the same example');
  const parsed = parseProfile(en);
  assert.deepEqual(parsed.errors, []);
  const read = (path) => (path === '.relevo/stacks/backend-api.md' ? en : null);
  const resolved = resolveProfile({ platform: { stack: 'backend-api', targets: [] }, pluginRoot: ROOT, read });
  assert.equal(resolved.ok, true, JSON.stringify(resolved.errors));
  const adapter = adapterFor({ stack: 'backend-api', target: null, review: resolved.profile.review });
  assert.deepEqual([adapter.supported, adapter.kind, adapter.declared, adapter.log, adapter.needs], [true, 'api', true, 'compose:postgres,api,auth', ['node', 'docker']]);
});

test('the two pages explain the declaration under the same headings and with the same keys', () => {
  const bullets = (f) => [...page(f).matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1]);
  const section = (f, heading) => page(f).split(heading)[1].split(/^## /m)[0];
  const en = section('docs/stacks.md', '### Declaring a review adapter for your own stack');
  const es = section('docs/stacks.es.md', '### Declara un adaptador de review para tu propio stack');
  for (const key of ['adapter: api', 'needs', 'log: compose:<', 'review.test', 'review.log', '{filter}', 'REVIEW INCONCLUSIVE', 'review.autopilot', '--needs node,docker', '.relevo/stacks/<stack>.md']) {
    assert.ok(en.includes(key), `English: ${key}`);
    assert.ok(es.includes(key), `Spanish: ${key}`);
  }
  assert.equal(en.match(/^- \*\*/gm).length, es.match(/^- \*\*/gm).length, 'the same number of points');
  assert.ok(bullets('docs/stacks.md').length > 0);
});
