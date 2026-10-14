// `init`: builds the plan of everything that has to change, then applies it once the person confirms.
// Implements openspec/changes/relevo-v1/specs/init-doctor/spec.md.
//
// planInit is pure: it compares the facts `doctor` gathers with what a configured repository looks like, so
// running it again only lists what differs (idempotent). applyPlan carries items out through injected I/O.
// init never reads or writes the model API key.

import { loadConfig } from './config.mjs';
import { labelDefinitions } from './labels.mjs';
import { OPENSPEC_INSTALL, REQUIRED_SKILLS, SKILL_INSTALL, WORKFLOW_FILES } from './doctor.mjs';

export const REVIEW_MODES = ['none', 'peer', 'roles'];

/** relevo.yml from the template and the person's answers. Throws when the result does not validate. */
export function renderConfig(template, answers = {}) {
  const set = (text, key, value) => {
    const re = new RegExp(`^(\\s*${key}:)\\s*[^#\\n]*?(\\s*(#.*)?)$`, 'm');
    if (!re.test(text)) throw new Error(`the template has no "${key}" line`);
    return text.replace(re, (_, head, tail) => `${head} ${value}${tail.startsWith(' ') || tail === '' ? tail : ` ${tail}`}`);
  };
  let out = template;
  if (answers.base) out = set(out, 'base', answers.base);
  if (answers.release) out = set(out, 'release', answers.release);
  if (answers.platform) out = set(out, 'platform', answers.platform);
  if (answers.members) out = set(out, 'members', `[${answers.members.join(', ')}]`);
  if (answers.specWriter !== undefined) out = set(out, 'spec_writer', answers.specWriter ?? 'null');
  if (answers.reviewMode) out = set(out, 'mode', answers.reviewMode);
  if (answers.merger) out = set(out, 'merger', answers.merger);
  if (answers.runMaxCost !== undefined) out = set(out, 'run_max_cost', answers.runMaxCost);
  if (answers.language) out = set(out, 'language', answers.language);
  const check = loadConfig(out);
  if (!check.ok) throw new Error(`the answers produce an invalid relevo.yml: ${check.errors.map((e) => e.message).join('; ')}`);
  return out;
}

/** The repository ruleset that makes the invariants platform-enforced. */
export function rulesetBody({ base, release, reviewMode }) {
  return {
    name: 'relevo-protected-branches',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: [`refs/heads/${base}`, `refs/heads/${release}`], exclude: [] } },
    bypass_actors: [],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: reviewMode === 'none' ? 0 : 1,
          // The archive commit is pushed after approval; dismissing approvals on push would undo it.
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
        },
      },
    ],
  };
}

/**
 * The ruleset that keeps the unattended agent on `feature/*`: nobody but a maintainer or an administrator may
 * create any other branch. Updates to the base and release branches are already blocked by the other ruleset
 * (pull request required); existing branches are not touched, so merging and normal work keep working.
 */
