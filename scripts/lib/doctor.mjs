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
import { isDeepStrictEqual } from 'node:util';
import { loadConfig } from './config.mjs';
import { parse as parseYaml } from './yaml-lite.mjs';
import { labelDefinitions } from './labels.mjs';
import { credentialMode, cloudBuilds, CLOUD_VARIABLE } from './execution-mode.mjs';
import { platformFolders } from './protected-paths.mjs';
import { SKILL_DIRS, SIZE_BUDGET_BYTES, folderHash, lockDifferences, resolveRoleSkills, skillBudget, skillDirsFor } from './role-skills.mjs';
import { adapterFor, targetOf } from './review-adapters.mjs';
import { testDatabase } from './api-preflight.mjs';
import { ROLES, profileLocations, profileLookups, repositoryProfilePath, resolveProfile } from './stack-profile.mjs';

export const REQUIRED_SKILLS = ['openspec-explore', 'grill-with-docs', 'grilling', 'domain-modeling'];
export const SKILL_INSTALL = {
  'openspec-explore': 'run `openspec init` (or `openspec update`) in the project',
  'grill-with-docs': 'run `npx skills add mattpocock/skills` and choose it',
  grilling: 'run `npx skills add mattpocock/skills` and choose it',
  'domain-modeling': 'run `npx skills add mattpocock/skills` and choose it',
  supabase: 'run `npx skills add supabase/agent-skills --skill supabase`',
  'supabase-postgres-best-practices': 'run `npx skills add supabase/agent-skills --skill supabase-postgres-best-practices`',
};
// Skills that make a stack work better, offered and never required. Commands as the Flutter docs give them, checked
// against flutter/agent-plugins on 2026-10-28 (the Antigravity command installs the Dart skills too).
export const RECOMMENDED = {
  flutter: {
    source: 'flutter/agent-plugins',
    prefix: 'flutter-',
    claude: { plugin: 'dart-flutter@dart-flutter', commands: ['claude plugin marketplace add flutter/agent-plugins', 'claude plugin install dart-flutter@dart-flutter'] },
    antigravity: { commands: ["npx skills add flutter/agent-plugins --skill '*' --agent universal --yes"] },
  },
};
/**
 * The command that installs skills of a stack into the project, as real files: `agent` is `claude-code` (writes
 * `.claude/skills/`) or `universal` (writes `.agents/skills/`). The installer writes in the folder it runs from, so a
 * platform below the root runs it from its folder.
 */
export function recommendedInstallCommand({ stack, skills, agent = 'claude-code', path = '.' }) {
  const flags = skills.map((s) => `--skill ${s}`).join(' ');
  const command = `npx skills add ${RECOMMENDED[stack].source} ${flags} --agent ${agent} --copy --yes`;
  const folder = String(path ?? '').replace(/^\.\//, '').replace(/\/+$/, '');
  return folder === '' || folder === '.' ? command : `cd ${folder} && ${command}`;
}
const ANTIGRAVITY_IDE = 'in the Antigravity IDE, install "Dart and Flutter" from Settings > Customizations > Build with Google Plugins (doctor cannot check this)';
export const OPENSPEC_INSTALL ='npm install --global @fission-ai/openspec (needs Node.js 20.19 or newer)';
export const WORKFLOW_FILES = ['relevo-go.yml', 'relevo-queue.yml', 'relevo-review.yml', 'relevo-sla.yml', 'relevo-digest.yml', 'relevo-ship.yml'];
// The repository variable that pauses the ship workflow, and the secrets of the GitHub App it pushes with.
export const SHIP_VARIABLE = 'RELEVO_CLOUD_SHIP';
export const SHIP_APP_SECRETS = ['RELEVO_SHIP_APP_ID', 'RELEVO_SHIP_APP_KEY'];
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
  supabase: 'install the Supabase CLI: brew install supabase/tap/supabase or see https://supabase.com/docs/guides/cli',
  docker: 'install Docker: https://docs.docker.com/get-docker/ (macOS: brew install --cask docker or brew install orbstack)',
};
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const pass = (id, message) => ({ id, status: 'pass', message });
const fail = (id, message, fix) => ({ id, status: 'fail', message, fix });
const warn = (id, message, fix) => ({ id, status: 'warn', message, fix });
// Information that asks for nothing: neither a failure nor a warning, and it never changes the exit status.
const note = (id, message) => ({ id, status: 'note', message });

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
 * Returns { protected, pullRequestRequired, approvals, dismissStale, lastPushApproval, requiredChecks, blocksDeletion, blocksForcePush }.
 */
export function summarizeProtection({ rulesets = [], classic = null, branch, defaultBranch }) {
  const out = { protected: false, pullRequestRequired: false, approvals: 0, dismissStale: false, lastPushApproval: false, requiredChecks: false, blocksDeletion: false, blocksForcePush: false };
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
        if (rule.parameters?.require_last_push_approval) out.lastPushApproval = true;
      }
      if (rule.type === 'required_status_checks') out.requiredChecks = true;
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
      if (pr.require_last_push_approval) out.lastPushApproval = true;
    }
    if (classic.required_status_checks) out.requiredChecks = true;
    if (classic.allow_deletions?.enabled === false) out.blocksDeletion = true;
    if (classic.allow_force_pushes?.enabled === false) out.blocksForcePush = true;
  }
  return out;
}

// ---------- Playwright of a platform

/** Is the platform a Vue platform reviewed in a browser? `web` is the only target of Vue, and its default. */
export const isVueWeb = (platform) => platform?.stack === 'vue' && (!platform.targets?.length || platform.targets.includes('web'));

/**
 * Does Playwright resolve from the folder of a platform, and is its Chromium installed? Resolving from the folder, not
 * from where the command runs, finds the node_modules of a platform in a subfolder. `tool(name, args)` throws when the
 * command fails; `exists(path)`.
 */
export function playwrightFacts(dir, { tool, exists }) {
  const where = "require.resolve('playwright', { paths: [require('node:path').resolve(process.argv[1])] })";
  try {
    tool('node', ['-e', where, dir || '.']);
  } catch {
    return { playwright: false, chromium: false };
  }
  try {
    const path = String(tool('node', ['-e', `process.stdout.write(require(${where}).chromium.executablePath())`, dir || '.'])).trim();
    return { playwright: true, chromium: path !== '' && Boolean(exists(path)) };
  } catch {
    return { playwright: true, chromium: false };
  }
}

/** playwrightFacts of each Vue platform with a web target, by platform name. */
export function vueWebFacts(platforms, deps) {
  return Object.fromEntries(Object.entries(platforms ?? {}).filter(([, p]) => isVueWeb(p)).map(([name, p]) => [name, playwrightFacts(p.path, deps)]));
}

