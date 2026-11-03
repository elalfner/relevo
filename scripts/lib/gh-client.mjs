// A `gh` client for the scripts of Relevo that need one of the subcommands the web session blocks (GraphQL): in a
// remote session it is answered by the REST version in gh-web.mjs, anywhere else it is the real `gh`. Like the other
// clients it is `(args, input?) -> stdout` and throws when the call fails. The command-line entry is scripts/gh-web.mjs.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isRemote, main } from './gh-web.mjs';

const realGh = (args, input, run) => run('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });

/** `run` and `env` are injectable for the tests. */
export function ghClient({ env = process.env, run = execFileSync } = {}) {
  if (!isRemote(env)) return (args, input) => realGh(args, input, run);
  return (args, input) => {
    const out = [];
    const err = [];
    const code = main(args, {
      env,
      api: (a, i) => realGh(a, i, run),
      git: (a) => run('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
      passthrough: () => { throw new Error('unreachable in a remote session'); },
      readFile: (p) => readFileSync(p, 'utf8'),
      out: (t) => out.push(t),
      err: (t) => err.push(t),
    });
    if (code !== 0) throw Object.assign(new Error(err.join('').trim() || 'the request failed'), { stderr: err.join(''), status: code });
    return out.join('');
  };
}
