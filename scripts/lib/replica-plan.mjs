// The recipe of a replicated build and the model of a replica. Implements "The recipe of a replicated build is declared in
// tasks.md", "A script checks the recipe before the build" and "The model of a replica comes from the ladder and the model plan"
// of the go specification.
//
// The recipe is declared, not guessed (decision D1 of #135): a task marked `[replica]` is a replica, nothing else is.
//
//   ## Replication recipe
//
//   - Template: `section 1`            (or `pattern`, or `src/a.vue`, `tests/a.test.ts`)
//
//   ## 2. Replicas
//
//   - [ ] 2.1 [replica] Invoices screen
//     - Rename: Orders -> Invoices, orders -> invoices
//     - Differences: a total column; no status filter       (or `none`)
//
// `section K` is the files that the checkpoint of section K of tasks.md changed; `pattern` is the files of the merged change of
// the issue's `Pattern:` line (pattern-check.mjs); anything else is a list of paths.

import { AUTO } from './config.mjs';

const REPLICA_TASK = /^\s*(?:[-*+]\s+)?\[([ xX])\]\s+(\d+\.\d+)\s+\[replica\]\s*(.*)$/i;
const RECIPE_HEADING = /^##\s+Replication recipe\s*$/i;
const FIELD = /^\s+[-*+]\s+(Rename|Differences):\s*(.*)$/i;

