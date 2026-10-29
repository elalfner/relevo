// `init`: builds the plan of everything that has to change, then applies it once the person confirms.
// Implements openspec/specs/init-doctor/spec.md.
//
// planInit is pure: it compares the facts `doctor` gathers with what a configured repository looks like, so
// running it again only lists what differs (idempotent). applyPlan carries items out through injected I/O.
// init never reads or writes the model API key.

import { loadConfig } from './config.mjs';
import { LEGACY_PLATFORMS } from './platforms.mjs';
import { labelDefinitions } from './labels.mjs';
import { agentWorkflow } from './agent-workflow.mjs';
import { isVueWeb, OPENSPEC_INSTALL, REQUIRED_SKILLS, SKILL_INSTALL, WEB_HOOK_COMMAND, WORKFLOW_FILES, recommendedInstallCommand } from './doctor.mjs';

export const REVIEW_MODES = ['none', 'peer', 'roles'];

export const RUNS = ['cloud', 'local', 'both'];
export const CREDENTIALS = ['api_key', 'subscription'];
export const AGENT_BUILDS = ['claude', 'antigravity'];
const API_KEY_LINE = '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}';
const TOKEN_LINE = '          # claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}';

/**
 * The go workflow with the credential line of the chosen mode: the API key is the template's default; for a
 * subscription token that line is commented out and the token line is switched on. Throws when the template no
 * longer has the lines (a test runs this on the real template).
 */
// The two official commands that install the plugin at the project scope; the person confirms this exact line.
export const PLUGIN_PROJECT_COMMAND = 'claude plugin marketplace add elalfner/relevo --scope project --sparse .claude-plugin && claude plugin install relevo@relevo --scope project';
const PLUGIN_PROJECT_DETAIL = 'It writes the marketplace and the enabled plugin into .claude/settings.json of this repository. It works even if the plugin is already installed for your machine, and nothing is committed for you.';

const WEB_HOOK_DETAIL = 'It adds a SessionStart hook to .claude/settings.json of this repository, keeping what the file already has. In a session of Claude Code on the web it installs OpenSpec when it is missing (npm install --global @fission-ai/openspec); on a terminal it does nothing. The file is left for you to commit.';

/**
 * `.claude/settings.json` with the hook that installs OpenSpec added to `SessionStart`, every other key and hook kept.
 * Idempotent: text that already installs OpenSpec is returned as it is. Throws on text that is not a JSON object, so a
 * broken file is never rewritten. `text` is null when the file does not exist.
 */
export function mergeWebHook(text) {
  const settings = text === null ? {} : JSON.parse(text);
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('.claude/settings.json is not a JSON object');
  const current = settings.hooks?.SessionStart;
  if (current !== undefined && !Array.isArray(current)) throw new Error('hooks.SessionStart in .claude/settings.json is not a list');
  if ((current ?? []).some((e) => (e?.hooks ?? []).some((h) => typeof h?.command === 'string' && h.command.includes('@fission-ai/openspec')))) return text;
  const hooks = { ...(settings.hooks ?? {}), SessionStart: [...(current ?? []), { hooks: [{ type: 'command', command: WEB_HOOK_COMMAND }] }] };
  return `${JSON.stringify({ ...settings, hooks }, null, 2)}\n`;
}

export function credentialLine(workflow, credential) {
  if (credential !== 'subscription') return workflow;
  if (!workflow.includes(API_KEY_LINE) || !workflow.includes(TOKEN_LINE)) throw new Error('the go workflow template has no credential lines to switch');
  return workflow.replace(API_KEY_LINE, API_KEY_LINE.replace('anthropic_api_key', '# anthropic_api_key')).replace(TOKEN_LINE, TOKEN_LINE.replace('# claude_code_oauth_token', 'claude_code_oauth_token'));
}

export const DEFAULT_RUNNER = ['ubuntu-latest'];

/**
 * The workflow with the runner of `runner.labels` in every `runs-on`. The templates run on `ubuntu-latest`, which is
 * what an empty or default list leaves alone; a list of one label is written as that label.
 */
