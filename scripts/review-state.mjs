#!/usr/bin/env node
// Keeps the state of an on-device review and decides whether a pull request may be opened.
//   review-state.mjs init <change-dir>            build the checklist from the change's scenarios
//   review-state.mjs set <id> <ok|fail|pending> [note ...]
//   review-state.mjs sync <change-dir>            after a fix: keep confirmed lines, retest failed ones, add new scenarios
//   review-state.mjs capture <path>               record a screenshot that was taken
//   review-state.mjs audit [<log-file>|-]         audit the device log (stdin by default), write the report
//   review-state.mjs agree                        the person agrees to open the pull request
//   review-state.mjs show                         print the state as JSON
//   review-state.mjs decide                       exit 0 when the pull request may be opened, 1 when not
// The state lives in evidence/review-state.json (override with --state). That folder is never committed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checklistFromChange } from './lib/checklist.mjs';
import { auditLog, auditReport } from './lib/logaudit.mjs';
import { decidePr, newState, setItem, syncState } from './lib/review-state.mjs';

const argv = process.argv.slice(2);
const si = argv.indexOf('--state');
const statePath = si === -1 ? 'evidence/review-state.json' : argv[si + 1];
const args = si === -1 ? argv : argv.filter((_, i) => i !== si && i !== si + 1);
const [command, ...rest] = args;

const fail = (m) => {
  console.error(m);
  process.exit(2);
};
const load = () => {
  if (!existsSync(statePath)) fail(`no review in progress (${statePath} not found): run "init" first`);
  return JSON.parse(readFileSync(statePath, 'utf8'));
};
const save = (state) => {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
};

try {
  switch (command) {
    case 'init': {
      if (!rest[0] || !existsSync(rest[0])) fail('usage: review-state.mjs init <change-directory>');
      const state = newState(checklistFromChange(rest[0]));
      save(state);
      console.log(`${state.items.length} checklist item(s) in ${statePath}`);
      break;
    }
    case 'sync': {
      if (!rest[0] || !existsSync(rest[0])) fail('usage: review-state.mjs sync <change-directory>');
      const state = syncState(load(), checklistFromChange(rest[0]));
      save(state);
      const pending = state.items.filter((i) => i.status === 'pending').length;
      console.log(`${state.items.length} checklist item(s), ${pending} to test again; the log audit and the agreement must be repeated`);
      break;
    }
    case 'set': {
      const [id, status, ...note] = rest;
      const state = setItem(load(), Number(id), status, note.join(' ') || null);
      save(state);
      console.log(`item ${id}: ${status}`);
      break;
    }
    case 'capture': {
      if (!rest[0]) fail('usage: review-state.mjs capture <path>');
      const state = load();
      state.captures.push(rest[0]);
      save(state);
      console.log(`recorded ${rest[0]}`);
      break;
    }
    case 'audit': {
      const state = load();
      const source = rest[0] && rest[0] !== '-' ? readFileSync(rest[0], 'utf8') : readFileSync(0, 'utf8');
      const audit = auditLog(source);
      state.audit = { verdict: audit.verdict, counts: audit.counts, findings: audit.findings };
      save(state);
      writeFileSync(join(dirname(statePath), 'review-report.md'), auditReport(audit));
      console.log(audit.verdict);
      audit.findings.slice(0, 10).forEach((f) => console.log(`  ${f.class}: ${f.excerpt}`));
      break;
    }
    case 'agree': {
      const state = load();
      state.agreed = true;
      save(state);
      console.log('the person agreed to open the pull request');
      break;
    }
    case 'show':
      console.log(JSON.stringify(load(), null, 2));
      break;
    case 'decide': {
      const { open, reasons } = decidePr(load());
      if (open) console.log('the pull request may be opened');
      else {
        console.log('the pull request must NOT be opened yet:');
        reasons.forEach((r) => console.log(`  - ${r}`));
      }
      process.exit(open ? 0 : 1);
      break;
    }
    default:
      fail('usage: review-state.mjs <init|set|capture|audit|agree|show|decide> [...]');
  }
} catch (err) {
  fail(err.message);
}
