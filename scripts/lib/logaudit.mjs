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
  { cls: 'exception', re: /Unhandled Exception|EXCEPTION CAUGHT BY|FATAL EXCEPTION|NoSuchMethodError|\bTypeError\b|\bFlutterError\b/ },
  // A network or data exception only counts when it was not handled: it shows up as an error in the log.
  { cls: 'network-data', re: /\b(DioException|SocketException|HttpException|ClientException|PostgrestException|AuthException)\b/, needs: UNHANDLED_CONTEXT },
  { cls: 'missing-activity', re: /ActivityNotFoundException/ },
];

export const ERROR_CLASSES = RULES.map((r) => r.cls);
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

/** Markdown report of an audit. */
export function auditReport(audit, { issue, scope } = {}) {
  const lines = [`# Review report${issue ? ` for #${issue}` : ''}`, '', `**${audit.verdict}**`, ''];
  if (audit.verdict === INCONCLUSIVE) {
    lines.push(`This audit proves nothing: ${audit.reason}. It cannot be waived.`);
    return `${lines.join('\n')}\n`;
  }
  if (scope?.pids?.length) {
    lines.push(`Scope: only the processes of \`${scope.package}\` (pid ${scope.pids.join(', ')}); other apps' log lines were ignored.`, '');
  } else {
    lines.push('Scope: the whole device log.', '');
  }
  if (audit.findings.length === 0) {
    lines.push('The device log contains none of the error classes: layout, lifecycle, exceptions, network or data errors, missing activity.');
  } else {
    lines.push(`${audit.findings.length} finding(s):`, '');
    audit.findings.forEach((f, i) => lines.push(`${i + 1}. **${f.class}** (log line ${f.line}): \`${f.excerpt.replace(/`/g, "'")}\`${f.waived ? ` — WAIVED by the reviewer: ${f.reason}` : ''}`));
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
