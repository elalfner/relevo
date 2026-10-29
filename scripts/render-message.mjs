#!/usr/bin/env node
// Renders a hand-off message. Usage:
//   echo '{"assignee":"ana","issue":31,...}' | node scripts/render-message.mjs built [--config relevo.yml] [--language es]
// The language comes from --language, else from relevo.yml (if found), else English.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { MESSAGE_KINDS, renderMessage } from './lib/messages.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const kind = process.argv[2];
if (!kind || !MESSAGE_KINDS.includes(kind)) {
  console.error(`usage: render-message.mjs <${MESSAGE_KINDS.join('|')}> [--config path] [--language xx]  (JSON data on stdin)`);
  process.exit(2);
}
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

let language = arg('language');
if (!language) {
  const path = resolve(arg('config') ?? 'relevo.yml');
  if (existsSync(path)) {
    const loaded = loadConfig(readFileSync(path, 'utf8'));
    if (loaded.ok) language = loaded.config.language;
  }
}

try {
  console.log(renderMessage(kind, JSON.parse(readFileSync(0, 'utf8') || '{}'), language ?? 'en'));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
