// Reads what the `go` gates need from an issue body.
// The expected shape is documented in docs/issue-format.md.

import { section } from './issue-sections.mjs';

export const ATTACHMENT_HOSTS = ['github.com', 'user-images.githubusercontent.com', 'private-user-images.githubusercontent.com'];
export const MAX_REFERENCES = 5;

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
 * The "Design reference" section: a bullet per reference, `- <target>: <what must match>`, plus fenced example code.
 * <target> is a backticked path of the repository, a backticked owner/repo:path of a linked repository, or a link.
 * Returns { present, references: [{ kind, target, repo?, path?, allowed?, match }], code, problems }.
 */
export function parseDesign(body) {
  const found = section(body, 'Design reference');
  if (!found) return { present: false, references: [], code: 0, problems: [] };
  let code = 0;
  let inFence = false;
  const references = [];
  const problems = [];
  found.text.split('\n').forEach((line) => {
    if (FENCE_RE.test(line)) {
      if (!inFence) code += 1;
      inFence = !inFence;
      return;
    }
    if (inFence || !/^\s*[-*+]\s+/.test(line)) return;
    const bullet = line.replace(/^\s*[-*+]\s+/, '').trim();
    const tick = bullet.match(/^`([^`]+)`\s*(?::\s*(.*))?$/);
    const link = bullet.match(/^<?(https?:\/\/[^\s>]+?)>?\s*(?::\s+(.*))?$/);
    const m = tick ?? link;
    if (!m) {
      problems.push(`"${bullet.slice(0, 60)}" is not a reference: write \`path\`: what must match`);
      return;
    }
    const target = m[1].trim();
    const match = (m[2] ?? '').trim();
    const ref = { target, match };
    if (/^https?:\/\//.test(target)) {
      let host = '';
      try {
        host = new URL(target).hostname;
      } catch { /* not a URL */ }
      const ok = ATTACHMENT_HOSTS.includes(host) && (host !== 'github.com' || new URL(target).pathname.startsWith('/user-attachments/'));
      Object.assign(ref, { kind: 'attachment', allowed: ok });
    } else if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+:[^\s]+$/.test(target)) {
      const [repo, ...rest] = target.split(':');
      Object.assign(ref, { kind: 'repo-file', repo, path: rest.join(':') });
    } else {
      Object.assign(ref, { kind: 'path', path: target });
    }
    const path = ref.path;
    if (path !== undefined && (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.split(/[\\/]/).includes('..'))) {
      problems.push(`"${target}" leaves the repository: use a path inside it`);
      return;
    }
    if (match === '') problems.push(`"${target}" does not say what must match (structure, spacing, typography, colour, states)`);
    references.push(ref);
  });
  return { present: true, references, code, problems };
}

/**
 * Returns {
 *   scenarios: number,          // complete WHEN/THEN pairs
 *   edgeCases: number,          // bullets under an "Edge cases" heading
 *   dependsOn: number[],        // issue numbers of this repository from "Depends-on: #N" lines
 *   dependsOnExternal: { repo, number }[],   // issues of other repositories from "Depends-on: owner/repo#N"
 *   dependsOnInvalid: string[], // tokens of a Depends-on line that look like a repository but are not owner/repo#N
 *   allowPaths: string[],       // paths and globs from "Allow-paths:" lines (dependency files the change may touch)
 *   platform: string[],         // every name written on a "Platform:" line, in order (the platform the issue is for)
 *   openQuestions: string[],    // the lines written under an "Open questions" heading (the template's comment and "none" excluded)
 *   needsClarification: boolean,// the literal text NEEDS CLARIFICATION outside code blocks
 *   decisionIds: string[],      // D1, D2... from "### D<n>. title" headings under "Decisions"
 *   constraintIds: string[],    // C1, C2... from "- C<n>: text" bullets under "Constraints"
 *   idProblems: string[],       // repeated or malformed decision and constraint ids
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

  // `#12` is an issue of this repository; `owner/repo#12` is an issue of another one. A token that looks like a
  // repository but is not followed by `#number` (for example "acme/api 12") is invalid.
  const dependsOn = [];
  const dependsOnExternal = [];
  const dependsOnInvalid = [];
  lines.forEach((line) => {
    const m = line.match(DEPENDS_RE);
    if (!m) return;
    [...m[1].matchAll(/(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#(\d+)/g)].forEach((ref) => {
      const num = Number.parseInt(ref[2], 10);
      if (ref[1]) {
        if (!dependsOnExternal.some((d) => d.repo === ref[1] && d.number === num)) dependsOnExternal.push({ repo: ref[1], number: num });
      } else if (!dependsOn.includes(num)) dependsOn.push(num);
    });
    const withoutRefs = m[1].replace(/(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+/g, ' ');
    [...withoutRefs.matchAll(/[A-Za-z0-9_.:-]*[A-Za-z0-9_.-]+\/[A-Za-z0-9_./:-]+/g)].forEach((bad) => {
      if (!dependsOnInvalid.includes(bad[0])) dependsOnInvalid.push(bad[0]);
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

  const none = /^(?:none|nothing|n\/a|ninguna?|nada|-)\.?$/i;
  const openQuestions = String(section(body, 'Open questions')?.text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !none.test(l.replace(/^[-*+]\s+/, '')));
  const needsClarification = lines.some((l) => /NEEDS CLARIFICATION/.test(l));

  const idProblems = [];
  const decisionIds = [];
  String(section(body, 'Decisions')?.text ?? '').split('\n').forEach((line) => {
    const h = line.match(/^###\s+(.*?)\s*$/);
    if (!h) return;
    const ok = h[1].match(/^(D\d+)\.\s+\S/);
    if (ok) {
      if (decisionIds.includes(ok[1])) idProblems.push(`the decision id ${ok[1]} is repeated`);
      else decisionIds.push(ok[1]);
    } else if (/^D(?:\d|[.:\s])/.test(h[1])) idProblems.push(`"### ${h[1]}" is not a decision: write "### D1. <title>"`);
  });
  const constraintIds = [];
  String(section(body, 'Constraints')?.text ?? '').split('\n').forEach((line) => {
    const b = line.match(/^\s*[-*+]\s+(C\d+)(.?)/);
    if (!b) return;
    if (b[2] !== ':') idProblems.push(`"${line.trim()}" is not a constraint: write "- ${b[1]}: <limit>"`);
    else if (constraintIds.includes(b[1])) idProblems.push(`the constraint id ${b[1]} is repeated`);
    else constraintIds.push(b[1]);
  });

  const missing = [];
  if (scenarios === 0) missing.push('scenarios written as WHEN/THEN pairs');
  if (edgeCases === 0) missing.push('edge cases (a list under an "Edge cases" heading)');

  const design = parseDesign(body);
  return { design, scenarios, edgeCases, dependsOn, dependsOnExternal, dependsOnInvalid, allowPaths, platform, openQuestions, needsClarification, decisionIds, constraintIds, idProblems, missing };
}
