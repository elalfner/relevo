// The ship that the `relevo:ship` label starts on GitHub: the steps of /relevo:ship, run by a workflow with no model.
// Implements "A label starts an unattended ship" and the requirements after it in openspec/specs/ship/spec.md.
//
// Everything that touches the outside is injected, so the whole sequence is testable without a network:
//   sh(cmd, args, { cwd, input }) -> { status, stdout, stderr }   git, openspec and the plugin's scripts
//   gh(args) -> stdout                                            reads, comments and labels (workflow token)
//   pushGh(args) -> stdout                                        merge and close (App token, or the workflow token)
//   sleep(ms), now()                                              waiting for the checks of the archive commit
// Nothing from the feature branch is executed: git runs without hooks, and the scripts come from `pluginRoot`.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.mjs';
import { clearAll, resolveLabelNames } from './labels.mjs';
import { renderMessage } from './messages.mjs';
import { shipDecision } from './ship.mjs';
import { baselineChecks, loadPr, requiredChecks } from './ship-github.mjs';

const ARCHIVE_SUBJECT = 'chore(openspec): archive ';
const CONFLICT_REASON = /has conflicts/;

const NOTES = {
  baseline: {
    en: (sha) => `The archive commit changes only openspec/ and had no checks of its own, so the checks of the approved head ${sha} were used.`,
    es: (sha) => `El commit del archivo solo cambia openspec/ y no tuvo checks propios, así que se usaron los checks del head aprobado ${sha}.`,
  },
  none: {
    en: () => 'No check ran on this code: only the review vouched for it (review.ship_without_ci is true).',
    es: () => 'No corrió ningún check sobre este código: solo la revisión lo respalda (review.ship_without_ci es true).',
  },
};

/**
 * What a label cannot do that a person in a session can. Returns null when the label may ship, or the message to post.
 * - a decision that stops, stops;
 * - an eligible person who did not approve must say so in writing, which a label cannot;
 * - no checks at all need the person's word, unless review.ship_without_ci says the label is enough.
 */
export function labelRules({ decision, config }) {
  if (!decision.allowed) return { kind: 'ship_stopped', data: { reasons: decision.reasons.join('; ') } };
  if (decision.confirm.includes('not-approver')) {
    return { kind: 'ship_not_approver', data: { approvers: decision.summary.approvedBy.map((l) => `@${l}`).join(', ') } };
  }
  if (decision.confirm.includes('no-ci') && !config.review.ship_without_ci) return { kind: 'ship_no_ci', data: {} };
  return null;
}

class Stop {
  constructor(kind, data = {}) {
    this.kind = kind;
    this.data = data;
  }
}
const stopWith = (kind, data) => {
  throw new Stop(kind, data);
};
const stopReasons = (...reasons) => stopWith('ship_stopped', { reasons: reasons.join('; ') });
const firstLines = (text, n = 6) => String(text ?? '').trim().split('\n').slice(0, n).join(' / ');

