#!/usr/bin/env node
// relevo install | update | doctor | version. See scripts/lib/cli.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { USAGE, execute, parseArgs } from './lib/cli.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const parsed = parseArgs(process.argv.slice(2));
if (parsed.error) {
  process.stderr.write(`${parsed.error}\n${USAGE}\n`);
  process.exit(2);
}
if (parsed.command === 'help') {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const has = (cmd) => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).error === undefined;
const version = JSON.parse(readFileSync(here('../package.json'), 'utf8')).version;

const { code, lines } = execute(parsed, { run, has, version, doctorScript: here('./doctor.mjs') });
process.stdout.write(`${lines.join('\n')}\n`);
process.exit(code);
