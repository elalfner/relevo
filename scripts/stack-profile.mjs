#!/usr/bin/env node
// Prints the resolved profile of a platform, as JSON. Usage:
//   node scripts/stack-profile.mjs --platform <name> [--config relevo.yml] [--plugin-root <dir>] [--role issue]
// With `--role issue` it prints only the questions the stack has for the issue writer ({ platform, stack, questions });
// without it the questions are not part of the output, so dev and qa never receive them.
// With `--role review` it prints the review block, the keys the repository replaced, the section Review and the lines
// that ask for what a review never changes ({ platform, stack, review, review_replaced, notes, warnings }).
// The profile is the plugin's stacks/<stack>.md plus the repository's .relevo/stacks/<stack>.md, with the
// `platforms.<name>.checks` of relevo.yml applied. The agents receive this output; they do not look for profiles.
//   exit 0: printed   exit 1: the stack has no profile (or a profile is invalid)   exit 2: bad usage or invalid relevo.yml

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const pluginRoot = resolve(arg('plugin-root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`, 2);

const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`, 2);

const names = Object.keys(loaded.config.platforms);
const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
if (!name) fail(`usage: stack-profile.mjs --platform <${names.join('|')}> [--config relevo.yml] [--plugin-root dir]`, 2);
const platform = loaded.config.platforms[name];
if (!platform) fail(`unknown platform "${name}"; the platforms of relevo.yml are: ${names.join(', ')}`, 2);

const base = dirname(configPath);
const read = (path) => {
  const file = path.startsWith('/') ? path : resolve(base, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const result = resolveProfile({ platform, pluginRoot, read });
if (!result.ok) fail(result.errors.join('\n'), 1);

const { profile } = result;
if (arg('role') === 'issue') {
  console.log(JSON.stringify({ platform: name, stack: profile.stack, questions: profile.questions }, null, 2));
  process.exit(0);
}
if (arg('role') === 'review') {
  console.log(JSON.stringify({ platform: name, stack: profile.stack, review: profile.review, review_replaced: profile.reviewReplaced ?? [], notes: profile.reviewBody, warnings: profile.reviewWarnings }, null, 2));
  process.exit(0);
}
if (arg('role') !== undefined) fail('--role can only be "issue" or "review"', 2);
console.log(JSON.stringify({
  platform: name,
  stack: profile.stack,
  path: platform.path,
  targets: platform.targets,
  target_tools: Object.fromEntries(platform.targets.map((t) => [t, profile.targets[t] ?? ''])),
  commands: profile.commands,
  generated: profile.generated,
  tools: profile.tools,
  requires_skills: profile.requires_skills,
  skills: profile.skills,
  plugin_skills: profile.pluginSkills,
  skills_when_installed: profile.skillsWhenInstalled,
  plugin_skills_when_installed: profile.pluginSkillsWhenInstalled,
  skills_disabled: profile.skillsDisabled,
  skills_disable_ignored: profile.skillsDisableIgnored,
  layers: profile.layers,
  ignored: profile.ignored,
  overridden: profile.overridden,
  body: profile.body,
}, null, 2));
