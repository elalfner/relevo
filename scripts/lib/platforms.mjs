// The platform registry of relevo.yml. Implements "Platforms are declared in a registry" of the platforms specification.
//
// `platforms` is a map of name to { stack, path, targets, checks }. The legacy `platform: flutter-android` is the
// same as one platform with stack `flutter`, path `.` and targets `[android]`.

export const LEGACY_PLATFORMS = {
  'flutter-android': { stack: 'flutter', path: '.', targets: ['android'] },
};

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const STACK_RE = /^[a-z][a-z0-9-]*$/;
const ENTRY_KEYS = new Set(['stack', 'path', 'targets', 'checks']);

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A relative path inside the repository: not absolute, no `..` segment. */
export function isRepoRelativePath(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const p = value.replace(/\\/g, '/');
  return !p.startsWith('/') && !/^[A-Za-z]:/.test(p) && !p.split('/').includes('..');
}

/**
 * Turn the `platform` / `platforms` settings of a parsed relevo.yml into one map.
 *   raw            { platform, platforms } as written (either may be undefined)
 *   knownTargets   optional function (stack) -> list of targets the stack defines, or null when unknown;
 *                  when given, targets are checked against it
 * Returns { platforms, errors }; `platforms` is always a map (the legacy default when nothing is set).
 */
export function normalizePlatforms({ platform, platforms } = {}, { knownTargets = null } = {}) {
  const errors = [];
  const has = (v) => v !== undefined && v !== null;

  if (has(platform) && has(platforms)) {
    errors.push({ path: 'platforms', message: 'set either platform (the legacy shortcut) or platforms, not both: keep only platforms' });
    return { platforms: {}, errors };
  }
  if (!has(platforms)) {
    const key = has(platform) ? platform : 'flutter-android';
    const legacy = LEGACY_PLATFORMS[key];
    if (!legacy) {
      errors.push({ path: 'platform', message: `platform has invalid value ${JSON.stringify(key)}; allowed values: ${Object.keys(LEGACY_PLATFORMS).map((k) => `"${k}"`).join(', ')}, or use platforms` });
      return { platforms: {}, errors };
    }
    return { platforms: { app: structuredClone(legacy) }, errors };
  }
  if (!isMap(platforms) || Object.keys(platforms).length === 0) {
    errors.push({ path: 'platforms', message: 'platforms must be a map of platform name to its settings, with at least one entry' });
    return { platforms: {}, errors };
  }

  const out = {};
  Object.entries(platforms).forEach(([name, entry]) => {
    const at = `platforms.${name}`;
    if (!NAME_RE.test(name)) errors.push({ path: at, message: `${at}: the platform name must be lowercase letters, digits and hyphens` });
    if (!isMap(entry)) {
      errors.push({ path: at, message: `${at} must be a map with at least a stack` });
      return;
    }
    Object.keys(entry).forEach((key) => {
      if (!ENTRY_KEYS.has(key)) errors.push({ path: `${at}.${key}`, message: `unknown setting "${at}.${key}"; allowed: ${[...ENTRY_KEYS].join(', ')}` });
    });
    if (typeof entry.stack !== 'string' || !STACK_RE.test(entry.stack)) {
      errors.push({ path: `${at}.stack`, message: `${at}.stack must name a stack, for example "flutter" (got ${JSON.stringify(entry.stack)})` });
    }
    const path = has(entry.path) ? entry.path : '.';
    if (!isRepoRelativePath(path)) errors.push({ path: `${at}.path`, message: `${at}.path must be a folder inside the repository, without a leading "/" or ".." (got ${JSON.stringify(path)})` });

    let targets = [];
    if (has(entry.targets)) {
      if (!Array.isArray(entry.targets) || entry.targets.some((t) => typeof t !== 'string' || t.trim() === '')) {
        errors.push({ path: `${at}.targets`, message: `${at}.targets must be a list of target names` });
      } else {
        targets = [...new Set(entry.targets)];
        const known = typeof entry.stack === 'string' && knownTargets ? knownTargets(entry.stack) : null;
        if (known) {
          targets.filter((t) => !known.includes(t)).forEach((t) => {
            errors.push({ path: `${at}.targets`, message: `${at}.targets has unknown target "${t}"; the stack "${entry.stack}" defines: ${known.length ? known.join(', ') : 'no targets'}` });
          });
        }
      }
    }
    const checks = has(entry.checks) ? entry.checks : {};
    if (!isMap(checks) || Object.values(checks).some((v) => typeof v !== 'string' || v.trim() === '')) {
      errors.push({ path: `${at}.checks`, message: `${at}.checks must map a command name to the command that replaces it` });
    }
    out[name] = { stack: entry.stack, path: typeof path === 'string' ? path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '') || '.' : '.', targets, ...(isMap(checks) && Object.keys(checks).length ? { checks } : {}) };
  });
  return { platforms: out, errors };
}
