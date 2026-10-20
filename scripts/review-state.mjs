#!/usr/bin/env node
// Keeps the state of an on-device review and decides whether a pull request may be opened.
//   review-state.mjs init <change-dir>            build the checklist from the change's scenarios
//   review-state.mjs set <id> <ok|fail|pending> [note ...]
//   review-state.mjs sync <change-dir>            after a fix: keep confirmed lines, retest failed ones, add new scenarios
//   review-state.mjs capture <path>               record a screenshot that was taken
//   review-state.mjs audit [<log-file>|-] [--package <id>] [--pid <n>]
//                                                 audit the device log (stdin by default), write the report;
//                                                 with --package only that app's lines are audited
//   review-state.mjs drain                        append the device log (stdin) to evidence/device.log; the skill clears the device's log after it
//   review-state.mjs audit --accumulated          audit evidence/device.log plus whatever is on stdin
//   review-state.mjs waive <n> <reason ...>       the person waives finding n of the audit, with a written reason
//   review-state.mjs waived                       print the "Waived findings" section for the pull request body
//   review-state.mjs agree                        the person agrees to open the pull request
//   review-state.mjs show                         print the state as JSON
//   review-state.mjs decide                       exit 0 when the pull request may be opened, 1 when not
// The state lives in evidence/review-state.json (override with --state). That folder is never committed.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checklistFromChange } from './lib/checklist.mjs';
import { auditLog, auditReport, filterByApp } from './lib/logaudit.mjs';
import { applyWaivers, decidePr, newState, setItem, syncState, waivedSection, waiveFinding } from './lib/review-state.mjs';

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
    case 'drain': {
      const file = join(dirname(statePath), 'device.log');
      const text = readFileSync(0, 'utf8');
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, text.endsWith('\n') || text === '' ? text : `${text}\n`);
      console.log(`${text.split('\n').filter(Boolean).length} line(s) added to ${file}`);
      break;
    }
    case 'audit': {
      const state = load();
      const pi = rest.indexOf('--package');
      const pkg = pi === -1 ? null : rest[pi + 1];
      const pids = rest.flatMap((a, i) => (a === '--pid' ? [rest[i + 1]] : []));
      const positional = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--package' && rest[i - 1] !== '--pid');
      const accumulated = rest.includes('--accumulated');
      const kept = accumulated && existsSync(join(dirname(statePath), 'device.log')) ? readFileSync(join(dirname(statePath), 'device.log'), 'utf8') : '';
      const fresh = positional[0] && positional[0] !== '-' ? readFileSync(positional[0], 'utf8') : readFileSync(0, 'utf8');
      const raw = accumulated ? `${kept}${kept && !kept.endsWith('\n') ? '\n' : ''}${fresh}` : fresh;
      if (pi !== -1 && !pkg) fail('--package needs an application id');
      const { text: source, scope } = pkg ? filterByApp(raw, { package: pkg, pids }) : { text: raw, scope: null };
      const audit = auditLog(source, { scope });
      state.audit = { verdict: audit.verdict, counts: audit.counts, findings: audit.findings, scope, ...(audit.reason ? { reason: audit.reason } : {}) };
      applyWaivers(state);
      audit.verdict = state.audit.verdict;
      save(state);
      writeFileSync(join(dirname(statePath), 'review-report.md'), auditReport(audit, { scope }));
      console.log(audit.verdict);
      if (audit.reason) console.log(`  ${audit.reason}`);
      audit.findings.slice(0, 10).forEach((f, i) => console.log(`  ${i + 1}. ${f.class}: ${f.excerpt}${f.waived ? ` (waived: ${f.reason})` : ''}`));
      break;
    }
    case 'waive': {
      const [number, ...reason] = rest;
      const state = waiveFinding(load(), number, reason.join(' '));
      save(state);
      writeFileSync(join(dirname(statePath), 'review-report.md'), auditReport(state.audit, { scope: state.audit.scope }));
      console.log(`finding ${number} waived; the verdict is ${state.audit.verdict}`);
      break;
    }
    case 'waived':
      process.stdout.write(waivedSection(load()));
      break;
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
