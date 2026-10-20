#!/usr/bin/env node
// Checks the task list of a change around a fix. Usage:
//   node scripts/fix-tasks.mjs --file openspec/changes/31-x/tasks.md --stage before|after
//   before: run before the developer; after: run after QA passes.
// exit 0: ok   exit 1: prints why not   exit 2: bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { checkFixTasks } from './lib/tasks-file.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const file = arg('file');
const stage = arg('stage');
if (!file || !['before', 'after'].includes(stage) || !existsSync(file)) {
  console.error('usage: fix-tasks.mjs --file <tasks.md> --stage before|after');
  process.exit(2);
}
const result = checkFixTasks(readFileSync(file, 'utf8'), stage);
if (!result.ok) result.reasons.forEach((r) => console.log(r));
process.exit(result.ok ? 0 : 1);
