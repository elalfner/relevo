// Decides whether the description of an issue may be rewritten.
// Implements "Only an issue Relevo has not committed to a build may be edited" of openspec/specs/issue/spec.md.
import { LABELS, resolveLabelNames } from './labels.mjs';

// Why each lifecycle label closes the issue to editing. `needs-spec` is the only one that leaves it open.
const REASON = {
  ready: 'go starts it by itself, so the new text would be built without anyone rereading it',
  queued: 'go starts it by itself when there is capacity',
  blocked: 'go starts it by itself when its dependency merges',
  building: 'the agent is building from the current text; wait for it to finish or fail',
  built: 'a branch already exists and the text would no longer match what was built',
  'in-review': 'it is being reviewed against the current text',
  'pr-open': 'a pull request already exists for the current text',
  'qa-failed': 'a branch already exists and the text would no longer match what was built',
  'changes-requested': 'a branch already exists and the text would no longer match what was built',
  'needs-reviewer': 'it is built and waiting for a reviewer',
  ship: 'its pull request is being merged',
};
export const EDITABLE_LABELS = ['needs-spec'];

/**
 * @param {{state?: string, labels?: Array<string|{name: string}>}} issue  `gh issue view --json state,labels`
 * @param {Record<string,string>} [overrides]  the `labels` setting of relevo.yml
 * @returns {{editable: true} | {editable: false, label?: string, reason: string}}
 */
export function canEditIssue(issue, overrides = {}) {
  if (String(issue.state ?? '').toUpperCase() !== 'OPEN') return { editable: false, reason: 'the issue is closed' };
  const names = resolveLabelNames(overrides);
  const have = new Set((issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)));
  for (const { key } of LABELS) {
    if (EDITABLE_LABELS.includes(key) || !have.has(names[key])) continue;
    return { editable: false, label: names[key], reason: REASON[key] };
  }
  return { editable: true };
}