/** `Orders -> Invoices, orders -> invoices` as [{ from, to }]; a pair that is not `a -> b` is returned in `bad`. */
export function parseRename(text) {
  const pairs = [];
  const bad = [];
  String(text ?? '').split(/[,;]/).map((p) => p.trim()).filter(Boolean).forEach((part) => {
    const m = part.replace(/`/g, '').match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
    if (m && m[1].trim() !== '' && m[2].trim() !== '') pairs.push({ from: m[1].trim(), to: m[2].trim() });
    else bad.push(part);
  });
  return { pairs, bad };
}

function parseTemplate(value) {
  const text = value.trim();
  if (/^`?pattern`?$/i.test(text)) return { kind: 'pattern' };
  const section = text.replace(/`/g, '').match(/^section\s+(\d+)$/i);
  if (section) return { kind: 'section', section: section[1] };
  const paths = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  return paths.length > 0 ? { kind: 'paths', paths } : null;
}

/**
 * { template, hasRecipe, replicas: [{ id, title, section, done, rename, differences, problems }], sections, problems }.
 * `sections` lists the numbers of the numbered sections, with whether they hold a replica.
 */
export function parseRecipe(tasksText) {
  const lines = String(tasksText ?? '').split('\n');
  const problems = [];
  let template = null;
  let hasRecipe = false;
  const replicas = [];
  const sections = [];
  let inRecipe = false;
  let section = null;
  let current = null;
  lines.forEach((line) => {
    if (/^##\s/.test(line)) {
      inRecipe = RECIPE_HEADING.test(line);
      if (inRecipe) hasRecipe = true;
      const n = /^##\s+(\d+)\./.exec(line);
      section = n ? n[1] : null;
      if (n) sections.push({ section: n[1], replica: false });
      current = null;
      return;
    }
    if (inRecipe) {
      const t = line.match(/^\s*[-*+]\s+Template:\s*(.*)$/i);
      if (t) {
        template = parseTemplate(t[1]);
        if (!template) problems.push(`the recipe's Template: "${t[1].trim().slice(0, 40)}" is not "section K", "pattern" or backticked paths`);
      }
      return;
    }
    const task = line.match(REPLICA_TASK);
    if (task) {
      current = { id: task[2], title: task[3].trim(), section, done: task[1] !== ' ', rename: [], renameBad: [], differences: null, problems: [] };
      replicas.push(current);
      const s = sections.find((x) => x.section === section);
      if (s) s.replica = true;
      return;
    }
    if (/^\s*(?:[-*+]\s+)?\[[ xX]\]\s+\d/.test(line)) { current = null; return; }
    const field = current ? line.match(FIELD) : null;
    if (!field) return;
    if (field[1].toLowerCase() === 'rename') {
      const r = parseRename(field[2]);
      current.rename.push(...r.pairs);
      current.renameBad.push(...r.bad);
    } else {
      current.differences = field[2].trim();
    }
  });
  replicas.forEach((r) => {
    if (r.rename.length === 0 && r.renameBad.length === 0) r.problems.push('has no Rename: line with a pair "old -> new"');
    r.renameBad.forEach((b) => r.problems.push(`has a rename "${b}" that is not "old -> new"`));
    if (r.differences === null || r.differences === '') r.problems.push('has no Differences: line (write what differs from the template, or "none")');
  });
  return { template, hasRecipe, replicas, sections, problems };
}

/**
 * The check that needs no model. `hasPattern`: the issue has a valid `Pattern:` line.
 * Returns { ok, replicated, template, replicas: [{ id, title, section, rename, differences }], problems: [string] }. A tasks.md with no
 * replica task and no recipe is not a replicated build: ok, `replicated` false.
 */
export function checkRecipe(tasksText, { hasPattern = false } = {}) {
  const parsed = parseRecipe(tasksText);
  const problems = [...parsed.problems];
  const replicas = parsed.replicas.filter((r) => !r.done);
  if (parsed.replicas.length === 0 && !parsed.hasRecipe) return { ok: true, replicated: false, template: null, replicas: [], problems: [] };
  if (parsed.replicas.length === 0) problems.push('the Replication recipe section has no [replica] task');
  if (parsed.replicas.length > 0 && !parsed.template) problems.push('there are [replica] tasks but no "- Template:" line in a "## Replication recipe" section');
  parsed.replicas.forEach((r) => r.problems.forEach((p) => problems.push(`task ${r.id} ${p}`)));
  const t = parsed.template;
  if (t?.kind === 'pattern' && !hasPattern) problems.push('the Template is "pattern" but the issue has no valid "Pattern: #N" line');
  if (t?.kind === 'section') {
    const target = parsed.sections.find((s) => s.section === t.section);
    const firstReplica = parsed.sections.findIndex((s) => s.replica);
    if (!target) problems.push(`the Template names section ${t.section}, which tasks.md does not have`);
    else if (target.replica) problems.push(`the Template names section ${t.section}, which holds replica tasks: a template is built normally`);
    else if (firstReplica !== -1 && parsed.sections.indexOf(target) > firstReplica) problems.push(`the Template section ${t.section} comes after the first replica: the template must be built first`);
  }
  return {
    ok: problems.length === 0,
    replicated: true,
    template: t,
    replicas: replicas.map((r) => ({ id: r.id, title: r.title, section: r.section, rename: r.rename, differences: r.differences })),
    problems,
  };
}

// After this many failures of the same replica the stronger model builds it.
export const FAILURES_BEFORE_STRONGER = 2;

/**
 * The model of one launch of a replica.
 *   config     the effective configuration
 *   devModel   the model of the developer in the model plan (`dev.model`), which is the stronger one
 *   failures   how many times this same target failed the gate (or was rejected) already
 *
 * Returns { model, escalate, why }. `escalate` is true when even the stronger model failed (3 or more): ask
 * `model-plan.mjs escalate --from <model>` for the next one. Only `agents.ladder` and `agents.dev.floor` are read.
 */
export function replicaModel({ config, devModel, failures = 0 }) {
  const dev = config.agents.dev;
  if (dev.model !== AUTO) return { model: dev.model, escalate: false, why: 'the developer is not on auto, so the repository decided its model' };
  const ladder = config.agents.ladder;
  const top = ladder.indexOf(devModel);
  if (top === -1) return { model: devModel, escalate: false, why: `"${devModel}" is not in agents.ladder (${ladder.join(', ')}), so there is no cheaper model to pick` };
  if (failures >= FAILURES_BEFORE_STRONGER + 1) return { model: devModel, escalate: true, why: `this target failed ${failures} times, ${devModel} included: raise it with model-plan.mjs escalate` };
  if (failures >= FAILURES_BEFORE_STRONGER) return { model: devModel, escalate: false, why: `this target failed ${failures} times on the cheaper model, so the stronger model ${devModel} builds it` };
  const floor = ladder.indexOf(dev.floor);
  const at = Math.max(top - 1, floor === -1 ? 0 : floor);
  if (at >= top) return { model: devModel, escalate: false, why: `${devModel} is already the floor of the developer, so a replica saves nothing` };
  return { model: ladder[at], escalate: false, why: `one name below ${devModel} in agents.ladder, not below the floor ${ladder[Math.max(floor, 0)]}` };
}
