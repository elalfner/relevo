// Checks a drafted issue before it is created, with the same rules `go` applies when it starts.
// Implements "Issues are checked before they are created" of openspec/specs/issue/spec.md.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_REFERENCES, parseIssueBody } from './issue-parse.mjs';
import { resolvePlatform } from './platform-of.mjs';
import { hardPathsInAllow, platformFolders } from './protected-paths.mjs';
import { findCredentials } from './scan.mjs';

export const TITLE_MAX = 72;
export const BODY_WARN = 8000;
// Text that only exists in templates/issue.md; finding it means the template was not filled in.
export const PLACEHOLDERS = ['<the situation>', '<the result a person can observe>', '<unusual input or state>', '<what must happen>', '<what is deliberately left out', '<dependency files the change may touch', '<name of a platform in relevo.yml>', '#<number>', '**<term>**', '<definition>', '<words to avoid>', '<decision title>', '<what was decided>', '<the reason>', '<the alternative', '<a concrete limit', '<path/to/file>', '<why it matters>', '<what only a person can check', '<an assumption', '<path/to/reference>', '<what must match>'];
const PICTOGRAPH_RE = /\p{Extended_Pictographic}/u;

/**
 * Returns { ok, problems: string[], warnings: string[], scenarios, edgeCases, dependsOn, allowPaths } for a drafted title and body.
 * `rulesFile` is the `qa.rules_from` file (or files) of the project, which can never be listed in an `Allow-paths:` line.
 * `platforms` is the registry of relevo.yml ({ name: { ... } }); when given, the platform of the draft is checked too.
 * `links` is the `links` list of relevo.yml: a `Depends-on:` that names a repository outside it is a problem.
 * `repoRoot` is the folder of the repository: a design reference to a file of the repository must exist under it
 * (when it is null the existence is not checked, as in the light planning job that has no checkout).
 */
export function checkIssueDraft({ title, body, rulesFile = null, platforms = null, links = [], repoRoot = null }) {
  const problems = [];
  const t = String(title ?? '').trim();
  if (!t) problems.push('the title is empty');
  if (PICTOGRAPH_RE.test(t)) problems.push('the title contains an emoji; titles are truncated in lists and boards, so keep them plain');
  if (t.length > TITLE_MAX) problems.push(`the title is ${t.length} characters; keep it at ${TITLE_MAX} or fewer`);

  const parsed = parseIssueBody(body);
  parsed.missing.forEach((m) => problems.push(`the body has no ${m}`));
  if (parsed.openQuestions.length > 0) problems.push(`the body has open questions (${parsed.openQuestions.length}): answer them or remove the "Open questions" section; the first is "${parsed.openQuestions[0].replace(/^[-*+]\s+/, '').slice(0, 80)}"`);
  if (parsed.needsClarification) problems.push('the body contains NEEDS CLARIFICATION: resolve it before the issue can be built');
  parsed.idProblems.forEach((p) => problems.push(p));
  parsed.design.problems.forEach((p) => problems.push(`Design reference: ${p}`));
  parsed.codePointers.problems.forEach((p) => problems.push(`Code pointers: ${p}`));
  const pointers = parsed.codePointers.references.length;
  const total = parsed.design.references.length + pointers;
  if (total > MAX_REFERENCES) {
    const counted = pointers > 0 ? `Design reference and the linked Code pointers have ${total} references together` : `Design reference has ${total} references`;
    problems.push(`${counted}; the most Relevo takes is ${MAX_REFERENCES}, so split the issue or keep the ones that matter`);
  }
  parsed.codePointers.references.forEach((ref) => {
    if (!links.includes(ref.repo)) problems.push(`Code pointers: "${ref.target}" names ${ref.repo}, which is not in links of relevo.yml (${links.length ? links.join(', ') : 'no repository is linked'})`);
  });
  parsed.design.references.forEach((ref) => {
    if (ref.kind === 'path' && repoRoot && !existsSync(join(repoRoot, ref.path))) problems.push(`Design reference: "${ref.target}" does not exist in the repository`);
    if (ref.kind === 'repo-file' && !links.includes(ref.repo)) problems.push(`Design reference: "${ref.target}" names ${ref.repo}, which is not in links of relevo.yml (${links.length ? links.join(', ') : 'no repository is linked'})`);
    if (ref.kind === 'attachment' && !ref.allowed) problems.push(`Design reference: ${ref.target} is not a GitHub attachment (github.com/user-attachments, user-images.githubusercontent.com)`);
  });
  const warnings = [];
  const size = String(body ?? '').length;
  if (size > BODY_WARN) warnings.push(`the body is ${size} characters; about ${BODY_WARN} or fewer reads better for an unattended build`);
  const left = PLACEHOLDERS.filter((p) => String(body ?? '').includes(p));
  if (left.length) problems.push(`the body still contains template text: ${left.join(', ')}`);
  findCredentials(String(body ?? '')).forEach(({ name }) => problems.push(`the body contains something that looks like a credential (${name}); issues are readable by everyone with access`));
  hardPathsInAllow(parsed.allowPaths, { rulesFile, platformPaths: platformFolders(platforms) }).forEach((entry) => problems.push(`Allow-paths lists "${entry}", which can never be allowed: workflows, the Relevo configuration, skills and the project rules are not changed by an unattended run`));

  parsed.dependsOnInvalid.forEach((token) => problems.push(`Depends-on has "${token}", which is not a reference; write #12 for an issue of this repository or owner/repo#12 for one of a linked repository`));
  [...new Set(parsed.dependsOnExternal.map((d) => d.repo))].filter((repo) => !links.includes(repo)).forEach((repo) => {
    problems.push(`Depends-on names ${repo}, which is not in links of relevo.yml (${links.length ? links.join(', ') : 'no repository is linked'})`);
  });

  if (platforms) {
    const r = resolvePlatform({ platforms, body });
    if (!r.ok) problems.push(r.reason === 'missing' ? `the body has no ${r.message}` : r.message);
  }

  return { ok: problems.length === 0, problems, warnings, scenarios: parsed.scenarios, edgeCases: parsed.edgeCases, dependsOn: parsed.dependsOn, dependsOnExternal: parsed.dependsOnExternal, allowPaths: parsed.allowPaths };
}
