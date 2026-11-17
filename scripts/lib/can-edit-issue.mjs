// Decides whether the description of an issue may be rewritten.
// Implements "Only an issue Relevo has not committed to a build may be edited" of openspec/specs/issue/spec.md.
import { LABELS, resolveLabelNames } from './labels.mjs';

// Why each lifecycle label closes the issue to editing. `needs-spec` is the only one that leaves it open.
const REASON = {
  ready: 'the text is approved: editing it withdraws the approval, which can be given again after the edit',
  queued: 'go starts it by itself when there is capacity',
  blocked: 'go starts it by itself when its dependency merges',
  building: 'the agent is building from the current text; wait for it to finish or fail',
  built: 'a branch already exists and the text would no longer match what was built',
  'in-review': 'it is being reviewed against the current text',
  'pr-open': 'a pull request already exists for the current text',
  'build-failed': 'a branch already exists and the text would no longer match what was built',
  'changes-requested': 'a branch already exists and the text would no longer match what was built',
  'needs-reviewer': 'it is built and waiting for a reviewer',
  ship: 'its pull request is being merged',
  // Not a state: it travels next to one, so the state decides whether the text may change.
  urgent: 'the label asks for an early start and does not commit the issue to a build',
  // A request: the cloud was asked to build the current text.
  go: 'a build was requested for the current text; the cloud removes the label when it decides',
  // A mark next to `building`: `building` decides. Alone it means nothing.
  local: 'the label marks a local build and does not commit the issue to a build by itself',
};
export const EDITABLE_LABELS = ['needs-spec', 'urgent', 'local'];

/**
 * Three results: editable; refused, naming the label; or, for an issue that is `ready` with no `go` label, withdrawable: the
 * approval may be withdrawn (the `ready` label removed) to edit the text, and given again afterwards. An edit made with `ready`
 * still on would withdraw it anyway when the issue is about to be built, so withdrawing first keeps the label from saying something false.
 * @param {{state?: string, labels?: Array<string|{name: string}>}} issue  `gh issue view --json state,labels`
 * @param {Record<string,string>} [overrides]  the `labels` setting of relevo.yml
 * @returns {{editable: true} | {editable: false, label?: string, reason: string} | {editable: false, withdrawable: true, label: string, reason: string}}
 */
export function canEditIssue(issue, overrides = {}) {
  if (String(issue.state ?? '').toUpperCase() !== 'OPEN') return { editable: false, reason: 'the issue is closed' };
  const names = resolveLabelNames(overrides);
  const have = new Set((issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)));
  for (const { key } of LABELS) {
    if (key === 'ready' || EDITABLE_LABELS.includes(key) || !have.has(names[key])) continue;
    return { editable: false, label: names[key], reason: REASON[key] };
  }
  if (have.has(names.ready)) return { editable: false, withdrawable: true, label: names.ready, reason: REASON.ready };
  return { editable: true };
}
