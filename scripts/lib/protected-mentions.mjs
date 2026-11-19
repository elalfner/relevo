// Finds the protected paths that the text of an issue names, while the issue is written. Implements "The check warns about
// protected paths that the text names" of the issue specification (openspec/changes/warn-protected-paths-and-assumptions).
//
// It reads the same way the build preflight reads the tasks (a verb that changes something, then a path) and decides what is
// protected with the same code that refuses the path at commit time, so no model is involved. It only warns: the spec stage
// of the preflight and the commit guard still stop the real change, and a person decides how to proceed.

import { changedPaths, pathTokens } from './build-preflight.mjs';
import { sections } from './issue-sections.mjs';
import { checkProtected, hardRule } from './protected-paths.mjs';

// Sections that point at a file or exclude work: a path named there is not a request to change it.
const SKIPPED = new Set(['out of scope', 'code pointers', 'design reference', 'external inputs']);
const NEGATION = /\b(?:not|never|don't|dont|without|nunca|jam[aá]s|no)\b/i;
const ALLOW_LINE = /^\s*(?:[-*+]\s+)?Allow-paths:/i;
const FENCE = /^\s*(```|~~~)/;

const quote = (line) => `"${line.replace(/\s+/g, ' ').trim().slice(0, 120)}"`;

/**
 * body, allow (the globs of `Allow-paths:`), rulesFile (qa.rules_from), platformPaths (platformFolders).
 * Returns [{ kind: 'change' | 'named', path, tier: 'hard' | 'soft', rule, line, section }]; each path once per line.
 */
export function protectedMentions({ body, allow = [], rulesFile = null, platformPaths = [] }) {
  const out = [];
  sections(body).forEach((s) => {
    if (SKIPPED.has(s.name.toLowerCase())) return;
    let inFence = false;
    s.text.split('\n').forEach((raw) => {
      if (FENCE.test(raw)) { inFence = !inFence; return; }
      const line = raw.trim();
      if (inFence || line === '' || ALLOW_LINE.test(line) || NEGATION.test(line)) return;
      const changed = new Set(changedPaths(line));
      const seen = new Set();
      [...changedPaths(line), ...pathTokens(line)].forEach((path) => {
        if (seen.has(path)) return;
        seen.add(path);
        const kind = changed.has(path) ? 'change' : 'named';
        const violation = checkProtected([path], { allow, rulesFile, platformPaths }).violations[0];
        if (!violation) return;
        // A manifest is named all the time to say what the project uses: only a line that asks to change it counts.
        if (violation.tier === 'soft' && kind === 'named') return;
        out.push({ kind, path: violation.path, tier: violation.tier, rule: violation.rule ?? hardRule(path, { rulesFile, platformPaths }), line, section: s.name });
      });
    });
  });
  return out;
}

/** One warning for a person: the path, the line, why it is protected and the ways out. */
export function mentionText(m) {
  const why = m.tier === 'soft' ? 'a dependency file that the issue does not allow in Allow-paths:' : `a protected path (${m.rule}) that an unattended run never changes`;
  const outs = `a person makes that edit and the issue leaves it out, or the task is rewritten so that nothing needs it${m.tier === 'soft' ? ', or the file is listed in an Allow-paths: line' : ''}`;
  const where = m.kind === 'change' ? `${m.section}: ${quote(m.line)} asks to change ${m.path}` : `${m.section}: ${quote(m.line)} names ${m.path}`;
  return `${where}, ${why}; ${m.kind === 'named' ? 'if the issue needs it changed, ' : 'ways out: '}${outs}`;
}
