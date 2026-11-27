#!/usr/bin/env node
// Renders a hand-off message. Usage:
//   echo '{"assignee":"ana","issue":31,...}' | node scripts/render-message.mjs built [--config relevo.yml] [--language es]
// The language comes from --language, else from relevo.yml (if found), else English.
// `qa_log` in the data is the path of the QA record of the run (see lib/qa-record.mjs): it is read here, redacted and, unless
// relevo.yml says that `trust` is `private-team`, kept without the texts of the findings. A log that cannot be read adds nothing.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { MESSAGE_KINDS, renderMessage } from './lib/messages.mjs';
import { readLog } from './lib/qa-record.mjs';
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

let config = null;
const path = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(path)) {
  const loaded = loadConfig(readFileSync(path, 'utf8'));
  if (loaded.ok) config = loaded.config;
}

try {
  const data = JSON.parse(readFileSync(0, 'utf8') || '{}');
  // The record is only ever what the log holds: nothing the caller types stands for it.
  delete data.qa_record;
  const rounds = data.qa_log ? readLog(String(data.qa_log)) : null;
  delete data.qa_log;
  // With no readable configuration the trust is not known, so no text of a finding is published.
  if (rounds) data.qa_record = { rounds, withText: config?.trust === 'private-team' };
  console.log(renderMessage(kind, data, arg('language') ?? config?.language ?? 'en'));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
