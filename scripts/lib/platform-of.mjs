// Which platform an issue belongs to. Implements "An issue belongs to one platform" of the platforms specification.
//
// One pure function, used by the planner, the issue check, `platform-of.mjs` and the tests, so that they cannot
// disagree about what an issue says.

import { parseIssueBody } from './issue-parse.mjs';

const names = (platforms) => Object.keys(platforms).join(', ');

/**
 * `platforms` is the validated registry of relevo.yml ({ name: { stack, path, targets } }); `body` is the issue text.
 * Returns { ok: true, name, entry } or { ok: false, reason: 'missing' | 'unknown' | 'conflict', message }.
 * With one platform the line is optional; with several it is required.
 */
export function resolvePlatform({ platforms, body }) {
  const registry = platforms ?? {};
  const known = Object.keys(registry);
  const written = [...new Set(parseIssueBody(body).platform)];

  if (written.length > 1) {
    return { ok: false, reason: 'conflict', message: `the issue names two platforms (${written.join(', ')}); an issue belongs to one, so split it into one issue per platform with Depends-on` };
  }
  if (written.length === 1) {
    const name = written[0];
    if (!Object.hasOwn(registry, name)) {
      return { ok: false, reason: 'unknown', message: `the issue says Platform: ${name}, which is not a platform of relevo.yml (${names(registry)})` };
    }
    return { ok: true, name, entry: registry[name] };
  }
  if (known.length === 1) return { ok: true, name: known[0], entry: registry[known[0]] };
  return { ok: false, reason: 'missing', message: `Platform: line naming one of the platforms of relevo.yml (${names(registry)})` };
}
