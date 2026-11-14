// Finds the assumptions that name something outside the repository and that nothing in the repository settles. Implements "The
// check warns about assumptions that name something outside the repository" of the issue specification and "The spec check lists
// assumptions that nothing in the repository settles" of the go specification (openspec/changes/warn-protected-paths-and-assumptions).
//
// An assumption is about something outside when it has a word of that kind (a permission, an endpoint, a field...) and a name in
// backticks. Each name is looked for in the files of the repository outside `openspec/`: a name that is found is settled, and
// the file where it was found is kept so that a person can see why. Finding a name proves that the repository mentions it, not
// that a server has it; that is why the result is a list to confirm and never a stop.

import { execFileSync } from 'node:child_process';

// English and Spanish words for what lives in another system. Singular and plural.
const OUTSIDE = /\b(?:permissions?|scopes?|roles?|endpoints?|routes?|fields?|propert(?:y|ies)|claims?|headers?|contracts?|back-?end|server|schema|enum|flags?|api|permisos?|alcances?|rutas?|campos?|encabezados?|contratos?|servidor|esquema)\b/i;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ASSUMPTIONS_HEADING = /^(?:From the issue:\s*)?Assumptions$/i;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const NAME = /`([^`\s]{2,})`/g;
const COMMENT = /^\s*<!--.*-->\s*$/;

/** The assumptions of a markdown text (the issue, or design.md): [{ text, names }], one per bullet. */
export function assumptionsOf(markdown) {
  const out = [];
  let level = null;
  let inFence = false;
  String(markdown ?? '').split('\n').forEach((line) => {
    if (FENCE.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    const h = HEADING.exec(line);
    if (h) {
      const n = h[1].length;
      if (level !== null && n <= level) level = null;
      if (level === null && ASSUMPTIONS_HEADING.test(h[2])) level = n;
      return;
    }
    if (level === null || COMMENT.test(line)) return;
    const b = BULLET.exec(line);
    if (b) out.push({ text: b[1].trim() });
    else if (out.length && /^\s+\S/.test(line)) out[out.length - 1].text += ` ${line.trim()}`;
  });
  return out.filter((a) => a.text !== '' && !/^<.*>$/.test(a.text)).map((a) => ({ text: a.text, names: [...a.text.matchAll(NAME)].map((m) => m[1]) }));
}

/** The assumptions that are about something outside the repository. */
export const externalAssumptions = (markdown) => assumptionsOf(markdown).filter((a) => OUTSIDE.test(a.text.replace(NAME, ' ')));

/** A search over the tracked files of a git repository outside `openspec/`: (name) => path of the first file that holds it, or null. */
export function repoSearch(root) {
  return (name) => {
    try {
      const out = execFileSync('git', ['grep', '-l', '-I', '-F', '-e', name, '--', '.', ':(exclude)openspec'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 20 });
      return out.split('\n').find(Boolean) ?? null;
    } catch {
      return null;
    }
  };
}

/**
 * items   the external assumptions ({ text, names })
 * search  (name) => path or null (see repoSearch)
 * exists  (name) => boolean: is the name a file of the repository? (a path is not something outside)
 * Returns { settled: [{ text, found: { name: path } }], confirm: [{ text, names, missing }] }. An assumption with no name cannot be
 * settled by a script and is in `confirm` with `missing` empty.
 */
export function settleAssumptions(items, { search, exists = () => false }) {
  const settled = [];
  const confirm = [];
  items.forEach((a) => {
    const names = a.names.filter((n) => !exists(n));
    const found = {};
    const missing = [];
    names.forEach((n) => {
      const where = search(n);
      if (where) found[n] = where;
      else missing.push(n);
    });
    if (names.length > 0 && missing.length === 0) settled.push({ text: a.text, found });
    else confirm.push({ text: a.text, names, missing });
  });
  return { settled, confirm };
}

const short = (t, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** The line of the hand-off for the assumptions that were not settled; '' when there are none. */
export function assumedLine(confirm) {
  return confirm.map((a) => `"${short(a.text)}" (${a.missing.length ? `not in the repository: ${a.missing.map((n) => `\`${n}\``).join(', ')}` : 'no name to check'})`).join('; ');
}

/** The warning of the check of a draft for one assumption that was not settled. */
export function assumptionWarning(a) {
  const what = a.missing.length ? `${a.missing.map((n) => `\`${n}\``).join(', ')}, which no file of the repository holds` : 'a name that a script cannot check';
  return `Assumptions: "${short(a.text)}" depends on something outside the repository (${what}); confirm it now and write it in Data contract, Decisions or Constraints, keep it as a manual input in External inputs (the build goes on and the hand-off lists it), or write it under Open questions (the build waits for a person)`;
}