export function runnerLine(workflow, labels) {
  const list = labels ?? DEFAULT_RUNNER;
  if (list.length === 1 && list[0] === DEFAULT_RUNNER[0]) return workflow;
  if (!workflow.includes('runs-on: ubuntu-latest')) throw new Error('the workflow template has no runs-on line to switch');
  return workflow.replaceAll('runs-on: ubuntu-latest', `runs-on: ${list.length === 1 ? list[0] : `[${list.join(', ')}]`}`);
}

/** The text of a `platforms:` block for { name: { stack, path, targets } }. */
export function platformsBlock(platforms) {
  const lines = ['platforms:'];
  Object.entries(platforms).forEach(([name, p]) => {
    if (!p) throw new Error(`unknown platform "${name}"`);
    lines.push(`  ${name}:`, `    stack: ${p.stack}`, `    path: ${p.path ?? '.'}`);
    if (p.targets?.length) lines.push(`    targets: [${p.targets.join(', ')}]`);
  });
  return `${lines.join('\n')}\n`;
}

/** Replace the `platforms:` block of the template (up to the next blank line) with the person's platforms. */
function setPlatforms(text, platforms) {
  const re = /^platforms:[^\n]*\n(?:[ \t]+[^\n]*\n|[ \t]*#[^\n]*\n)*/m;
  if (!re.test(text)) throw new Error('the template has no "platforms" block');
  return text.replace(re, platformsBlock(platforms));
}

/**
 * A commented `.relevo/stacks/<stack>.md`. For a stack the plugin ships it adds to the plugin's profile and never
 * replaces it. For a stack the plugin does not ship (`own`) it is the whole profile: the commands are left commented
 * because one that passes without checking anything would be worse than none, and `doctor` warns until they exist.
 */
export function stackProfileTemplate(stack, { own = false } = {}) {
  if (!own) {
    return `---
stack: ${stack}
# Lists are added to the plugin's profile; a command that the plugin sets cannot be replaced here (use
# platforms.<name>.checks in relevo.yml for that).
# generated: ['coverage/**']
# tools: []
# skills:
#   dev: []
#   qa: []
---

<!-- Hygiene of this project for ${stack}, in plain sentences. The developer follows it and QA audits against it.
     It is added after the plugin's text for the stack. -->
`;
  }
  return `---
stack: ${stack}
# The plugin has no profile for ${stack}, so this file is the whole profile. Write the commands QA runs, from the
# folder of the platform. analyze and test must not rewrite your code; only format may. Until analyze and test are
# written (here or in platforms.<name>.checks of relevo.yml), /relevo:doctor warns.
# commands:
#   analyze: <a command that fails on a type, lint or vet error>
#   test: <a command that runs the tests once>
#   format: <a command that formats the code>
# The tools the job needs on the runner (each is checked with \`<tool> --version\`).
# tools: []
# Generated files that are left out of the diff QA reviews.
# generated: []
# skills:
#   dev: []
#   qa: []
---

# ${stack}

## Hygiene for the developer

<!-- What the developer does and avoids in ${stack} code, in plain sentences that can be checked by reading the diff. -->

## What the auditor looks for in the diff

<!-- The bugs of ${stack} that analyze and test do not catch, so QA looks for them by reading. -->
`;
}

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
  const platforms = answers.platforms ?? (answers.platform ? { app: LEGACY_PLATFORMS[answers.platform] } : null);
  if (platforms) out = setPlatforms(out, platforms);
  if (answers.links) out = set(out, 'links', `[${answers.links.join(', ')}]`);
  // A subscription's quota is shared by every run and by the interactive use of the account: one agent at a time.
  if (answers.credential === 'subscription') out = set(out, 'concurrent_agents', answers.concurrentAgents ?? 1);
  if (answers.members) out = set(out, 'members', `[${answers.members.join(', ')}]`);
  if (answers.specWriter !== undefined) out = set(out, 'spec_writer', answers.specWriter ?? 'null');
  if (answers.reviewMode) out = set(out, 'mode', answers.reviewMode);
  if (answers.merger) out = set(out, 'merger', answers.merger);
  if (answers.agentBuild === 'antigravity') {
    // The agent has no cost limit: the limit of the run is a number of tokens, and the agent is named in its own group.
    out = out.replace(/^(\s*)run_max_cost:[^\n]*$/m, '$1run_max_tokens: 2000000          # REQUIRED with agent.build antigravity: tokens per unattended run; choose your own');
    out = `${out.trimEnd()}\n\n# Which agent builds in the cloud: claude (the default) or antigravity.\nagent:\n  build: antigravity\n`;
    if (answers.runMaxTokens !== undefined) out = set(out, 'run_max_tokens', answers.runMaxTokens);
  } else if (answers.runMaxCost !== undefined) out = set(out, 'run_max_cost', answers.runMaxCost);
  if (answers.language) out = set(out, 'language', answers.language);
  // The commented example of the template becomes the setting; the default runner leaves the template as it is.
  if (answers.runnerLabels && !(answers.runnerLabels.length === 1 && answers.runnerLabels[0] === DEFAULT_RUNNER[0])) {
    const re = /^# runner:[^\n]*\n#   labels:[^\n]*\n/m;
    if (!re.test(out)) throw new Error('the template has no "runner" example to switch on');
    out = out.replace(re, `runner:                             # where the Relevo workflows run (docs/execution.md)\n  labels: [${answers.runnerLabels.join(', ')}]\n`);
  }
  // A browser review is always driven by the agent, so a Vue web platform cannot keep the autopilot off.
  const autopilot = answers.autopilot ?? (Object.values(platforms ?? {}).some(isVueWeb) ? 'precheck' : null);
  if (autopilot) out = set(out, 'autopilot', autopilot);
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

const OPTIONAL = 'It is optional: if you decline, nothing else changes and /relevo:doctor keeps a note about it.';
const MCP_ENTRY = '{ "mcpServers": { "dart": { "command": "dart", "args": ["mcp-server"] } } }';

/**
 * The optional installs and the manual steps for the default skills of a stack (see RECOMMENDED in doctor.mjs): one
 * install per platform folder that lacks them, run from that folder, because the installer writes where it runs.
 * Declining changes nothing else; init never runs them (the skill does, after a yes to each) and never writes the
 * project's rules file or an MCP configuration file.
 */
function recommendedSkillItems(rec) {
  const label = rec.stack === 'flutter' ? 'Dart and Flutter' : rec.stack;
  const items = [];
  const where = (path) => (path === '.' ? 'the root' : path);
  const installs = (agent, missing, writes) => missing.forEach((m) => {
    const id = `install.recommended.${rec.stack}.${agent === 'claude-code' ? 'claude' : 'antigravity'}.${m.path === '.' ? 'root' : m.path}`;
    const tool = agent === 'claude-code' ? 'Claude Code' : 'the Antigravity CLI';
    items.push(item(id, 'todo', `Optional: install the default ${label} skills (${m.skills.join(', ')}) for ${tool} into ${where(m.path)}; it writes ${writes} and skills-lock.json there: commit both`, { install: true, optional: true, command: recommendedInstallCommand({ stack: rec.stack, skills: m.skills, agent, path: m.path }), detail: OPTIONAL }));
  });
  if (rec.claude === 'present') items.push(item(`install.recommended.${rec.stack}.claude`, 'ok', `The default ${label} skills are committed to the repository (Claude Code)`));
  else installs('claude-code', rec.claudeMissing, '.claude/skills');
  if (rec.antigravity === 'present') items.push(item(`install.recommended.${rec.stack}.antigravity`, 'ok', `The default ${label} skills are in .agents/skills`));
  else if (rec.antigravity === 'missing') {
    installs('universal', rec.antigravityMissing, '.agents/skills');
    items.push(item(`manual.recommended.${rec.stack}.antigravity-ide`, 'manual', `Optional, Antigravity IDE: install "${label}" from Settings > Customizations > Build with Google Plugins`));
    items.push(item(`manual.recommended.${rec.stack}.mcp`, 'manual', `Optional, Antigravity CLI: add the ${label} MCP server to .agents/mcp_config.json (or ~/.gemini/config/mcp_config.json)`, { checklist: [MCP_ENTRY] }));
  }
  if (rec.claude === 'missing' || rec.antigravity === 'missing') {
    items.push(item(`manual.recommended.${rec.stack}.commit`, 'manual', `Commit the new skills folder and skills-lock.json with the other files Relevo wrote: the cloud runner reads only what is committed`));
    items.push(item(`manual.recommended.${rec.stack}.rules`, 'manual', `Optional: the official ${label} rules are not installed with the skills; copy the ones you want from https://github.com/flutter/agent-plugins/tree/main/rules into the rules file of the project`));
  }
  return items;
}

/**
 * Plan every change. `ctx`:
 *   facts      from gatherFacts (doctor)
 *   answers    the person's answers (members, specWriter, reviewMode, language, platforms, links, runs, credential, runnerLabels, stackProfiles, base, release, merger)
 *   templates  { config: text, workflows: { file: text } }
 *   current    { workflows: { file: text|null }, gitignore: text|null, keepFiles: { path: boolean } }
 *   admin      true when the person has administrator permission on the repository
 *   upgrades   { file: state } or a function file -> state (asked only for a workflow that exists and differs), from
 *              `planUpgrades`: a clean merge becomes an
 *              update to confirm, a conflict or a missing base stays `differs` and says why
 * Items have status: ok (nothing to do), todo (init will do it), differs (exists but differs: reported, never
 * overwritten), manual (the person must do it).
 */
export function planInit({ facts, answers, templates, current, admin, upgrades = {} }) {
  const items = [];
  const base = facts.config?.branches?.base ?? answers.base ?? 'dev';
  const release = facts.config?.branches?.release ?? answers.release ?? 'main';
  const reviewMode = facts.config?.review?.mode ?? answers.reviewMode ?? 'peer';
  const names = labelDefinitions(facts.config?.labels ?? {});

  // dependencies: offered, never installed without confirmation
  if (!facts.openspec) items.push(item('install.openspec', 'todo', 'Install the OpenSpec command-line tool', { install: true, command: 'npm install --global @fission-ai/openspec', detail: OPENSPEC_INSTALL }));
  REQUIRED_SKILLS.filter((n) => !facts.skills[n]).forEach((n) => items.push(item(`install.skill.${n}`, 'todo', `Install the ${n} skill`, { install: true, command: n === 'openspec-explore' ? 'openspec init' : 'npx skills add mattpocock/skills', detail: SKILL_INSTALL[n] })));

  const configuredPlatforms = facts.config?.platforms ?? answers.platforms ?? (answers.platform ? { app: LEGACY_PLATFORMS[answers.platform] } : {});
  const hasSupabase = Object.values(configuredPlatforms).some((p) => p?.stack === 'supabase');
  if (hasSupabase) {
    ['supabase', 'supabase-postgres-best-practices'].forEach((skill) => {
      if (facts.skills?.[skill] === false) {
        items.push(item(`install.skill.${skill}`, 'todo', `Install the ${skill} skill`, {
          install: true,
          command: `npx skills add supabase/agent-skills --skill ${skill}`,
          detail: SKILL_INSTALL[skill] ?? `run \`npx skills add supabase/agent-skills --skill ${skill}\``,
        }));
      }
    });
  }

  // Skills a stack works better with: optional installs (declining changes nothing), and the steps init never does itself.
  const rec = facts.recommendedSkills;
  if (rec) items.push(...recommendedSkillItems(rec));

  // What a browser review of each Vue platform needs: Playwright in its development dependencies, and its Chromium.
  Object.entries(configuredPlatforms).filter(([, p]) => isVueWeb(p)).forEach(([name, p]) => {
    const found = facts.vueWeb?.[name];
    if (!found) return;
    const cd = p.path && p.path !== '.' ? `cd ${p.path} && ` : '';
    if (found.playwright) items.push(item(`install.playwright.${name}`, 'ok', `Playwright resolves from platform ${name}`));
    else items.push(item(`install.playwright.${name}`, 'todo', `Add Playwright to the development dependencies of platform ${name}, which its browser review needs (package.json and the lock file are left for you to commit)`, { install: true, command: `${cd}npm install -D playwright`, detail: 'It changes package.json and the lock file of the platform: commit them on the base branch, so that every review finds Playwright. If you decline, a browser review of this platform stops until it is installed.' }));
    if (found.playwright && found.chromium) items.push(item(`install.chromium.${name}`, 'ok', `The Chromium of Playwright is installed for platform ${name}`));
    else items.push(item(`install.chromium.${name}`, 'todo', `Install the Chromium of Playwright for platform ${name}`, { install: true, command: `${cd}npx playwright install chromium`, detail: 'It downloads the browser to the cache of your user, outside the repository. If you decline, a browser review of this platform stops until it is installed.' }));
  });
  if (facts.config && (facts.config.review?.autopilot ?? 'off') === 'off' && Object.values(configuredPlatforms).some(isVueWeb)) {
    items.push(item('review.autopilot', 'manual', 'A browser review of a Vue platform is driven by the agent: set review.autopilot to precheck (or verify) in relevo.yml'));
  }

  // the plugin, declared in the project so that a teammate who clones the repository is offered it
  if (facts.pluginDeclared?.declared) items.push(item('install.plugin-project', 'ok', 'The repository declares the Relevo plugin (.claude/settings.json)'));
  else if (facts.pluginDeclared?.unreadable) items.push(item('install.plugin-project', 'manual', '.claude/settings.json is not valid JSON: fix it, then run init again to declare the Relevo plugin in the project'));
  else if (facts.pluginDeclared) items.push(item('install.plugin-project', 'todo', 'Declare the Relevo plugin in the project, so that a teammate who clones the repository is offered it (the new .claude/settings.json is left for you to commit)', { install: true, command: PLUGIN_PROJECT_COMMAND, detail: PLUGIN_PROJECT_DETAIL }));

  // OpenSpec in the sessions of Claude Code on the web, where every new container starts without it
  if (facts.webHook?.declared) items.push(item('install.web-hook', 'ok', 'The repository installs OpenSpec at the start of a web session (.claude/settings.json)'));
  else if (facts.webHook?.unreadable) items.push(item('install.web-hook', 'manual', '.claude/settings.json is not valid JSON: fix it, then run init again to add the hook that installs OpenSpec in web sessions'));
  else if (facts.webHook) items.push(item('install.web-hook', 'todo', 'Add a hook that installs OpenSpec at the start of a web session of Claude Code, where it is missing (the changed .claude/settings.json is left for you to commit)', { install: true, command: `node \${CLAUDE_PLUGIN_ROOT}/scripts/web-hook.mjs`, hook: WEB_HOOK_COMMAND, detail: WEB_HOOK_DETAIL }));

  // relevo.yml
  if (facts.configText !== null) items.push(item('config', facts.config ? 'ok' : 'differs', facts.config ? 'relevo.yml exists and is valid' : `relevo.yml exists but is invalid: ${facts.configErrors.join('; ')}`));
  else items.push(item('config', 'todo', 'Create relevo.yml from the answers', { content: renderConfig(templates.config, { base, release, ...answers }) }));

  // profile files of the repository (init never commits them, the person does): the ones asked for, and one for each
  // stack the plugin does not ship, where the file is the whole profile, unless the person declined it
  const shipped = templates.shippedStacks ?? null;
  const isOwn = (stack) => shipped !== null && !shipped.includes(stack);
  const declined = answers.declinedStackProfiles ?? [];
  const ownStacks = [...new Set(Object.values(configuredPlatforms).map((p) => p?.stack).filter((stack) => stack && isOwn(stack) && !declined.includes(stack)))];
  [...new Set([...(answers.stackProfiles ?? []), ...ownStacks])].forEach((stack) => {
    const path = `.relevo/stacks/${stack}.md`;
    const own = isOwn(stack);
    if ((current.stackProfiles ?? {})[stack]) items.push(item(`stack-profile.${stack}`, 'ok', `${path} exists`));
    else items.push(item(`stack-profile.${stack}`, 'todo', own ? `Create ${path}, the profile of ${stack}, which the plugin does not ship: write its commands, then commit it (left for you to commit; /relevo:doctor warns until analyze and test exist)` : `Create ${path}, a commented profile that adds to the plugin's (left for you to commit)`, { path, content: stackProfileTemplate(stack, { own }) }));
  });

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

  // workflows: where go builds decides which ones are added (default: both the cloud and machines)
  const runs = answers.runs ?? 'both';
  const credential = answers.credential ?? 'api_key';
  if (!RUNS.includes(runs)) throw new Error(`runs must be one of ${RUNS.join(', ')} (got "${runs}")`);
  if (!CREDENTIALS.includes(credential)) throw new Error(`credential must be one of ${CREDENTIALS.join(', ')} (got "${credential}")`);
  const build = answers.agentBuild ?? 'claude';
  if (!AGENT_BUILDS.includes(build)) throw new Error(`agentBuild must be one of ${AGENT_BUILDS.join(', ')} (got "${build}")`);
  // The runner of the workflows: the setting of the repository, else the person's answer, else GitHub's.
  const runnerLabels = facts.config?.runner?.labels ?? answers.runnerLabels ?? DEFAULT_RUNNER;
  const cloudFiles = ['relevo-go.yml', 'relevo-queue.yml'];
  WORKFLOW_FILES.forEach((file) => {
    if (runs === 'local' && cloudFiles.includes(file)) return;
    const shared = file === 'relevo-go.yml' ? credentialLine(templates.workflows[file], credential) : templates.workflows[file];
    const wanted = runnerLine(agentWorkflow(shared, build, templates.agentBlocks), runnerLabels);
    const have = current.workflows[file] ?? null;
    // The state of the update is asked for only when the file exists and differs: it may need the network.
    const upgrade = () => (typeof upgrades === 'function' ? upgrades(file) : upgrades[file]);
    const up = have !== null && have !== wanted ? upgrade() : undefined;
    if (have === null) items.push(item(`workflow.${file}`, 'todo', `Add .github/workflows/${file}`, { path: `.github/workflows/${file}`, content: wanted }));
    else if (have === wanted) items.push(item(`workflow.${file}`, 'ok', `.github/workflows/${file} is up to date`));
    else if (up?.status === 'update') {
      items.push(item(`workflow.${file}`, 'todo', `Update .github/workflows/${file} from ${up.from} to ${up.to}, keeping your own changes`, { path: `.github/workflows/${file}`, content: up.text, diff: up.diff }));
    } else if (up?.status === 'current') items.push(item(`workflow.${file}`, 'ok', `.github/workflows/${file} is up to date (with your own changes)`));
    else if (up?.status === 'conflict') {
      const where = up.conflicts.length > 0 ? `${up.conflicts.length} place(s) changed by you and by the new template` : up.message;
      items.push(item(`workflow.${file}`, 'differs', `.github/workflows/${file} differs from the template and cannot be updated without a conflict (${where}); it is left as it is`, { conflicts: up.conflicts }));
    } else if (up?.status === 'nobase') {
      items.push(item(`workflow.${file}`, 'differs', `.github/workflows/${file} differs from the template and no published version is close to it; it is left as it is (name the version it came from with --from <version>)`));
    } else if (up?.status === 'error') {
      items.push(item(`workflow.${file}`, 'differs', `.github/workflows/${file} differs from the template and could not be checked for an update (${up.message}); it is left as it is`));
    } else {
      // The cloud build only passes QA when the build job installs the toolchain of the stack, which the template does.
      const toolchain = file === 'relevo-go.yml' ? '; check that its build job installs the toolchain of your stacks, as the template does for Flutter, Laravel and Supabase' : '';
      items.push(item(`workflow.${file}`, 'differs', `.github/workflows/${file} exists and differs from the template; it is left as it is (compare it by hand${toolchain})`));
    }
  });
  if (runs === 'local') items.push(item('execution', 'ok', 'go builds on each person\'s machine: the go and queue workflows are not added. Run /relevo:go <n>, or node scripts/go-local.mjs <n> to build in a separate worktree'));

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
  const secretName = credential === 'subscription' ? 'CLAUDE_CODE_OAUTH_TOKEN' : 'ANTHROPIC_API_KEY';
  if (runs === 'local') items.push(item('manual.api-key', 'ok', 'No model secret is needed in the repository: each person builds with their own Claude session'));
  else if (hasCredential) items.push(item('manual.api-key', 'ok', 'A model credential secret exists (init never reads it)'));
  else if (credential === 'subscription') items.push(item('manual.api-key', 'manual', `Create a token with \`claude setup-token\` (it prints it over two lines: remove all whitespace) and store it yourself as the secret ${secretName}; init never reads or writes it. Read the current Anthropic terms on automated use of a subscription first; the quota is shared with the interactive use of that account, which is why concurrent_agents is 1`));
  else items.push(item('manual.api-key', 'manual', `Create an API key in the Anthropic Console (a spending limit on its workspace is advisable) and store it yourself as the secret ${secretName}; init never reads or writes it`));
  const links = facts.config?.links ?? answers.links ?? [];
  if (links.length > 0) {
    if ((facts.secrets ?? []).includes('RELEVO_LINKS_TOKEN')) items.push(item('manual.links-token', 'ok', 'The RELEVO_LINKS_TOKEN secret exists (init never reads it)'));
    else items.push(item('manual.links-token', 'manual', `If ${links.join(', ')} ${links.length > 1 ? 'are' : 'is'} private, create a fine-grained token with read access to issues, pull requests and contents and store it yourself as the secret RELEVO_LINKS_TOKEN (init never reads or writes it; Relevo only reads with it, and public repositories need none)`));
  }
  if (hasSupabase) {
    items.push(item('manual.supabase-mcp', 'manual', 'To explore your Supabase database in Claude Code or Antigravity during /relevo:think, consider connecting the Supabase MCP server (see https://supabase.com/docs/guides/ai-tools)'));
  }
  items.push(item('manual.push', 'manual', 'Commit and push the new files to the default branch: a workflow only runs from there'));

  return items;
}

/** Plain-text plan, shown before anything is changed. */
export function renderPlan(items) {
  const tag = { ok: 'ok     ', todo: 'will do', differs: 'differs', manual: 'by hand' };
  const todo = items.filter((i) => i.status === 'todo').length;
  const indent = (text) => text.split('\n').map((l) => `          ${l}`);
  const lines = items.flatMap((i) => [
    `[${tag[i.status]}] ${i.description}${i.install ? ` (${i.command})` : ''}`,
    ...(i.diff ? indent(i.diff.trimEnd()) : []),
    ...(i.conflicts ?? []).flatMap((c) => [indent('yours:'), indent(c.yours), indent('the new template:'), indent(c.theirs)].flat()),
  ]);
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
          // A workflow is written only under .github/workflows/, whatever the item says.
          if (it.id.startsWith('workflow.') && !/^\.github\/workflows\/[\w.-]+\.yml$/.test(it.path)) throw new Error(`refusing to write ${it.path}: a workflow goes under .github/workflows/`);
          if (it.id.startsWith('workflow.') || it.id.startsWith('stack-profile.')) io.write(it.path, it.content);
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
