#!/usr/bin/env node
// Keeps the state of an on-device review and decides whether a pull request may be opened.
//   review-state.mjs init <change-dir> [--autopilot off|precheck|verify]   build the checklist from the change's scenarios
//   review-state.mjs init <change-dir> --adapter api [--stack supabase] [--log <path, glob or docker:name>] [--cwd <dir>]
//                                                 an api review: also records how much of the log files exists now,
//                                                 or the time a container's log is read from (the Supabase default)
//   review-state.mjs ran <exit code> [--by person|agent] [--filter <f>] [--tests <n>] [--line <n>] [--failing a,b] [--tap <file>|-]
//                                                 an api review: record a test run (the person's, or the agent's for a line);
//                                                 --tap reads the output of `supabase test db` for the assertions and the failing names
//   review-state.mjs started-stack                a Supabase review: the agent started the local stack, so it stops it at the end
//   review-state.mjs runs-list                    print the "Test runs" section for the pull request body
//   review-state.mjs reset-log                    an api review: take the log files as they are now (after a fix)
//   review-state.mjs set <id> <ok|fail|pending> [note ...]
//   review-state.mjs sync <change-dir>            after a fix: keep confirmed lines, retest failed ones, add new scenarios
//   review-state.mjs capture <path>               record a screenshot that was taken (refused after "agree")
//   review-state.mjs qa-pass <script>             QA passed this browser review script; the runner runs only this exact content
//   review-state.mjs audit [<log-file>|-] [--package <id>] [--pid <n>]
//                                                 audit the device log (stdin by default), write the report;
//                                                 with --package only that app's lines are audited
//   review-state.mjs drain                        append the device log (stdin) to evidence/device.log; the skill clears the device's log after it
//   review-state.mjs audit --accumulated          audit evidence/device.log plus whatever is on stdin
//   review-state.mjs confirm-env                  the person confirmed in writing that the app does not point to production data
//   review-state.mjs precheck <n> ok|fail [note]  the agent's own result for a line (autopilot precheck or verify)
//   review-state.mjs auto <n> <how ...>           the agent verified a line automatically (autopilot verify only)
//   review-state.mjs auto-list                    print the "Verified automatically" section for the pull request body
//   review-state.mjs waive <n> <reason ...>       the person waives finding n of the audit, with a written reason
//   review-state.mjs waived                       print the "Waived findings" section for the pull request body
//   review-state.mjs agree                        the person agrees to open the pull request
//   review-state.mjs show                         print the state as JSON
//   review-state.mjs decide                       exit 0 when the pull request may be opened, 1 when not
// The state lives in evidence/review-state.json (override with --state). That folder is never committed.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readSlice, snapshotLog } from './lib/api-log.mjs';
import { checklistFromChange } from './lib/checklist.mjs';
import { auditApi, auditLog, auditReport, filterByApp } from './lib/logaudit.mjs';
import { parseTap } from './lib/pgtap.mjs';
import { applyWaivers, autoItem, autoSection, confirmEnv, decidePr, markStackStarted, newState, precheckItem, qaPass, recordCapture, recordRun, runsSection, setItem, syncState, waivedSection, waiveFinding } from './lib/review-state.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const si = argv.indexOf('--state');
const statePath = si === -1 ? 'evidence/review-state.json' : argv[si + 1];
const args = si === -1 ? argv : argv.filter((_, i) => i !== si && i !== si + 1);
const [command, ...rest] = args;

