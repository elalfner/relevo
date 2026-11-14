// The checks that need no model, before a build spends one. Implements the preflight requirements of the go
// specification ("Inputs that the issue declares are checked before the agent starts", "A refused reference ends the
// run before the agent starts", "The specification is checked before the developer agent runs") and the next-step
// reasons `missing`, `inputs` and `policy` of the issue-lifecycle specification.
//
// Two stages: `issue` runs in the build job before the agent starts and reads what the issue says; `spec` runs inside
// `go` after the specification is written and reads the task lines of `tasks.md`.
//
// This is an optimisation, never a control: every rule it applies is applied again by the guard that already enforces
// it (the commit script, the restricted-file scan, QA). A defect here costs a build or a late rejection, and cannot
// let a protected change through.

import { parseExternalInputs, parseIssueBody } from './issue-parse.mjs';
import { checkProtected, isSoftProtected, matchesGlob } from './protected-paths.mjs';
import { checkRestricted, restrictedList } from './restricted-paths.mjs';
import { conflictText, findConflicts } from './rule-conflicts.mjs';
import { patternFinding } from './pattern.mjs';
import { checkRecipe } from './replica-plan.mjs';
import { assumedLine, externalAssumptions, settleAssumptions } from './assumptions.mjs';

export const REASONS = { references: 'missing', inputs: 'inputs', policy: 'policy', conflict: 'conflict' };

// ---------------------------------------------------------------- stage: issue

/**
 * body        the text of the issue
 * manifest    the manifest of the fetcher ({ files, refused }) or null when the references were not fetched
 * exists      (path) => boolean: does the file exist on the base branch?
 * env         the environment of the step, where a secret is present only if the workflow chose to expose it
 * variables   the names of the variables of the repository (a list), or null when they are not known
 * pattern     { number, result } of the issue's `Pattern: #N` (result from findPatternChange), or null when it was not looked up
 * rules       the lines of the rules files (parseRules of each), to find an issue that contradicts a rule; [] when there is none
 *
 * Returns { decision: 'ok' | 'needs-spec', reason, findings, unverified }. `unverified` lists the inputs that a person
 * has to confirm: the manual ones and the ones this job cannot check. A value of a secret is never read or returned.
 */
export function checkIssueStage({ body, manifest = null, exists = () => true, env = {}, variables = null, rules = [], pattern = null }) {
  const findings = [];
  const unverified = [];
  const { inputs } = parseExternalInputs(body);

  (manifest?.refused ?? []).forEach((r) => {
    const isInput = inputs.some((i) => i.kind === 'link' && i.name === r.reference);
    findings.push({ kind: isInput ? 'input' : 'reference', input_kind: isInput ? 'link' : undefined, name: r.reference, detail: r.reason });
  });

  inputs.forEach((input) => {
    if (input.kind === 'file') {
      if (!exists(input.name)) findings.push({ kind: 'input', input_kind: 'file', name: input.name, detail: 'the file does not exist on the base branch' });
    } else if (input.kind === 'link') {
      const fetched = (manifest?.files ?? []).some((f) => f.reference === input.name);
      const refused = (manifest?.refused ?? []).some((r) => r.reference === input.name);
      // Without a manifest the file was never fetched, so this job cannot say that it can be read.
      if (!fetched && !refused) unverified.push({ kind: 'link', name: input.name, purpose: input.purpose });
    } else if (input.kind === 'variable') {
      if (variables === null) unverified.push({ kind: 'variable', name: input.name, purpose: input.purpose });
      else if (!variables.includes(input.name)) findings.push({ kind: 'input', input_kind: 'variable', name: input.name, detail: 'the variable is not set in the repository' });
    } else if (input.kind === 'secret') {
      // The list of secrets cannot be read safely from a job, so a secret counts only when the workflow exposed it.
      if (!(typeof env[input.name] === 'string' && env[input.name] !== '')) unverified.push({ kind: 'secret', name: input.name, purpose: input.purpose });
    } else {
      unverified.push({ kind: 'manual', name: input.name, purpose: input.purpose });
    }
  });

  // The pattern: a line that cannot be used, or a change that is not merged or does not exist, is an input that is not available.
  parseIssueBody(body).patternProblems.forEach((detail) => findings.push({ kind: 'input', input_kind: 'pattern', name: 'Pattern:', detail }));
  if (pattern) {
    const finding = patternFinding(pattern.number, pattern.result);
    if (finding) findings.push(finding);
    else if (pattern.result.state === 'unknown') unverified.push({ kind: 'pattern', name: `#${pattern.number}`, purpose: pattern.result.detail });
  }

  const found = findConflicts({ body, rules });
  // Only a rule blocks; a scenario that the words say needs an excluded line is a note, because the words alone are not reliable enough to stop a build.
  found.conflicts.filter((c) => c.kind === 'rule').forEach((c) => findings.push({ kind: 'conflict', detail: conflictText(c) }));
  const notes = found.conflicts.filter((c) => c.kind === 'scenario').map(conflictText);
  found.problems.forEach((detail) => findings.push({ kind: 'conflict', detail }));

  const hasReference = findings.some((f) => f.kind === 'reference');
  const hasInput = findings.some((f) => f.kind === 'input');
  const reason = findings.length === 0 ? null : hasReference ? REASONS.references : hasInput ? REASONS.inputs : REASONS.conflict;
  return { decision: findings.length === 0 ? 'ok' : 'needs-spec', reason, findings, unverified, notes };
}

