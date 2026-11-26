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

// The one rule for what a task line is and when it is done. It is the rule of OpenSpec (TASK_LINE_PATTERN in its
// `utils/task-progress.js`, the code behind `openspec instructions apply` and `openspec archive`), copied, so that the total and
// the done count of Relevo equal the ones OpenSpec reports; tests/tasks-contract.test.mjs compares them with the installed CLI.
//   - a list item (`-`, `*`, `+`, or `1.` / `1)`), indented or not, with a box that holds at most one marker: `[ ]`, `[x]`, `[]`, `[~]`, `[ x ]`;
//   - only `x` or `X` means done, any other marker is unfinished and still counts in the total;
//   - a box followed by `(` or `[` is a link, not a task;
//   - a line with no box is not a task, and a line inside a code fence or a comment counts like any other.
const TASK_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;
const TASK_ID = /^(\d+\.\d+)\b/;

/** One line as a task: { marker, done, text, id } or null when it is not a task. `id` is the `N.M` that starts the text, or null. */
export function parseTaskLine(line) {
  const match = TASK_LINE.exec(String(line ?? ''));
  if (!match) return null;
  const marker = match[1] ?? '';
  const text = match[2].trim();
  return { marker, done: marker.toLowerCase() === 'x', text, id: TASK_ID.exec(text)?.[1] ?? null };
}

/** Every task of the file in order: [{ line, marker, done, text, id }], `line` being the 1-based number of the line. */
export function parseTaskLines(tasksText) {
  const tasks = [];
  String(tasksText ?? '').split('\n').forEach((raw, i) => {
    const task = parseTaskLine(raw);
    if (task) tasks.push({ line: i + 1, ...task });
  });
  return tasks;
}

/** How many tasks are done out of all of them: { done, total }, as OpenSpec counts them. The sections added by corrections count too. */
export function countTasks(tasksText) {
  const tasks = parseTaskLines(tasksText);
  return { done: tasks.filter((t) => t.done).length, total: tasks.length };
}

/** Ids of the tasks that are still unfinished (any marker but `x`). */
export function uncheckedTasks(tasksText) {
  return parseTaskLines(tasksText).filter((t) => !t.done && t.id).map((t) => t.id);
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
    const task = parseTaskLine(lines[i]);
    if (task?.id) tasks.push({ id: task.id, text: task.text.slice(task.id.length).trim() });
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
