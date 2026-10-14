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

/**
 * Scan log text. Returns { verdict, findings: [{ class, line, excerpt }], counts }.
 * verdict is exactly "REVIEW PASSED" or "REVIEW REJECTED".
 */
export function auditLog(text) {
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
  return { verdict: findings.length === 0 ? 'REVIEW PASSED' : 'REVIEW REJECTED', findings, counts };
}

/** Markdown report of an audit. */
export function auditReport(audit, { issue, scope } = {}) {
  const lines = [`# Review report${issue ? ` for #${issue}` : ''}`, '', `**${audit.verdict}**`, ''];
  if (scope?.pids?.length) {
    lines.push(`Scope: only the processes of \`${scope.package}\` (pid ${scope.pids.join(', ')}); other apps' log lines were ignored.`, '');
  } else if (scope) {
    lines.push(`Scope: the whole device log. The process of \`${scope.package}\` was not found in it, so lines from other apps on the device were audited too and may be quoted below.`, '');
  } else {
    lines.push('Scope: the whole device log.', '');
  }
  if (audit.findings.length === 0) {
    lines.push('The device log contains none of the error classes: layout, lifecycle, exceptions, network or data errors, missing activity.');
  } else {
    lines.push(`${audit.findings.length} finding(s):`, '');
    audit.findings.forEach((f) => lines.push(`- **${f.class}** (log line ${f.line}): \`${f.excerpt.replace(/`/g, "'")}\``));
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
