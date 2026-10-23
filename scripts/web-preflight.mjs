#!/usr/bin/env node
// Checks that a browser review can drive: the project's dependencies, Playwright and its Chromium, and the address
// under review with the module scripts its page loads. Usage:
//   node scripts/web-preflight.mjs --url http://localhost:5173 [--timeout 5000] [--wait 30000]
// With --wait it is also the readiness probe of a server the agent started: the address is retried until it answers.
// Prints { ok, check, detail, start, env } as JSON: `start` is the command that starts the app, `env` the variable
// names of .env.example (the real environment files are never read).
//   exit 0: ready   exit 3: no node_modules (run npm install)   exit 4: Playwright does not resolve
//   exit 5: the Chromium of Playwright is missing   exit 6: the address or one of its modules does not answer below 400
//   exit 2: bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { loadPlaywright } from './lib/web-review.mjs';
import { webPreflight } from './lib/web-preflight.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const number = (name, fallback) => {
  const v = arg(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`--${name} must be a number of milliseconds`);
    process.exit(2);
  }
  return n;
};

const url = arg('url');
try {
  if (!url || !/^https?:$/.test(new URL(url).protocol)) throw new Error();
} catch {
  console.error('usage: web-preflight.mjs --url <http address> [--timeout 5000] [--wait 30000]');
  process.exit(2);
}
const cwd = process.cwd();
const result = await webPreflight({ cwd, url, timeout: number('timeout', 5000), wait: number('wait', 0) }, {
  exists: existsSync,
  readFile: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
  loadPlaywright: () => loadPlaywright(cwd),
  fetch: globalThis.fetch,
});
const { code, ...shown } = result;
console.log(JSON.stringify(shown));
process.exit(code);
