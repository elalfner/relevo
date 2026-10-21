// `doctor`: reports every check as pass, fail or warn, with a fix next to each failure.
// Implements openspec/specs/init-doctor/spec.md.
//
// Two layers, both read-only:
//   gatherFacts(probes)  asks the machine and GitHub (through injected probes) and returns plain facts
//   runChecks(facts)     pure: turns the facts into a list of results
// The probes are injected so everything here is testable without a network.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { labelDefinitions } from './labels.mjs';
import { credentialMode, cloudBuilds, CLOUD_VARIABLE } from './execution-mode.mjs';
import { SKILL_DIRS, SIZE_BUDGET_BYTES, folderHash, lockDifferences, resolveRoleSkills, skillBudget } from './role-skills.mjs';
import { ROLES, profileLocations, profileLookups, resolveProfile } from './stack-profile.mjs';

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
// How to ask a tool that it is there (most answer --version), and how to install the ones Relevo knows.
const TOOL_PROBE = { adb: ['version'] };
const TOOL_INSTALL = {
  flutter: 'install Flutter: https://docs.flutter.dev/get-started/install',
  adb: 'install the Android platform tools',
  xcrun: 'install the Xcode command line tools (macOS only)',
  node: 'install Node.js 20.19 or newer',
  php: 'install PHP 8.2 or newer: https://www.php.net/downloads',
  composer: 'install Composer: https://getcomposer.org/download/',
  npm: 'install Node.js, which includes npm: https://nodejs.org/',
};
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
 *   repo
 *   git(args) -> stdout (optional)   readFolder(dir) -> [{ path, content }] (optional)   os, pluginRoot (optional)
 */
