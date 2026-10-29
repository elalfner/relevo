#!/usr/bin/env node
// Fetches the design references of an issue so the builder can read them. Usage:
//   node scripts/design-fetch.mjs --issue 42 [--repo owner/name] [--out .relevo-design] [--config relevo.yml] [--repo-root .]
//   node scripts/design-fetch.mjs --body-file issue.md ...      (the body from a file instead of GitHub, for tests)
// The references come only from the issue: the bullets of "Design reference" and the bullets of "Code pointers" that
// name a file of a linked repository. Pasted attachments are downloaded only when design.images is true; files of
// linked repositories are read through `gh api`. Downloads go to <out> (default .relevo-design), which is added to
// .git/info/exclude so it is never committed, with a manifest.json. The files of this repository are not copied.
//   exit 0: every reference is available   exit 1: some reference was refused (the reasons are printed)   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { fetchReferences } from './lib/design-fetch.mjs';
import { parseCodePointers, parseDesign } from './lib/issue-parse.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const issue = arg('issue');
const bodyFile = arg('body-file');
if (!issue && !bodyFile) fail('usage: design-fetch.mjs --issue <n> [--repo owner/name] [--out .relevo-design] [--config relevo.yml] [--repo-root .]', 2);

const configPath = resolve(arg('config') ?? 'relevo.yml');
let config = { design: { images: false }, links: [] };
if (existsSync(configPath)) {
  const loaded = loadConfig(readFileSync(configPath, 'utf8'));
  if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`, 2);
  config = loaded.config;
}
const repoRoot = resolve(arg('repo-root') ?? '.');
const out = resolve(arg('out') ?? '.relevo-design');

let body;
if (bodyFile) {
  body = readFileSync(bodyFile, 'utf8');
} else {
  const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
  const args = ['issue', 'view', String(issue), '--json', 'body', '-q', '.body', ...(repo ? ['--repo', repo] : [])];
  try {
    body = execFileSync('gh', args, { encoding: 'utf8' });
  } catch (error) {
    fail(`the issue could not be read: ${String(error.message).split('\n')[0]}`, 2);
  }
}

const design = parseDesign(body);
const pointers = parseCodePointers(body);
if (!design.present && pointers.references.length === 0 && pointers.problems.length === 0) {
  console.log('the issue has no references to fetch');
  process.exit(0);
}

// The token for linked repositories replaces GH_TOKEN only in these calls, which read the linked repositories and
// nothing else. The raw call returns a Buffer, so an image is not decoded as text.
const linksToken = process.env.GH_LINKS_TOKEN;
const linksEnv = { ...process.env, ...(linksToken ? { GH_TOKEN: linksToken } : {}) };
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', env: linksEnv });
const ghRaw = (args) => execFileSync('gh', args, { env: linksEnv, maxBuffer: 16 * 1024 * 1024 });
const result = await fetchReferences({
  references: [
    ...design.references.map((r) => ({ ...r, section: 'design' })),
    ...pointers.references.map((r) => ({ ...r, section: 'code-pointer' })),
  ],
  images: config.design.images === true,
  links: config.links,
  exists: (path) => existsSync(join(repoRoot, path)),
  fetch: globalThis.fetch,
  gh,
  ghRaw,
  token: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? null,
  linksToken: Boolean(linksToken),
  cloud: process.env.GITHUB_ACTIONS === 'true',
});
const refused = [
  ...design.problems.map((p) => ({ reference: 'Design reference', reason: p })),
  ...pointers.problems.map((p) => ({ reference: 'Code pointers', reason: p })),
  ...result.refused,
];

const EXT = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp' };
const manifest = { files: [], refused };
mkdirSync(out, { recursive: true });
result.files.forEach((f, i) => {
  const entry = { reference: f.reference, section: f.section ?? 'design', kind: f.kind, type: f.type };
  if (f.kind === 'path') {
    entry.file = f.path;
  } else {
    const base = f.kind === 'repo-file' ? f.path.split('/').pop().replace(/[^A-Za-z0-9._-]/g, '_') : `attachment.${EXT[f.type]}`;
    const name = `${String(i + 1).padStart(2, '0')}-${base}`;
    writeFileSync(join(out, name), f.buf);
    entry.file = join(out, name);
    entry.bytes = f.buf.length;
  }
  manifest.files.push(entry);
});
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// Keep the downloads out of git: a local exclusion, never committed.
try {
  const exclude = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { encoding: 'utf8', cwd: repoRoot }).trim();
  const file = resolve(repoRoot, exclude);
  const pattern = `/${out.startsWith(`${repoRoot}/`) ? out.slice(repoRoot.length + 1) : '.relevo-design'}/`;
  mkdirSync(join(file, '..'), { recursive: true });
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!current.split('\n').includes(pattern)) appendFileSync(file, `${current && !current.endsWith('\n') ? '\n' : ''}${pattern}\n`);
} catch { /* not a git repository: nothing to exclude */ }

manifest.files.forEach((f) => console.log(`available: ${f.reference} -> ${f.file}${f.bytes ? ` (${f.bytes} bytes)` : ''}`));
refused.forEach((r) => console.error(`refused: ${r.reference}: ${r.reason}`));
console.log(`${manifest.files.length} available, ${refused.length} refused; manifest in ${join(out, 'manifest.json')}`);
process.exit(refused.length > 0 ? 1 : 0);
