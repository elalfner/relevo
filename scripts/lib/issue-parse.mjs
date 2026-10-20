// Reads what the `go` gates need from an issue body.
// The expected shape is documented in docs/issue-format.md.

const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const WHEN_RE = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?(?:WHEN|GIVEN)(?:\*\*|__)?(?:\s|:)/i;
const THEN_RE = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?THEN(?:\*\*|__)?(?:\s|:)/i;
const EDGE_RE = /\b(edge[ -]?cases?|casos?\s+(?:borde|l[ií]mite|extremos?))\b/i;
const DEPENDS_RE = /^\s*(?:[-*+]\s+)?Depend(?:s[- ]on|e(?:\s+de)?):\s*(.+)$/i;
const ALLOW_RE = /^\s*(?:[-*+]\s+)?Allow-paths:\s*(.+)$/i;
const PLATFORM_RE = /^\s*(?:[-*+]\s+)?Platform:\s*(.+)$/i;

/** Remove fenced code blocks so examples inside them are not counted. */
function withoutCode(body) {
  const out = [];
  let inFence = false;
  String(body ?? '').split('\n').forEach((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) out.push(line);
  });
  return out;
}

/**
 * Returns {
 *   scenarios: number,          // complete WHEN/THEN pairs
 *   edgeCases: number,          // bullets under an "Edge cases" heading
 *   dependsOn: number[],        // issue numbers from "Depends-on: #N" lines
 *   allowPaths: string[],       // paths and globs from "Allow-paths:" lines (dependency files the change may touch)
 *   platform: string[],         // every name written on a "Platform:" line, in order (the platform the issue is for)
 *   missing: string[],          // what the spec gate reports as absent
 * }
 */
export function parseIssueBody(body) {
  const lines = withoutCode(body);

  const whens = lines.filter((l) => WHEN_RE.test(l)).length;
  const thens = lines.filter((l) => THEN_RE.test(l)).length;
  const scenarios = Math.min(whens, thens);

  let edgeCases = 0;
  let inEdge = false;
  lines.forEach((line) => {
    const heading = line.match(HEADING_RE);
    if (heading) {
      inEdge = EDGE_RE.test(heading[2]);
      return;
    }
    if (inEdge && BULLET_RE.test(line)) edgeCases += 1;
  });

  const dependsOn = [];
  lines.forEach((line) => {
    const m = line.match(DEPENDS_RE);
    if (!m) return;
    [...m[1].matchAll(/#(\d+)/g)].forEach((n) => {
      const num = Number.parseInt(n[1], 10);
      if (!dependsOn.includes(num)) dependsOn.push(num);
    });
  });

  // Dependency files the change may touch; comma separated, with or without backticks around each path.
  const allowPaths = [];
  lines.forEach((line) => {
    const m = line.match(ALLOW_RE);
    if (!m) return;
    m[1].split(',').map((p) => p.trim().replace(/^`+|`+$/g, '').trim()).filter(Boolean).forEach((p) => {
      if (!allowPaths.includes(p)) allowPaths.push(p);
    });
  });

  // The platform(s) named by the issue; resolving them against relevo.yml is platform-of.mjs's job.
  const platform = [];
  lines.forEach((line) => {
    const m = line.match(PLATFORM_RE);
    if (!m) return;
    m[1].split(',').map((p) => p.trim().replace(/^`+|`+$/g, '').trim()).filter(Boolean).forEach((p) => platform.push(p));
  });

  const missing = [];
  if (scenarios === 0) missing.push('scenarios written as WHEN/THEN pairs');
  if (edgeCases === 0) missing.push('edge cases (a list under an "Edge cases" heading)');

  return { scenarios, edgeCases, dependsOn, allowPaths, platform, missing };
}
