#!/usr/bin/env node
// The groups of pending tasks the developer builds one at a time. Usage:
//   node scripts/task-groups.mjs <path to tasks.md>
// Prints JSON { groups: [{ section, title, tasks }], pending }. One group per section of tasks.md that has unchecked
// tasks, and one group when three tasks or fewer are pending.
//   exit 0: printed   exit 2: no file given or it cannot be read

import { taskGroups } from './lib/task-groups.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: task-groups.mjs <path to tasks.md>');
  process.exit(2);
}
let text;
try {
  text = readFileSync(file, 'utf8');
} catch (error) {
  console.error(`task-groups: ${error.message}`);
  process.exit(2);
}
console.log(JSON.stringify(taskGroups(text)));