// ---------------------------------------------------------------- stage: spec

const TASK_LINE = /^\s*[-*+]\s+\[[ xX]\]\s+(.*)$/;
// Backticked text, or a path with a slash, or a file name with an extension that a repository file can have.
const TOKEN = /`([^`\n]+)`|((?:\.{0,2}\/)?[\w@.\-]+(?:\/[\w@.\-]+)+\/?)|((?:^|(?<=[\s(]))\.env[\w.\-]*|\b[\w.\-]+\.(?:md|json|ya?ml|lock|toml|xml|mjs|cjs|js|ts|dart|php|gradle|txt|pem|key|p12|pfx|crt|cer)\b)/g;
const VERBS = /\b(?:add(?:s|ed|ing)?|edit(?:s|ed|ing)?|chang(?:e|es|ed|ing)|updat(?:e|es|ed|ing)|creat(?:e|es|ed|ing)|writ(?:e|es|ing)|wrote|replac(?:e|es|ed|ing)|modif(?:y|ies|ied|ying)|delet(?:e|es|ed|ing)|remov(?:e|es|ed|ing)|renam(?:e|es|ed|ing)|append(?:s|ed|ing)?|fix(?:es|ed|ing)?|configur(?:e|es|ed|ing)|rewrit(?:e|es|ing)|rewrote|touch(?:es|ed|ing)?|bump(?:s|ed|ing)?)\b|\b(?:edit|cambi|actualiz|a[ñn]ad|agreg|cre[aoó]|escrib|reemplaz|modific|borr|elimin|renombr|corrig|configur|reescrib)\w*/iu;
const DEPENDENCY = /\b(?:npm\s+(?:i|install)|pnpm\s+add|yarn\s+add|composer\s+require|(?:flutter|dart)\s+pub\s+add|pip\s+install|add(?:ing)?\s+(?:\S+\s+){0,3}?(?:dependenc|package|librar)|install(?:ing)?\s+(?:\S+\s+){0,3}?(?:package|librar|dependenc)|(?:a[ñn]ad|agreg|instal)\w*\s+(?:la\s+|una\s+|el\s+|nueva\s+)*(?:dependencia|paquete|librer[ií]a))/iu;

const cleanToken = (text) => String(text).trim().replace(/^[("'`]+|[)"'`.,;:]+$/g, '').replace(/^\.\//, '');
const looksLikePath = (token) => token !== '' && !/\s/.test(token) && !/^https?:/i.test(token) && (token.includes('/') || token.startsWith('.env') || /\.[A-Za-z0-9]{1,5}$/.test(token));

// A phrase that points to where a rule or an example comes from ends the part of the line that says what is changed.
const REFERENCE_PHRASE = /,?\s+(?:as|per|according to|following|see|seg[uú]n|como)\s/i;

/** The path-like tokens of a task line that come after a verb that changes something, up to a phrase that only points to a source. */
export function changedPaths(line) {
  const verb = VERBS.exec(line);
  if (!verb) return [];
  let after = line.slice(verb.index + verb[0].length);
  const cut = REFERENCE_PHRASE.exec(after);
  if (cut) after = after.slice(0, cut.index);
  return [...after.matchAll(TOKEN)].map((m) => cleanToken(m[1] ?? m[2] ?? m[3])).filter(looksLikePath);
}

