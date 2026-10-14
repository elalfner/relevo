// Checks a drafted issue before it is created, with the same rules `go` applies when it starts.
// Implements "Issues are checked before they are created" of openspec/changes/relevo-v1/specs/draft/spec.md.

import { parseIssueBody } from './issue-parse.mjs';
import { findCredentials } from './scan.mjs';

export const TITLE_MAX = 72;
// Text that only exists in templates/issue.md; finding it means the template was not filled in.
export const PLACEHOLDERS = ['<the situation>', '<the result a person can observe>', '<unusual input or state>', '<what must happen>', '#<number>'];
const PICTOGRAPH_RE = /\p{Extended_Pictographic}/u;

/** Returns { ok, problems: string[], scenarios, edgeCases, dependsOn } for a drafted title and body. */
export function checkIssueDraft({ title, body }) {
  const problems = [];
  const t = String(title ?? '').trim();
  if (!t) problems.push('the title is empty');
  if (PICTOGRAPH_RE.test(t)) problems.push('the title contains an emoji; titles are truncated in lists and boards, so keep them plain');
  if (t.length > TITLE_MAX) problems.push(`the title is ${t.length} characters; keep it at ${TITLE_MAX} or fewer`);

  const parsed = parseIssueBody(body);
  parsed.missing.forEach((m) => problems.push(`the body has no ${m}`));
  const left = PLACEHOLDERS.filter((p) => String(body ?? '').includes(p));
  if (left.length) problems.push(`the body still contains template text: ${left.join(', ')}`);
  findCredentials(String(body ?? '')).forEach(({ name }) => problems.push(`the body contains something that looks like a credential (${name}); issues are readable by everyone with access`));

  return { ok: problems.length === 0, problems, scenarios: parsed.scenarios, edgeCases: parsed.edgeCases, dependsOn: parsed.dependsOn };
}
