// Lists the shared code that a build touched, from the diff and the import graph, never from a model. Implements "A script lists
// the shared code a build touched" of the go specification (openspec/changes/warn-protected-paths-and-assumptions).
//
// A changed source file is shared when it lives in a shared folder (a path rule) or when more than one other file of the
// repository that is not a test imports it. The graph is read with regular expressions and is approximate on purpose: it only
// adds to the list, and every entry says why it is there so that a person can check it. Nothing here blocks anything.

import { posix } from 'node:path';
import { matchesGlob } from './protected-paths.mjs';

// The files whose imports are read, and the extensions an import may leave out.
const GRAPH_EXT = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.dart'];
// Source files of other languages only get the path rule.
const OTHER_EXT = ['.php', '.py', '.rb', '.kt', '.java', '.swift', '.go', '.css', '.scss', '.sass', '.less'];
// A folder of this name at the top of the source tree holds what several screens use.
export const SHARED_DIRS = ['components', 'shared', 'common', 'composables', 'core', 'ui', 'widgets'];
// A folder of this name above it makes it the code of one screen or feature, which only the import graph can call shared.
const FEATURE_DIRS = ['views', 'pages', 'screens', 'features', 'modules', 'routes', 'apps'];
const SKIP_DIRS = ['node_modules', 'vendor', 'build', 'dist', 'coverage', '.dart_tool', 'openspec', 'docs', '.relevo-design'];
const TEST = /(?:^|\/)(?:__tests__|tests?|spec|e2e|integration_test|test_driver)\/|\.(?:test|spec)\.[a-z]+$|_test\.dart$|\.d\.ts$/i;

const ext = (path) => posix.extname(path).toLowerCase();
const inSkipped = (path) => path.split('/').some((s) => SKIP_DIRS.includes(s));
export const isTest = (path) => TEST.test(path);
const isGraphFile = (path) => GRAPH_EXT.includes(ext(path)) && !inSkipped(path);
/** A file that can be shared code: source, not a test, not a document or a generated folder. */
export const isCode = (path) => (GRAPH_EXT.includes(ext(path)) || OTHER_EXT.includes(ext(path))) && !inSkipped(path) && !isTest(path);

const IMPORT_JS = [/\b(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g, /\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g];
const IMPORT_DART = /^\s*(?:import|export|part)\s+['"]([^'"]+)['"]/gm;

/** The specifiers that a file imports. */
export function importsOf(path, text) {
  const out = new Set();
  const patterns = ext(path) === '.dart' ? [IMPORT_DART] : IMPORT_JS;
  patterns.forEach((re) => [...String(text).matchAll(re)].forEach((m) => out.add(m[1])));
  return [...out];
}

// The folder that an alias is rooted in: `<prefix>/src/` of the importer, so a monorepo with several apps resolves in its own.
function rootOf(importer, folder) {
  const parts = importer.split('/');
  const i = parts.indexOf(folder);
  return i === -1 ? null : parts.slice(0, i + 1).join('/');
}

/** The tracked file that a specifier of `importer` points at, or null. */
export function resolveImport(importer, spec, files) {
  let base = null;
  const dart = ext(importer) === '.dart';
  if (spec.startsWith('./') || spec.startsWith('../') || (dart && !/^(?:package|dart):/.test(spec))) base = posix.join(posix.dirname(importer), spec);
  else if (/^[@~]\//.test(spec)) {
    const root = rootOf(importer, 'src');
    if (root) base = `${root}/${spec.slice(2)}`;
  } else if (spec.startsWith('package:')) {
    const root = rootOf(importer, 'lib');
    if (root) base = `${root}/${spec.replace(/^package:[^/]+\//, '')}`;
  }
  if (!base) return null;
  const candidates = [base, ...GRAPH_EXT.map((e) => `${base}${e}`), ...GRAPH_EXT.map((e) => `${base}/index${e}`)];
  return candidates.find((c) => files.has(c)) ?? null;
}

/** Does the path live in a shared folder at the top of the source tree (or match one of the `extra` globs)? Returns the rule or null. */
export function pathRule(path, extra = []) {
  const glob = extra.find((g) => matchesGlob(path, g));
  if (glob) return glob;
  const dirs = path.split('/').slice(0, -1);
  const at = dirs.findIndex((d) => SHARED_DIRS.includes(d));
  if (at === -1 || dirs.slice(0, at).some((d) => FEATURE_DIRS.includes(d))) return null;
  return `${dirs[at]}/`;
}

/**
 * changed  [{ path, status: 'added' | 'modified' }] from the diff against the base
 * files    every tracked path
 * read     (path) => text of a tracked file, or null when it cannot be read
 * extra    globs of shared folders that the project adds
 * Returns { shared: [{ path, status, why, importers }], notes }.
 */
export function sharedFiles({ changed, files, read, extra = [], maxFiles = 4000, maxBytes = 300 * 1024 }) {
  const notes = [];
  const set = new Set(files);
  const candidates = changed.filter((c) => isCode(c.path) && set.has(c.path));
  const unread = [...new Set(candidates.filter((c) => !isGraphFile(c.path)).map((c) => ext(c.path)))];
  if (unread.length) notes.push(`the import graph is not read for ${unread.join(', ')} files, so only the shared-folder rule applies to them`);

  // Who imports whom, over the tracked files that are not tests.
  const importers = new Map();
  const graphFiles = files.filter((f) => isGraphFile(f) && !isTest(f));
  if (candidates.some((c) => isGraphFile(c.path))) {
    if (graphFiles.length > maxFiles) notes.push(`only the first ${maxFiles} of ${graphFiles.length} source files were read for the import graph`);
    graphFiles.slice(0, maxFiles).forEach((file) => {
      const text = read(file);
      if (text === null || text.length > maxBytes) return;
      importsOf(file, text).forEach((spec) => {
        const target = resolveImport(file, spec, set);
        if (target && target !== file) (importers.get(target) ?? importers.set(target, new Set()).get(target)).add(file);
      });
    });
  }

  const shared = [];
  candidates.forEach(({ path, status }) => {
    const rule = pathRule(path, extra);
    const who = [...(importers.get(path) ?? [])].sort();
    const why = [];
    if (rule) why.push(`in a shared folder (${rule})`);
    if (who.length >= 2) why.push(`used by ${who.length} files`);
    if (why.length) shared.push({ path, status, why: why.join(', '), importers: who.slice(0, 5) });
  });
  return { shared: shared.sort((a, b) => a.path.localeCompare(b.path)), notes };
}

/** The line of the hand-off; '' when nothing is shared. */
export const sharedLine = (shared) => shared.map((s) => `${s.path} (${s.status}, ${s.why})`).join('; ');
