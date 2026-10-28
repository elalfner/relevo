// Edits tasks.md of a change: appends a section of corrections for a review iteration.
// Implements "Specification first" of openspec/specs/fix/spec.md.

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

/** How many tasks are checked out of all of them: { done, total }. Every checkbox counts, the sections added by corrections too. */
export function countTasks(tasksText) {
  const boxes = [...String(tasksText ?? '').matchAll(/^\s*- \[([ xX])\]/gm)];
  return { done: boxes.filter((m) => m[1] !== ' ').length, total: boxes.length };
}

/** Ids of the tasks that are still unchecked. */
export function uncheckedTasks(tasksText) {
  return [...String(tasksText).matchAll(/^\s*- \[ \] (\d+\.\d+)\b/gm)].map((m) => m[1]);
}

/** Tasks of the last "Review corrections" section: { found, ids, tasks } with each task's id and text. */
export function correctionSection(tasksText) {
  const lines = String(tasksText).split('\n');
  let start = -1;
  lines.forEach((line, i) => {
    if (ITERATION_RE.test(line) && SECTION_RE.test(line)) start = i;
  });
  if (start === -1) return { found: false, ids: [], tasks: [] };
  const tasks = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (SECTION_RE.test(lines[i])) break;
    const m = lines[i].match(/^\s*- \[[ x]\] (\d+\.\d+)\s+(.*)$/);
    if (m) tasks.push({ id: m[1], text: m[2].trim() });
  }
  return { found: true, ids: tasks.map((t) => t.id), tasks };
}

const DEVICE_ONLY_RE = /\(device only\)\s*$/i;
const TEST_RE = /^test:/i;

/**
 * Checks the task list around a fix.
 *   before  the developer has not run: the only unchecked tasks are the corrections, and there is a regression test
 *           task unless every correction is device-only
 *   after   QA passed: nothing is unchecked
 * Returns { ok, reasons }.
 */
export function checkFixTasks(tasksText, stage) {
  const open = uncheckedTasks(tasksText);
  if (stage === 'after') {
    return open.length === 0
      ? { ok: true, reasons: [] }
      : { ok: false, reasons: [`tasks are still unchecked: ${open.join(', ')}`] };
  }
  const section = correctionSection(tasksText);
  if (!section.found) return { ok: false, reasons: ['tasks.md has no "Review corrections" section: add the corrections first'] };
  const reasons = [];
  const old = open.filter((id) => !section.ids.includes(id));
  if (old.length > 0) reasons.push(`tasks that are not corrections are still unchecked: ${old.join(', ')}`);
  const allDevice = section.tasks.length > 0 && section.tasks.every((t) => DEVICE_ONLY_RE.test(t.text));
  if (!allDevice && !section.tasks.some((t) => TEST_RE.test(t.text))) {
    reasons.push('a regression test is missing: add a correction task that starts with "Test:", or mark the corrections "(device only)"');
  }
  return { ok: reasons.length === 0, reasons };
}
