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
export function auditReport(audit, { issue } = {}) {
  const lines = [`# Review report${issue ? ` for #${issue}` : ''}`, '', `**${audit.verdict}**`, ''];
  if (audit.findings.length === 0) {
    lines.push('The device log contains none of the error classes: layout, lifecycle, exceptions, network or data errors, missing activity.');
  } else {
    lines.push(`${audit.findings.length} finding(s):`, '');
    audit.findings.forEach((f) => lines.push(`- **${f.class}** (log line ${f.line}): \`${f.excerpt.replace(/`/g, "'")}\``));
  }
  return `${lines.join('\n')}\n`;
}
