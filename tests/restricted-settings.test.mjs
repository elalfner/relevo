import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agyCovers, claudeCovers } from '../scripts/lib/restricted-settings.mjs';

const CLI = new URL('../scripts/restricted-settings.mjs', import.meta.url).pathname;
const run = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
const folder = (files = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-restricted-settings-'));
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  });
  return dir;
};

test('the command writes the denials into .claude/settings.json, keeps what the file has, and is idempotent', () => {
  const dir = folder({ '.claude/settings.json': JSON.stringify({ permissions: { deny: ['Bash(curl:*)'] }, model: 'x' }) });
  const first = run(dir);
  assert.equal(first.status, 0, first.stderr);
  const after = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  assert.equal(after.model, 'x');
  assert.equal(after.permissions.deny[0], 'Bash(curl:*)');
  assert.ok(after.permissions.deny.includes('Read(**/.env)'));
  assert.match(first.stdout, /left for you to commit/);
  assert.match(run(dir).stdout, /nothing changed/);
});

test('the command adds the entries of restricted_paths from relevo.yml, and leaves a broken file alone', () => {
  const dir = folder({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nrestricted_paths:\n  - infra/prod.tfvars\n' });
  assert.equal(run(dir).status, 0);
  assert.ok(JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).permissions.deny.includes('Read(./infra/prod.tfvars)'));
  const broken = folder({ '.claude/settings.json': '{ not json' });
  const r = run(broken);
  assert.equal(r.status, 2);
  assert.equal(readFileSync(join(broken, '.claude/settings.json'), 'utf8'), '{ not json');
  assert.equal(run(folder(), '--agent', 'other').status, 2);
});

test('Antigravity: the command writes one read_file rule for each restricted file that exists, by exact path, never opening one', () => {
  const dir = folder({ '.env': 'A=canary-value-0123456789\n', 'api/.env.production': 'B=1\n', '.env.example': 'A=\n', 'a.txt': 'x\n' });
  const settings = join(dir, 'home', 'settings.json');
  const r = run(dir, '--agent', 'antigravity', '--settings', settings);
  assert.equal(r.status, 0, r.stderr);
  const { deny } = JSON.parse(readFileSync(settings, 'utf8')).permissions;
  const real = realpathSync(dir); // the process reports its working folder with links resolved
  assert.deepEqual(deny, [`read_file(${real}/.env)`, `read_file(${real}/api/.env.production)`]);
  assert.ok(!r.stdout.includes('canary') && !r.stderr.includes('canary'));
});

test('what a settings file covers: a Read rule by glob, by folder, by absolute path; an agy rule by path or folder', () => {
  const claude = (...deny) => ({ permissions: { deny } });
  assert.equal(claudeCovers(claude('Read(**/.env)'), '.env', '/r'), true);
  assert.equal(claudeCovers(claude('Read(**/.env)'), 'api/.env', '/r'), true);
  assert.equal(claudeCovers(claude('Read(./.env)'), '.env', '/r'), true);
  assert.equal(claudeCovers(claude('Read(./.env)'), 'api/.env', '/r'), false, 'a rule for the root file does not cover the one below');
  assert.equal(claudeCovers(claude('Read(./secrets/**)'), 'secrets/a.txt', '/r'), true);
  assert.equal(claudeCovers(claude('Read(secrets)'), 'secrets/a.txt', '/r'), true);
  assert.equal(claudeCovers(claude('Read(//r/api/.env)'), 'api/.env', '/r'), true);
  assert.equal(claudeCovers(claude('Read(**/.env.*)'), '.env.production', '/r'), true);
  assert.equal(claudeCovers(claude('Bash(cat:*)', 'Read(**/*.md)'), '.env', '/r'), false);
  assert.equal(claudeCovers({}, '.env', '/r'), false);
  assert.equal(agyCovers({ permissions: { deny: ['read_file(/r/.env)'] } }, '/r/.env'), true);
  assert.equal(agyCovers({ permissions: { deny: ['read_file(/r/)'] } }, '/r/api/.env'), true);
  assert.equal(agyCovers({ permissions: { deny: ['read_file(*)'] } }, '/r/.env'), true);
  assert.equal(agyCovers({ permissions: { deny: ['read_file(.env)'] } }, '/r/.env'), false, 'a bare name is not an exact path');
  assert.equal(agyCovers({ permissions: { deny: ['command(cat)'] } }, '/r/.env'), false);
});