/** The change folder of the issue on the branch, and whether it is still to be archived. */
export function findChange(workDir, issue) {
  const changes = join(workDir, 'openspec', 'changes');
  const prefix = `${issue}-`;
  const active = existsSync(changes) ? readdirSync(changes).filter((n) => n.startsWith(prefix) && n !== 'archive') : [];
  if (active.length === 1) return { name: active[0], state: 'active' };
  if (active.length > 1) return { name: null, state: 'ambiguous', found: active };
  const archiveDir = join(changes, 'archive');
  const dated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-(${issue}-.+)$`);
  const archived = existsSync(archiveDir) ? readdirSync(archiveDir).map((n) => n.match(dated)?.[1]).filter(Boolean) : [];
  if (archived.length === 1) return { name: archived[0], state: 'archived' };
  return { name: null, state: archived.length > 1 ? 'ambiguous' : 'missing', found: archived };
}

export async function runUnattendedShip(ctx) {
  const { repo, issue, actor, actorType, hasApp, workDir, pluginRoot, sh, gh, pushGh } = ctx;
  const sleep = ctx.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = ctx.now ?? (() => Date.now());
  const waitLimitMs = ctx.waitLimitMs ?? 30 * 60 * 1000;
  const settleMs = ctx.settleMs ?? 3 * 60 * 1000;
  const pollMs = ctx.pollMs ?? 20 * 1000;
  const headPollMs = ctx.headPollMs ?? 10 * 1000;
  const n = String(issue);

  const run = (cmd, args, opts = {}) => sh(cmd, args, { cwd: workDir, ...opts });
  const git = (args, opts = {}) => {
    const r = run('git', ['-c', 'core.hooksPath=/dev/null', ...args], opts);
    if (r.status !== 0 && !opts.allowFail) stopReasons(`git ${args[0]} failed: ${firstLines(r.stderr || r.stdout)}`);
    return r;
  };
  const script = (name, args, opts = {}) => run(process.execPath, [join(pluginRoot, 'scripts', name), ...args], opts);
  const openspec = (args) => run('openspec', args, { env: { OPENSPEC_TELEMETRY: '0' } });

  // The configuration of the default branch only names the base branch; the one that applies is the base branch's.
  const readConfig = (text, where) => {
    const loaded = loadConfig(text);
    if (!loaded.ok) stopReasons(`relevo.yml on ${where} is not valid: ${loaded.errors.map((e) => e.message).join('; ')}`);
    return loaded.config;
  };

  let config = loadConfig('limits:\n  run_max_cost: 1\n').config;
  let names = resolveLabelNames({});
  const removeShipLabel = () => {
    try {
      gh(['issue', 'edit', n, '--repo', repo, '--remove-label', names.ship]);
    } catch {
      // The label may already be gone; the comment still says what happened.
    }
  };

  if (actorType !== 'User') {
    removeShipLabel();
    return { outcome: 'ignored', reason: 'the label was not applied by a person' };
  }

  try {
    const fromDefault = run('git', ['show', 'HEAD:relevo.yml']);
    if (fromDefault.status !== 0) stopReasons('relevo.yml not found on the default branch: run /relevo:init');
    const base = readConfig(fromDefault.stdout, 'the default branch').branches.base;
    git(['fetch', '--no-tags', 'origin', base]);
    const fromBase = run('git', ['show', `origin/${base}:relevo.yml`]);
    if (fromBase.status !== 0) stopReasons(`relevo.yml not found on ${base}`);
    config = readConfig(fromBase.stdout, base);
    names = resolveLabelNames(config.labels);
    const language = config.language;

    const issueData = JSON.parse(gh(['issue', 'view', n, '--repo', repo, '--json', 'state,labels']));
    const labels = issueData.labels.map((l) => l.name);
    if (issueData.state !== 'OPEN') stopReasons('the issue is closed');

    // The issue's branch, looked up on the remote: never a branch named by the event.
    const heads = git(['ls-remote', '--heads', 'origin']).stdout.split('\n')
      .map((l) => l.split('\t')[1]?.replace('refs/heads/', ''))
      .filter((b) => b && b.startsWith(`feature/${n}-`));
    if (heads.length === 0) stopReasons(`there is no branch feature/${n}-* on the remote`);
    if (heads.length > 1) stopReasons(`more than one branch matches feature/${n}-*: ${heads.join(', ')}`);
    const branch = heads[0];
    git(['fetch', '--no-tags', 'origin', branch]);
    git(['switch', '--force-create', branch, `origin/${branch}`]);
    const head = () => git(['rev-parse', 'HEAD']).stdout.trim();

    const change = findChange(workDir, n);
    if (change.state === 'missing') stopReasons(`no change folder openspec/changes/${n}-* on ${branch}`);
    if (change.state === 'ambiguous') stopReasons(`more than one change folder for #${n}: ${change.found.join(', ')}`);

    // The head the approval was given on: the current one, or the one before the archive when a previous run archived.
    const subject = (ref) => git(['log', '-1', '--format=%s', ref]).stdout.trim();
    let baseline = head();
    if (change.state === 'archived') baseline = subject('HEAD').startsWith(ARCHIVE_SUBJECT) ? git(['rev-parse', 'HEAD^']).stdout.trim() : undefined;

    const decide = (pr, withBaseline) => shipDecision({
      config, pr, invoker: actor, labels, issue: n,
      baseline: withBaseline,
      baselineChecks: withBaseline ? baselineChecks(gh, repo, withBaseline, pr?.headRefOid) : undefined,
    });
    // GitHub takes a moment to see a push on the pull request; a head that never matches means someone else pushed.
    const check = async (withBaseline) => {
      const local = head();
      let pr = loadPr(gh, repo, branch);
      for (let tries = 0; pr && pr.headRefOid !== local && tries < 6; tries += 1) {
        await sleep(headPollMs);
        pr = loadPr(gh, repo, branch);
      }
      if (pr && pr.headRefOid !== local) stopReasons('the branch moved while shipping: apply the label again');
      return { pr, decision: decide(pr, withBaseline) };
    };

    let { pr, decision } = await check(baseline);
    const rule = labelRules({ decision, config });
    if (rule) stopWith(rule.kind, rule.data);

    const required = requiredChecks(gh, repo, base);
    if (required.required && !hasApp) stopWith('ship_needs_app', { base });

    const diff = git(['diff', `origin/${base}...HEAD`]).stdout;
    const scan = script('scan-diff.mjs', [], { input: diff });
    if (scan.status !== 0) stopReasons(`the diff has findings: ${firstLines(scan.stdout || scan.stderr)}`);

    const archive = () => {
      const steps = [
        () => openspec(['validate', change.name]),
        () => script('fix-tasks.mjs', ['--file', `openspec/changes/${change.name}/tasks.md`, '--stage', 'after']),
        () => openspec(['archive', change.name, '-y']),
        () => script('check-archive.mjs', []),
        () => script('stage.mjs', ['openspec/changes', 'openspec/specs']),
      ];
      steps.forEach((step) => {
        const r = step();
        if (r.status !== 0) stopReasons(`the archive stopped: ${firstLines(r.stdout || r.stderr)}`);
      });
      git(['commit', '-m', `${ARCHIVE_SUBJECT}${change.name} (#${n})`]);
      git(['push', 'origin', `HEAD:refs/heads/${branch}`]);
    };

    let pushed = false;
    if (change.state === 'active') {
      archive();
      pushed = true;
    }

    // With the App, the push started the project's checks: wait for them, for a bounded time.
    if (pushed && hasApp) {
      const started = now();
      for (;;) {
        const current = loadPr(gh, repo, branch);
        const rollup = current?.statusCheckRollup ?? [];
        const running = rollup.some((c) => (c.__typename === 'StatusContext' ? !['SUCCESS', 'FAILURE', 'ERROR'].includes(c.state) : c.status !== 'COMPLETED'));
        if (rollup.length > 0 && !running) break;
        if (rollup.length === 0 && now() - started >= settleMs) break;
        if (now() - started >= waitLimitMs) {
          stopReasons(`the checks of the archive commit did not finish within ${Math.round(waitLimitMs / 60000)} minutes; apply the label again: the specification is already archived, so it resumes from the merge`);
        }
        await sleep(pollMs);
      }
    }

    ({ pr, decision } = await check(baseline));
    if (!decision.allowed && decision.reasons.length === 1 && CONFLICT_REASON.test(decision.reasons[0]) && subject('HEAD').startsWith(ARCHIVE_SUBJECT)) {
      // The base branch changed the specifications the archive wrote: undo the archive, bring in the base, archive again.
      git(['revert', '--no-edit', 'HEAD']);
      const merge = git(['merge', '--no-edit', `origin/${base}`], { allowFail: true });
      if (merge.status !== 0) {
        const scope = script('conflict-scope.mjs', []);
        git(['merge', '--abort'], { allowFail: true });
        if (scope.status !== 0) stopReasons(`bringing in ${base} conflicts in code, which is for the author: ${firstLines(scope.stdout)}`);
        stopReasons(`bringing in ${base} conflicts inside openspec/: run /relevo:ship ${n} to resolve it in a session`);
      }
      archive();
      // The head now holds more than the archive, so the approval must be on it.
      ({ pr, decision } = await check(undefined));
    }
    const again = labelRules({ decision, config });
    if (again) stopWith(again.kind, again.data);

    const merged = head();
    try {
      pushGh(['pr', 'merge', String(pr.number), '--repo', repo, '--squash', '--delete-branch', '--subject', pr.title, '--body', `Issue #${n}`, '--match-head-commit', merged]);
    } catch (err) {
      stopReasons(`GitHub refused the merge: ${firstLines(err.stderr || err.message)}`);
    }

    const after = JSON.parse(gh(['issue', 'view', n, '--repo', repo, '--json', 'state,labels']));
    if (after.state === 'OPEN') pushGh(['issue', 'close', n, '--repo', repo, '--reason', 'completed']);
    const { remove } = clearAll(after.labels.map((l) => l.name), config.labels);
    if (remove.length > 0) pushGh(['issue', 'edit', n, '--repo', repo, ...remove.flatMap((l) => ['--remove-label', l])]);

    let commit = merged.slice(0, 7);
    try {
      commit = (gh(['pr', 'view', String(pr.number), '--repo', repo, '--json', 'mergeCommit', '--jq', '.mergeCommit.oid']).trim() || merged).slice(0, 7);
    } catch {
      // The short head is close enough for the report.
    }
    const lang = language === 'es' ? 'es' : 'en';
    const note = decision.summary.checksFrom === 'baseline' ? NOTES.baseline[lang](String(baseline).slice(0, 7)) : decision.summary.checks === 'none' ? NOTES.none[lang]() : '';
    gh(['issue', 'comment', n, '--repo', repo, '--body', renderMessage('ship_done', { issue: n, pr: `#${pr.number}`, base, commit, actor, checks_note: note }, language)]);

    // A close made with the workflow token starts no workflow: tell the queue, so dependent issues are unblocked now.
    if (!hasApp) {
      try {
        gh(['workflow', 'run', 'relevo-queue.yml', '--repo', repo]);
      } catch {
        // No queue workflow: nothing waits on it.
      }
    }
    return { outcome: 'merged', pr: pr.number, commit };
  } catch (err) {
    if (!(err instanceof Stop)) throw err;
    removeShipLabel();
    gh(['issue', 'comment', n, '--repo', repo, '--body', renderMessage(err.kind, { actor, issue: n, ...err.data }, config.language)]);
    return { outcome: 'stopped', kind: err.kind, ...err.data };
  }
}
