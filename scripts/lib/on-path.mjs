// Whether a tool can be found on the PATH, without running it. The names of a declared review adapter come from the
// repository's profile, so they are looked for and never executed (see the design of declared-review-adapter, decision 6).
// The preflight of an api review and `doctor` share this lookup.

import { accessSync, constants, statSync } from 'node:fs';
import { delimiter } from 'node:path';
import { findOnPath } from './api-preflight.mjs';

const isExecutable = (file) => {
  try {
    accessSync(file, constants.X_OK);
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

/** True when an executable called `name` is in a directory of `env.PATH`; on Windows the extensions of `env.PATHEXT` count too. */
export function onPath(name, env = process.env, platform = process.platform) {
  const ext = platform === 'win32' ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')] : [''];
  return findOnPath(name, env.PATH, { isExecutable }, { sep: delimiter, ext });
}
