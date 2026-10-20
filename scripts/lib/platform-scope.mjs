// An issue changes only its own platform. Implements "An issue changes only its platform" of the go specification.
//
// A commit of an unattended run may touch the folder of the platform of the issue, the specification of the change
// itself, GLOSSARY.md and docs/adr/ (the documentation the issue carries), and any path the issue lists in its
// `Allow-paths:` line. A platform whose folder is `.` is not restricted.

import { matchesGlob } from './protected-paths.mjs';

const clean = (path) => String(path ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');

/** Paths that every platform may change, whatever its folder. */
function isShared(path, change) {
  if (path === 'GLOSSARY.md' || path.startsWith('docs/adr/')) return true;
  return Boolean(change) && (path === `openspec/changes/${change}` || path.startsWith(`openspec/changes/${change}/`));
}

/**
 * The paths outside the platform. `within` is the platform folder (`.` or empty: no restriction), `change` is the
 * change id (its specification folder is always allowed), `allow` the globs of the issue's `Allow-paths:` line.
 * Returns violations like those of `checkProtected`: [{ path, tier: 'scope', rule: within }].
 */
export function checkScope(paths, { within = '.', change = null, allow = [] } = {}) {
  const folder = clean(within);
  if (folder === '' || folder === '.') return { ok: true, violations: [] };
  const violations = [];
  [...new Set((paths ?? []).map(clean).filter(Boolean))].forEach((path) => {
    const inside = path === folder || path.startsWith(`${folder}/`);
    if (inside || isShared(path, change) || allow.some((pattern) => matchesGlob(path, pattern))) return;
    violations.push({ path, tier: 'scope', rule: folder });
  });
  return { ok: violations.length === 0, violations };
}
