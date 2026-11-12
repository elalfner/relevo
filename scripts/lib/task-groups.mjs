// Splits the pending tasks of a change into the groups the developer builds one at a time. Implements "The developer
// builds one section of tasks at a time" of the go specification.
//
// A group is a section of `tasks.md` (`## 1. Title`) with its unchecked tasks (`- [ ] 1.1 ...`), in file order. A change
// with three pending tasks or fewer is one group: splitting it would cost more launches than it saves. A task that is
// under no section goes in a group of its own at the end.
//
// A task marked `[replica]` (see replica-plan.mjs) is a group of its own, flagged `replica`, so that each replica is one launch
// and one checkpoint. Replica groups are never joined by the small-change rule, and they come after the groups they copy.

export const SMALL_CHANGE = 3;
export const REPLICA_MARK = /^\s*(?:[-*+]\s+)?\[[ xX]\]\s+\d+\.\d+\s+\[replica\]/i;

/**
 * { groups: [{ section, title, tasks: ['1.1', '1.2'] }], pending }.
 * `section` is the number of the heading ('1', '2', ...) or null for a task outside any section; a replica group also has `replica: true`.
 */
export function taskGroups(tasksText) {
  const lines = String(tasksText ?? '').split('\n');
  const sections = [];
  const replicas = [];
  let current = null;
  let loose = null;
  lines.forEach((line) => {
    const heading = /^##\s+(\d+)\.\s*(.*)$/.exec(line);
    if (heading) {
      current = { section: heading[1], title: heading[2].trim(), tasks: [] };
      sections.push(current);
      return;
    }
    if (/^##\s/.test(line)) {
      current = null; // a heading with no number ("Workflow follow-up") ends the numbered sections
      return;
    }
    const task = /^\s*- \[ \] (\d+\.\d+)\b/.exec(line);
    if (!task) return;
    if (REPLICA_MARK.test(line)) {
      replicas.push({ section: current ? current.section : null, title: line.replace(/^\s*- \[ \] \d+\.\d+\s+\[replica\]\s*/i, '').trim(), tasks: [task[1]], replica: true });
      return;
    }
    if (current) current.tasks.push(task[1]);
    else (loose ??= { section: null, title: '', tasks: [] }).tasks.push(task[1]);
  });
  const normal = [...sections, ...(loose ? [loose] : [])].filter((g) => g.tasks.length > 0);
  const pendingNormal = normal.reduce((total, g) => total + g.tasks.length, 0);
  const pending = pendingNormal + replicas.length;
  if (pendingNormal <= SMALL_CHANGE && normal.length > 1) {
    return { groups: [{ section: null, title: '', tasks: normal.flatMap((g) => g.tasks) }, ...replicas], pending };
  }
  return { groups: [...normal, ...replicas], pending };
}
