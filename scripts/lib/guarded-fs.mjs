// `readFileSync` for the command-line scripts of Relevo: the same call, except that a restricted file is never opened.
// Implements "Scripts of Relevo do not read or publish restricted files" of the security specification. The check is by
// path name and runs before the file is touched; a script that was handed `.env` by mistake stops with exit 2 and a
// message that names the path, never its content. Only the entry points in scripts/ import this module, because it ends
// the process: a library function that needs the check calls `assertNotRestricted` itself and lets its caller decide.

import { existsSync, readFileSync as nodeReadFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { RestrictedPathError, assertNotRestricted, restrictedListFromText } from './restricted-paths.mjs';

let cached = null;

/** The list in force for this repository: the base plus `restricted_paths` of relevo.yml, valid or not as a whole. */
export function projectList(cwd = process.cwd()) {
  if (cached?.cwd === cwd) return cached.list;
  let text = '';
  const file = resolve(cwd, 'relevo.yml');
  if (existsSync(file)) {
    try {
      text = nodeReadFileSync(file, 'utf8');
    } catch { /* an unreadable relevo.yml leaves the base list */ }
  }
  const list = restrictedListFromText(text);
  cached = { cwd, list };
  return list;
}

/**
 * The path as the list sees it: resolved against the working folder (so `a/./b`, `a//b`, `a/../a/b` and `../<folder>/a/b`
 * are the same name) and relative to it when it is inside. The folders of the path are resolved through links (a temporary
 * folder is under /private on macOS) but the file itself is not: a symbolic link to a restricted file is not followed.
 */
function seen(path, cwd) {
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  const absolute = resolve(cwd, path);
  const rel = relative(real(cwd), join(real(dirname(absolute)), basename(absolute)));
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? absolute : rel;
}

/** Throws RestrictedPathError for a restricted path. File descriptors (0 for stdin) and non-strings pass. */
export function guardPath(path, cwd = process.cwd()) {
  if (typeof path !== 'string' && !(path instanceof URL)) return;
  const name = path instanceof URL ? path.pathname : path;
  assertNotRestricted(seen(name, cwd), projectList(cwd));
}

/** Same as `fs.readFileSync`, but a restricted file ends the script (exit 2) before it is opened. */
export function readFileSync(path, ...rest) {
  try {
    guardPath(path);
  } catch (err) {
    if (!(err instanceof RestrictedPathError)) throw err;
    console.error(`error: ${err.message}`);
    process.exit(2);
  }
  return nodeReadFileSync(path, ...rest);
}