export function gatherFacts(p) {
  const f = { repo: p.repo ?? null };
  const tryRun = (fn, fallback = null) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  f.node = process.versions.node;
  f.packageVersion = tryRun(() => JSON.parse(readFileSync(resolve(PLUGIN_ROOT, 'package.json'), 'utf8')).version);
  f.adapters = p.adapters ? tryRun(() => p.adapters(), []) : [];
  f.openspec = tryRun(() => String(p.tool('openspec', ['--version'])).trim());
  f.git = tryRun(() => Boolean(p.tool('git', ['--version'])), false);
  f.gh = tryRun(() => Boolean(p.tool('gh', ['--version'])), false);
  f.ghAuth = f.gh ? tryRun(() => { p.tool('gh', ['auth', 'status']); return true; }, false) : false;
  f.skills = {};
  f.manualOnlySkills = [];
  REQUIRED_SKILLS.forEach((name) => {
    const dir = p.skillDirs.find((d) => p.exists(`${d}/${name}`));
    f.skills[name] = dir !== undefined;
    // A skill that sets `disable-model-invocation` can only be launched by the person; an unreadable file counts as invocable.
    const head = dir === undefined ? '' : tryRun(() => String(p.read(`${dir}/${name}/SKILL.md`)).split(/\n---\s*\n/)[0], '');
    if (/^disable-model-invocation:\s*true\s*$/m.test(head)) f.manualOnlySkills.push(name);
  });

  // What was installed with the plugin: the folders it runs from and its version. A package that lost one of them
  // cannot run its commands, and the version is what the workflows should pin.
  const installedRoot = p.pluginRoot ?? PLUGIN_ROOT;
  f.pluginFolders = ['scripts', 'skills', 'agents', 'stacks', 'templates'].filter((d) => tryRun(() => readdirSync(resolve(installedRoot, d)).length > 0, false) !== true);
  f.pluginVersion = tryRun(() => JSON.parse(readFileSync(resolve(installedRoot, '.claude-plugin', 'plugin.json'), 'utf8')).version ?? null, null);

  f.configText = p.exists('relevo.yml') ? p.read('relevo.yml') : null;
  const loaded = f.configText === null ? null : loadConfig(f.configText, profileLookups({ pluginRoot: p.pluginRoot ?? PLUGIN_ROOT, read: readerFor(p, tryRun) }));
  f.config = loaded?.ok ? loaded.config : null;
  f.configErrors = loaded && !loaded.ok ? loaded.errors.map((e) => e.message) : [];
  f.rulesFilesMissing = (f.config?.qa?.rules_from ?? []).filter((file) => !p.exists(file));
  f.rulesFileMissing = f.rulesFilesMissing.length > 0;

  gatherPlatforms(f, p, tryRun);

  f.openspecRoot = p.exists('openspec/config.yaml') || p.exists('openspec/config.yml');
  f.openspecRootTracked = tryRun(() => String(p.tool('git', ['ls-files', 'openspec'])).trim().length > 0, false);
  f.evidenceIgnored = p.exists('.gitignore') && /^\/?evidence\/?\s*$/m.test(p.read('.gitignore'));
  f.pluginDeclared = pluginDeclaration(p);

  // Workflows: what runs on GitHub is what is on the default branch, not what is in the working copy, so once the
  // repository is known they are read from there. `present` says whether the file is where it has to be; `local`
  // and `remote` say where it is.
  f.workflows = {};
  let texts = {};
  WORKFLOW_FILES.forEach((file) => {
    const local = p.exists(`.github/workflows/${file}`);
    f.workflows[file] = { present: local, local, remote: null };
    if (local) texts[file] = p.read(`.github/workflows/${file}`);
  });
  let names = tryRun(() => p.listDir('.github/workflows'), []);
  f.workflowSource = 'working copy';

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
    f.cloudVariable = tryRun(() => api(`repos/${f.repo}/actions/variables/${CLOUD_VARIABLE}`).value, null);
    // The repositories this one may depend on: can they be read, and are they private (then a token is needed)?
    f.links = (f.config?.links ?? []).map((link) => {
      const info = tryRun(() => api(`repos/${link}`), null);
      return { repo: link, reachable: info !== null, private: info ? info.private === true : null };
    });
    const wf = tryRun(() => api(`repos/${f.repo}/actions/workflows`).workflows, []);
    WORKFLOW_FILES.forEach((file) => {
      const found = wf.find((w) => w.path === `.github/workflows/${file}`);
      f.workflows[file].enabled = found ? found.state === 'active' : null;
    });
    const ref = encodeURIComponent(f.defaultBranch);
    let remoteNames = null;
    try {
      remoteNames = api(`repos/${f.repo}/contents/.github/workflows?ref=${ref}`).map((e) => e.name);
    } catch (err) {
      if (/404|Not Found/i.test(String(err.stderr ?? err.message ?? err))) remoteNames = [];
    }
    if (remoteNames !== null) {
      names = remoteNames;
      texts = {};
      WORKFLOW_FILES.forEach((file) => {
        const remote = remoteNames.includes(file);
        f.workflows[file].remote = remote;
        f.workflows[file].present = remote;
        if (remote) texts[file] = tryRun(() => Buffer.from(api(`repos/${f.repo}/contents/.github/workflows/${file}?ref=${ref}`).content, 'base64').toString('utf8'), '');
      });
      f.workflowSource = `default branch (${f.defaultBranch})`;
    }
    derivePluginFacts();
    const plugin = f.pluginMarketplace && /^https:\/\/(?:.*@)?github\.com\/([^/@\s]+\/[^/@\s]+?)(?:\.git)?$/.exec(f.pluginMarketplace);
    const slug = plugin ? plugin[1] : f.pluginCheckouts[0]?.repo;
    f.pluginRepoPrivate = slug ? tryRun(() => api(`repos/${slug}`).private, null) : null;
  } else {
    derivePluginFacts();
  }
  return f;

  // What the workflows say about the plugin repository, and whether a CI workflow exists (closes over texts, names).
  function derivePluginFacts() {
    const goText = texts['relevo-go.yml'] ?? '';
    const marketplace = (/^\s*plugin_marketplaces:\s*(.+?)\s*$/m.exec(goText) ?? [])[1] ?? null;
    // A URL that carries a credential (x-access-token:...@) can already be cloned by the runner.
    f.pluginMarketplaceHasToken = marketplace !== null && /^https:\/\/.*@github\.com\//.test(marketplace);
    f.pluginMarketplace = marketplace;
    // Workflows that check out the plugin repository for its scripts: do they pass a token that can read it?
    WORKFLOW_FILES.forEach((file) => { if (typeof texts[file] === 'string') f.workflows[file].text = texts[file]; });
    f.pluginCheckouts = [];
    Object.entries(texts).forEach(([file, text]) => {
      const m = /repository:\s*([\w.-]+\/[\w.-]+)\s*\n([\s\S]*?)path:\s*\.relevo-plugin/.exec(text);
      if (m) f.pluginCheckouts.push({ file, repo: m[1], hasToken: /\n\s*token:/.test(`\n${m[2]}`) });
    });
    // The version of the package each workflow runs its scripts from (null when it has no pin).
    f.pluginPins = {};
    WORKFLOW_FILES.forEach((file) => {
      if (typeof texts[file] === 'string') f.pluginPins[file] = (/^\s*RELEVO_VERSION:\s*['"]?([\w.+-]+)['"]?\s*$/m.exec(texts[file]) ?? [])[1] ?? null;
    });
    f.hasCi = names.some((n) => /\.ya?ml$/.test(n) && !n.startsWith('relevo-'));
  }
}

/**
 * Whether the repository declares the Relevo plugin in the settings file that is committed, so that a teammate who
 * clones it is offered the plugin: { declared } or, when the file is not valid JSON, { unreadable: true }. Only the
 * shared file counts; the user's and the local settings do not reach anyone else.
 */
export function pluginDeclaration(p) {
  const path = '.claude/settings.json';
  if (!p.exists(path)) return { declared: false };
  try {
    const settings = JSON.parse(p.read(path));
    return { declared: Boolean(settings?.extraKnownMarketplaces?.relevo) && settings?.enabledPlugins?.['relevo@relevo'] === true };
  } catch {
    return { unreadable: true };
  }
}

/** Reads a file: the plugin's own files from disk, the repository's through the probes. Null when absent. */
function readerFor(p, tryRun) {
  const pluginRoot = p.pluginRoot ?? PLUGIN_ROOT;
  return (path) => {
    if (path.startsWith(`${pluginRoot}/`)) return tryRun(() => readFileSync(path, 'utf8'), null);
    return p.exists(path) ? p.read(path) : null;
  };
}

/**
 * The platforms of relevo.yml: the profile each one resolves to, the tools and target tools it needs, the extra
 * skills of each role and the state of the skills lock. The plugin's own files are read from disk, the
 * repository's through the probes.
 */
function gatherPlatforms(f, p, tryRun) {
  f.platformFacts = [];
  f.macos = (p.os ?? process.platform) === 'darwin';
  f.autopilot = null;
  f.roleSkills = null;
  f.skillLockDifferences = [];
  if (!f.config) return;

  const pluginRoot = p.pluginRoot ?? PLUGIN_ROOT;
  const read = readerFor(p, tryRun);
  const probed = new Map();
  const available = (tool) => {
    if (!probed.has(tool)) probed.set(tool, tryRun(() => Boolean(p.tool(tool, TOOL_PROBE[tool] ?? ['--version'])), false));
    return probed.get(tool);
  };

  Object.entries(f.config.platforms).forEach(([name, platform]) => {
    const resolved = resolveProfile({ platform, pluginRoot, read });
    const entry = { name, stack: platform.stack, path: platform.path, targets: platform.targets, profile: resolved.ok ? resolved.profile : null, errors: resolved.ok ? [] : resolved.errors, tools: [], targetTools: [] };
    if (resolved.ok) {
      entry.tools = resolved.profile.tools.map((tool) => ({ tool, ok: available(tool) }));
      entry.targetTools = platform.targets.map((target) => {
        const tool = resolved.profile.targets[target] ?? '';
        return { target, tool, ok: tool === '' ? true : available(tool) };
      });
    }
    f.platformFacts.push(entry);
  });

  // What the Autopilot of `review` needs, only when the repository asks for it.
  const mode = f.config.review?.autopilot ?? 'off';
  if (mode !== 'off') {
    const join = (dir, file) => (dir === '.' || dir === '' ? file : `${dir}/${file}`);
    f.autopilot = {
      mode,
      platforms: Object.entries(f.config.platforms).map(([name, platform]) => {
        const entry = { name, stack: platform.stack, path: platform.path };
        if (platform.stack === 'flutter') {
          entry.driverEntry = p.exists(join(platform.path, 'lib/main_driver.dart'));
          const pubspec = p.exists(join(platform.path, 'pubspec.yaml')) ? tryRun(() => p.read(join(platform.path, 'pubspec.yaml')), '') : '';
          entry.driverDependency = /^\s*flutter_driver\s*:/m.test(pubspec ?? '');
        } else if (platform.stack === 'vue') {
          entry.playwright = tryRun(() => Boolean(p.tool('node', ['-e', "require.resolve('playwright')"])), false);
        }
        return entry;
      }),
    };
  }

  // Extra skills per role, read from the base branch the way `go` reads them.
  if (p.git) {
    const baseRef = `origin/${f.config.branches.base}`;
    if (tryRun(() => { p.git(['rev-parse', '--verify', '--quiet', baseRef]); return true; }, false)) {
      f.roleSkills = {};
      f.platformFacts.filter((e) => e.profile).forEach((e) => {
        f.roleSkills[e.name] = {};
        ROLES.forEach((role) => {
          const skills = resolveRoleSkills({ role, profile: e.profile, git: p.git, baseRef, allowScripts: f.config.skills.allow_scripts });
          skills.forEach((s) => { if (s.path) s.bytes = tryRun(() => Buffer.byteLength(String(read(s.path) ?? '')), 0); });
          f.roleSkills[e.name][role] = skills;
        });
      });
    }
  }

  // The skills lock: each skill folder must still have the hash it was installed with.
  if (p.exists('skills-lock.json') && p.readFolder) {
    const lock = tryRun(() => JSON.parse(p.read('skills-lock.json')), null);
    const hashes = {};
    Object.keys(lock?.skills ?? {}).forEach((name) => {
      const dir = SKILL_DIRS.find((d) => p.exists(`${d}/${name}`));
      hashes[name] = dir ? tryRun(() => folderHash(p.readFolder(`${dir}/${name}`)), null) : null;
    });
    f.skillLockDifferences = lockDifferences(lock, hashes);
  }
}

/**
 * Where `go` builds: the credential mode from the secret names, the repository variable that pauses the cloud, a
 * reminder about the policy for a subscription, and the quota warning for a subscription with many agents.
 */
function executionChecks(f) {
  if (!Array.isArray(f.secrets)) return [];
  const r = [];
  // Antigravity builds with a Gemini key and has no cost limit of its own: the checks of the Anthropic credential do not apply.
  if (f.config?.agent?.build === 'antigravity') return antigravityExecutionChecks(f);
  const { mode } = credentialMode(f.secrets);
  const goWorkflow = f.workflows?.['relevo-go.yml'];
  const installed = Boolean(goWorkflow?.present);
  // The credential line the workflow uses, when its text is known (the one that is not commented out).
  const text = goWorkflow?.text ?? '';
  const used = /^\s*claude_code_oauth_token:/m.test(text) ? 'subscription' : /^\s*anthropic_api_key:/m.test(text) ? 'api_key' : null;

  if (mode === 'both') r.push(warn('execution.credential', `both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN exist${used ? `; the workflow uses the ${used === 'api_key' ? 'API key' : 'subscription token'}` : ''}`, 'keep only the secret the workflow uses, so that it is clear which account pays'));
  else if (mode === 'api_key') r.push(pass('execution.credential', 'the cloud builds with an API key: run_max_cost is a real ceiling on spending'));
  else if (mode === 'subscription') r.push(pass('execution.credential', 'the cloud builds with a subscription token: run_max_cost is only a notional ceiling, and the quota is shared with the use of the account that owns the token'));
  else r.push(pass('execution.credential', installed ? 'no model credential: the cloud cannot build (see the warning about the secret)' : 'no model credential and no go workflow: go builds on machines only'));

  if (mode === 'subscription' || (mode === 'both' && used === 'subscription')) {
    r.push(pass('execution.policy', 'reminder: read the current Anthropic terms on automated use of a subscription token (and the README of claude-code-action) before relying on it for a team'));
    if ((f.config?.limits?.concurrent_agents ?? 1) > 1) {
      r.push(warn('execution.concurrency', `limits.concurrent_agents is ${f.config.limits.concurrent_agents} with a subscription, whose quota is shared by every run and by the interactive use of the account`, 'set limits.concurrent_agents to 1'));
    }
  }

  const variable = f.cloudVariable ?? null;
  if (String(variable ?? '').trim().toLowerCase() === 'off') r.push(pass('execution.cloud', `the cloud is paused (${CLOUD_VARIABLE} is off): ready issues are built on machines with /relevo:go`));
  else if (cloudBuilds({ workflowPresent: installed, variable })) r.push(pass('execution.cloud', `the cloud builds ready issues (set the repository variable ${CLOUD_VARIABLE} to off to pause it)`));
  else r.push(pass('execution.cloud', 'the go workflow is not installed: ready issues are built on machines with /relevo:go'));
  return r;
}

/** Where `go` builds when the agent is Antigravity: the key by name, and what stands in for the limits it lacks. */
function antigravityExecutionChecks(f) {
  const r = [];
  const installed = Boolean(f.workflows?.['relevo-go.yml']?.present);
  if (f.secrets.includes('GEMINI_API_KEY')) r.push(pass('execution.credential', 'the cloud builds with a Gemini key: Antigravity has no cost limit, so limits.run_max_tokens (enforced by the run guard) and the quota of the Google Cloud project that owns the key are the ceiling; use a key made only for Relevo'));
  else r.push(pass('execution.credential', installed ? 'no GEMINI_API_KEY secret: the cloud cannot build (see the warning about the secret)' : 'no GEMINI_API_KEY and no go workflow: go builds on machines only'));
  const variable = f.cloudVariable ?? null;
  if (String(variable ?? '').trim().toLowerCase() === 'off') r.push(pass('execution.cloud', `the cloud is paused (${CLOUD_VARIABLE} is off): ready issues are built on machines with /relevo:go`));
  else if (cloudBuilds({ workflowPresent: installed, variable })) r.push(pass('execution.cloud', `the cloud builds ready issues (set the repository variable ${CLOUD_VARIABLE} to off to pause it)`));
  else r.push(pass('execution.cloud', 'the go workflow is not installed: ready issues are built on machines with /relevo:go'));
  return r;
}

/**
 * The linked repositories (`links`): each one readable, and the read-only secret for private ones. Nothing is said
 * when `links` is empty. The secret is checked by name only; doctor never reads its value.
 */
function linkChecks(f) {
  const links = f.links ?? [];
  if (links.length === 0) return [];
  const r = [];
  links.forEach((l) => {
    if (l.reachable) r.push(pass(`links.${l.repo}`, `${l.repo} can be read (${l.private ? 'private' : 'public'})`));
    else r.push(fail(`links.${l.repo}`, `${l.repo} in links cannot be read with your sign-in`, 'check the name in links, and that you have access to the repository'));
  });
  const anyPrivate = links.some((l) => l.private === true);
  if (!Array.isArray(f.secrets)) {
    r.push(warn('links.secret', 'could not list the repository secrets, so RELEVO_LINKS_TOKEN was not checked', 'check that you may read them, or look in Settings > Secrets'));
  } else if (f.secrets.includes('RELEVO_LINKS_TOKEN')) {
    r.push(pass('links.secret', 'the RELEVO_LINKS_TOKEN secret exists for reading linked repositories'));
  } else if (anyPrivate) {
    r.push(fail('links.secret', `${links.filter((l) => l.private).map((l) => l.repo).join(', ')} is private and there is no RELEVO_LINKS_TOKEN secret, so a dependency on it can never be read`, 'create a fine-grained token with read access to issues and pull requests of that repository and store it as the secret RELEVO_LINKS_TOKEN (Relevo only reads with it)'));
  } else {
    r.push(warn('links.secret', 'every linked repository is public, so no RELEVO_LINKS_TOKEN is needed now, but a private one added later would not be readable', 'create the secret RELEVO_LINKS_TOKEN (read-only) before linking a private repository'));
  }
  return r;
}

/** What the profile of each platform asks for: tools, targets, layers, skills. */
function platformChecks(f) {
  const r = [];
  const seen = new Set();
  (f.platformFacts ?? []).forEach((e) => {
    if (!e.profile) {
      r.push(fail(`platform.${e.name}.profile`, `platform ${e.name}: ${e.errors.join('; ')}`, `define the profile of "${e.stack}": ${profileLocations(e.stack)}`));
      return;
    }
    const layers = e.profile.layers.map((l) => (l === 'plugin' ? 'default of the plugin' : `.relevo/stacks/${e.stack}.md`)).join(' + ');
    r.push(pass(`platform.${e.name}.profile`, `platform ${e.name} (${e.stack}, ${e.path}): profile = ${layers}`));
    (e.profile.ignored ?? []).forEach((x) => {
      r.push(warn(`platform.${e.name}.ignored.${x.key}`, `platform ${e.name}: the repository profile sets ${x.key} = "${x.value}", which is ignored (the plugin keeps "${x.kept}")`, `a command is replaced with platforms.${e.name}.checks in relevo.yml, not in the profile`));
    });
    e.tools.forEach(({ tool, ok }) => {
      if (seen.has(`tool:${tool}`)) return;
      seen.add(`tool:${tool}`);
      r.push(ok ? pass(`tools.${tool}`, `${tool} is installed`) : fail(`tools.${tool}`, `${tool} is not installed (platform ${e.name}, stack ${e.stack})`, TOOL_INSTALL[tool] ?? `install ${tool}`));
    });
    e.targetTools.forEach(({ target, tool, ok }) => {
      const id = `tools.target.${e.name}.${target}`;
      if (tool === '') r.push(pass(id, `target ${target} of ${e.name} needs no extra tool`));
      else if (tool === 'xcrun' && !f.macos) r.push(pass(id, `target ${target} of ${e.name}: iOS can only be built and reviewed on macOS (a notice, not a problem)`));
      else if (ok) r.push(pass(id, `target ${target} of ${e.name}: ${tool} is installed`));
      else r.push(warn(id, `target ${target} of ${e.name}: ${tool} is not installed; \`review\` needs it for this target`, TOOL_INSTALL[tool] ?? `install ${tool}`));
    });
    e.profile.requires_skills.forEach((name) => {
      if (f.skills[name] === undefined) r.push(warn(`skills.${name}`, `platform ${e.name} requires the skill ${name}; it was not checked`, SKILL_INSTALL[name] ?? `install the skill ${name}`));
    });
  });

  Object.entries(f.roleSkills ?? {}).forEach(([platform, roles]) => {
    Object.entries(roles).forEach(([role, skills]) => {
      skills.filter((s) => s.left_out).forEach((s) => {
        r.push(warn(`skills.role.${platform}.${role}.${s.name}`, `skill ${s.name} (${role}, ${platform}) is left out: ${s.reason}`, 'fix the reason, or remove the skill from the profile'));
      });
      skills.filter((s) => s.path && s.scripts).forEach((s) => {
        r.push(pass(`skills.scripts.${platform}.${role}.${s.name}`, `skill ${s.name} has scripts and is allowed by skills.allow_scripts (a notice)`));
      });
      const budget = skillBudget(skills.filter((s) => s.path).map((s) => s.bytes ?? 0));
      if (budget.over) r.push(warn(`skills.size.${platform}.${role}`, `the skills of ${role} (${platform}) add up to ${Math.round(budget.bytes / 1024)} KB, over the ${SIZE_BUDGET_BYTES / 1024} KB budget; the agent reads them at every run`, 'keep the skills of a role small, or list fewer'));
    });
  });
  (f.autopilot?.platforms ?? []).forEach((e) => {
    if (e.stack === 'flutter') {
      if (!e.driverEntry) r.push(warn(`autopilot.${e.name}.entrypoint`, `review.autopilot is ${f.autopilot.mode} but platform ${e.name} has no lib/main_driver.dart, so the agent cannot drive the app`, 'add lib/main_driver.dart that calls enableFlutterDriverExtension() and then runs the app'));
      else r.push(pass(`autopilot.${e.name}.entrypoint`, `platform ${e.name}: lib/main_driver.dart exists`));
      if (!e.driverDependency) r.push(warn(`autopilot.${e.name}.dependency`, `platform ${e.name} does not depend on flutter_driver (dev_dependencies), which the driven review needs`, 'add flutter_driver: { sdk: flutter } under dev_dependencies in pubspec.yaml'));
      else r.push(pass(`autopilot.${e.name}.dependency`, `platform ${e.name} depends on flutter_driver`));
    } else if (e.stack === 'vue') {
      if (!e.playwright) r.push(warn(`autopilot.${e.name}.playwright`, `review.autopilot is ${f.autopilot.mode} but Playwright cannot be resolved from this project (platform ${e.name})`, 'npm install -D playwright && npx playwright install chromium'));
      else r.push(pass(`autopilot.${e.name}.playwright`, `Playwright is available for platform ${e.name}`));
    } else {
      r.push(warn(`autopilot.${e.name}.adapter`, `review.autopilot is ${f.autopilot.mode}, but a driven review of the stack ${e.stack} (platform ${e.name}) is not available`, 'set review.autopilot to off, or review that platform by hand'));
    }
  });
  (f.skillLockDifferences ?? []).forEach((name) => {
    r.push(warn(`skills.lock.${name}`, `the skill ${name} differs from the hash in skills-lock.json`, 'review the change to the skill, then run `npx skills` to refresh the lock, or restore the skill'));
  });
  return r;
}

/** Turn facts into results. Pure. */
export function runChecks(f) {
  const r = [];

  // tools
  r.push(versionAtLeast(f.node, '20.19') ? pass('tools.node', `Node.js ${f.node}`) : fail('tools.node', `Node.js ${f.node} is older than 20.19`, 'install Node.js 20.19 or newer'));
  r.push(f.openspec ? pass('tools.openspec', `OpenSpec ${f.openspec}`) : fail('tools.openspec', 'the OpenSpec command-line tool is not installed', `install it: ${OPENSPEC_INSTALL}`));
  r.push(f.git ? pass('tools.git', 'git is installed') : fail('tools.git', 'git is not installed', 'install git'));
  r.push(f.gh ? pass('tools.gh', 'the GitHub CLI is installed') : fail('tools.gh', 'the GitHub CLI (gh) is not installed', 'install it from https://cli.github.com'));
  if (f.gh) r.push(f.ghAuth ? pass('tools.gh-auth', 'signed in to GitHub') : fail('tools.gh-auth', 'the GitHub CLI is not signed in', 'run `gh auth login`'));
  r.push(...platformChecks(f));
  r.push(...adapterChecks(f));

  // skills that think invokes
  REQUIRED_SKILLS.forEach((name) => {
    const manual = (f.manualOnlySkills ?? []).includes(name);
    r.push(f.skills[name] ? pass(`skills.${name}`, manual ? `skill ${name} is installed; it is reserved for you, so run /${name} by hand when \`think\` asks (a notice, not a problem)` : `skill ${name} is installed`) : fail(`skills.${name}`, `skill ${name} is not installed; \`think\` needs it`, SKILL_INSTALL[name]));
  });

  // configuration
  if (f.configText === null) r.push(fail('config.valid', 'relevo.yml not found', 'run /relevo:init'));
  else if (!f.config) r.push(fail('config.valid', `relevo.yml is invalid: ${f.configErrors.join('; ')}`, 'fix the settings named above and run `node scripts/validate-config.mjs`'));
  else {
    r.push(pass('config.valid', 'relevo.yml is valid'));
    if (f.rulesFileMissing) r.push(warn('config.rules-file', `qa.rules_from points to ${f.rulesFilesMissing.map((x) => `"${x}"`).join(', ')}, which does not exist`, 'create that file or change qa.rules_from'));
  }

  // OpenSpec in the repository
  if (f.openspecRoot && f.openspecRootTracked) r.push(pass('openspec.root', 'the OpenSpec root is tracked by git'));
  else r.push(fail('openspec.root', 'the OpenSpec root is missing or not tracked by git, so a clean checkout (and the runner) has no `openspec/`', 'run /relevo:init, then commit openspec/config.yaml and the .gitkeep files'));
  r.push(f.evidenceIgnored ? pass('evidence.ignored', 'evidence/ is ignored by git') : fail('evidence.ignored', 'evidence/ is not in .gitignore; `review` would put screenshots in git', 'add the line `evidence/` to .gitignore (or run /relevo:init)'));
  r.push(...pluginDeclaredChecks(f));

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
  else if (f.config?.agent?.build === 'antigravity') {
    if (f.secrets.includes('GEMINI_API_KEY')) r.push(pass('automation.secret', 'a model credential secret exists (GEMINI_API_KEY)'));
    else r.push(warn('automation.secret', 'no GEMINI_API_KEY secret, so the cloud cannot build: a ready label only leaves a comment that says to run /relevo:go on a machine', 'for the cloud, add a key made only for Relevo, in its own Google Cloud project with a quota, to the repository secrets (init never touches it); for local builds nothing is needed'));
  } else if (f.secrets.some((n) => ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'].includes(n))) r.push(pass('automation.secret', 'a model credential secret exists'));
  else r.push(warn('automation.secret', 'no ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN secret, so the cloud cannot build: a ready label only leaves a comment that says to run /relevo:go on a machine', 'for the cloud, add one to the repository secrets (init never touches it; for a subscription token remove all whitespace before storing it); for local builds nothing is needed'));

  Object.entries(f.workflows).forEach(([file, w]) => {
    const required = REQUIRED_WORKFLOWS.has(file);
    const bad = (m, fix) => r.push(required ? fail(`automation.workflow.${file}`, m, fix) : warn(`automation.workflow.${file}`, m, fix));
    if (!w.present && w.local && w.remote === false) bad(`${file} is only in your working copy, not on the default branch, and a workflow only runs from there`, 'commit it and push it to the default branch (through a pull request if the branch is protected)');
    else if (!w.present) bad(`${file} is not installed`, 'run /relevo:init to copy it into .github/workflows/');
    else if (w.enabled === false) bad(`${file} is disabled`, 'enable it in the Actions tab');
    else if (w.enabled === null) r.push(warn(`automation.workflow.${file}`, `${file} is on the default branch but GitHub does not list it yet`, 'check the Actions tab, or run doctor again in a minute'));
    else r.push(pass(`automation.workflow.${file}`, `${file} is installed and enabled`));
  });
  r.push(f.hasCi ? pass('automation.ci', 'an objective CI check exists') : fail('automation.ci', 'no CI workflow other than Relevo\'s was found; QA needs an objective check', 'add a workflow that runs the project\'s analysis and tests on pull requests'));

  r.push(...pluginInstallChecks(f));
  r.push(...toolchainChecks(f));
  if (f.pluginMarketplace && f.pluginRepoPrivate === true && !f.pluginMarketplaceHasToken) {
    r.push(fail('automation.plugin-clone', `the plugin repository (${f.pluginMarketplace}) is private, so the runner cannot clone it without a credential`, 'store a read-only token as RELEVO_PLUGIN_TOKEN and use the private-repository line in relevo-go.yml'));
  }
  r.push(...linkChecks(f));
  r.push(...executionChecks(f));
  if (f.pluginRepoPrivate === true && Array.isArray(f.secrets)) {
    if (f.secrets.includes('RELEVO_PLUGIN_TOKEN')) r.push(pass('automation.plugin-secret', 'the RELEVO_PLUGIN_TOKEN secret exists for the private plugin repository'));
    else r.push(fail('automation.plugin-secret', 'the plugin repository is private and the repository has no RELEVO_PLUGIN_TOKEN secret, so the workflows fall back to the default token and fail at checkout', 'store a read-only fine-grained token that can read the plugin repository as the repository secret RELEVO_PLUGIN_TOKEN; a secret defined at organization level is not visible to this check'));
  }
  return r;
}

// The action that sets up the toolchain of a stack in the build job of the go workflow. Vue needs only Node, which the
// job installs for Relevo itself, and a stack that is not listed here is not judged.
const TOOLCHAIN_ACTIONS = { flutter: { action: 'subosito/flutter-action', step: 'the Flutter step' }, laravel: { action: 'shivammathur/setup-php', step: 'the Laravel step' } };

/**
 * Does the go workflow install the toolchain of each configured platform? Without it every cloud build fails QA after
 * it spent the run. Only active lines count (a commented example installs nothing), and nothing is judged when the
 * go workflow is not installed, as when go builds on machines.
 */
function toolchainChecks(f) {
  const go = f.workflows?.['relevo-go.yml'];
  if (!go?.present || typeof go.text !== 'string') return [];
  const active = go.text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  return (f.platformFacts ?? []).filter((e) => TOOLCHAIN_ACTIONS[e.stack]).map((e) => {
    const { action, step } = TOOLCHAIN_ACTIONS[e.stack];
    return active.includes(action)
      ? pass(`automation.toolchain.${e.name}`, `the go workflow installs the toolchain of platform ${e.name} (${e.stack})`)
      : fail(`automation.toolchain.${e.name}`, `the go workflow installs no toolchain for platform ${e.name} (${e.stack}), so every cloud build would fail QA after spending the run`, `enable ${step} of the build job in relevo-go.yml (the template has it active; compare with /relevo:init), or, if you install it another way, ignore this`);
  });
}

/** Does the committed settings file declare the plugin? It is a local fact, so it needs no GitHub sign-in. */
function pluginDeclaredChecks(f) {
  const r = [];
  if (f.pluginDeclared?.unreadable) r.push(warn('plugin.declared', '.claude/settings.json is not valid JSON, so it cannot be checked whether the repository declares the Relevo plugin', 'fix the file; /relevo:init then offers to declare the plugin'));
  else if (f.pluginDeclared?.declared) r.push(pass('plugin.declared', 'the repository declares the Relevo plugin in .claude/settings.json, so a teammate who opens it is offered it'));
  else if (f.pluginDeclared) r.push(warn('plugin.declared', 'the repository does not declare the Relevo plugin in .claude/settings.json: a teammate who clones it is not offered the plugin and finds no /relevo: commands', 'run /relevo:init, or claude plugin marketplace add elalfner/relevo --scope project --sparse .claude-plugin and claude plugin install relevo@relevo --scope project, and commit .claude/settings.json'));
  return r;
}

/**
 * The installed plugin and what the workflows pin. A package that lost a folder cannot run; a workflow that clones
 * the plugin repository for its scripts (the layout before the package) or has no pin is told to be replaced; a pin
 * that differs from the installed version is only a warning, because a project chooses when it moves.
 */
function pluginInstallChecks(f) {
  const r = [];
  if ((f.pluginFolders ?? []).length > 0) r.push(fail('plugin.install', `the installed plugin lacks ${f.pluginFolders.join(', ')}`, 'reinstall it: relevo install, or claude plugin install relevo@relevo'));
  else r.push(pass('plugin.install', `the plugin has the folders it runs from${f.pluginVersion ? ` (version ${f.pluginVersion})` : ''}`));
  const cloners = (f.pluginCheckouts ?? []).map((c) => c.file);
  if (cloners.length > 0) r.push(fail('automation.plugin-layout', `${cloners.join(', ')} clone the plugin repository for their scripts, which downloads the documentation and the tests too`, 'copy the current templates: they install the published package at a pinned version (/relevo:init lists the difference)'));
  const pins = f.pluginPins ?? {};
  const unpinned = Object.entries(pins).filter(([file, v]) => v === null && !cloners.includes(file)).map(([file]) => file);
  if (unpinned.length > 0) r.push(fail('automation.plugin-pin', `${unpinned.join(', ')} do not pin the version of the Relevo package`, 'copy the current templates, which set RELEVO_VERSION'));
  const old = f.pluginVersion ? Object.entries(pins).filter(([, v]) => v !== null && v !== f.pluginVersion).map(([file, v]) => `${file} (${v})`) : [];
  if (old.length > 0) r.push(warn('automation.plugin-version', `${old.join(', ')} pin a different version than the installed plugin (${f.pluginVersion})`, 'to move them, change RELEVO_VERSION to the installed version after reading the changelog'));
  return r;
}

/**
 * The plugins that `relevo init` rendered for a tool other than Claude Code: a file that is gone is a failure (the
 * plugin cannot run), a file of another package version or edited by hand is a warning, because a team chooses when it
 * moves and may keep an edit on purpose.
 */
function adapterChecks(f) {
  return (f.adapters ?? []).flatMap((a) => {
    const id = `adapters.antigravity.${a.scope}`;
    const name = `the Antigravity plugin of the ${a.scope} (${a.dir})`;
    const r = [];
    if (a.missing.length > 0) r.push(fail(id, `${name} lacks ${a.missing.slice(0, 5).join(', ')}${a.missing.length > 5 ? ` and ${a.missing.length - 5} more` : ''}`, 'run `relevo update`'));
    if (f.packageVersion && a.package !== f.packageVersion) r.push(warn(`${id}.version`, `${name} was rendered by Relevo ${a.package}, and this one is ${f.packageVersion}`, 'run `relevo update`'));
    if (a.edited.length > 0) r.push(warn(`${id}.edited`, `${name} has files edited by hand: ${a.edited.slice(0, 5).join(', ')}`, 'keep them, or run `relevo update --force` to overwrite them'));
    return r.length > 0 ? r : [pass(id, `${name} is complete and up to date`)];
  });
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
