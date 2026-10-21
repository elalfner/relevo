#!/usr/bin/env node
// relevo install | update | doctor | version. See scripts/lib/cli.mjs. `install` without --scope asks where, in a
// terminal, with the project preselected.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { USAGE, execute, isInsideGitRepo, parseArgs, resolveScope, scopeChoices } from './lib/cli.mjs';
import { select } from './lib/select.mjs';

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

let { scope } = parsed;
if (parsed.command === 'install' && has('claude')) {
  const inRepo = isInsideGitRepo(run);
  const resolved = resolveScope({ given: scope, interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY), inRepo });
  if (resolved.ask) {
    const choices = scopeChoices({ cwd: process.cwd(), inRepo });
    scope = await select({
      title: 'Where should Relevo be installed?',
      choices,
      defaultIndex: Math.max(0, choices.findIndex((c) => c.value === resolved.preferred)),
      input: process.stdin,
      output: process.stdout
    });
    if (scope === null) {
      process.stdout.write('Cancelled: nothing was installed.\n');
      process.exit(130);
    }
  } else {
    scope = resolved.scope;
    if (resolved.reason) process.stdout.write(`relevo: ${resolved.reason}.\n`);
  }
}

const { code, lines } = execute({ command: parsed.command, scope }, { run, has, version, doctorScript: here('./doctor.mjs'), cwd: process.cwd() });
process.stdout.write(`${lines.join('\n')}\n`);
process.exit(code);
