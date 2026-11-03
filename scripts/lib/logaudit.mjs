// Audits a device log for the error classes the review spec names:
// layout overflows, lifecycle errors, unhandled exceptions, unhandled network or data
// errors, and missing-activity errors.

const ANSI_RE = /\u001b\[[0-9;]*m/g;
const MAX_FINDINGS = 50;
const MAX_EXCERPT = 200;

const UNHANDLED_CONTEXT = /E\/flutter|Unhandled Exception|EXCEPTION CAUGHT|FATAL EXCEPTION|AndroidRuntime/;

const RULES = [
  { cls: 'layout', re: /RenderFlex overflowed|BoxConstraints forces an infinite|was given unbounded (height|width)|unbounded (height|width)/i },
  { cls: 'lifecycle', re: /setState\(\) called (during build|after dispose)|called after dispose\(\)|deactivated widget's ancestor/i },
  { cls: 'exception', re: /Unhandled Exception|EXCEPTION CAUGHT BY|FATAL EXCEPTION|NoSuchMethodError|\bTypeError\b|\bFlutterError\b|\bUncaught\b|\bReferenceError\b|\bSyntaxError\b|Unhandled (?:promise )?rejection/ },
  // A network or data exception only counts when it was not handled: it shows up as an error in the log.
  { cls: 'network-data', re: /\b(DioException|SocketException|HttpException|ClientException|PostgrestException|AuthException)\b/, needs: UNHANDLED_CONTEXT },
  // A driven browser: a console.error call, a request that failed, an error response, or one the origin guard stopped. Written by web-review.mjs.
  { cls: 'network-data', re: /\brequestfailed\b|\bresponse [45]\d\d\b|\bblocked request\b/ },
  { cls: 'console-error', re: /\bconsole\.error\b/ },
  { cls: 'missing-activity', re: /ActivityNotFoundException/ },
];

export const ERROR_CLASSES = [...new Set(RULES.map((r) => r.cls))];
export const PASSED = 'REVIEW PASSED';
export const PASSED_WITH_WAIVERS = 'REVIEW PASSED (with waivers)';
export const REJECTED = 'REVIEW REJECTED';
export const INCONCLUSIVE = 'REVIEW INCONCLUSIVE';

/**
 * Scan log text. Returns { verdict, findings: [{ class, line, excerpt }], counts }.
 * verdict is "REVIEW PASSED", "REVIEW REJECTED", or "REVIEW INCONCLUSIVE" when there is no evidence to judge: the log is
 * empty, or `scope` (from filterByApp) says the application's process was never found in it. An inconclusive audit
 * carries a `reason` and is never a pass.
 */
export function auditLog(text, { scope = null } = {}) {
  if (String(text ?? '').trim() === '') {
    return { verdict: INCONCLUSIVE, reason: 'the device log is empty: the app was not started, the device was disconnected or the log could not be read', findings: [], counts: {} };
  }
  if (scope && scope.pids.length === 0) {
    return { verdict: INCONCLUSIVE, reason: `no line of the log was written by ${scope.package}: restart the app and repeat the steps`, findings: [], counts: {} };
  }
  const findings = [];
  const seen = new Set();
  String(text).split('\n').forEach((raw, idx) => {
    const line = raw.replace(ANSI_RE, '');
    RULES.forEach((rule) => {
      if (!rule.re.test(line)) return;
      if (rule.needs && !rule.needs.test(line)) return;
      const excerpt = line.trim().slice(0, MAX_EXCERPT);
      const key = `${rule.cls}|${excerpt}`;
      if (seen.has(key) || findings.length >= MAX_FINDINGS) return;
      seen.add(key);
      findings.push({ class: rule.cls, line: idx + 1, excerpt });
    });
  });
  const counts = {};
  findings.forEach((f) => {
    counts[f.class] = (counts[f.class] ?? 0) + 1;
  });
  return { verdict: findings.length === 0 ? PASSED : REJECTED, findings, counts };
}

// The classes of an api review, read from the slice of the Laravel log. A log entry starts with "[date] env.LEVEL:".
const LARAVEL_ENTRY = /^\[\d{4}-\d{2}-\d{2}[ T][\d:.+-]+\]\s+\S+\.(ERROR|CRITICAL|ALERT|EMERGENCY):/;
const SQL_ERROR = /SQLSTATE\[|\bQueryException\b|\bPDOException\b/;
// An error entry about the database is a database finding, the more specific class, not also an exception.
const API_RULES = [
  { cls: 'exception', test: (l) => LARAVEL_ENTRY.test(l) && !SQL_ERROR.test(l) },
  { cls: 'database', test: (l) => SQL_ERROR.test(l) },
  { cls: 'lazy-loading', test: (l) => /Attempted to lazy load|LazyLoadingViolationException/.test(l) },
  { cls: 'server-error', test: (l) => /\bHTTP\/\d(?:\.\d)?"? 5\d\d\b|\bresponse 5\d\d\b|\b500 Internal Server Error\b/.test(l) },
];

// The classes of a Supabase review, read from the log of the local database container. Permission, row-level-security and
// constraint errors are expected denials. A pgTAP `throws_ok` does not write its denial to the log (the error is caught in
// the test), so the proof that a policy denies is the recorded run, not the log.
const PG_LEVEL = /\b(ERROR|FATAL|PANIC):\s/;
const PG_DENIAL = /permission denied|violates row-level security policy|violates [\w\s-]*constraint|duplicate key value/i;
const PG_RULES = [
  { cls: 'fatal', test: (l) => /\b(FATAL|PANIC):\s/.test(l) },
  { cls: 'deadlock', test: (l) => PG_LEVEL.test(l) && /deadlock detected/i.test(l) },
  { cls: 'out-of-memory', test: (l) => /\bout of memory\b/i.test(l) },
  { cls: 'database-error', test: (l) => /\bERROR:\s/.test(l) && !/deadlock detected|out of memory/i.test(l) && !PG_DENIAL.test(l) },
];

/**
 * Audit the slice of the Laravel log of an api review, with the test runs recorded in the state ([{ exit, tests, by, line,
 * filter, failing }]). The latest run of each line (or filter) counts, so a run repeated after a fix replaces the one before.
 * A quiet log is not a failure to judge: a run that passes writes nothing, so a recorded run is the evidence that the code
 * was exercised, and only an empty slice with no run at all is inconclusive.
 * Returns { verdict, findings, counts, reason? }.
 */
export function auditApi({ text = '', runs = [], unreadable = [], flavor = 'laravel' } = {}) {
  const postgres = flavor === 'postgres';
  const latest = new Map();
  runs.forEach((r) => latest.set(r.line ?? r.filter ?? '*', r));
  const findings = [];
  const seen = new Set();
  const add = (cls, line, excerpt) => {
    const key = `${cls}|${excerpt}`;
    if (seen.has(key) || findings.length >= MAX_FINDINGS) return;
    seen.add(key);
    findings.push({ class: cls, line, excerpt });
  };
  [...latest.values()].filter((r) => r.exit !== 0).forEach((r) => {
    const what = r.failing?.length ? r.failing.join(', ') : `the run${r.filter ? ` filtered by ${r.filter}` : ''} exited ${r.exit}${r.tests === 0 ? ' and ran no test' : ''}`;
    add('test-failure', 0, `${what} (${r.by ?? 'person'})`.slice(0, MAX_EXCERPT));
  });
  // Expected denials of a Postgres log: counted and listed, a finding only when no run is recorded to explain them.
  const expected = [];
  const denialsExplained = runs.length > 0;
  String(text).split('\n').forEach((raw, idx) => {
    const line = raw.replace(ANSI_RE, '');
    const excerpt = line.trim().slice(0, MAX_EXCERPT);
    if (postgres) {
      if (/\bERROR:\s/.test(line) && PG_DENIAL.test(line) && !/deadlock detected|out of memory/i.test(line)) {
        if (denialsExplained) expected.push({ line: idx + 1, excerpt });
        else add('denial', idx + 1, excerpt);
        return;
      }
      PG_RULES.forEach((rule) => {
        if (rule.test(line)) add(rule.cls, idx + 1, excerpt);
      });
      return;
    }
    API_RULES.forEach((rule) => {
      if (rule.test(line)) add(rule.cls, idx + 1, excerpt);
    });
  });
  const counts = {};
  findings.forEach((f) => { counts[f.class] = (counts[f.class] ?? 0) + 1; });
  const extra = { ...(unreadable.length ? { unreadable } : {}), ...(postgres ? { expected } : {}) };
  if (findings.length > 0) return { verdict: REJECTED, findings, counts, ...extra };
  if (unreadable.length > 0) {
    return { verdict: INCONCLUSIVE, reason: `a log source could not be read (${unreadable.map((u) => `${u.file}: ${u.reason}`).join('; ')}), so the audit cannot say the log is clean`, findings, counts, unreadable };
  }
  if (runs.length === 0 && String(text).trim() === '') {
    return { verdict: INCONCLUSIVE, reason: 'no test run is recorded and the log has nothing since the review started: run the tests and say so (ran <exit code>)', findings, counts };
  }
  return { verdict: PASSED, findings, counts, ...(postgres ? { expected } : {}) };
}

/** Markdown report of an audit. */
export function auditReport(audit, { issue, scope } = {}) {
  const lines = [`# Review report${issue ? ` for #${issue}` : ''}`, '', `**${audit.verdict}**`, ''];
  if (audit.verdict === INCONCLUSIVE) {
    lines.push(`This audit proves nothing: ${audit.reason}. It cannot be waived.`);
    return `${lines.join('\n')}\n`;
  }
  if (scope?.kind === 'api') {
    lines.push(`Scope: what ${scope.pattern} received since the review started, and the test runs of the review (${scope.runs ?? 0} recorded).`, '');
    if (audit.findings.length === 0 && scope.flavor === 'postgres') lines.push('The log slice has no fatal entry, deadlock, out-of-memory or database error, and no recorded run failed.');
    else if (audit.findings.length === 0) lines.push('The log slice has no unhandled exception, server error, database error or lazy-loading violation, and no recorded run failed.');
  } else if (scope?.pids?.length) {
    lines.push(`Scope: only the processes of \`${scope.package}\` (pid ${scope.pids.join(', ')}); other apps' log lines were ignored.`, '');
  } else {
    lines.push('Scope: the whole device log.', '');
  }
  if (audit.findings.length === 0 && scope?.kind === 'api') {
    // said above
  } else if (audit.findings.length === 0) {
    lines.push('The device log contains none of the error classes: layout, lifecycle, exceptions, network or data errors, missing activity.');
  } else {
    lines.push(`${audit.findings.length} finding(s):`, '');
    audit.findings.forEach((f, i) => lines.push(`${i + 1}. **${f.class}** (log line ${f.line}): \`${f.excerpt.replace(/`/g, "'")}\`${f.waived ? ` — WAIVED by the reviewer: ${f.reason}` : ''}`));
  }
  if (audit.expected?.length > 0) {
    lines.push('', `${audit.expected.length} expected denial(s): permission, row-level security or constraint errors; they are not findings.`);
    audit.expected.slice(0, 5).forEach((e) => lines.push(`- (log line ${e.line}) \`${e.excerpt.replace(/`/g, "'")}\``));
  } else if (scope?.flavor === 'postgres' && audit.verdict === PASSED) {
    lines.push('', 'No denial appears in the log. A pgTAP test that catches a denial does not write it there: the proof is the recorded run and its assertions, not the log.');
  }
  return `${lines.join('\n')}\n`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// `logcat -v time` writes "E/tag( 1234): msg"; `-v threadtime` writes "10-14 12:00:00.123  1234  1234 E tag: msg".
const PID_TIME = /^\S+\s+\S+\s+[VDIWEF]\/[^(]*\(\s*(\d+)\)/;
const PID_THREADTIME = /^\S+\s+\S+\s+(\d+)\s+\d+\s+[VDIWEF]\s/;

/** Process id of a logcat line, or null when the format has none. */
export function linePid(line) {
  const m = PID_THREADTIME.exec(line) ?? PID_TIME.exec(line);
  return m ? Number(m[1]) : null;
}

/** Process ids the log itself says belong to an application package (process start and crash headers). */
export function pidsForPackage(text, pkg) {
  const p = escapeRe(pkg);
  const re = [new RegExp(`Start proc (\\d+):${p}[/:]`), new RegExp(`Process: ${p}, PID: (\\d+)`)];
  const pids = new Set();
  String(text).split('\n').forEach((line) => {
    re.forEach((r) => {
      const m = r.exec(line);
      if (m) pids.add(Number(m[1]));
    });
  });
  return [...pids];
}

/**
 * Keep only the log lines written by the processes of one application, so that other apps on the same
 * device (and whatever they log) are neither audited nor quoted in the report.
 * Returns { text, scope } where scope is { package, pids } when filtered, or { package, pids: [] } when the
 * log never names the app's process, in which case the whole log is returned and the caller must say so.
 */
export function filterByApp(text, { package: pkg, pids = [] }) {
  const all = new Set([...pids.map(Number), ...pidsForPackage(text, pkg)]);
  if (all.size === 0) return { text: String(text), scope: { package: pkg, pids: [] } };
  const kept = String(text).split('\n').filter((line) => {
    const pid = linePid(line);
    return pid !== null && all.has(pid);
  });
  return { text: kept.join('\n'), scope: { package: pkg, pids: [...all] } };
}
