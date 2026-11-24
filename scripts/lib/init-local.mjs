// `init --local`: the setup of a project of one person on this machine, with no GitHub. Like planInit, planLocalInit is pure and
// idempotent: it compares the facts with what a local project looks like and lists only what differs, so a second run says that
// nothing needs to change. It asks for nothing from GitHub and installs no workflow, label or ruleset.
// Implements "Init can set up a local project" and "Init asks no question the setup can answer" (change local-tracker).

import { loadConfig } from './config.mjs';
import { OPENSPEC_INSTALL, REQUIRED_SKILLS, SKILL_INSTALL } from './doctor.mjs';
import { platformsBlock } from './init.mjs';

export const ISSUES_KEEP = '.relevo/issues/.gitkeep';
export const DEFAULT_COST = 5;
const item = (id, status, description, extra = {}) => ({ id, status, description, ...extra });

/** The relevo.yml of a local project: one person, `files`, the prototype depth and a cost limit for an unattended run. */
export function renderLocalConfig({ base, cost, language, platforms }) {
  return [
    '# relevo.yml: one per repository. `/relevo:init --local` created it for a project of one person on this machine.',
    '# Validate it with: node scripts/validate-config.mjs relevo.yml',
    '',
    'branches:',
    `  base: ${base}`,
    '',
    'tracker: files          # issues are files under .relevo/issues/; no GitHub',
    'git_provider: local     # a built issue is merged into the base branch locally',
    'depth: prototype        # standard | prototype: prototype lowers the default effort and the questions of think; all five QA lenses run at both',
    platformsBlock(platforms).trimEnd(),
    'limits:',
    `  run_max_cost: ${cost}      # US dollars per unattended run`,
    `language: ${language}`,
    '',
  ].join('\n');
}

/**
 * @param {{ facts: { isRepo: boolean, hasCommit: boolean, branch: string|null, configText: string|null, config: object|null,
 *   issuesKeep: boolean, gitignoreText: string|null, openspec: string|null, openspecRoot: boolean, skills: Record<string, boolean> },
 *   answers: { platforms?: object, cost?: number, language?: string, base?: string } }} input
 * @returns {{ items: object[], questions: string[], blocked: boolean }}  `questions` are the answers the plan still needs.
 */
export function planLocalInit({ facts, answers = {} }) {
  const items = [];
  const questions = [];

  if (facts.configText !== null && facts.config?.tracker !== 'files') {
    items.push(item('config.conflict', 'warning', 'relevo.yml exists and is not a local project (tracker is not "files"): `--local` changes nothing. Set `tracker: files` and `git_provider: local` yourself, or run it in another folder.'));
    return { items, questions, blocked: true };
  }

  const base = facts.hasCommit && facts.branch ? facts.branch : (answers.base ?? 'main');
  if (!facts.isRepo) items.push(item('git.init', 'todo', 'Create the git repository (branch main)', { command: 'git init -b main' }));
  else items.push(item('git.init', 'ok', 'This folder is a git repository'));

  if (facts.configText !== null) {
    items.push(facts.config ? item('config.write', 'ok', 'relevo.yml is a local project') : item('config.write', 'warning', 'relevo.yml is invalid: run `node scripts/validate-config.mjs relevo.yml` and fix what it names'));
  } else {
    const platforms = answers.platforms;
    const cost = answers.cost ?? null;
    if (!platforms || Object.keys(platforms).length === 0) questions.push('platforms');
    if (cost === null) questions.push('cost');
    if (questions.length === 0) {
      const text = renderLocalConfig({ base, cost, language: answers.language ?? 'en', platforms });
      const check = loadConfig(text);
      if (!check.ok) throw new Error(`the relevo.yml of a local project is not valid: ${check.errors.map((e) => e.message).join('; ')}`);
      items.push(item('config.write', 'todo', `Write relevo.yml (tracker files, base branch ${base}, depth prototype)`, { path: 'relevo.yml', text }));
    }
  }

  items.push(facts.issuesKeep ? item('issues.dir', 'ok', '.relevo/issues/ exists') : item('issues.dir', 'todo', 'Create .relevo/issues/ for the issues', { path: ISSUES_KEEP }));

  const ignored = (facts.gitignoreText ?? '').split('\n').some((l) => /^\/?evidence\/?$/.test(l.trim()));
  items.push(ignored ? item('gitignore.evidence', 'ok', 'evidence/ is ignored by git') : item('gitignore.evidence', 'todo', 'Ignore evidence/ in .gitignore (a review puts screenshots there)', { path: '.gitignore', line: 'evidence/' }));

  if (!facts.openspec) items.push(item('install.openspec', 'todo', 'Install the OpenSpec command-line tool', { install: true, command: 'npm install --global @fission-ai/openspec', detail: OPENSPEC_INSTALL }));
  else if (!facts.openspecRoot) items.push(item('install.openspec-init', 'todo', 'Set OpenSpec up in this project', { install: true, command: 'openspec init', detail: 'creates openspec/, where the specification of each build is written; commit it afterwards' }));
  REQUIRED_SKILLS.filter((n) => !facts.skills[n]).forEach((n) => items.push(item(`install.skill.${n}`, 'todo', `Install the ${n} skill`, { install: true, command: SKILL_INSTALL[n], detail: SKILL_INSTALL[n] })));

  // A repository with no commit has no base branch yet: the first commit holds what was just written, and nothing else.
  if (!facts.hasCommit) items.push(item('git.commit', 'todo', 'Make the first commit with relevo.yml and .relevo/issues/', { message: 'chore: set up Relevo' }));
  else items.push(item('git.commit', 'ok', `The base branch ${base} has commits (commit relevo.yml yourself when you are ready)`));

  return { items, questions, blocked: false };
}

/**
 * Carry out the `todo` items that are not installs, in order. `io`: git(args), write(path, text), append(path, line), mkdir(path).
 * Returns [{ id, ok, message }]. Stops at the first failure so that a half-made setup is never committed.
 */
export function applyLocalPlan(items, { io }) {
  const results = [];
  for (const it of items.filter((i) => i.status === 'todo' && !i.install)) {
    try {
      if (it.id === 'git.init') io.git(['init', '-q', '-b', 'main']);
      else if (it.id === 'config.write') io.write(it.path, it.text);
      else if (it.id === 'issues.dir') { io.mkdir('.relevo/issues'); io.write(it.path, ''); }
      else if (it.id === 'gitignore.evidence') io.append(it.path, it.line);
      else if (it.id === 'git.commit') {
        io.git(['add', '--', 'relevo.yml', ISSUES_KEEP, '.gitignore']);
        io.git(['commit', '-q', '-m', it.message]);
      }
      results.push({ id: it.id, ok: true, message: it.description });
    } catch (error) {
      results.push({ id: it.id, ok: false, message: `${it.description}: ${String(error.stderr ?? error.message).trim().split('\n')[0]}` });
      break;
    }
  }
  return results;
}