export function pushScopeBody({ base, release }) {
  return {
    name: 'relevo-push-scope',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~ALL'], exclude: ['refs/heads/feature/*', `refs/heads/${base}`, `refs/heads/${release}`] } },
    // Repository role ids: 5 = admin, 2 = maintain.
    bypass_actors: [
      { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' },
      { actor_id: 2, actor_type: 'RepositoryRole', bypass_mode: 'always' },
    ],
    rules: [{ type: 'creation' }],
  };
}

/** What to change by hand when init cannot (not an administrator, or the feature needs a paid plan). */
export function manualChecklist({ base, release, reviewMode }) {
  return [
    `Settings > Rules > Rulesets: add a ruleset that targets \`${base}\` and \`${release}\`, with no bypass actors, that blocks deletion and force pushes and requires a pull request${reviewMode === 'none' ? '' : ' with at least 1 approval'}.`,
    'In that ruleset, leave "Dismiss stale pull request approvals when new commits are pushed" OFF (the spec archive commit is pushed after approval).',
    'Settings > Actions > General > Workflow permissions: choose "Read repository contents" and turn OFF "Allow GitHub Actions to create and approve pull requests".',
    'Settings > Code security: turn ON secret scanning and push protection.',
  ];
}

/** The extra setting that keeps the agent on feature branches, for the hand-made route. */
export function pushScopeChecklist({ base, release }) {
  return [`Settings > Rules > Rulesets: add a second ruleset on all branches except \`feature/*\`, \`${base}\` and \`${release}\` that restricts creation, with the Maintain and Admin roles allowed to bypass, so the agent can only create \`feature/*\` branches.`];
}

const item = (id, status, description, extra = {}) => ({ id, status, description, ...extra });

/**
 * Plan every change. `ctx`:
 *   facts      from gatherFacts (doctor)
 *   answers    the person's answers (members, specWriter, reviewMode, language, platform, base, release, merger)
 *   templates  { config: text, workflows: { file: text } }
 *   current    { workflows: { file: text|null }, gitignore: text|null, keepFiles: { path: boolean } }
 *   admin      true when the person has administrator permission on the repository
 * Items have status: ok (nothing to do), todo (init will do it), differs (exists but differs: reported, never
 * overwritten), manual (the person must do it).
 */
export function planInit({ facts, answers, templates, current, admin }) {
  const items = [];
  const base = facts.config?.branches?.base ?? answers.base ?? 'dev';
  const release = facts.config?.branches?.release ?? answers.release ?? 'main';
  const reviewMode = facts.config?.review?.mode ?? answers.reviewMode ?? 'peer';
  const names = labelDefinitions(facts.config?.labels ?? {});

  // dependencies: offered, never installed without confirmation
  if (!facts.openspec) items.push(item('install.openspec', 'todo', 'Install the OpenSpec command-line tool', { install: true, command: 'npm install --global @fission-ai/openspec', detail: OPENSPEC_INSTALL }));
  REQUIRED_SKILLS.filter((n) => !facts.skills[n]).forEach((n) => items.push(item(`install.skill.${n}`, 'todo', `Install the ${n} skill`, { install: true, command: n === 'openspec-explore' ? 'openspec init' : 'npx skills add mattpocock/skills', detail: SKILL_INSTALL[n] })));

  // relevo.yml
  if (facts.configText !== null) items.push(item('config', facts.config ? 'ok' : 'differs', facts.config ? 'relevo.yml exists and is valid' : `relevo.yml exists but is invalid: ${facts.configErrors.join('; ')}`));
  else items.push(item('config', 'todo', 'Create relevo.yml from the answers', { content: renderConfig(templates.config, { base, release, ...answers }) }));

  // labels
  const missing = (facts.labels ?? null) === null ? names : names.filter((l) => !facts.labels.includes(l.name));
  items.push(missing.length === 0 ? item('labels', 'ok', 'All lifecycle labels exist') : item('labels', 'todo', `Create ${missing.length} label(s): ${missing.map((l) => l.name).join(', ')}`, { labels: missing }));

  // base branch
  items.push(facts.branches?.base ? item('branch.base', 'ok', `Base branch ${base} exists`) : item('branch.base', 'todo', `Create branch ${base} from ${release}`, { base, release }));

  // repository protection
  const protectionOk = ['base', 'release'].every((k) => facts.protection?.[k]?.pullRequestRequired && !facts.protection[k].dismissStale);
  const checklist = manualChecklist({ base, release, reviewMode });
  if (protectionOk) items.push(item('protection', 'ok', 'Branch protection is in place'));
  else if (!admin || facts.protectionUnavailable) items.push(item('protection', 'manual', admin ? 'Branch protection is not available on this repository; set it by hand when you can' : 'You are not an administrator: ask one to set the branch protection', { checklist }));
  else items.push(item('protection', 'todo', `Add a ruleset: pull request required on ${base} and ${release}, no deletion, no force push, approvals not dismissed on push`, { ruleset: rulesetBody({ base, release, reviewMode }), checklist }));

  if (facts.pushScope === true) items.push(item('push-scope', 'ok', 'The agent can only create feature/* branches'));
  else if (!admin || facts.protectionUnavailable) items.push(item('push-scope', 'manual', admin ? 'Rulesets are not available on this repository: keep the agent on feature/* branches by hand when you can' : 'Ask an administrator to keep the agent on feature/* branches', { checklist: pushScopeChecklist({ base, release }) }));
  else items.push(item('push-scope', 'todo', 'Add a ruleset so that only maintainers and administrators can create branches other than feature/* (the agent pushes only feature/*)', { ruleset: pushScopeBody({ base, release }), checklist: pushScopeChecklist({ base, release }) }));

  items.push(facts.canApprove === false ? item('workflow-permissions', 'ok', 'Workflows cannot approve pull requests')
    : admin ? item('workflow-permissions', 'todo', 'Stop workflows from approving pull requests and make their token read-only by default')
      : item('workflow-permissions', 'manual', 'Ask an administrator to stop workflows from approving pull requests', { checklist: [checklist[2]] }));
  const scanOn = facts.secretScanning?.scanning === true && facts.secretScanning?.pushProtection === true;
  if (scanOn) items.push(item('secret-scanning', 'ok', 'Secret scanning and push protection are on'));
  else items.push(admin ? item('secret-scanning', 'todo', 'Turn on secret scanning and push protection (may need a public repository or a paid plan; if GitHub refuses, it is reported)', { checklist: [checklist[3]] })
    : item('secret-scanning', 'manual', 'Ask an administrator to turn on secret scanning and push protection', { checklist: [checklist[3]] }));

  // workflows
  WORKFLOW_FILES.forEach((file) => {
    const have = current.workflows[file] ?? null;
    if (have === null) items.push(item(`workflow.${file}`, 'todo', `Add .github/workflows/${file}`, { path: `.github/workflows/${file}`, content: templates.workflows[file] }));
    else if (have === templates.workflows[file]) items.push(item(`workflow.${file}`, 'ok', `.github/workflows/${file} is up to date`));
    else items.push(item(`workflow.${file}`, 'differs', `.github/workflows/${file} exists and differs from the template; it is left as it is (compare it by hand)`));
  });

  // local files
  const ignored = current.gitignore !== null && /^\/?evidence\/?\s*$/m.test(current.gitignore);
  items.push(ignored ? item('gitignore', 'ok', 'evidence/ is ignored') : item('gitignore', 'todo', 'Add evidence/ to .gitignore', { path: '.gitignore', line: 'evidence/' }));

  if (!facts.openspecRoot) items.push(item('openspec-root', 'manual', 'There is no OpenSpec root: run `openspec init` (init never creates openspec/ files by hand), then run init again'));
  else {
    const keeps = Object.entries(current.keepFiles).filter(([, present]) => !present).map(([path]) => path);
    items.push(keeps.length === 0 ? item('openspec-root', 'ok', 'The OpenSpec folders are tracked-ready') : item('openspec-root', 'todo', `Add ${keeps.join(', ')} so git keeps the empty OpenSpec folders (a clean checkout would otherwise have no root)`, { paths: keeps }));
  }

  // always manual
  const hasCredential = (facts.secrets ?? []).some((n) => ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(n));
  if (hasCredential) items.push(item('manual.api-key', 'ok', 'A model credential secret exists (init never reads it)'));
  else items.push(item('manual.api-key', 'manual', 'Add the model credential to the repository secrets yourself (init never reads or writes it): ANTHROPIC_API_KEY, or CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` with all whitespace removed'));
  items.push(item('manual.push', 'manual', 'Commit and push the new files to the default branch: a workflow only runs from there'));

  return items;
}

/** Plain-text plan, shown before anything is changed. */
export function renderPlan(items) {
  const tag = { ok: 'ok     ', todo: 'will do', differs: 'differs', manual: 'by hand' };
  const todo = items.filter((i) => i.status === 'todo').length;
  const lines = items.map((i) => `[${tag[i.status]}] ${i.description}${i.install ? ` (${i.command})` : ''}`);
  lines.push('', todo === 0 ? 'Nothing to do.' : `${todo} change(s) to make.`);
  return lines.join('\n');
}

/** Mark the items named in `ids` as skipped, so `applyPlan` leaves them for a later run. */
export function skipItems(items, ids) {
  const skip = new Set(ids);
  return items.map((i) => (skip.has(i.id) && i.status === 'todo' ? { ...i, status: 'skipped' } : i));
}

/**
 * Carry out the `todo` items that are not installs. `io`: gh(args, input?) -> stdout, write(path, text),
 * append(path, line), mkdir(path). Returns [{ id, ok, message, checklist? }]; a refused GitHub change becomes a
 * manual checklist instead of a silent failure.
 */
export function applyPlan(items, { repo, io }) {
  const results = [];
  const refused = (it, err) => {
    const m = String(err.stderr ?? err.message ?? err).trim().split('\n')[0];
    results.push({ id: it.id, ok: false, message: `GitHub refused: ${m}`, checklist: it.checklist ?? [] });
  };
  items.filter((i) => i.status === 'todo' && !i.install).forEach((it) => {
    try {
      switch (it.id) {
        case 'config':
          io.write('relevo.yml', it.content);
          break;
        case 'labels':
          it.labels.forEach((l) => io.gh(['label', 'create', l.name, '--repo', repo, '--color', l.color, '--description', l.description, '--force']));
          break;
        case 'branch.base': {
          const sha = JSON.parse(io.gh(['api', `repos/${repo}/branches/${it.release}`])).commit.sha;
          io.gh(['api', '-X', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/heads/${it.base}`, '-f', `sha=${sha}`]);
          break;
        }
        case 'protection':
        case 'push-scope':
          io.gh(['api', '-X', 'POST', `repos/${repo}/rulesets`, '--input', '-'], JSON.stringify(it.ruleset));
          break;
        case 'workflow-permissions':
          io.gh(['api', '-X', 'PUT', `repos/${repo}/actions/permissions/workflow`, '-f', 'default_workflow_permissions=read', '-F', 'can_approve_pull_request_reviews=false']);
          break;
        case 'secret-scanning':
          io.gh(['api', '-X', 'PATCH', `repos/${repo}`, '--input', '-'], JSON.stringify({ security_and_analysis: { secret_scanning: { status: 'enabled' }, secret_scanning_push_protection: { status: 'enabled' } } }));
          break;
        case 'gitignore':
          io.append(it.path, it.line);
          break;
        case 'openspec-root':
          it.paths.forEach((p) => io.write(p, ''));
          break;
        default:
          if (it.id.startsWith('workflow.')) io.write(it.path, it.content);
          else throw new Error(`no way to apply "${it.id}"`);
      }
      results.push({ id: it.id, ok: true, message: it.description });
    } catch (err) {
      if (['protection', 'push-scope', 'workflow-permissions', 'secret-scanning'].includes(it.id)) refused(it, err);
      else results.push({ id: it.id, ok: false, message: String(err.message ?? err) });
    }
  });
  return results;
}
