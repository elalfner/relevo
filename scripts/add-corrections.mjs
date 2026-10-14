#!/usr/bin/env node
// Appends a "Review corrections" section to a change's tasks.md. Usage:
//   node scripts/add-corrections.mjs openspec/changes/<id>/tasks.md "first task" "second task"
// Prints {"section":N,"iteration":K,"ids":["N.1",...]}.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { addCorrections } from './lib/tasks-file.mjs';

const [file, ...titles] = process.argv.slice(2);
if (!file || !existsSync(file) || titles.length === 0) {
  console.error('usage: add-corrections.mjs <tasks.md> "task" ["task" ...]');
  process.exit(2);
}
try {
  const { text, section, iteration, ids } = addCorrections(readFileSync(file, 'utf8'), titles);
  writeFileSync(file, text);
  console.log(JSON.stringify({ section, iteration, ids }));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
