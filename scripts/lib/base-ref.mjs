// Which refs a build compares with. A github project works against the remote (`origin/<base>`); a files project has no remote
// that matters, so it works against its own branches, and the local base is the truth that `ship` moves. The tracker decides, not
// the presence of a remote: a files project that happens to have an `origin` must not build from a stale `origin/<base>`.
// Implements decision 11 of the design of local-tracker.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { readFileSync } from './guarded-fs.mjs';

/** Does this project work against local branches only? `config` is the validated relevo.yml. */
export const localRefs = (config) => config?.tracker === 'files';

/** The ref of the base branch to diff, merge or start from. */
export const baseRef = (config, base) => (localRefs(config) ? base : `origin/${base}`);

/** The ref of the branch of an issue. */
export const branchRef = (config, branch) => (localRefs(config) ? branch : `origin/${branch}`);

/** For the scripts: whether the relevo.yml at `configPath` is a files project. A missing or invalid file is a github project. Never throws. */
export function readLocal(configPath = 'relevo.yml') {
  try {
    const path = resolve(configPath);
    if (!existsSync(path)) return false;
    const loaded = loadConfig(readFileSync(path, 'utf8'));
    return loaded.ok && localRefs(loaded.config);
  } catch {
    return false;
  }
}
