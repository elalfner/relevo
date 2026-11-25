// Builds the tracker of the project in the working directory, for the scripts that read an issue: the config says which
// backend, the GitHub one reaches `gh` the way every script does (a web session answers over REST).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config.mjs';
import { ghClient } from '../gh-client.mjs';
import { readFileSync } from '../guarded-fs.mjs';
import { createTracker } from './index.mjs';
import { filesBackend } from './files.mjs';

/** { tracker, config, kind }. Throws with the reason when relevo.yml is invalid. A missing relevo.yml is a github project. */
export function loadTracker({ configPath = 'relevo.yml', repo = null, env = process.env, gh = null, files = null } = {}) {
  const path = resolve(configPath);
  let config = { tracker: 'github' };
  if (existsSync(path)) {
    const loaded = loadConfig(readFileSync(path, 'utf8'));
    if (!loaded.ok) throw new Error(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
    config = loaded.config;
  }
  const tracker = createTracker(config, { gh: gh ?? (config.tracker === 'github' ? ghClient({ env }) : null), repo: repo ?? env.GITHUB_REPOSITORY ?? null, files: files ?? ((cfg) => filesBackend({ repoRoot: process.cwd(), labels: cfg.labels })) });
  return { tracker, config, kind: config.tracker };
}