/** Every path-like token of a line, changed or not: for a reader that wants the paths a line names. */
export const pathTokens = (line) => [...String(line).matchAll(TOKEN)].map((m) => cleanToken(m[1] ?? m[2] ?? m[3])).filter(looksLikePath);

/**
 * tasksText    the text of tasks.md
 * allow        the entries of `Allow-paths:` of the issue
 * rulesFile    qa.rules_from (a name or a list)
 * platformPaths  the folders of the platforms (platformFolders)
 * restricted   the list of restricted files (restrictedList)
 * designText   the text of design.md, to list the assumptions about names outside the repository that `search` does not find
 * search       (name) => path or null over the files of the repository (assumptions.mjs repoSearch); without it the assumptions are not read
 * exists       (name) => boolean: is the name a file of the repository?
 * hasPattern   the issue has a valid `Pattern: #N` line (the recipe of tasks.md may name `pattern` as its template)
 *
 * Returns { decision, reason, findings, assumptions, assumed } where a finding is { kind: 'path' | 'dependency', task, path?, tier?, rule? }.
 * Only the task lines are read, and only a path that follows a verb that changes something counts: a file that a
 * task reads, or that the design only mentions, does not stop the build.
 */
export function checkSpecStage({ tasksText, allow = [], rulesFile = null, platformPaths = [], restricted = restrictedList(), designText = '', search = null, exists = () => false, hasPattern = false }) {
  const findings = [];
  String(tasksText ?? '').split('\n').forEach((raw) => {
    const m = TASK_LINE.exec(raw);
    if (!m) return;
    const task = m[1].trim();
    const paths = changedPaths(task);
    const protectedViolations = checkProtected(paths, { allow, rulesFile, platformPaths }).violations;
    protectedViolations.forEach((v) => findings.push({ kind: 'path', task, path: v.path, tier: v.tier, rule: v.rule }));
    checkRestricted(paths, restricted).violations.forEach((v) => findings.push({ kind: 'path', task, path: v.path, tier: 'restricted', rule: v.rule }));
    const namesManifest = paths.some(isSoftProtected);
    if (!namesManifest && DEPENDENCY.test(task) && !allow.some((entry) => ['package.json', 'composer.json', 'pubspec.yaml', 'Gemfile'].some((f) => matchesGlob(f, entry)))) {
      findings.push({ kind: 'dependency', task });
    }
  });
  // The recipe of a replicated build: a replica task without its rename map or differences sends the issue back (reason `missing`).
  const recipe = checkRecipe(tasksText, { hasPattern });
  recipe.problems.forEach((detail) => findings.push({ kind: 'recipe', detail }));
  // An assumption never changes the decision: a lexical match is not reliable enough to stop a build. It goes to the hand-off.
  const assumptions = search ? settleAssumptions(externalAssumptions(designText), { search, exists }).confirm : [];
  return { decision: findings.length === 0 ? 'ok' : 'needs-spec', reason: findings.length === 0 ? null : findings.every((f) => f.kind === 'recipe') ? 'missing' : REASONS.policy, findings, assumptions, assumed: assumedLine(assumptions) };
}

// ---------------------------------------------------------------- text for the comment

/** The "what is missing" text of the needs-spec comment: one line per finding, in English, with the reason of each. */
export function missingText(result) {
  const lines = result.findings.map((f) => {
    if (f.kind === 'reference') return `${f.name}: ${f.detail}`;
    if (f.kind === 'conflict') return f.detail;
    if (f.kind === 'recipe') return `replication recipe: ${f.detail}`;
    if (f.kind === 'input') return `External input ${f.input_kind} \`${f.name}\`: ${f.detail}`;
    if (f.kind === 'dependency') return `task "${f.task}" adds a dependency, but the issue has no Allow-paths: line for its manifest`;
    const why = f.tier === 'soft' ? 'a dependency file that the issue does not allow in Allow-paths:' : f.tier === 'restricted' ? 'a restricted file that no run reads or changes' : `a protected path (${f.rule}) that an unattended run never changes`;
    return `task "${f.task}" changes ${f.path}, ${why}`;
  });
  return lines.join('; ');
}

/** The part of an issue that a stage needs, for callers that have only the body. */
export const allowPathsOf = (body) => parseIssueBody(body).allowPaths;
