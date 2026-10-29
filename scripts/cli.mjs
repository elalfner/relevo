#!/usr/bin/env node
// relevo init | install | update | doctor | version. See scripts/lib/cli.mjs and scripts/lib/init-tools.mjs. `install`
// and `init` without --scope ask where, in a terminal, with the project preselected; `init` also asks for the tools.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { USAGE, execute, isInsideGitRepo, parseArgs, resolveScope, scopeChoices } from './lib/cli.mjs';
import { TOOLS, initScopeChoices, parseInitArgs, repoRoot, resolveInitScope, runInit, runUpdate } from './lib/init-tools.mjs';
import { select, selectMany } from './lib/select.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const argv = process.argv.slice(2);
const parsed = argv[0] === 'init' ? parseInitArgs(argv.slice(1)) : parseArgs(argv);
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
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const deps = { run, has, version, doctorScript: here('./doctor.mjs'), cwd: process.cwd(), packageRoot: here('..'), home: homedir(), root: repoRoot(run) };
const cancel = () => {
  process.stdout.write('Cancelled: nothing was installed.\n');
  process.exit(130);
};
const finish = ({ code, lines }) => {
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(code);
};

if (parsed.command === 'init') {
  const inRepo = isInsideGitRepo(run);
  let { tools, scope } = parsed;
  if (!tools) {
    if (!interactive) {
      process.stderr.write(`init needs --tools without a terminal: ${TOOLS.map((t) => t.value).join(', ')}\n`);
      process.exit(2);
    }
    tools = await selectMany({ title: 'Which tools does your team use?', choices: TOOLS, initial: ['claude'], input: process.stdin, output: process.stdout });
    if (tools === null) cancel();
    if (tools.length === 0) {
      process.stdout.write('No tool chosen: nothing was installed.\n');
      process.exit(0);
    }
  }
  const resolved = resolveInitScope({ given: scope, interactive: interactive && !parsed.yes, inRepo });
  if (resolved.ask) {
    const choices = initScopeChoices({ cwd: process.cwd(), inRepo });
    scope = await select({ title: 'Where should Relevo be installed?', choices, defaultIndex: Math.max(0, choices.findIndex((c) => c.value === resolved.preferred)), input: process.stdin, output: process.stdout });
    if (scope === null) cancel();
  } else {
    scope = resolved.scope;
    if (resolved.reason) process.stdout.write(`relevo: ${resolved.reason}.\n`);
  }
  finish(runInit({ tools, scope, force: Boolean(parsed.force) }, deps));
}

let { scope } = parsed;
if (parsed.command === 'install' && has('claude')) {
  const inRepo = isInsideGitRepo(run);
  const resolved = resolveScope({ given: scope, interactive, inRepo });
  if (resolved.ask) {
    const choices = scopeChoices({ cwd: process.cwd(), inRepo });
    scope = await select({
      title: 'Where should Relevo be installed?',
      choices,
      defaultIndex: Math.max(0, choices.findIndex((c) => c.value === resolved.preferred)),
      input: process.stdin,
      output: process.stdout
    });
    if (scope === null) cancel();
  } else {
    scope = resolved.scope;
    if (resolved.reason) process.stdout.write(`relevo: ${resolved.reason}.\n`);
  }
}

if (parsed.command === 'update') finish(runUpdate({ scope, force: Boolean(parsed.force) }, deps));
finish(execute({ command: parsed.command, scope }, deps));
