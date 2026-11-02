// Which files the token reader may open: the declared paths, or the detected ones after the person confirmed them.
// Detection is by convention only and reads no file content; the plugin names no folder of any project.

import { isRestricted } from './restricted-paths.mjs';

export const TOKEN_EXTENSIONS = /\.(dart|css|scss|pcss)$|(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/;
const SKIP_DIRS = ['node_modules', '.git', 'build', 'dist', '.dart_tool', 'vendor', 'coverage', '.next', '.nuxt', 'ios/Pods'];
export const MAX_FILES = 200;
export const MAX_BYTES = 400_000;

const clean = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
const inSkipped = (p) => SKIP_DIRS.some((d) => `/${p}/`.includes(`/${d}/`));

/**
 * The files to read, from a listing of the repository's files and the paths asked for.
 * Returns { files, skippedRestricted, tooMany }: a path asked for that is a file is taken as it is; a folder gives the
 * files below it that a token reader understands, in a fixed order. A restricted file is named and never opened.
 */
export function filesFor(listing, paths, restricted) {
  const all = listing.map(clean).sort();
  const wanted = new Set();
  const skippedRestricted = [];
  paths.map(clean).forEach((p) => {
    const matches = all.filter((f) => f === p || f.startsWith(`${p}/`));
    matches.forEach((f) => {
      if (inSkipped(f.slice(p.length))) return;
      // A restricted file under a declared path is named and never opened, whatever its type.
      if (isRestricted(f, restricted)) skippedRestricted.push(f);
      else if (f === p || TOKEN_EXTENSIONS.test(f)) wanted.add(f);
    });
  });
  const files = [...wanted].sort();
  return { files: files.slice(0, MAX_FILES), skippedRestricted: [...new Set(skippedRestricted)].sort(), tooMany: files.length > MAX_FILES };
}

/**
 * Candidate token files by convention, for the person to confirm: the configuration of a styling tool, a stylesheet that
 * declares custom properties on the root (its first lines are looked at by the caller), and Dart files named after a
 * theme, a palette or colours. Returns [{ path, why }].
 */
export function detectCandidates(listing, { peek = () => '' } = {}) {
  const out = [];
  listing.map(clean).sort().filter((f) => !inSkipped(f)).forEach((f) => {
    if (/(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/.test(f)) out.push({ path: f, why: 'the configuration of the styling tool' });
    else if (/\.(css|scss|pcss)$/.test(f) && /(^|[\s,]):root\b[^{]*\{[^}]*--[\w-]+\s*:/.test(peek(f))) out.push({ path: f, why: 'custom properties declared on the root' });
    else if (/\.dart$/.test(f) && /(theme|colou?rs?|palette|tokens?)/i.test(f.split('/').pop())) out.push({ path: f, why: 'a Dart file named after a theme or colours' });
  });
  return out.slice(0, 40);
}
