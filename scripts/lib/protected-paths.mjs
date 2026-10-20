// Paths the unattended agent must not change. Implements "Protected paths" of the security specification.
//
// Two tiers:
//   hard  never allowed, whatever the issue says: workflows, the Relevo configuration, the folders of skills and
//         the file with the project rules (a defect is fixed in the code, not by rewriting the rule).
//   soft  dependency manifests and lock files: allowed only when the issue lists them in an `Allow-paths:` line.

export const HARD_PATTERNS = ['.github/', 'relevo.yml', '.relevo/', '.claude/skills/', '.agents/skills/', 'skills-lock.json'];

export const SOFT_FILES = [
  'pubspec.yaml', 'pubspec.lock',
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'composer.json', 'composer.lock',
  'Gemfile', 'Gemfile.lock',
];

const clean = (path) => String(path ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

const escapeRe = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

/** Convert a glob (`*`, `**`, `?`) to a regular expression. A pattern without `/` matches at any depth, like .gitignore. */
function globToRegExp(pattern) {
  let p = clean(pattern);
  if (p.endsWith('/')) p += '**';
  const anyDepth = !p.includes('/');
  let re = '';
  for (let i = 0; i < p.length; i += 1) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      i += 1;
      if (p[i + 1] === '/') {
        i += 1;
        re += '(?:.*/)?';
      } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += escapeRe(c);
  }
  return new RegExp(`^${anyDepth ? '(?:.*/)?' : ''}${re}$`);
}

/** Does `path` match `pattern`? */
export function matchesGlob(path, pattern) {
  return globToRegExp(pattern).test(clean(path));
}

/** The rules file setting is one name or a list (`qa.rules_from`); both give a list of cleaned names. */
const ruleFiles = (rulesFile) => [].concat(rulesFile ?? []).filter(Boolean).map(clean);

function hardPatterns(rulesFile) {
  return [...HARD_PATTERNS, ...ruleFiles(rulesFile)];
}

// Hard patterns are anchored at the root of the repository; `relevo.yml` and the rules file are exact files.
const matchesHard = (path, pattern) => {
  const p = clean(path);
  const rule = clean(pattern);
  return rule.endsWith('/') ? p.startsWith(rule) : p === rule;
};

/** The hard rule a path breaks, or null. */
export function hardRule(path, { rulesFile = null } = {}) {
  return hardPatterns(rulesFile).find((pattern) => matchesHard(path, pattern)) ?? null;
}

/** Is the file a dependency manifest or lock file (soft tier)? */
export const isSoftProtected = (path) => SOFT_FILES.includes(clean(path).split('/').pop());

/**
 * Check the paths of a diff. `allow` is the list of globs from the issue's `Allow-paths:` line.
 * Returns { ok, violations: [{ path, tier: 'hard' | 'soft', rule }] }.
 */
export function checkProtected(paths, { allow = [], rulesFile = null } = {}) {
  const violations = [];
  [...new Set((paths ?? []).map(clean).filter(Boolean))].forEach((path) => {
    const hard = hardRule(path, { rulesFile });
    if (hard) {
      violations.push({ path, tier: 'hard', rule: hard });
      return;
    }
    if (isSoftProtected(path) && !allow.some((pattern) => matchesGlob(path, pattern))) {
      violations.push({ path, tier: 'soft', rule: clean(path).split('/').pop() });
    }
  });
  return { ok: violations.length === 0, violations };
}

/** Entries of an `Allow-paths:` list that name (or would cover) a hard-protected path: they can never be allowed. */
export function hardPathsInAllow(allow, { rulesFile = null } = {}) {
  const probes = [...HARD_PATTERNS.map((pattern) => (pattern.endsWith('/') ? `${pattern}x` : pattern)), ...ruleFiles(rulesFile)].filter(Boolean);
  return (allow ?? []).filter((entry) => hardRule(entry, { rulesFile }) || probes.some((probe) => matchesGlob(probe, entry)));
}

export function formatViolations(violations) {
  return violations
    .map((v) => {
      if (v.tier === 'hard') return `${v.path}  protected path (${v.rule}): it is never changed by an unattended run`;
      if (v.tier === 'scope') return `${v.path}  outside the platform (${v.rule}): an issue changes only its platform; list the path in an Allow-paths: line to allow it`;
      return `${v.path}  dependency file: the issue must list it in an Allow-paths: line`;
    })
    .join('\n');
}
