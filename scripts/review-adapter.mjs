#!/usr/bin/env node
// Prints how `review` works for a platform of relevo.yml, as JSON. Usage:
//   node scripts/review-adapter.mjs --platform web [--target web] [--config relevo.yml]
// Output: { supported, stack, target, kind, log, capture, driver, needs, reason, platform, needs_autopilot, advice }
// `advice` is what to tell the person, in the language of relevo.yml, when a browser review cannot start with review.autopilot off.
//   exit 0: supported   exit 1: no adapter for this platform and target (the reason is in the output)   exit 2: bad usage or invalid relevo.yml

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { adapterFor, autopilotAdvice, needsAutopilot, targetOf } from './lib/review-adapters.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};
const name = arg('platform');
if (!name) fail('usage: review-adapter.mjs --platform <name> [--target <target>] [--config relevo.yml]');
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
const platform = loaded.config.platforms[name];
if (!platform) fail(`there is no platform "${name}" in relevo.yml (platforms: ${Object.keys(loaded.config.platforms).join(', ') || 'none'})`);

const target = arg('target') ?? targetOf(platform);
const adapter = adapterFor({ stack: platform.stack, target });
const advice = autopilotAdvice(adapter, { autopilot: loaded.config.review?.autopilot, language: loaded.config.language });
console.log(JSON.stringify({ ...adapter, platform: name, needs_autopilot: needsAutopilot(adapter), advice }));
process.exit(adapter.supported ? 0 : 1);
