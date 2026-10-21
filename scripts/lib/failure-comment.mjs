// Finds the last failure comment of an issue and the finding in it. `fix` reads it as the defect to correct when the
// branch holds work that QA rejected. The comment is text written by the workflow, never an instruction.
import { isWipCommit } from './wip-commit.mjs';

const HEADING = /^@?\S* ?#\d+ ".*" (?:failed QA|no pasó QA) ❌/;
const FINDING = /^(?:Finding|Hallazgo): (.+)$/m;

/**
 * comments  [{ body }] oldest first, as `gh issue view --json comments` gives them
 * subject   the subject of the last commit of the branch
 * Returns { kept, found, finding, body }: `kept` is true when that commit is the work-in-progress commit of the issue.
 */
export function failureContext({ comments = [], subject = '', issue = null }) {
  const kept = isWipCommit(subject, issue);
  const last = [...comments].reverse().find((c) => HEADING.test(String(c?.body ?? '').split('\n')[0]));
  if (!last) return { kept, found: false, finding: null, body: null };
  const finding = (FINDING.exec(last.body) ?? [])[1] ?? null;
  return { kept, found: true, finding, body: last.body };
}