/**
 * Is the default set of a stack's skills committed to the repository, for each coding agent it uses? A skill counts
 * only as a folder in the repository (`.claude/skills` for Claude Code, `.agents/skills` for Antigravity), in the
 * folder of the platform or at the root: a plugin installed on a machine and the home folder do not reach the cloud
 * runner. Returns { stack, claude, plugin, claudeMissing, antigravity, antigravityMissing } (`claude` and `antigravity`
 * are 'present' or 'missing', `antigravity` is null when the agent is not used, `plugin` says whether the plugin is
 * installed on this machine, or null when `claude` cannot list), or null when no platform has a default set.
 * `platforms` is [{ path, skills }]. Deps: `exists`, `tool`, `repoTop`, `adapters`, `agentBuild`.
 */
export function recommendedSkillFacts({ stack, platforms, exists, tool, repoTop = null, adapters = [], agentBuild = 'claude' }) {
  const rec = RECOMMENDED[stack];
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  const targets = (platforms ?? []).filter((e) => e.skills.length > 0).map((e) => ({ path: String(e.path ?? '.').replace(/^\.\//, '').replace(/\/+$/, '') || '.', skills: e.skills }));
  if (targets.length === 0) return null;
  const missingIn = (agentDir) => targets
    .map(({ path, skills }) => {
      const dirs = path === '.' ? [agentDir] : [`${path}/${agentDir}`, agentDir];
      return { path, skills: skills.filter((name) => !dirs.some((d) => safe(() => exists(`${d}/${name}`), false))) };
    })
    .filter((m) => m.skills.length > 0);
  const claudeMissing = missingIn('.claude/skills');
  const plugins = safe(() => JSON.parse(String(tool('claude', ['plugin', 'list', '--json']))), null);
  const plugin = Array.isArray(plugins) ? plugins.some((e) => e.id === rec.claude.plugin && (e.scope === 'user' || e.projectPath === repoTop)) : null;
  const usesAntigravity = adapters.length > 0 || agentBuild === 'antigravity';
  const antigravityMissing = usesAntigravity ? missingIn('.agents/skills') : [];
  return {
    stack,
    claude: claudeMissing.length === 0 ? 'present' : 'missing',
    plugin,
    claudeMissing,
    antigravity: !usesAntigravity ? null : antigravityMissing.length === 0 ? 'present' : 'missing',
    antigravityMissing,
  };
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
  // The installations Claude Code knows of: the user scope, and the project or local scope of this repository. null when
  // `claude` cannot list them. Only the command is read, never Claude Code's own files.
  const repoTop = tryRun(() => String(p.tool('git', ['rev-parse', '--show-toplevel'])).trim() || null, null);
  f.installedPlugins = tryRun(() => JSON.parse(String(p.tool('claude', ['plugin', 'list', '--json'])))
    .filter((e) => String(e.id).startsWith('relevo@') && (e.scope === 'user' || e.projectPath === repoTop))
    .map((e) => ({ scope: e.scope, version: e.version ?? null })), null);

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
  f.webHook = webHookDeclaration(p);
  f.remoteSession = process.env.CLAUDE_CODE_REMOTE === 'true';

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
    f.configOnBranches = configOnBranches((branch) => Buffer.from(api(`repos/${f.repo}/contents/relevo.yml?ref=${encodeURIComponent(branch)}`).content, 'base64').toString('utf8'), f.defaultBranch, base);

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
    f.shipVariable = tryRun(() => api(`repos/${f.repo}/actions/variables/${SHIP_VARIABLE}`).value, null);
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
    // The version of the text each workflow was copied from (null when it has no stamp).
    f.pluginStamps = {};
    WORKFLOW_FILES.forEach((file) => {
      if (typeof texts[file] === 'string') f.pluginStamps[file] = (/^# relevo-template: (\d+\.\d+\.\d+)\s*$/m.exec(texts[file]) ?? [])[1] ?? null;
    });
    f.hasCi = names.some((n) => /\.ya?ml$/.test(n) && !n.startsWith('relevo-'));
  }
}

/**
 * Whether the repository declares the Relevo plugin in the settings file that is committed, so that a teammate who
 * clones it is offered the plugin: { declared } or, when the file is not valid JSON, { unreadable: true }. Only the
 * shared file counts; the user's and the local settings do not reach anyone else.
 */
/**
 * A label event reads relevo.yml from the default branch, while every build starts from the base branch: do the two
 * copies on GitHub give the same settings? Comments and layout do not count. null when there is nothing to compare:
 * the default branch is the base, the base has no relevo.yml, or a read failed for another reason than a missing file.
 */
export function configOnBranches(readAt, defaultBranch, base) {
  if (!defaultBranch || defaultBranch === base) return null;
  const notFound = (err) => /404|Not Found/i.test(String(err?.stderr ?? err?.message ?? err));
  let baseText;
  try {
    baseText = readAt(base);
  } catch {
    return null;
  }
  let defaultText;
  try {
    defaultText = readAt(defaultBranch);
  } catch (err) {
    return notFound(err) ? { defaultBranch, base, same: false, missingOnDefault: true } : null;
  }
  let same;
  try {
    same = isDeepStrictEqual(parseYaml(defaultText), parseYaml(baseText));
  } catch {
    same = defaultText === baseText;
  }
  return { defaultBranch, base, same, missingOnDefault: false };
}

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

// The one-line `SessionStart` hook that installs OpenSpec in a session of Claude Code on the web. It does nothing
// outside a remote session, and nothing when `openspec` already runs; `|| true` keeps a failed install from failing the hook.
export const WEB_HOOK_COMMAND = '[ "$CLAUDE_CODE_REMOTE" = "true" ] && ! command -v openspec >/dev/null 2>&1 && OPENSPEC_TELEMETRY=0 npm install --global @fission-ai/openspec || true';

/** Does a `SessionStart` entry install OpenSpec? The package name is what is matched, so a hook written by hand counts. */
const installsOpenspec = (entry) => (entry?.hooks ?? []).some((h) => typeof h?.command === 'string' && h.command.includes('@fission-ai/openspec'));

/**
 * Whether the committed settings file has a `SessionStart` hook that installs OpenSpec: { declared } or, when the file
 * is not valid JSON, { unreadable: true }. A missing file is { declared: false }.
 */
export function webHookDeclaration(p) {
  const path = '.claude/settings.json';
  if (!p.exists(path)) return { declared: false };
  try {
    const settings = JSON.parse(p.read(path));
    return { declared: Array.isArray(settings?.hooks?.SessionStart) && settings.hooks.SessionStart.some(installsOpenspec) };
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
      (resolved.profile.requires_skills ?? []).forEach((name) => {
        if (f.skills[name] === undefined && p.skillDirs) {
          const dir = p.skillDirs.find((d) => p.exists(`${d}/${name}`));
          f.skills[name] = dir !== undefined;
        }
      });
      entry.tools = resolved.profile.tools.map((tool) => {
        if (tool === 'docker') {
          const cliOk = available('docker');
          const daemonOk = cliOk ? tryRun(() => Boolean(p.tool('docker', ['info'])), false) : false;
          return { tool, ok: daemonOk, cliOk };
        }
        return { tool, ok: available(tool) };
      });
      entry.targetTools = platform.targets.map((target) => {
        const tool = resolved.profile.targets[target] ?? '';
        return { target, tool, ok: tool === '' ? true : available(tool) };
      });
      // An api review (Laravel) runs the project's tests: whether its dependencies are installed and which database the tests use.
      const adapter = adapterFor({ stack: platform.stack, target: targetOf(platform) });
      if (adapter.supported && adapter.kind === 'api') {
        const at = (file) => (platform.path === '.' || platform.path === '' ? file : `${platform.path}/${file}`);
        const xml = ['phpunit.xml', 'phpunit.xml.dist'].find((n) => p.exists(at(n)));
        entry.api = { vendor: p.exists(at('vendor/autoload.php')), database: testDatabase(xml ? tryRun(() => p.read(at(xml)), null) : null) };
      }
      // The review block of the profile: where the log is, and whether the folder it names exists.
      const logPattern = resolved.profile.review?.log;
      if (logPattern) {
        const segments = logPattern.split('/').filter(Boolean);
        const literal = segments.findIndex((s) => /[*?]/.test(s));
        const dir = (literal === -1 ? segments.slice(0, -1) : segments.slice(0, literal)).join('/');
        entry.reviewLog = { pattern: logPattern, dir, dirExists: dir === '' ? true : p.exists(platform.path === '.' || platform.path === '' ? dir : `${platform.path}/${dir}`) };
      }
      // The cloud and a fresh clone read the repository's layer from git, not from this working copy. `null` means
      // git could not say (no git, or not a repository).
      if (resolved.profile.layers.includes('repository')) {
        const path = repositoryProfilePath(platform.stack);
        if (!f.git) entry.repositoryLayerTracked = null;
        else if (tryRun(() => { p.tool('git', ['ls-files', '--error-unmatch', path]); return true; }, false)) entry.repositoryLayerTracked = true;
        else entry.repositoryLayerTracked = tryRun(() => { p.tool('git', ['rev-parse', '--is-inside-work-tree']); return true; }, false) ? false : null;
      }
    }
    f.platformFacts.push(entry);
  });

  // The skills a stack works better with: only for a stack that has a recommendation, and only when a platform uses it.
  f.recommendedSkills = null;
  const recommendedStack = Object.keys(RECOMMENDED).find((stack) => f.platformFacts.some((e) => e.stack === stack));
  if (recommendedStack && p.exists) {
    const platforms = f.platformFacts.filter((e) => e.stack === recommendedStack && e.profile).map((e) => ({ path: e.path, skills: [...new Set([...(e.profile.pluginSkills?.dev ?? []), ...(e.profile.pluginSkills?.qa ?? [])])] }));
    f.recommendedSkills = recommendedSkillFacts({ stack: recommendedStack, platforms, exists: p.exists, tool: p.tool, repoTop: tryRun(() => String(p.tool('git', ['rev-parse', '--show-toplevel'])).trim() || null, null), adapters: f.adapters, agentBuild: f.config?.agent?.build });
  }

  // What the Autopilot of `review` needs, only when the repository asks for it.
  const mode = f.config.review?.autopilot ?? 'off';
  if (mode !== 'off') {
    const join = (dir, file) => (dir === '.' || dir === '' ? file : `${dir}/${file}`);
    f.autopilot = {
      mode,
      platforms: Object.entries(f.config.platforms).map(([name, platform]) => {
        const entry = { name, stack: platform.stack, path: platform.path, targets: platform.targets };
        if (platform.stack === 'flutter') {
          entry.driverEntry = p.exists(join(platform.path, 'lib/main_driver.dart'));
          const pubspec = p.exists(join(platform.path, 'pubspec.yaml')) ? tryRun(() => p.read(join(platform.path, 'pubspec.yaml')), '') : '';
          entry.driverDependency = /^\s*flutter_driver\s*:/m.test(pubspec ?? '');
        } else if (platform.stack === 'vue') {
          entry.playwright = playwrightFacts(platform.path, { tool: p.tool, exists: p.exists }).playwright;
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
          const skills = resolveRoleSkills({ role, profile: e.profile, git: p.git, baseRef, allowScripts: f.config.skills.allow_scripts, dirs: skillDirsFor(e.path) });
          skills.forEach((s) => { if (s.path) s.bytes = tryRun(() => Buffer.byteLength(String(read(s.path) ?? '')), 0); });
          f.roleSkills[e.name][role] = skills;
        });
      });
    }
  }

  // The skills lock: each skill folder must still have the hash it was installed with, in the lock file of the folder
  // that holds it (the root, or a platform: the installer writes the lock where it runs).
  if (p.readFolder) {
    const locks = [{ folder: '', lock: 'skills-lock.json', dirs: SKILL_DIRS }, ...platformFolders(f.config.platforms).map((folder) => ({ folder, lock: `${folder}/skills-lock.json`, dirs: SKILL_DIRS.map((d) => `${folder}/${d}`) }))];
    locks.filter((l) => p.exists(l.lock)).forEach((l) => {
      const lock = tryRun(() => JSON.parse(p.read(l.lock)), null);
      const hashes = {};
      Object.keys(lock?.skills ?? {}).forEach((name) => {
        const dir = l.dirs.find((d) => p.exists(`${d}/${name}`));
        hashes[name] = dir ? tryRun(() => folderHash(p.readFolder(`${dir}/${name}`)), null) : null;
      });
      lockDifferences(lock, hashes).forEach((name) => f.skillLockDifferences.push(l.folder === '' ? name : { name, folder: l.folder, lock: l.lock }));
    });
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
  else if (mode === 'subscription') r.push(note('execution.credential', 'the cloud builds with a subscription token: run_max_cost is only a notional ceiling, and the quota is shared with the use of the account that owns the token'));
  else r.push(pass('execution.credential', installed ? 'no model credential: the cloud cannot build (see the warning about the secret)' : 'no model credential and no go workflow: go builds on machines only'));

  if (mode === 'subscription' || (mode === 'both' && used === 'subscription')) {
    r.push(note('execution.policy', 'reminder: read the current Anthropic terms on automated use of a subscription token (and the README of claude-code-action) before relying on it for a team'));
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
    r.push(fail('links.secret', `${links.filter((l) => l.private).map((l) => l.repo).join(', ')} is private and there is no RELEVO_LINKS_TOKEN secret, so a dependency on it can never be read`, 'create a fine-grained token with read access to issues, pull requests and contents of that repository and store it as the secret RELEVO_LINKS_TOKEN (Relevo only reads with it)'));
  } else {
    r.push(warn('links.secret', 'every linked repository is public, so no RELEVO_LINKS_TOKEN is needed now, but a private one added later would not be readable', 'create the secret RELEVO_LINKS_TOKEN (read-only) before linking a private repository'));
  }
  return r;
}

/** Is the profile only the repository's (the plugin ships none for the stack)? */
const isOwnProfile = (e) => e.profile?.layers?.length === 1 && e.profile.layers[0] === 'repository';

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
    if (e.repositoryLayerTracked === false) {
      const path = `.relevo/stacks/${e.stack}.md`;
      const effect = e.profile.layers.includes('plugin') ? `use only the plugin's profile for ${e.stack}, without your rules` : `have no profile for ${e.stack}`;
      r.push(warn(`platform.${e.name}.profile.tracked`, `platform ${e.name}: ${path} is not tracked by git, so the cloud run and a fresh clone ${effect}`, `commit ${path} and push it with the rest of the repository's Relevo files`));
    }
    // A stack the plugin does not ship is whatever its file says: without analyze and test QA has nothing to run.
    if (isOwnProfile(e)) {
      const missing = ['analyze', 'test'].filter((c) => !e.profile.commands?.[c]);
      if (missing.length > 0) r.push(warn(`platform.${e.name}.commands`, `platform ${e.name}: the profile of ${e.stack} defines no ${missing.join(' and no ')}, so QA has no command to run for it`, `write ${missing.join(' and ')} in .relevo/stacks/${e.stack}.md, or set platforms.${e.name}.checks in relevo.yml`));
    }
    (e.profile.ignored ?? []).forEach((x) => {
      r.push(warn(`platform.${e.name}.ignored.${x.key}`, `platform ${e.name}: the repository profile sets ${x.key} = "${x.value}", which is ignored (the plugin keeps "${x.kept}")`, `a command is replaced with platforms.${e.name}.checks in relevo.yml, not in the profile`));
    });
    // What an api review needs, and what the review block of the profile says.
    if (e.api) {
      const inDir = e.path && e.path !== '.' ? `cd ${e.path} && ` : '';
      if (!e.api.vendor) r.push(warn(`review.api.${e.name}.vendor`, `platform ${e.name} has no vendor/ folder, so the review cannot run its tests`, `run \`${inDir}composer install\``));
      else r.push(pass(`review.api.${e.name}.vendor`, `platform ${e.name}: the dependencies are installed`));
      const db = e.api.database;
      if (db.safe) r.push(pass(`review.api.${e.name}.database`, `platform ${e.name}: the tests use in-memory SQLite`));
      else r.push(note(`review.api.${e.name}.database`, `platform ${e.name}: ${db.reason}; the review asks for your written confirmation that it is not production before it runs a test`));
    }
    (e.profile.reviewReplaced ?? []).forEach((key) => {
      r.push(note(`review.block.${e.name}.${key}`, `platform ${e.name}: the repository replaced ${key} of the plugin's profile`));
    });
    (e.profile.reviewWarnings ?? []).forEach((w, i) => {
      r.push(warn(`review.text.${e.name}.${i}`, `platform ${e.name}: the section Review of .relevo/stacks/${e.stack}.md asks to ${w.rule} ("${w.text}"), which a review never changes: the review ignores that line`, 'remove the line; the section can add steps and ask for more evidence, not loosen a rule'));
    });
    if (e.reviewLog && !e.reviewLog.dirExists) {
      r.push(warn(`review.log.${e.name}`, `platform ${e.name}: review.log is ${e.reviewLog.pattern}, and ${e.reviewLog.dir} does not exist, so the audit would read no log`, 'point review.log at the folder where the app writes its log'));
    }
    if (e.profile.review?.serve && e.repositoryLayerTracked === false) {
      r.push(warn(`review.serve.${e.name}`, `platform ${e.name}: the serve command of the review comes from .relevo/stacks/${e.stack}.md, which is not on the base branch, so the review ignores it in a fresh clone`, `commit .relevo/stacks/${e.stack}.md on the base branch`));
    }
    e.tools.forEach(({ tool, ok, cliOk }) => {
      if (seen.has(`tool:${tool}`)) return;
      seen.add(`tool:${tool}`);
      if (tool === 'docker' && !ok && cliOk) {
        r.push(warn(`tools.docker`, `docker is installed but the engine is stopped (platform ${e.name}, stack ${e.stack})`, 'start Docker Desktop or OrbStack'));
      } else {
        r.push(ok ? pass(`tools.${tool}`, `${tool} is installed`) : fail(`tools.${tool}`, `${tool} is not installed (platform ${e.name}, stack ${e.stack})`, TOOL_INSTALL[tool] ?? `install ${tool}`));
      }
    });
    e.targetTools.forEach(({ target, tool, ok }) => {
      const id = `tools.target.${e.name}.${target}`;
      if (tool === '') r.push(pass(id, `target ${target} of ${e.name} needs no extra tool`));
      else if (tool === 'xcrun' && !f.macos) r.push(note(id, `target ${target} of ${e.name}: iOS can only be built and reviewed on macOS`));
      else if (ok) r.push(pass(id, `target ${target} of ${e.name}: ${tool} is installed`));
      else r.push(warn(id, `target ${target} of ${e.name}: ${tool} is not installed; \`review\` needs it for this target`, TOOL_INSTALL[tool] ?? `install ${tool}`));
    });
    e.profile.requires_skills.forEach((name) => {
      if (f.skills[name] === undefined) r.push(warn(`skills.${name}`, `platform ${e.name} requires the skill ${name}; it was not checked`, SKILL_INSTALL[name] ?? `install the skill ${name}`));
      else if (!f.skills[name]) r.push(warn(`skills.${name}`, `platform ${e.name} requires the skill ${name}, which is not installed`, SKILL_INSTALL[name] ?? `install the skill ${name}`));
      else r.push(pass(`skills.${name}`, `skill ${name} is installed (platform ${e.name})`));
    });
  });

  // A skill the plugin's profile lists and the repository lacks is one note per platform, with its install command, and
  // never a warning: the profile works without it. What the repository switched off is not missing.
  (f.platformFacts ?? []).filter((e) => e.profile).forEach((e) => {
    const missing = [...new Set(Object.values(f.roleSkills?.[e.name] ?? {}).flatMap((skills) => skills.filter((s) => s.left_out && s.default).map((s) => s.name)))];
    missing.forEach((name) => {
      const command = RECOMMENDED[e.stack] ? recommendedInstallCommand({ stack: e.stack, skills: [name], path: e.path }) : null;
      r.push(note(`skills.default.${e.name}.${name}`, `platform ${e.name}: the plugin lists the skill ${name} for ${e.stack}, and it is not on the base branch, so it is left out${command ? `; install it with ${command}, commit it, or switch it off with skills.disable in .relevo/stacks/${e.stack}.md` : ''}`));
    });
    (e.profile.skillsDisabled ?? []).forEach((name) => {
      r.push(pass(`skills.disabled.${e.name}.${name}`, `platform ${e.name}: the skill ${name} is switched off by .relevo/stacks/${e.stack}.md`));
    });
    (e.profile.skillsDisableIgnored ?? []).forEach((x) => {
      if (x.reason === 'required') r.push(warn(`skills.disable.${e.name}.${x.name}`, `platform ${e.name}: skills.disable names ${x.name}, which the profile requires, so it stays`, 'remove it from skills.disable'));
      else r.push(note(`skills.disable.${e.name}.${x.name}`, `platform ${e.name}: skills.disable names ${x.name}, which no list of the plugin has, so it matches nothing`));
    });
  });

  Object.entries(f.roleSkills ?? {}).forEach(([platform, roles]) => {
    Object.entries(roles).forEach(([role, skills]) => {
      skills.filter((s) => s.left_out && !s.default).forEach((s) => {
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
      if (!e.playwright) r.push(warn(`autopilot.${e.name}.playwright`, `review.autopilot is ${f.autopilot.mode} but Playwright cannot be resolved from this project (platform ${e.name})`, `run /relevo:init, which offers it, or \`${e.path && e.path !== '.' ? `cd ${e.path} && ` : ''}npm install -D playwright && npx playwright install chromium\` and commit package.json and the lock file`));
      else r.push(pass(`autopilot.${e.name}.playwright`, `Playwright is available for platform ${e.name}`));
    } else if (adapterFor({ stack: e.stack, target: targetOf({ stack: e.stack, targets: e.targets ?? [] }) }).kind === 'api') {
      r.push(pass(`autopilot.${e.name}.adapter`, `platform ${e.name}: the agent proves a line by running the test that covers it (autopilot ${f.autopilot.mode})`));
    } else {
      r.push(warn(`autopilot.${e.name}.adapter`, `review.autopilot is ${f.autopilot.mode}, but a driven review of the stack ${e.stack} (platform ${e.name}) is not available`, 'set review.autopilot to off, or review that platform by hand'));
    }
  });
  (f.skillLockDifferences ?? []).forEach((d) => {
    const name = typeof d === 'string' ? d : d.name;
    const lock = typeof d === 'string' ? 'skills-lock.json' : d.lock;
    r.push(warn(typeof d === 'string' ? `skills.lock.${name}` : `skills.lock.${d.folder}.${name}`, `the skill ${name} differs from the hash in ${lock}`, 'review the change to the skill, then run `npx skills` to refresh the lock, or restore the skill'));
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
  r.push(...recommendedSkillChecks(f));
  r.push(...adapterChecks(f));

  // skills that think invokes
  REQUIRED_SKILLS.forEach((name) => {
    const manual = (f.manualOnlySkills ?? []).includes(name);
    r.push(f.skills[name] ? (manual ? note(`skills.${name}`, `skill ${name} is installed; it is reserved for you, so run /${name} by hand when \`think\` asks`) : pass(`skills.${name}`, `skill ${name} is installed`)) : fail(`skills.${name}`, `skill ${name} is not installed; \`think\` needs it`, SKILL_INSTALL[name]));
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
  r.push(...webHookChecks(f));

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
  const cb = f.configOnBranches;
  if (cb) {
    const fix = `promote ${cb.base} to ${cb.defaultBranch} through a pull request, or make ${cb.base} the default branch`;
    if (cb.same) r.push(pass('repo.config-default-branch', `relevo.yml on ${cb.defaultBranch}, which the cloud reads, gives the same settings as on ${cb.base}`));
    else if (cb.missingOnDefault) r.push(warn('repo.config-default-branch', `the cloud reads relevo.yml from the default branch ${cb.defaultBranch}, which has none while ${cb.base} has one`, fix));
    else r.push(warn('repo.config-default-branch', `the cloud reads relevo.yml from the default branch ${cb.defaultBranch}, and it differs from the one on ${cb.base}`, fix));
  }

  if (f.protectionError) {
    r.push(warn('repo.protection', `could not read the branch rules (${f.protectionError}), so they were not checked`, 'run doctor again; if it keeps failing, check your access to the repository'));
  } else if (f.protectionUnavailable) {
    r.push(note('repo.protection', `no branch protection is available on this plan (${f.protectionUnavailable}): approval and merge are only enforced by the written confirmation in \`ship\`; making the repository public or upgrading the plan would add it`));
  } else {
    [['base', f.config?.branches?.base ?? 'base'], ['release', f.config?.branches?.release ?? 'release']].forEach(([key, name]) => {
      const p = f.protection?.[key];
      if (!p || !p.pullRequestRequired) r.push(fail(`repo.protection.${key}`, `${name} does not require a pull request`, `protect ${name}: require a pull request with at least one approval (/relevo:init sets this up)`));
      else if (f.config?.review?.mode !== 'none' && p.approvals < 1) r.push(fail(`repo.protection.${key}`, `${name} requires a pull request but no approval`, `require at least 1 approving review on ${name}`));
      else r.push(pass(`repo.protection.${key}`, `${name} requires a pull request${p.approvals ? ` with ${p.approvals} approval(s)` : ''}`));
      if (p?.dismissStale) r.push(fail(`repo.dismiss-stale.${key}`, `${name} dismisses approvals when new commits are pushed; the spec archive commit pushed by \`ship\` would dismiss the approval`, `turn off "dismiss stale pull request approvals when new commits are pushed" on ${name}`));
      if (p?.lastPushApproval) r.push(fail(`repo.last-push.${key}`, `${name} requires the most recent push to be approved by someone else; the spec archive commit pushed by \`ship\` would need a new approval`, `turn off "require approval of the most recent reviewable push" on ${name}`));
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

  // One result per cause: the workflows in the same state, with the same status and the same fix, are one result that names them.
  const groups = new Map();
  const put = (kind, status, file, what, fix) => {
    const key = `${kind}|${status}`;
    const g = groups.get(key) ?? { kind, status, files: [], what, fix };
    g.files.push(file);
    groups.set(key, g);
  };
  Object.entries(f.workflows).forEach(([file, w]) => {
    const level = REQUIRED_WORKFLOWS.has(file) ? 'fail' : 'warn';
    if (!w.present && w.local && w.remote === false) put('local-only', level, file, 'only in your working copy, not on the default branch, and a workflow only runs from there', 'commit it and push it to the default branch (through a pull request if the branch is protected)');
    else if (!w.present) put('missing', level, file, 'not installed', 'run /relevo:init to copy it into .github/workflows/');
    else if (w.enabled === false) put('disabled', level, file, 'disabled', 'enable it in the Actions tab');
    else if (w.enabled === null) put('unlisted', 'warn', file, 'on the default branch but GitHub does not list it yet', 'check the Actions tab, or run doctor again in a minute');
    else put('installed', 'pass', file, 'installed and enabled');
  });
  groups.forEach(({ kind, status, files, what, fix }) => {
    // The same state can be a failure for a required workflow and a warning for an optional one: two results, two ids.
    const id = files.length === 1 ? `automation.workflow.${files[0]}` : `automation.workflow.${kind}${status === 'warn' && kind !== 'unlisted' ? '-optional' : ''}`;
    const message = files.length === 1 ? `${files[0]} is ${what}` : `${files.join(', ')} are ${what}`;
    r.push({ id, status, message, ...(fix ? { fix } : {}) });
  });
  r.push(f.hasCi ? pass('automation.ci', 'an objective CI check exists') : fail('automation.ci', 'no CI workflow other than Relevo\'s was found; QA needs an objective check', 'add a workflow that runs the project\'s analysis and tests on pull requests'));

  r.push(...pluginInstallChecks(f));
  r.push(...toolchainChecks(f));
  r.push(...runnerChecks(f));
  if (f.pluginMarketplace && f.pluginRepoPrivate === true && !f.pluginMarketplaceHasToken) {
    r.push(fail('automation.plugin-clone', `the plugin repository (${f.pluginMarketplace}) is private, so the runner cannot clone it without a credential`, 'store a read-only token as RELEVO_PLUGIN_TOKEN and use the private-repository line in relevo-go.yml'));
  }
  r.push(...linkChecks(f));
  r.push(...executionChecks(f));
  r.push(...shipChecks(f));
  // The token is for reading the plugin repository, which only a workflow that still loads the plugin through a marketplace
  // (or clones it, the older layout) does; one that loads it from the pinned package needs none.
  const readsPluginRepository = Boolean(f.pluginMarketplace) || (f.pluginCheckouts ?? []).length > 0;
  if (readsPluginRepository && f.pluginRepoPrivate === true && Array.isArray(f.secrets)) {
    if (f.secrets.includes('RELEVO_PLUGIN_TOKEN')) r.push(pass('automation.plugin-secret', 'the RELEVO_PLUGIN_TOKEN secret exists for the private plugin repository'));
    else r.push(fail('automation.plugin-secret', 'the plugin repository is private and the repository has no RELEVO_PLUGIN_TOKEN secret, so the workflows fall back to the default token and fail at checkout', 'store a read-only fine-grained token that can read the plugin repository as the repository secret RELEVO_PLUGIN_TOKEN; a secret defined at organization level is not visible to this check'));
  }
  return r;
}

/**
 * What the ship workflow needs, when it is on the default branch: the App secrets when the base branch requires checks
 * (a push with the workflow token starts none, so the archive commit would never get them), and whether it is paused.
 * Its label is checked with the other labels, and it needs no model credential.
 */
function shipChecks(f) {
  const r = [];
  if (!f.workflows?.['relevo-ship.yml']?.present) return r;
  const base = f.config?.branches?.base ?? 'base';
  if (f.protectionError || f.protectionUnavailable) return r;
  if (f.protection?.base?.requiredChecks) {
    if (f.secrets === null) r.push(warn('ship.app', `${base} requires status checks and the secrets could not be listed, so the ship App was not checked`, `check that ${SHIP_APP_SECRETS.join(' and ')} exist`));
    else if (SHIP_APP_SECRETS.every((s) => f.secrets.includes(s))) r.push(pass('ship.app', `${base} requires status checks and the ship App secrets exist, so the relevo:ship label pushes with the App and the checks run on the archive commit`));
    else r.push(fail('ship.app', `${base} requires status checks, so the relevo:ship label cannot ship here: the archive commit pushed with the workflow token would never get its checks`, `create a GitHub App for this repository and store its id and private key as ${SHIP_APP_SECRETS.join(' and ')} (docs/execution.md, "Shipping with a label"), or ship with /relevo:ship`));
  } else {
    r.push(pass('ship.app', `${base} requires no status checks, so the checks of the approved head carry over to the archive commit and the ship workflow needs no App`));
  }
  if (String(f.shipVariable ?? '').trim().toLowerCase() === 'off') r.push(warn('ship.paused', `the relevo:ship label is paused (${SHIP_VARIABLE} is off)`, `delete the repository variable ${SHIP_VARIABLE}, or set it to on, to ship with the label again`));
  return r;
}

// The action that sets up the toolchain of a stack in the build job of the go workflow. Vue needs only Node, which the
// job installs for Relevo itself, and a stack that is not listed here is not judged.
const TOOLCHAIN_ACTIONS = { flutter: { action: 'subosito/flutter-action', step: 'the Flutter step' }, laravel: { action: 'shivammathur/setup-php', step: 'the Laravel step' }, supabase: { action: 'supabase/setup-cli', step: 'the Supabase step' } };

/**
 * Does the go workflow install the toolchain of each configured platform? Without it every cloud build fails QA after
 * it spent the run. Only active lines count (a commented example installs nothing), and nothing is judged when the
 * go workflow is not installed, as when go builds on machines.
 */
function toolchainChecks(f) {
  const go = f.workflows?.['relevo-go.yml'];
  if (!go?.present || typeof go.text !== 'string') return [];
  const active = go.text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const known = (f.platformFacts ?? []).filter((e) => TOOLCHAIN_ACTIONS[e.stack]).map((e) => {
    const { action, step } = TOOLCHAIN_ACTIONS[e.stack];
    return active.includes(action)
      ? pass(`automation.toolchain.${e.name}`, `the go workflow installs the toolchain of platform ${e.name} (${e.stack})`)
      : fail(`automation.toolchain.${e.name}`, `the go workflow installs no toolchain for platform ${e.name} (${e.stack}), so every cloud build would fail QA after spending the run`, `enable ${step} of the build job in relevo-go.yml (the template has it active; compare with /relevo:init), or, if you install it another way, ignore this`);
  });
  // A stack of the repository has no step in the template: the convention is a step guarded by the name of the stack.
  // Only a warning, because the toolchain may come another way (an image, a runner that has it). A stack that needs only
  // Node is not judged: the job installs Node for Relevo itself.
  const own = (f.platformFacts ?? []).filter((e) => !TOOLCHAIN_ACTIONS[e.stack] && isOwnProfile(e) && (e.profile.tools ?? []).some((t) => !NODE_TOOLS.includes(t))).map((e) => {
    const guard = `needs.decide.outputs.stack == '${e.stack}'`;
    return active.includes(guard)
      ? pass(`automation.toolchain.${e.name}`, `the go workflow has a step for the stack of platform ${e.name} (${e.stack})`)
      : warn(`automation.toolchain.${e.name}`, `the go workflow has no step guarded by ${guard}, so a cloud build for platform ${e.name} (${e.stack}) may find no ${e.profile.tools.filter((t) => !NODE_TOOLS.includes(t)).join(', ')} and fail QA after spending the run`, `add a step to the build job of relevo-go.yml that installs it, guarded by "- if: ${guard}" (see the comment in the template), or, if you install it another way, ignore this`);
  });
  return [...known, ...own];
}

// The tools that the build job already has: it installs Node for Relevo itself.
const NODE_TOOLS = ['node', 'npm'];

const HOSTED_RUNNER = ['ubuntu-latest'];

/** The labels written in a `runs-on` line: `[self-hosted, linux-build]` or `ubuntu-latest`; null for an expression we cannot judge. */
function parseRunsOn(value) {
  if (value.includes('${{')) return null;
  const inner = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return inner.split(',').map((l) => l.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/**
 * Does every Relevo workflow run on the runner that relevo.yml names (`runner.labels`, else ubuntu-latest)? A workflow
 * edited by hand to another runner is reported with the file, because the next copy of the template would undo it. A
 * runner that is not GitHub's is only assumed to persist: Relevo cannot tell, and says so instead of claiming.
 */
function runnerChecks(f) {
  const wanted = f.config?.runner?.labels ?? HOSTED_RUNNER;
  const same = (a, b) => a.length === b.length && [...a].sort().every((l, i) => l === [...b].sort()[i]);
  const r = [];
  let judged = 0;
  // One result per cause: the files that run on the same other runner are one failure that names all of them.
  const differing = new Map();
  Object.entries(f.workflows ?? {}).forEach(([file, w]) => {
    if (!w.present || typeof w.text !== 'string') return;
    judged += 1;
    const found = [...w.text.matchAll(/^[ \t]+runs-on:[ \t]*(.+?)[ \t]*(?:#.*)?$/gm)].map((m) => parseRunsOn(m[1])).filter((l) => l !== null);
    const other = found.find((labels) => !same(labels, wanted));
    if (!other) return;
    const key = other.join(', ');
    differing.set(key, [...(differing.get(key) ?? []), file]);
  });
  [...differing.entries()].forEach(([labels, files]) => {
    const names = files.join(', ');
    const id = differing.size === 1 ? 'automation.runner' : `automation.runner.${labels}`;
    r.push(fail(id, `${names} ${files.length === 1 ? 'runs' : 'run'} on [${labels}] and relevo.yml says [${wanted.join(', ')}]`, same(wanted, HOSTED_RUNNER) ? `set runner.labels: [${labels}] in relevo.yml if that is the runner you want, or restore runs-on: ubuntu-latest in ${names}` : `change runs-on in ${names} to [${wanted.join(', ')}], or change runner.labels in relevo.yml`));
  });
  if (r.length > 0) return r;
  if (judged > 0) r.push(pass('automation.runner', `the Relevo workflows run on [${wanted.join(', ')}]`));
  if (!same(wanted, HOSTED_RUNNER)) r.push(warn('automation.runner.persistence', `the runner [${wanted.join(', ')}] is not GitHub's: Relevo assumes it keeps its files between jobs, and the code the agent writes runs with the permissions of the runner's user`, 'an ephemeral runner (created for one job) or a container is the real barrier; Relevo installs its tools under the temporary folder of the job and removes what it adds, but cannot make the machine a sandbox (docs/security.md)'));
  return r;
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
 * Does the repository install OpenSpec in the sessions of Claude Code on the web? The hook has no use on a terminal,
 * where OpenSpec stays installed, so it is judged only when doctor itself runs in a remote session. It warns: the
 * project can run without it, but every new session starts without OpenSpec.
 */
function webHookChecks(f) {
  if (!f.remoteSession || !f.webHook) return [];
  if (f.webHook.unreadable) return [warn('web.openspec-hook', '.claude/settings.json is not valid JSON, so it cannot be checked whether it installs OpenSpec in web sessions', 'fix the file; /relevo:init then offers the hook')];
  if (f.webHook.declared) return [pass('web.openspec-hook', 'the repository installs OpenSpec at the start of a web session (SessionStart hook in .claude/settings.json)')];
  return [warn('web.openspec-hook', 'this is a web session and the repository has no SessionStart hook that installs OpenSpec, so every new session starts without it and go cannot run', `run /relevo:init to add the hook, commit .claude/settings.json, or install it now: ${OPENSPEC_INSTALL}`)];
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
  if (old.length > 0) r.push(warn('automation.plugin-version', `${old.join(', ')} pin a different version than the installed plugin (${f.pluginVersion})`, 'run /relevo:init: it updates a workflow by merging it with the new template and keeps your own changes; or change RELEVO_VERSION by hand after reading the changelog (that moves the scripts, not the text)'));
  r.push(...versionChecks(f), ...workflowTextChecks(f));
  return r;
}

const byVersion = (a, b) => a.split('.').map(Number).reduce((x, n, i) => x || n - Number(b.split('.')[i]), 0);

/**
 * Which version each part is on, from what can be read here: the plugin in use, each installation `claude` lists and the
 * pins of the workflows. It is a note, always visible; a warning only when the user and the project scope disagree, with
 * the command that moves the lagging one. It asks the npm registry nothing.
 */
function versionChecks(f) {
  if (f.installedPlugins === undefined) return [];
  if (f.installedPlugins === null) return [warn('plugin.versions', 'the installed versions of the plugin could not be read: `claude plugin list --json` failed', 'check that Claude Code is installed (claude --version) and run claude plugin list')];
  const r = [];
  const scopes = f.installedPlugins.filter((e) => e.version);
  const pins = [...new Set(Object.values(f.pluginPins ?? {}).filter(Boolean))].sort(byVersion);
  const parts = [
    `plugin in use ${f.pluginVersion ?? 'unknown'}`,
    scopes.length > 0 ? `installed ${scopes.map((e) => `${e.scope} ${e.version}`).join(', ')}` : 'not installed through Claude Code',
    pins.length > 0 ? `workflows pin ${pins.join(', ')}` : null,
  ].filter(Boolean);
  r.push(note('plugin.versions', `versions: ${parts.join('; ')}`));
  const distinct = [...new Set(scopes.map((e) => e.version))].sort(byVersion);
  if (distinct.length > 1) {
    const newest = distinct.at(-1);
    const lagging = scopes.filter((e) => e.version !== newest).map((e) => e.scope);
    r.push(warn('plugin.scopes', `the plugin is on different versions: ${scopes.map((e) => `${e.scope} ${e.version}`).join(', ')}`, `update the lagging scope: ${lagging.map((s) => `claude plugin update relevo@relevo --scope ${s}`).join('; ')}`));
  }
  return r;
}

/** Is the text of each workflow as current as the scripts it runs? The stamp is the version of the text; the pin is the scripts'. */
function workflowTextChecks(f) {
  const stamps = f.pluginStamps;
  if (!stamps) return [];
  const pins = f.pluginPins ?? {};
  const unknown = Object.keys(stamps).filter((file) => stamps[file] === null && f.workflows?.[file]?.present);
  const older = Object.keys(stamps).filter((file) => stamps[file] !== null && pins[file] && byVersion(stamps[file], pins[file]) < 0);
  const r = [];
  if (older.length > 0) r.push(warn('automation.workflow-text', `${older.map((file) => `${file} (text ${stamps[file]}, scripts ${pins[file]})`).join(', ')}: the text of the workflow is older than the scripts it runs`, 'run /relevo:init: it updates the workflow by merging it with the new template and keeps your own changes'));
  if (unknown.length > 0) r.push(warn('automation.workflow-text-unknown', `${unknown.join(', ')} have no # relevo-template: line, so the age of their text is unknown`, 'run /relevo:init: it updates the workflow by merging it with the new template and keeps your own changes'));
  if (older.length === 0 && unknown.length === 0 && Object.keys(stamps).length > 0) r.push(pass('automation.workflow-text', 'the text of the workflows is as current as the scripts they run'));
  return r;
}

/**
 * The default skills of a stack. Never a warning or a failure: the stack works without them, so a missing one is a
 * note with the commands. It judges what is committed, because the cloud runner reads only that; a plugin installed on
 * this machine is said and not counted. The Antigravity IDE route cannot be checked, so it is said and not guessed.
 */
function recommendedSkillChecks(f) {
  const rec = f.recommendedSkills;
  if (!rec) return [];
  const label = rec.stack === 'flutter' ? 'Dart and Flutter' : rec.stack;
  const commands = (missing, agent) => missing.map((m) => recommendedInstallCommand({ stack: rec.stack, skills: m.skills, agent, path: m.path })).join('; then ');
  const names = (missing) => [...new Set(missing.flatMap((m) => m.skills))].join(', ');
  const commit = 'then commit the folder and skills-lock.json';
  const r = [];
  if (rec.claude === 'present') r.push(pass(`recommended.${rec.stack}.claude`, `the default ${label} skills are committed to the repository (Claude Code)`));
  else {
    const here = rec.plugin === true ? `; the plugin ${RECOMMENDED[rec.stack].claude.plugin} is installed on this machine, which works here and does not reach the cloud runner` : '';
    r.push(note(`recommended.${rec.stack}.claude`, `${rec.stack} works better with the default ${label} skills (${names(rec.claudeMissing)}), which are not committed to the repository, and the cloud runner reads only what is committed${here}; they are optional. Install them: ${commands(rec.claudeMissing, 'claude-code')}, ${commit}`));
  }
  if (rec.antigravity === 'present') r.push(pass(`recommended.${rec.stack}.antigravity`, `the default ${label} skills are in .agents/skills (Antigravity)`));
  else if (rec.antigravity === 'missing') r.push(note(`recommended.${rec.stack}.antigravity`, `${rec.stack} works better with the default ${label} skills (${names(rec.antigravityMissing)}), which are not in .agents/skills; they are optional. For the Antigravity CLI run ${commands(rec.antigravityMissing, 'universal')}, ${commit}; ${ANTIGRAVITY_IDE}`));
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

/** The exit status of `doctor`: 1 when a check failed, 0 otherwise. Warnings and notes never fail it. */
export function exitCode(results) {
  return results.some((x) => x.status === 'fail') ? 1 : 0;
}

const TAG = { pass: 'pass', fail: 'FAIL', warn: 'warn', note: 'note' };
const lineOf = (x) => [`[${TAG[x.status]}] ${x.message}`, ...(x.fix && (x.status === 'fail' || x.status === 'warn') ? [`       fix: ${x.fix}`] : [])];

/** The first line of the report: what was judged, and where the workflows were read from. */
export function reportHeader(facts) {
  if (!facts?.repo || !facts.ghAuth) return 'Relevo doctor: only the local checks ran (no GitHub repository, or not signed in to GitHub)';
  return `Relevo doctor: ${facts.repo}, workflows read from the ${facts.workflowSource ?? 'working copy'}`;
}

/**
 * Text report. By default what needs action comes first (failures, warnings, notes, each with its count) and the checks
 * that passed are only counted; `all` lists every check in the order it was evaluated. The closing line counts results.
 */
export function renderReport(results, { header = null, all = false } = {}) {
  const by = (status) => results.filter((x) => x.status === status);
  const failed = by('fail').length;
  const warned = by('warn').length;
  const passed = by('pass').length;
  const lines = header ? [header, ''] : [];
  if (all) lines.push(...results.flatMap(lineOf));
  else {
    [['FAILURES', 'fail'], ['WARNINGS', 'warn'], ['NOTES', 'note']].forEach(([title, status]) => {
      const group = by(status);
      if (group.length === 0) return;
      lines.push(`${title} (${group.length})`, ...group.flatMap(lineOf), '');
    });
    if (passed > 0) lines.push(`${passed} check(s) passed; run with --all to list them.`);
  }
  lines.push('', failed === 0 ? (warned === 0 ? 'All green.' : `No failures, ${warned} warning(s).`) : `${failed} check(s) failed${warned ? `, ${warned} warning(s)` : ''}.`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
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
