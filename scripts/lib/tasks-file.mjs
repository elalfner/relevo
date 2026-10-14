// Edits tasks.md of a change: appends a section of corrections for a review iteration.
// Implements "Specification first" of openspec/changes/relevo-v1/specs/fix/spec.md.

const SECTION_RE = /^##\s+(\d+)\.\s+(.*)$/;
const ITERATION_RE = /Review corrections \[Iteration (\d+)\]/;

/**
 * Append "## N. Review corrections [Iteration K]" with one unchecked task per title.
 * Returns { text, section, iteration, ids }.
 */
export function addCorrections(tasksText, titles) {
  const clean = titles.map((t) => String(t).trim()).filter(Boolean);
  if (clean.length === 0) throw new Error('give at least one correction task');
  const lines = String(tasksText).split('\n');
  let last = 0;
  let iteration = 0;
  lines.forEach((line) => {
    const s = line.match(SECTION_RE);
    if (!s) return;
    last = Math.max(last, Number(s[1]));
    const it = line.match(ITERATION_RE);
    if (it) iteration = Math.max(iteration, Number(it[1]));
  });
  const section = last + 1;
  const next = iteration + 1;
  const ids = clean.map((_, i) => `${section}.${i + 1}`);
  const block = [`## ${section}. Review corrections [Iteration ${next}]`, '', ...clean.map((t, i) => `- [ ] ${ids[i]} ${t}`), ''].join('\n');
  const base = String(tasksText).replace(/\s*$/, '\n');
  return { text: `${base}\n${block}`, section, iteration: next, ids };
}

/** Ids of the tasks that are still unchecked. */
export function uncheckedTasks(tasksText) {
  return [...String(tasksText).matchAll(/^\s*- \[ \] (\d+\.\d+)\b/gm)].map((m) => m[1]);
}
