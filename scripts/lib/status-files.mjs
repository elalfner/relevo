// What is waiting in a files project: the open issues by state with the command that moves each one, and the branches waiting
// to be shipped. One person, so there are no reviewers, review deadlines, milestones or capacity to report.
// Implements "Status lists the issues of a files project from the files" of the status specification (change local-tracker).

import { resolveLabelNames } from './labels.mjs';

const TEXT = {
  en: {
    title: 'Issues of this project',
    nothing: 'Nothing is waiting: every issue is shipped.',
    branches: 'Branches waiting to be shipped',
    state: { draft: 'draft', ready: 'ready', building: 'building', built: 'built', 'in-review': 'in review', 'build-failed': 'build failed', 'needs-spec': 'needs a better text' },
    next: {
      draft: (n) => `approve it with /relevo:issue ${n}`,
      ready: (n) => `/relevo:go ${n}`,
      building: (n) => `being built: node scripts/go-local.mjs status ${n}`,
      built: (n) => `/relevo:review ${n}`,
      'in-review': (n) => `/relevo:review ${n}`,
      'build-failed-branch': (n) => `/relevo:fix ${n}`,
      'build-failed': (n) => `/relevo:go ${n} --retry`,
      'needs-spec': (n) => `/relevo:issue ${n}`,
    },
  },
  es: {
    title: 'Issues de este proyecto',
    nothing: 'No hay nada en espera: todos los issues están fusionados.',
    branches: 'Ramas en espera de fusionarse',
    state: { draft: 'borrador', ready: 'listo', building: 'construyéndose', built: 'construido', 'in-review': 'en revisión', 'build-failed': 'la construcción falló', 'needs-spec': 'necesita un mejor texto' },
    next: {
      draft: (n) => `apruébalo con /relevo:issue ${n}`,
      ready: (n) => `/relevo:go ${n}`,
      building: (n) => `se está construyendo: node scripts/go-local.mjs status ${n}`,
      built: (n) => `/relevo:review ${n}`,
      'in-review': (n) => `/relevo:review ${n}`,
      'build-failed-branch': (n) => `/relevo:fix ${n}`,
      'build-failed': (n) => `/relevo:go ${n} --retry`,
      'needs-spec': (n) => `/relevo:issue ${n}`,
    },
  },
};

/**
 * @param {{ config: object, issues: {number: number, title: string, labels: {name: string}[]}[], branches?: string[] }} input
 *   `issues` are the open issues; `branches` the local `feature/<n>-*` branches.
 * @returns {{ items: {issue: number, title: string, state: string, next: string}[], branches: {branch: string, issue: number}[] }}
 */
export function statusFiles({ config, issues, branches = [] }) {
  const names = resolveLabelNames(config.labels);
  const has = (i, key) => i.labels.some((l) => l.name === names[key]);
  const branchOf = (n) => branches.find((b) => new RegExp(`^feature/${n}-`).test(b)) ?? null;
  const items = [...issues].sort((a, b) => a.number - b.number).map((i) => {
    const state = ['building', 'in-review', 'built', 'build-failed', 'needs-spec', 'ready', 'queued'].find((k) => has(i, k)) ?? 'draft';
    const normal = state === 'queued' ? 'ready' : state;
    return { issue: i.number, title: i.title, state: normal, branch: branchOf(i.number) };
  });
  const waiting = items.filter((i) => ['built', 'in-review'].includes(i.state) && i.branch).map((i) => ({ branch: i.branch, issue: i.issue }));
  return { items: items.map(({ branch, ...rest }) => ({ ...rest, hasBranch: branch !== null })), branches: waiting };
}

/** The report as lines of text, in `language` (en or es). */
export function renderStatusFiles(report, language = 'en') {
  const t = TEXT[language] ?? TEXT.en;
  if (report.items.length === 0) return [t.nothing];
  const lines = [`${t.title}:`];
  report.items.forEach((i) => {
    const key = i.state === 'build-failed' && i.hasBranch ? 'build-failed-branch' : i.state;
    lines.push(`  #${i.issue} ${i.title} [${t.state[i.state] ?? i.state}] -> ${(t.next[key] ?? (() => ''))(i.issue)}`);
  });
  if (report.branches.length > 0) {
    lines.push('', `${t.branches}:`, ...report.branches.map((b) => `  ${b.branch} (#${b.issue})`));
  }
  return lines;
}
