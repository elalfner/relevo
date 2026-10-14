// `doctor`: reports every check as pass, fail or warn, with a fix next to each failure.
// Implements openspec/changes/relevo-v1/specs/init-doctor/spec.md.
//
// Two layers, both read-only:
//   gatherFacts(probes)  asks the machine and GitHub (through injected probes) and returns plain facts
//   runChecks(facts)     pure: turns the facts into a list of results
// The probes are injected so everything here is testable without a network.

import { loadConfig } from './config.mjs';
import { labelDefinitions } from './labels.mjs';

export const REQUIRED_SKILLS = ['openspec-explore', 'grill-with-docs', 'grilling', 'domain-modeling'];
export const SKILL_INSTALL = {
  'openspec-explore': 'run `openspec init` (or `openspec update`) in the project',
  'grill-with-docs': 'run `npx skills add mattpocock/skills` and choose it',
  grilling: 'run `npx skills add mattpocock/skills` and choose it',
  'domain-modeling': 'run `npx skills add mattpocock/skills` and choose it',
};
export const OPENSPEC_INSTALL = 'npm install --global @fission-ai/openspec (needs Node.js 20.19 or newer)';
export const WORKFLOW_FILES = ['relevo-go.yml', 'relevo-queue.yml', 'relevo-review.yml', 'relevo-sla.yml', 'relevo-digest.yml'];
const REQUIRED_WORKFLOWS = new Set(['relevo-go.yml']);
const TOOLCHAIN = { 'flutter-android': { command: 'flutter', install: 'install Flutter: https://docs.flutter.dev/get-started/install' } };

const pass = (id, message) => ({ id, status: 'pass', message });
const fail = (id, message, fix) => ({ id, status: 'fail', message, fix });
const warn = (id, message, fix) => ({ id, status: 'warn', message, fix });

/** True when `version` (like "22.1.0") is at least `min` (like "20.19"). */
export function versionAtLeast(version, min) {
  const a = String(version).replace(/^v/, '').split('.').map(Number);
  const b = String(min).split('.').map(Number);
  for (let i = 0; i < b.length; i += 1) {
    if ((a[i] ?? 0) > b[i]) return true;
    if ((a[i] ?? 0) < b[i]) return false;
  }
  return true;
}

// ---------- branch protection