// The log an api review reads when the profile does not say: the files of Laravel, the container of Supabase.
const DEFAULT_LOG = { supabase: 'docker:supabase_db_{project_id}' };
const describeLog = (log) => (log.source === 'docker' ? `the log of the container ${log.container} is read from ${log.since} on` : `the log ${log.pattern} is read from now on (${Object.keys(log.offsets).length} file(s) as they are)`);

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
      const ai = rest.indexOf('--autopilot');
      const flag = (name) => (rest.indexOf(`--${name}`) === -1 ? undefined : rest[rest.indexOf(`--${name}`) + 1]);
      const api = flag('adapter') === 'api';
      if (flag('adapter') !== undefined && !api) fail('--adapter can only be "api"');
      const stack = flag('stack');
      if (stack !== undefined && !api) fail('--stack goes with --adapter api');
      const log = api ? snapshotLog(flag('log') ?? DEFAULT_LOG[stack] ?? 'storage/logs/*.log', { cwd: flag('cwd') ?? '.' }) : null;
      const state = newState(checklistFromChange(rest[0]), { autopilot: ai === -1 ? 'off' : rest[ai + 1], kind: api ? 'api' : 'device', log, stack });
      if (api && flag('cwd')) state.cwd = flag('cwd');
      save(state);
      console.log(`${state.items.length} checklist item(s) in ${statePath} (autopilot: ${state.autopilot})${api ? `; ${describeLog(log)}` : ''}`);
      break;
    }
    case 'sync': {
      if (!rest[0] || !existsSync(rest[0])) fail('usage: review-state.mjs sync <change-directory>');
      const state = syncState(load(), checklistFromChange(rest[0]));
      // The log of the old code is not the log of the new: an api review takes the files as they are now.
      if (state.kind === 'api') state.log = snapshotLog(state.log.pattern, { cwd: state.cwd ?? '.' });
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
      const state = recordCapture(load(), rest[0]);
      save(state);
      console.log(`recorded ${rest[0]}`);
      break;
    }
    case 'qa-pass': {
      if (!rest[0] || !existsSync(rest[0])) fail('usage: review-state.mjs qa-pass <script>');
      const state = qaPass(load(), rest[0], readFileSync(rest[0], 'utf8'));
      save(state);
      console.log(`QA passed ${rest[0]} (sha256 ${state.qaScript.sha256.slice(0, 12)}); any change to it needs a new pass`);
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
    case 'ran': {
      const [exit, ...flags] = rest;
      const flag = (name) => (flags.indexOf(`--${name}`) === -1 ? undefined : flags[flags.indexOf(`--${name}`) + 1]);
      const tapSource = flag('tap');
      const tap = tapSource === undefined ? null : parseTap(readFileSync(tapSource === '-' ? 0 : tapSource, 'utf8'));
      const failing = tap ? [...tap.failing, ...(flag('failing')?.split(',').filter(Boolean) ?? [])] : flag('failing')?.split(',').filter(Boolean);
      const state = recordRun(load(), { exit, by: flag('by'), filter: flag('filter'), tests: tap ? tap.assertions : flag('tests'), line: flag('line'), failing, covers: flag('covers')?.split(',').map((n) => n.trim()).filter(Boolean), incomplete: tap ? !tap.planComplete : false });
      save(state);
      const last = state.runs.at(-1);
      console.log(`recorded: run by the ${last.by}${last.line ? ` for line ${last.line}` : ''}, exit ${last.exit}${last.tests !== undefined ? `, ${last.tests} ${state.stack === 'supabase' ? 'assertion(s)' : 'test(s)'}` : ''}${last.covers?.length ? `, covering ${last.covers.join(', ')}` : ''}${last.incomplete ? ' (the plan was not completed)' : ''}`);
      break;
    }
    case 'started-stack': {
      const state = markStackStarted(load());
      save(state);
      console.log('recorded: the agent started the local stack, so it stops it at the end');
      break;
    }
    case 'runs-list':
      process.stdout.write(runsSection(load()));
      break;
    case 'reset-log': {
      const state = load();
      if (state.kind !== 'api') fail('reset-log is for an api review');
      state.log = snapshotLog(state.log.pattern, { cwd: state.cwd ?? '.' });
      save(state);
      console.log(describeLog(state.log));
      break;
    }
    case 'audit': {
      const state = load();
      if (state.kind === 'api') {
        const slice = readSlice(state.log, { cwd: state.cwd ?? '.' });
        const flavor = state.stack === 'supabase' ? 'postgres' : 'laravel';
        const audit = auditApi({ text: slice.text, runs: state.runs, unreadable: slice.unreadable, flavor });
        const scope = { kind: 'api', pattern: state.log.pattern, runs: (state.runs ?? []).length, ...(flavor === 'postgres' ? { flavor } : {}) };
        state.audit = { verdict: audit.verdict, counts: audit.counts, findings: audit.findings, scope, ...(audit.reason ? { reason: audit.reason } : {}), ...(audit.unreadable ? { unreadable: audit.unreadable } : {}), ...(audit.expected ? { expected: audit.expected } : {}), ...(audit.startup ? { startup: audit.startup } : {}) };
        applyWaivers(state);
        audit.verdict = state.audit.verdict;
        save(state);
        writeFileSync(join(dirname(statePath), 'review-report.md'), auditReport(audit, { scope }));
        console.log(audit.verdict);
        if (audit.reason) console.log(`  ${audit.reason}`);
        audit.findings.slice(0, 10).forEach((f, i) => console.log(`  ${i + 1}. ${f.class}: ${f.excerpt}${f.waived ? ` (waived: ${f.reason})` : ''}`));
        break;
      }
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
    case 'confirm-env': {
      const state = confirmEnv(load());
      save(state);
      console.log('recorded: the person confirmed that the app does not point to production data');
      break;
    }
    case 'precheck': {
      const [id, result, ...note] = rest;
      const state = precheckItem(load(), Number(id), result, note.join(' ') || null);
      save(state);
      console.log(`item ${id}: pre-check ${result} (the person still confirms it)`);
      break;
    }
    case 'auto': {
      const [id, ...how] = rest;
      const state = autoItem(load(), Number(id), how.join(' '));
      save(state);
      console.log(`item ${id}: verified automatically`);
      break;
    }
    case 'auto-list':
      process.stdout.write(autoSection(load()));
      break;
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
      fail('usage: review-state.mjs <init|set|sync|capture|qa-pass|drain|audit|ran|started-stack|runs-list|reset-log|waive|waived|confirm-env|precheck|auto|auto-list|agree|show|decide> [...]');
  }
} catch (err) {
  fail(err.message);
}
