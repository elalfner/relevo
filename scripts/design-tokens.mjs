#!/usr/bin/env node
// Prints the design tokens of a project (colours, text styles, spacing, radii) read from its code, with the file and line of
// each value and what could not be determined. Usage:
//   node scripts/design-tokens.mjs [--paths a,b] [--json] [--config relevo.yml] [--root dir]
// It reads only the paths declared in relevo.yml (`design.system.tokens`) or given with --paths (the ones a person
// confirmed). With neither it reads nothing: it lists, by convention, the files it would suggest and says to confirm them.
// It runs no project code, uses no network and never opens a restricted file.
//   exit 0: printed   exit 2: bad usage or invalid relevo.yml

import { existsSync, readdirSync, readFileSync as nodeRead, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { readTokens, renderTokens } from './lib/design-tokens.mjs';
import { MAX_BYTES, MAX_FILES, detectCandidates, filesFor } from './lib/design-token-files.mjs';
import { isRestricted, restrictedListFromText } from './lib/restricted-paths.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const root = resolve(arg('root') ?? '.');
const configPath = resolve(arg('config') ?? join(root, 'relevo.yml'));
let config = null;
let configText = '';
if (existsSync(configPath)) {
  configText = nodeRead(configPath, 'utf8');
  const loaded = loadConfig(configText);
  if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
  config = loaded.config;
}
const restricted = restrictedListFromText(configText);

function walk(dir, out = []) {
  readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    if (['node_modules', '.git', 'build', 'dist', '.dart_tool', 'vendor', 'coverage'].includes(e.name)) return;
    const full = join(dir, e.name);
    if (e.isSymbolicLink()) return;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(relative(root, full));
  });
  return out;
}

const listing = walk(root);
const given = arg('paths') ? arg('paths').split(',').map((s) => s.trim()).filter(Boolean) : (config?.design.system.tokens ?? []);
const json = process.argv.includes('--json');

if (given.length === 0) {
  // Nothing declared and nothing confirmed: suggest, read nothing but the first lines of a stylesheet to tell it apart.
  const visible = listing.filter((f) => !isRestricted(f, restricted));
  const peek = (f) => {
    try {
      return statSync(join(root, f)).size < MAX_BYTES ? nodeRead(join(root, f), 'utf8').slice(0, 4000) : '';
    } catch {
      return '';
    }
  };
  const detected = detectCandidates(visible, { peek });
  const out = { declared: false, detected, tokens: [], unresolved: [], sets: [], skipped_restricted: [] };
  console.log(json ? JSON.stringify(out, null, 2) : detected.length
    ? `No token files are declared (design.system.tokens in relevo.yml). Found by convention, to confirm:\n${detected.map((d) => `  ${d.path}: ${d.why}`).join('\n')}\nRun again with --paths <the ones to read>.`
    : 'No token files are declared (design.system.tokens in relevo.yml) and none were found by convention. Ask where the colours and spacing are defined.');
  process.exit(0);
}

const selection = filesFor(listing, given, restricted);
const files = [];
const unreadable = [];
selection.files.forEach((f) => {
  try {
    if (statSync(join(root, f)).size > MAX_BYTES) { unreadable.push({ path: f, reason: `larger than ${MAX_BYTES} bytes` }); return; }
    files.push({ path: f, text: nodeRead(join(root, f), 'utf8') });
  } catch (err) {
    unreadable.push({ path: f, reason: err.code ?? 'unreadable' });
  }
});
const result = readTokens(files);
const notes = [
  ...selection.skippedRestricted.map((f) => `skipped a restricted file: ${f}`),
  ...unreadable.map((u) => `could not read ${u.path}: ${u.reason}`),
  ...(selection.tooMany ? [`more than ${MAX_FILES} files matched; the first ${MAX_FILES} were read`] : []),
];
if (json) console.log(JSON.stringify({ declared: !arg('paths'), paths: given, files: files.map((f) => f.path), ...result, skipped_restricted: selection.skippedRestricted, notes }, null, 2));
else {
  console.log(renderTokens(result) || 'No tokens were found in the given paths.');
  if (notes.length) console.log(`\n${notes.join('\n')}`);
}