const globToRegExp = (g) => new RegExp(`^${g.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/** Does a ruleset ref pattern ("refs/heads/dev", "~DEFAULT_BRANCH", "~ALL", globs) cover this branch? */
export function refMatches(pattern, branch, defaultBranch) {
  if (pattern === '~ALL') return true;
  if (pattern === '~DEFAULT_BRANCH') return branch === defaultBranch;
  return globToRegExp(pattern).test(`refs/heads/${branch}`);
}

/**
 * What the repository enforces on a branch, from its rulesets and its classic protection.
 * Returns { protected, pullRequestRequired, approvals, dismissStale, blocksDeletion, blocksForcePush }.
 */
export function summarizeProtection({ rulesets = [], classic = null, branch, defaultBranch }) {
  const out = { protected: false, pullRequestRequired: false, approvals: 0, dismissStale: false, blocksDeletion: false, blocksForcePush: false };
  rulesets.filter((r) => r.target === 'branch' && r.enforcement === 'active').forEach((r) => {
    const include = r.conditions?.ref_name?.include ?? [];
    const exclude = r.conditions?.ref_name?.exclude ?? [];
    if (!include.some((p) => refMatches(p, branch, defaultBranch)) || exclude.some((p) => refMatches(p, branch, defaultBranch))) return;
    out.protected = true;
    (r.rules ?? []).forEach((rule) => {
      if (rule.type === 'pull_request') {
        out.pullRequestRequired = true;
        out.approvals = Math.max(out.approvals, rule.parameters?.required_approving_review_count ?? 0);
        if (rule.parameters?.dismiss_stale_reviews_on_push) out.dismissStale = true;
      }
      if (rule.type === 'deletion') out.blocksDeletion = true;
      if (rule.type === 'non_fast_forward') out.blocksForcePush = true;
    });
  });
  if (classic) {
    out.protected = true;
    const pr = classic.required_pull_request_reviews;
    if (pr) {
      out.pullRequestRequired = true;
      out.approvals = Math.max(out.approvals, pr.required_approving_review_count ?? 0);
      if (pr.dismiss_stale_reviews) out.dismissStale = true;
    }
    if (classic.allow_deletions?.enabled === false) out.blocksDeletion = true;
    if (classic.allow_force_pushes?.enabled === false) out.blocksForcePush = true;
  }
  return out;
}

// ---------- gather

/**
 * Collect facts. `probes`:
 *   tool(name, args) -> stdout string, or throws when the tool is missing or fails
 *   gh(args) -> stdout (read-only GitHub calls)
 *   exists(path) -> boolean       read(path) -> string
 *   skillDirs -> directories that may hold skills
 *   repo, platform
 */
export function gatherFacts(p) {
  const f = { repo: p.repo ?? null, platform: p.platform ?? null };
  const tryRun = (fn, fallback = null) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  f.node = process.versions.node;
  f.openspec = tryRun(() => String(p.tool('openspec', ['--version'])).trim());
  f.git = tryRun(() => Boolean(p.tool('git', ['--version'])), false);
  f.gh = tryRun(() => Boolean(p.tool('gh', ['--version'])), false);
  f.ghAuth = f.gh ? tryRun(() => { p.tool('gh', ['auth', 'status']); return true; }, false) : false;
  const tc = TOOLCHAIN[f.platform];
  f.toolchain = tc ? tryRun(() => { p.tool(tc.command, ['--version']); return true; }, false) : null;
  f.adb = tryRun(() => Boolean(p.tool('adb', ['version'])), false);

  f.skills = {};
  REQUIRED_SKILLS.forEach((name) => {
    f.skills[name] = p.skillDirs.some((dir) => p.exists(`${dir}/${name}`));
  });

  f.configText = p.exists('relevo.yml') ? p.read('relevo.yml') : null;
  const loaded = f.configText === null ? null : loadConfig(f.configText);
  f.config = loaded?.ok ? loaded.config : null;
  f.configErrors = loaded && !loaded.ok ? loaded.errors.map((e) => e.message) : [];
  f.rulesFileMissing = Boolean(f.config?.qa?.rules_from) && !p.exists(f.config.qa.rules_from);

  f.openspecRoot = p.exists('openspec/config.yaml') || p.exists('openspec/config.yml');
  f.openspecRootTracked = tryRun(() => String(p.tool('git', ['ls-files', 'openspec'])).trim().length > 0, false);
  f.evidenceIgnored = p.exists('.gitignore') && /^\/?evidence\/?\s*$/m.test(p.read('.gitignore'));

  f.workflows = {};
  WORKFLOW_FILES.forEach((file) => {
    f.workflows[file] = { present: p.exists(`.github/workflows/${file}`) };
  });
  const goText = f.workflows['relevo-go.yml'].present ? p.read('.github/workflows/relevo-go.yml') : '';
  const marketplace = (/^\s*plugin_marketplaces:\s*(.+?)\s*$/m.exec(goText) ?? [])[1] ?? null;
  // A URL that carries a credential (x-access-token:...@) can already be cloned by the runner.
  f.pluginMarketplaceHasToken = marketplace !== null && /^https:\/\/.*@github\.com\//.test(marketplace);
  f.pluginMarketplace = marketplace;
  // Workflows that check out the plugin repository for its scripts: do they pass a token that can read it?
  f.pluginCheckouts = [];
  WORKFLOW_FILES.filter((file) => f.workflows[file].present).forEach((file) => {
    const text = p.read(`.github/workflows/${file}`);
    const m = /repository:\s*([\w.-]+\/[\w.-]+)\s*\n([\s\S]*?)path:\s*\.relevo-plugin/.exec(text);
    if (m) f.pluginCheckouts.push({ file, repo: m[1], hasToken: /\n\s*token:/.test(`\n${m[2]}`) });
  });
  f.hasCi = tryRun(() => p.listDir('.github/workflows').some((n) => /\.ya?ml$/.test(n) && !n.startsWith('relevo-')), false);

  if (f.repo && f.ghAuth) {
    const api = (path, paginate = false) => JSON.parse(p.gh(paginate ? ['api', '--paginate', '--slurp', path] : ['api', path]));
    const flat = (data) => (Array.isArray(data) && Array.isArray(data[0]) ? data.flat() : data);
    const base = f.config?.branches?.base ?? 'dev';
    const release = f.config?.branches?.release ?? 'main';

    const repoInfo = tryRun(() => api(`repos/${f.repo}`), {});
    f.defaultBranch = repoInfo.default_branch ?? release;
    const sa = repoInfo.security_and_analysis;
    f.secretScanning = sa ? { scanning: sa.secret_scanning?.status === 'enabled', pushProtection: sa.secret_scanning_push_protection?.status === 'enabled' } : null;
    f.labels = tryRun(() => flat(api(`repos/${f.repo}/labels?per_page=100`, true)).map((l) => l.name));
    f.branches = {
      base: tryRun(() => { api(`repos/${f.repo}/branches/${encodeURIComponent(base)}`); return true; }, false),
      release: tryRun(() => { api(`repos/${f.repo}/branches/${encodeURIComponent(release)}`); return true; }, false),
    };

    let rulesets = [];
    f.protectionUnavailable = null;
    try {
      const list = flat(api(`repos/${f.repo}/rulesets`));
      rulesets = list.map((r) => api(`repos/${f.repo}/rulesets/${r.id}`));
    } catch (err) {
      const text = String(err.stderr ?? err.message ?? err);
      if (/Upgrade to GitHub|not available/i.test(text)) f.protectionUnavailable = text.trim().split('\n')[0];
      else f.protectionError = text.trim().split('\n')[0];
    }
    f.pushScope = rulesets.some((r) => r.name === 'relevo-push-scope' && r.enforcement === 'active');
    f.protection = {};
    [[base, 'base'], [release, 'release']].forEach(([branch, key]) => {
      const classic = f.branches[key] ? tryRun(() => api(`repos/${f.repo}/branches/${encodeURIComponent(branch)}/protection`)) : null;
      f.protection[key] = summarizeProtection({ rulesets, classic, branch, defaultBranch: f.defaultBranch });
    });

    f.canApprove = tryRun(() => api(`repos/${f.repo}/actions/permissions/workflow`).can_approve_pull_request_reviews, null);
    f.secrets = tryRun(() => api(`repos/${f.repo}/actions/secrets`).secrets.map((s) => s.name));
    const wf = tryRun(() => api(`repos/${f.repo}/actions/workflows`).workflows, []);
    WORKFLOW_FILES.forEach((file) => {
      const found = wf.find((w) => w.path === `.github/workflows/${file}`);
      f.workflows[file].enabled = found ? found.state === 'active' : null;
    });
    const plugin = f.pluginMarketplace && /^https:\/\/(?:.*@)?github\.com\/([^/@\s]+\/[^/@\s]+?)(?:\.git)?$/.exec(f.pluginMarketplace);
    const slug = plugin ? plugin[1] : f.pluginCheckouts[0]?.repo;
    f.pluginRepoPrivate = slug ? tryRun(() => api(`repos/${slug}`).private, null) : null;
  }
  return f;
}

// ---------- checks

/** Turn facts into results. Pure. */
export function runChecks(f) {
  const r = [];

  // tools
  r.push(versionAtLeast(f.node, '20.19') ? pass('tools.node', `Node.js ${f.node}`) : fail('tools.node', `Node.js ${f.node} is older than 20.19`, 'install Node.js 20.19 or newer'));
  r.push(f.openspec ? pass('tools.openspec', `OpenSpec ${f.openspec}`) : fail('tools.openspec', 'the OpenSpec command-line tool is not installed', `install it: ${OPENSPEC_INSTALL}`));
  r.push(f.git ? pass('tools.git', 'git is installed') : fail('tools.git', 'git is not installed', 'install git'));
  r.push(f.gh ? pass('tools.gh', 'the GitHub CLI is installed') : fail('tools.gh', 'the GitHub CLI (gh) is not installed', 'install it from https://cli.github.com'));
  if (f.gh) r.push(f.ghAuth ? pass('tools.gh-auth', 'signed in to GitHub') : fail('tools.gh-auth', 'the GitHub CLI is not signed in', 'run `gh auth login`'));
  if (f.toolchain !== null) {
    const tc = TOOLCHAIN[f.platform];
    r.push(f.toolchain ? pass('tools.toolchain', `${tc.command} is installed`) : fail('tools.toolchain', `${tc.command} is not installed (platform ${f.platform})`, tc.install));
  }
  r.push(f.adb ? pass('tools.device-bridge', 'adb is installed') : warn('tools.device-bridge', 'adb is not installed; `review` needs it', 'install the Android platform tools'));

  // skills that think invokes
  REQUIRED_SKILLS.forEach((name) => {
    r.push(f.skills[name] ? pass(`skills.${name}`, `skill ${name} is installed`) : fail(`skills.${name}`, `skill ${name} is not installed; \`think\` needs it`, SKILL_INSTALL[name]));
  });

  // configuration
  if (f.configText === null) r.push(fail('config.valid', 'relevo.yml not found', 'run /relevo:init'));
  else if (!f.config) r.push(fail('config.valid', `relevo.yml is invalid: ${f.configErrors.join('; ')}`, 'fix the settings named above and run `node scripts/validate-config.mjs`'));
  else {
    r.push(pass('config.valid', 'relevo.yml is valid'));
    if (f.rulesFileMissing) r.push(warn('config.rules-file', `qa.rules_from points to "${f.config.qa.rules_from}", which does not exist`, 'create that file or change qa.rules_from'));
  }

  // OpenSpec in the repository
  if (f.openspecRoot && f.openspecRootTracked) r.push(pass('openspec.root', 'the OpenSpec root is tracked by git'));
  else r.push(fail('openspec.root', 'the OpenSpec root is missing or not tracked by git, so a clean checkout (and the runner) has no `openspec/`', 'run /relevo:init, then commit openspec/config.yaml and the .gitkeep files'));
  r.push(f.evidenceIgnored ? pass('evidence.ignored', 'evidence/ is ignored by git') : fail('evidence.ignored', 'evidence/ is not in .gitignore; `review` would put screenshots in git', 'add the line `evidence/` to .gitignore (or run /relevo:init)'));

  // GitHub side
  if (!f.repo || !f.ghAuth) {
    r.push(warn('repo.checks', 'the repository checks were skipped: no repository or no GitHub sign-in', 'run inside a GitHub repository after `gh auth login`'));
    return r;
  }
  if (f.config) {
    const wanted = labelDefinitions(f.config.labels).map((l) => l.name);
    const missing = f.labels ? wanted.filter((n) => !f.labels.includes(n)) : null;
    if (missing === null) r.push(warn('repo.labels', 'could not read the labels', 'check your access to the repository'));
    else if (missing.length === 0) r.push(pass('repo.labels', 'all lifecycle labels exist'));
    else r.push(fail('repo.labels', `missing labels: ${missing.join(', ')}`, 'run /relevo:init to create them'));
    r.push(f.branches.base ? pass('repo.base-branch', `base branch ${f.config.branches.base} exists`) : fail('repo.base-branch', `base branch ${f.config.branches.base} does not exist`, `create it from ${f.config.branches.release}, or run /relevo:init`));
  }

  if (f.protectionError) {
    r.push(warn('repo.protection', `could not read the branch rules (${f.protectionError}), so they were not checked`, 'run doctor again; if it keeps failing, check your access to the repository'));
  } else if (f.protectionUnavailable) {
    r.push(warn('repo.protection', `branch protection is not available on this repository (${f.protectionUnavailable})`, 'make the repository public or upgrade the plan; until then approval and merge are only enforced by the written confirmation in `ship`'));
  } else {
    [['base', f.config?.branches?.base ?? 'base'], ['release', f.config?.branches?.release ?? 'release']].forEach(([key, name]) => {
      const p = f.protection?.[key];
      if (!p || !p.pullRequestRequired) r.push(fail(`repo.protection.${key}`, `${name} does not require a pull request`, `protect ${name}: require a pull request with at least one approval (/relevo:init sets this up)`));
      else if (f.config?.review?.mode !== 'none' && p.approvals < 1) r.push(fail(`repo.protection.${key}`, `${name} requires a pull request but no approval`, `require at least 1 approving review on ${name}`));
      else r.push(pass(`repo.protection.${key}`, `${name} requires a pull request${p.approvals ? ` with ${p.approvals} approval(s)` : ''}`));
      if (p?.dismissStale) r.push(fail(`repo.dismiss-stale.${key}`, `${name} dismisses approvals when new commits are pushed; the spec archive commit pushed by \`ship\` would dismiss the approval`, `turn off "dismiss stale pull request approvals when new commits are pushed" on ${name}`));
    });
  }
  if (!f.protectionUnavailable && !f.protectionError) {
    r.push(f.pushScope ? pass('repo.push-scope', 'the agent can only create feature/* branches') : warn('repo.push-scope', 'nothing stops the unattended agent from creating branches other than feature/*', 'run /relevo:init to add the relevo-push-scope ruleset'));
  }
  if (f.secretScanning) {
    const { scanning, pushProtection } = f.secretScanning;
    r.push(scanning && pushProtection ? pass('repo.secret-scanning', 'secret scanning and push protection are on')
      : warn('repo.secret-scanning', `secret scanning is ${scanning ? 'on' : 'off'} and push protection is ${pushProtection ? 'on' : 'off'}`, 'turn both on in Settings > Code security (init tries to; GitHub may need a public repository or a paid plan)'));
  }
  if (f.canApprove === true) r.push(fail('repo.automation-approve', 'workflows are allowed to approve pull requests', 'in Settings > Actions > General, turn off "Allow GitHub Actions to create and approve pull requests"'));
  else if (f.canApprove === false) r.push(pass('repo.automation-approve', 'workflows cannot approve pull requests'));
  else r.push(warn('repo.automation-approve', 'could not read whether workflows may approve pull requests', 'check Settings > Actions > General by hand'));

  // automation readiness
  if (f.secrets === null) r.push(warn('automation.secret', 'could not list the repository secrets', 'check that you may read them, or look in Settings > Secrets'));
  else if (f.secrets.some((n) => ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(n))) r.push(pass('automation.secret', 'a model credential secret exists'));
  else r.push(fail('automation.secret', 'no ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN secret', 'add one to the repository secrets (init never touches it); for a subscription token remove all whitespace before storing it'));

  Object.entries(f.workflows).forEach(([file, w]) => {
    const required = REQUIRED_WORKFLOWS.has(file);
    const bad = (m, fix) => r.push(required ? fail(`automation.workflow.${file}`, m, fix) : warn(`automation.workflow.${file}`, m, fix));
    if (!w.present) bad(`${file} is not installed`, 'run /relevo:init to copy it into .github/workflows/');
    else if (w.enabled === false) bad(`${file} is disabled`, 'enable it in the Actions tab');
    else if (w.enabled === null) r.push(warn(`automation.workflow.${file}`, `${file} is in the repository but not on GitHub yet`, 'commit and push it to the default branch'));
    else r.push(pass(`automation.workflow.${file}`, `${file} is installed and enabled`));
  });
  r.push(f.hasCi ? pass('automation.ci', 'an objective CI check exists') : fail('automation.ci', 'no CI workflow other than Relevo\'s was found; QA needs an objective check', 'add a workflow that runs the project\'s analysis and tests on pull requests'));

  const noToken = (f.pluginCheckouts ?? []).filter((c) => !c.hasToken).map((c) => c.file);
  if (f.pluginRepoPrivate === true && noToken.length > 0) {
    r.push(fail('automation.plugin-checkout', `${noToken.join(', ')} check out the private plugin repository with the default token, which cannot read it, so those runs fail`, 'copy the current templates (they pass `token: ${{ secrets.RELEVO_PLUGIN_TOKEN || github.token }}`) and store RELEVO_PLUGIN_TOKEN'));
  }
  if (f.pluginMarketplace && f.pluginRepoPrivate === true && !f.pluginMarketplaceHasToken) {
    r.push(fail('automation.plugin-clone', `the plugin repository (${f.pluginMarketplace}) is private, so the runner cannot clone it without a credential`, 'store a read-only token as RELEVO_PLUGIN_TOKEN and use the private-repository line in relevo-go.yml'));
  }
  return r;
}

/** Text report. */
export function renderReport(results) {
  const tag = { pass: 'pass', fail: 'FAIL', warn: 'warn' };
  const lines = results.flatMap((x) => [`[${tag[x.status]}] ${x.message}`, ...(x.fix && x.status !== 'pass' ? [`       fix: ${x.fix}`] : [])]);
  const failed = results.filter((x) => x.status === 'fail').length;
  const warned = results.filter((x) => x.status === 'warn').length;
  lines.push('', failed === 0 ? (warned === 0 ? 'All green.' : `No failures, ${warned} warning(s).`) : `${failed} check(s) failed${warned ? `, ${warned} warning(s)` : ''}.`);
  return lines.join('\n');
}

/** Wrap a `gh` client so that it can only read: `doctor` must never change anything. */
export function readOnlyGh(gh) {
  return (args) => {
    const isApi = args[0] === 'api';
    const writes = args.some((a, i) => /^(-X|--method)$/.test(a) && String(args[i + 1]).toUpperCase() !== 'GET')
      || args.some((a) => /^(-f|-F|--field|--raw-field|--input)$/.test(a));
    if (!isApi || writes) throw new Error(`doctor is read-only: refusing "gh ${args.join(' ')}"`);
    return gh(args);
  };
}
