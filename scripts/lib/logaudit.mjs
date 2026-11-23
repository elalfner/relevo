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
// `supabase db reset` writes this one entry while it recreates the database; it is a startup entry, not a fault.
const PG_STARTUP = /\bFATAL:\s+role "postgres" does not exist\s*$/;
const PG_RULES = [
  { cls: 'fatal', test: (l) => /\b(FATAL|PANIC):\s/.test(l) },
  { cls: 'deadlock', test: (l) => PG_LEVEL.test(l) && /deadlock detected/i.test(l) },
  { cls: 'out-of-memory', test: (l) => /\bout of memory\b/i.test(l) },
  { cls: 'database-error', test: (l) => /\bERROR:\s/.test(l) && !/deadlock detected|out of memory/i.test(l) && !PG_DENIAL.test(l) },
];

/**
 * The entry of `patterns` that an `ERROR:` line matches, or null. Only the message after the first `ERROR:` is read, and a line
 * with a fatal signal (a FATAL or PANIC level, a deadlock, out of memory, an HTTP status of 500 or above) is never matched.
 */
export function ownExpected(line, patterns) {
  const at = line.search(/\bERROR:\s/);
  if (at === -1) return null;
  if (/\b(FATAL|PANIC):\s/.test(line) || /deadlock detected|out of memory/i.test(line) || /\bHTTP\/\d(?:\.\d)?"? 5\d\d\b|\bresponse 5\d\d\b|\b500 Internal Server Error\b/.test(line)) return null;
  const message = line.slice(at + 'ERROR:'.length);
  return patterns.find((p) => message.includes(p)) ?? null;
}

const collapse = (text) => String(text).trim().replace(/\s+/g, ' ');

/**
 * The entry of `entries` (review.expected_fatals) that a `FATAL:` line is, or null. Only the whole message after the first `FATAL:`
 * counts, so a message that merely contains an entry, or that an entry merely contains, is not matched. A line that also carries a
 * PANIC, a deadlock, out of memory or an HTTP status of 500 or above is never matched.
 */
export function ownExpectedFatal(line, entries) {
  const at = line.search(/\bFATAL:\s/);
  if (at === -1) return null;
  if (/\bPANIC:\s/.test(line) || /deadlock detected|out of memory/i.test(line) || /\bHTTP\/\d(?:\.\d)?"? 5\d\d\b|\bresponse 5\d\d\b|\b500 Internal Server Error\b/.test(line)) return null;
  const message = collapse(line.slice(at + 'FATAL:'.length));
  return entries.find((e) => collapse(e) === message) ?? null;
}

// A declared adapter reads the log of any backend: only the signals that belong to no framework. An HTTP status of 500 or
// above is the Laravel pattern; an error that carries none of these signals (a service may write level "error" for any rejected
// request) is not a finding, and the report says so.
const DECLARED_RULES = [...PG_RULES, API_RULES.find((r) => r.cls === 'server-error')];
export const DECLARED_NOT_DETECTED = 'Errors that carry none of those signals (a fatal entry, a deadlock, out of memory, a database error or an HTTP status of 500 or above) are not detected, and the recorded run is the proof.';

/**
 * Audit the slice of the Laravel log of an api review, with the test runs recorded in the state ([{ exit, tests, by, line,
 * filter, failing }]). The latest run of each line (or filter) counts, so a run repeated after a fix replaces the one before.
 * A quiet log is not a failure to judge: a run that passes writes nothing, so a recorded run is the evidence that the code
 * was exercised, and only an empty slice with no run at all is inconclusive.
 * `windowStart` is how many runs were recorded when the log was last reset; with some and none since, the audit is inconclusive.
 * Returns { verdict, findings, counts, reason? }.
 */
export function auditApi({ text = '', runs = [], unreadable = [], flavor = 'laravel', expectedErrors = [], expectedFatals = [], windowStart = 0 } = {}) {
  // `declared` reads a Postgres-like log with only the signals every backend shares; it has no Supabase startup entry.
  const declared = flavor === 'declared';
  const postgres = flavor === 'postgres' || declared;
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
  const startup = [];
  // Errors of the repository's own rules (`RAISE EXCEPTION`), declared in review.expected_errors; read for a declared adapter only.
  const patterns = declared ? expectedErrors : [];
  const declaredExpected = [];
  // The whole messages of `FATAL:` lines the repository's own test harness provokes, declared in review.expected_fatals; declared adapter only.
  const fatalPatterns = declared ? expectedFatals : [];
  const declaredFatals = [];
  const denialsExplained = runs.length > 0;
  String(text).split('\n').forEach((raw, idx) => {
    const line = raw.replace(ANSI_RE, '');
    const excerpt = line.trim().slice(0, MAX_EXCERPT);
    if (postgres) {
      if (!declared && PG_STARTUP.test(line)) {
        startup.push({ line: idx + 1, excerpt });
        return;
      }
      if (/\bERROR:\s/.test(line) && PG_DENIAL.test(line) && !/deadlock detected|out of memory/i.test(line)) {
        if (denialsExplained) expected.push({ line: idx + 1, excerpt });
        else add('denial', idx + 1, excerpt);
        return;
      }
      const own = patterns.length > 0 ? ownExpected(line, patterns) : null;
      if (own) {
        if (denialsExplained) declaredExpected.push({ line: idx + 1, excerpt, pattern: own });
        else add('denial', idx + 1, excerpt);
        return;
      }
      const ownFatal = fatalPatterns.length > 0 ? ownExpectedFatal(line, fatalPatterns) : null;
      if (ownFatal) {
        if (denialsExplained) declaredFatals.push({ line: idx + 1, excerpt, pattern: ownFatal });
        else add('fatal', idx + 1, excerpt);
        return;
      }
      (declared ? DECLARED_RULES : PG_RULES).forEach((rule) => {
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
  const extra = { ...(unreadable.length ? { unreadable } : {}), ...(postgres ? { expected, startup, ...(patterns.length > 0 ? { declaredExpected } : {}), ...(fatalPatterns.length > 0 ? { declaredFatals } : {}) } : {}) };
  if (findings.length > 0) return { verdict: REJECTED, findings, counts, ...extra };
  if (unreadable.length > 0) {
    return { verdict: INCONCLUSIVE, reason: `a log source could not be read (${unreadable.map((u) => `${u.file}: ${u.reason}`).join('; ')}), so the audit cannot say the log is clean`, findings, counts, unreadable };
  }
  // The log was reset after runs were recorded: those runs say nothing about this window, so a run recorded since is needed.
  if (windowStart > 0 && runs.length <= windowStart) {
    return { verdict: INCONCLUSIVE, reason: 'no test run is recorded since the log was reset, and the runs before it do not prove this window: run the tests and say so (ran <exit code>)', findings, counts };
  }
  if (runs.length === 0 && String(text).trim() === '') {
    return { verdict: INCONCLUSIVE, reason: 'no test run is recorded and the log has nothing since the review started: run the tests and say so (ran <exit code>)', findings, counts };
  }
  return { verdict: PASSED, findings, counts, ...(postgres ? { expected, startup, ...(patterns.length > 0 ? { declaredExpected } : {}), ...(fatalPatterns.length > 0 ? { declaredFatals } : {}) } : {}) };
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
    if (audit.findings.length === 0 && scope.flavor === 'declared') lines.push('The log slice has no fatal entry, deadlock, out-of-memory, database error or server error, and no recorded run failed.');
    else if (audit.findings.length === 0 && scope.flavor === 'postgres') lines.push('The log slice has no fatal entry, deadlock, out-of-memory or database error, and no recorded run failed.');
    else if (audit.findings.length === 0) lines.push('The log slice has no unhandled exception, server error, database error or lazy-loading violation, and no recorded run failed.');
  } else if (scope?.kind === 'ios') {
    lines.push(`Scope: the log of \`${scope.process}\` in the iOS Simulator since ${scope.since} (local time).`, '');
  } else if (scope?.pids?.length) {
    lines.push(`Scope: only the processes of \`${scope.package}\` (pid ${scope.pids.join(', ')}); other apps' log lines were ignored.`, '');
  } else {
    lines.push('Scope: the whole device log.', '');
  }
  if (audit.findings.length === 0 && scope?.kind === 'api') {
    // said above
  } else if (audit.findings.length === 0) {
    lines.push(scope?.kind === 'ios' ? 'The simulator log has no fault and no error from the app or from a library that is not Apple\'s.' : 'The device log contains none of the error classes: layout, lifecycle, exceptions, network or data errors, missing activity.');
  } else {
    lines.push(`${audit.findings.length} finding(s):`, '');
    audit.findings.forEach((f, i) => lines.push(`${i + 1}. **${f.class}** (${f.line ? `log line ${f.line}` : 'simulator log'}${f.count > 1 ? `, ${f.count} times` : ''}): \`${f.excerpt.replace(/`/g, "'")}\`${f.waived ? ` — WAIVED by the reviewer: ${f.reason}` : ''}`));
  }
  if (audit.ignored > 0) {
    lines.push('', `${audit.ignored} error(s) written by Apple frameworks were ignored as system noise; they are not findings.`);
  }
  if (audit.expected?.length > 0) {
    lines.push('', `${audit.expected.length} expected denial(s): permission, row-level security or constraint errors; they are not findings.`);
    audit.expected.slice(0, 5).forEach((e) => lines.push(`- (log line ${e.line}) \`${e.excerpt.replace(/`/g, "'")}\``));
  }
  if (audit.declaredExpected?.length > 0) {
    lines.push('', `${audit.declaredExpected.length} expected error(s) that match a pattern the repository declared in \`review.expected_errors\`; they are not findings. The patterns are the repository's declaration, and a waiver stays the person's decision.`);
    const counts = new Map();
    audit.declaredExpected.forEach((e) => counts.set(e.pattern, (counts.get(e.pattern) ?? 0) + 1));
    counts.forEach((n, pattern) => lines.push(`- \`${pattern}\`: ${n} time${n === 1 ? '' : 's'}`));
    audit.declaredExpected.slice(0, 5).forEach((e) => lines.push(`  - (log line ${e.line}) \`${e.excerpt.replace(/`/g, "'")}\``));
  }
  if (audit.declaredFatals?.length > 0) {
    lines.push('', `${audit.declaredFatals.length} expected fatal(s) whose whole message the repository declared in \`review.expected_fatals\`: the fatal entries its own test harness provokes on purpose; they are not findings. The messages are the repository's declaration, and a waiver stays the person's decision.`);
    const counts = new Map();
    audit.declaredFatals.forEach((e) => counts.set(e.pattern, (counts.get(e.pattern) ?? 0) + 1));
    counts.forEach((n, pattern) => lines.push(`- \`${pattern}\`: ${n} time${n === 1 ? '' : 's'}`));
    audit.declaredFatals.slice(0, 5).forEach((e) => lines.push(`  - (log line ${e.line}) \`${e.excerpt.replace(/`/g, "'")}\``));
  }
  if (audit.startup?.length > 0) {
    lines.push('', `${audit.startup.length} expected startup entr${audit.startup.length === 1 ? 'y' : 'ies'}: \`FATAL: role "postgres" does not exist\`, which a database reset writes while it recreates the database; not a finding.`);
    audit.startup.slice(0, 5).forEach((e) => lines.push(`- (log line ${e.line}) \`${e.excerpt.replace(/`/g, "'")}\``));
  }
  if (scope?.flavor === 'declared') lines.push('', DECLARED_NOT_DETECTED);
  if (!(audit.expected?.length > 0) && scope?.flavor === 'postgres' && audit.verdict === PASSED) {
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
