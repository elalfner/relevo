// What the command-line wrappers of the rescue and of the checkpoint share: the real git, the identity of the workflow
// when the repository has none, and the rules of relevo.yml that the safe commit applies.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { platformFolders } from './protected-paths.mjs';
import { restrictedListFromText } from './restricted-paths.mjs';
import { rescueWork } from './rescue-work.mjs';
import { readFileSync } from './guarded-fs.mjs';
import { loadBaseline } from './tree-baseline.mjs';

/** Runs `rescueWork` in the current repository. `decision` comes from `readDecision`; `subject` is the commit subject or null. */
export function runRescue({ decision, configPath = 'relevo.yml', subject = null }) {
  // The work is committed under the identity of the workflow when the repository has none of its own.
  let identity = [];
  try {
    if (!execFileSync('git', ['config', 'user.email'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()) throw new Error('empty');
  } catch {
    identity = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
  }
  const git = (args) => execFileSync('git', [...identity, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const path = resolve(configPath);
  let rulesFile = null;
  let platformPaths = [];
  let text = '';
  if (existsSync(path)) {
    text = readFileSync(path, 'utf8');
    const loaded = loadConfig(text);
    if (loaded.ok) {
      rulesFile = loaded.config.qa.rules_from;
      platformPaths = platformFolders(loaded.config.platforms);
    }
  }
  // The list is read from the text, so a relevo.yml that does not validate still restricts what it lists.
  return rescueWork({ git, decision, rulesFile, platformPaths, restricted: restrictedListFromText(text), subject, baseline: loadBaseline(process.env.RELEVO_PROGRESS_DIR) });
}
