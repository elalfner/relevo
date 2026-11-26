// The files backend of the tracker: an issue is `.relevo/issues/<n>.md` (committed, so a worktree has it) and its state, comments,
// approval hash and delivery record live in `<git common dir>/relevo/` (shared by every worktree, never tracked). It answers in the
// JSON shape of `gh issue view`, so the pure rules (can-edit-issue, issue-hash, issue-check) take its answers unchanged.
// Implements openspec/specs/local-tracker; design decisions 1, 3 and 4 of the change local-tracker.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveLabelNames, LABELS } from '../labels.mjs';
import { issueHash } from '../issue-hash.mjs';
import { parseIssueBody } from '../issue-parse.mjs';

export const ISSUES_DIR = '.relevo/issues';
const gitReal = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const write = (path, text) => {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
};
const readJson = (path, fallback) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
};

/** The first heading is the title, the rest is the body. Pure. */
export function parseIssueFile(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const at = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (at === -1) return { title: '', body: lines.join('\n').trim() };
  return { title: lines[at].replace(/^#\s+/, '').trim(), body: [...lines.slice(0, at), ...lines.slice(at + 1)].join('\n').trim() };
}

export const renderIssueFile = ({ title, body }) => `# ${String(title).trim()}\n\n${String(body ?? '').trim()}\n`;

/**
 * @param {{ repoRoot?: string, labels?: Record<string,string>, now?: () => string, git?: (cwd, args) => string }} options
 *   `labels` is the `labels` setting of relevo.yml; `git` and `now` are injectable for the tests.
 */
export function filesBackend({ repoRoot = process.cwd(), labels = {}, now = () => new Date().toISOString(), git = gitReal } = {}) {
  const root = resolve(repoRoot);
  const names = resolveLabelNames(labels);
  const issuesDir = join(root, ISSUES_DIR);
  const common = resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  const stateDir = join(common, 'relevo');
  const recordPath = (n) => join(stateDir, 'issues', `${n}.json`);
  const logPath = (n) => join(stateDir, 'issues', `${n}.log`);
  const deliveryPath = (n) => join(stateDir, 'delivery', `${n}.json`);
  const issuePath = (n) => join(issuesDir, `${n}.md`);
  const ensure = (dir) => mkdirSync(dir, { recursive: true });
  const numbersIn = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext) && /^\d+$/.test(f.slice(0, -ext.length))).map((f) => Number(f.slice(0, -ext.length))) : []);
  const known = () => [...new Set([...numbersIn(issuesDir, '.md'), ...numbersIn(join(stateDir, 'issues'), '.json')])].sort((a, b) => a - b);
  const record = (n) => readJson(recordPath(n), { labels: [], closed: false, hash: null });
  const save = (n, r) => { ensure(join(stateDir, 'issues')); write(recordPath(n), `${JSON.stringify({ ...r, updatedAt: now() }, null, 2)}\n`); };
  const need = (n) => {
    if (!existsSync(issuePath(n))) throw Object.assign(new Error(`issue ${n} does not exist: there is no ${ISSUES_DIR}/${n}.md`), { stderr: `issue ${n} not found` });
    return parseIssueFile(readFileSync(issuePath(n), 'utf8'));
  };
  const comments = (n) => (existsSync(logPath(n)) ? readFileSync(logPath(n), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

  const shape = (n, fields) => {
    const { title, body } = need(n);
    const r = record(n);
    const full = {
      number: Number(n), title, body, state: r.closed ? 'CLOSED' : 'OPEN',
      labels: r.labels.map((name) => ({ name })), comments: comments(n), assignees: [], milestone: null,
    };
    if (!fields) return full;
    return Object.fromEntries(String(fields).split(',').map((f) => f.trim()).filter((f) => f in full).map((f) => [f, full[f]]));
  };

  return {
    kind: 'files',
    issueGet: (n, fields) => shape(n, fields),
    issueList: ({ state = 'open', search = null, fields = 'number,title,labels' } = {}) => known().filter((n) => existsSync(issuePath(n))).map((n) => shape(n)).filter((i) => {
      if (state !== 'all' && i.state.toLowerCase() !== state) return false;
      return !search || `${i.title}\n${i.body}`.toLowerCase().includes(String(search).toLowerCase());
    }).map((i) => Object.fromEntries(String(fields).split(',').map((f) => f.trim()).filter((f) => f in i).map((f) => [f, i[f]]))),
    /** Takes the next number (never one that was used), writes the file and returns its path relative to the repository. */
    issueCreate: ({ title, body }) => {
      const n = (known().at(-1) ?? 0) + 1;
      ensure(issuesDir);
      write(issuePath(n), renderIssueFile({ title, body }));
      save(n, { labels: [], closed: false, hash: null, createdAt: now() });
      return `${ISSUES_DIR}/${n}.md`;
    },
    issueEditBody: (n, body) => { write(issuePath(n), renderIssueFile({ title: need(n).title, body })); },
    /** `add` and `remove` are label names. Adding `ready` stores the hash of the text that is being approved. */
    stateSet: (n, { add = [], remove = [] }) => {
      const current = need(n);
      const r = record(n);
      const next = new Set(r.labels);
      remove.forEach((l) => next.delete(l));
      add.forEach((l) => next.add(l));
      const approving = add.includes(names.ready);
      const withdrawn = remove.includes(names.ready) && !next.has(names.ready);
      save(n, { ...r, labels: [...next], hash: approving ? issueHash(current) : (withdrawn ? null : r.hash) });
    },
    commentAdd: (n, body) => { need(n); ensure(join(stateDir, 'issues')); appendFileSync(logPath(n), `${JSON.stringify({ body, createdAt: now(), author: { login: 'local' } })}\n`); },
    commentsList: (n) => { need(n); return comments(n); },
    /** Closes the issue: its state is cleared and its number stays taken. */
    issueClose: (n) => { need(n); save(n, { ...record(n), labels: [], closed: true, hash: null }); },
    deliveryOpen: ({ branch, base, title, body, issue = null }) => {
      const n = issue ?? Number(/^(?:feature\/)?(?:relevo\/)?(\d+)/.exec(branch)?.[1] ?? 0);
      ensure(join(stateDir, 'delivery'));
      write(deliveryPath(n), `${JSON.stringify({ issue: n, branch, base, title, body, openedAt: now() }, null, 2)}\n`);
      return deliveryPath(n);
    },
    /** The delivery record of an issue, or null. */
    deliveryRead: (n) => readJson(deliveryPath(n), null),
    /** Merges `patch` into the delivery record (created when there is none): the review result and the last green gate go here. */
    deliverySet: (n, patch) => {
      ensure(join(stateDir, 'delivery'));
      write(deliveryPath(n), `${JSON.stringify({ issue: Number(n), ...readJson(deliveryPath(n), {}), ...patch }, null, 2)}\n`);
    },
    deliveryGet: (branch) => {
      const dir = join(stateDir, 'delivery');
      const found = numbersIn(dir, '.json').map((n) => readJson(deliveryPath(n), null)).find((d) => d?.branch === branch);
      return found ?? null;
    },

    // Beyond the shared verbs: what only a files project needs.
    /** Is the text the one that was approved? { ok, expected, actual }. `ok` is false when the issue was never approved. */
    approvalCheck: (n) => {
      const actual = issueHash(need(n));
      const expected = record(n).hash;
      return { ok: expected !== null && expected === actual, expected, actual };
    },
    /** { ok, waiting: [n], missing: [n], external: [string], problems }: Depends-on lines against the state of the other issues. */
    dependencyCheck: (n) => {
      const parsed = parseIssueBody(need(n).body);
      const waiting = [];
      const missing = [];
      parsed.dependsOn.forEach((d) => {
        if (!existsSync(issuePath(d)) && !existsSync(recordPath(d))) missing.push(d);
        else if (!record(d).closed) waiting.push(d);
      });
      const external = [...parsed.dependsOnExternal.map((e) => `${e.repo}#${e.number}`), ...parsed.dependsOnInvalid];
      const problems = [
        ...external.map((e) => `Depends-on names ${e}: a files project cannot depend on another repository`),
        ...missing.map((d) => `Depends-on #${d}: there is no such issue`),
        ...waiting.map((d) => `waiting for #${d}, which is not shipped yet`),
      ];
      return { ok: problems.length === 0, waiting, missing, external, problems };
    },
    stateFolder: stateDir,
    labelKeys: LABELS.map((l) => l.key),
  };
}
