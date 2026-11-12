// The merged change of the issue named by `Pattern: #N`: the template that a replicated build copies. Implements "The pattern
// change is found before building" of the issue specification.
//
// The client is injected (`gh(args) -> stdout`, like scripts/lib/github.mjs) so everything here is testable without a network.
// Not yet exercised against the live API: verify in the first pilot.
//
// A change counts as the change of the issue when a pull request that was merged into the base branch cross-references the
// issue and was merged when the issue was closed (the merge closes it; a later pull request that only mentions the issue
// does not count).

export const MAX_DIFF_BYTES = 200 * 1024;
// How far apart the merge and the closing of the issue may be and still be the same event.
export const CLOSE_WINDOW_MS = 120 * 1000;

const json = (gh, path, { paginate = false } = {}) => {
  const args = ['api'];
  if (paginate) args.push('--paginate', '--slurp');
  args.push(path);
  const data = JSON.parse(gh(args));
  return paginate ? data.flat() : data;
};

const notFound = (error) => /404|Not Found/i.test(String(error?.stderr ?? error?.message ?? ''));

/**
 * repo     owner/name
 * number   the issue named by the pattern
 * base     the base branch the change must have been merged into
 * gh       the client
 *
 * Returns { state, detail, pr?, sha?, files?, diff?, truncated? } with `state`:
 *   merged       the change was found: `pr`, `sha`, `files` (the paths it changed) and `diff` (its text, up to MAX_DIFF_BYTES)
 *   not-merged   the issue exists but no merged change closed it into the base branch
 *   missing      there is no such issue in the repository (a pull request is not an issue)
 *   unknown      the lookup failed (the build goes on and lists the pattern as unverified)
 */
export function findPatternChange({ repo, number, base, gh }) {
  let issue;
  try {
    issue = json(gh, `repos/${repo}/issues/${number}`);
  } catch (error) {
    if (notFound(error)) return { state: 'missing', detail: `#${number} does not exist in ${repo}` };
    return { state: 'unknown', detail: `#${number} could not be read: ${String(error.message).slice(0, 120)}` };
  }
  if (issue.pull_request) return { state: 'missing', detail: `#${number} is a pull request, not an issue` };
  if (issue.state !== 'closed') return { state: 'not-merged', detail: `#${number} is still open, so its change is not merged` };

  try {
    const closedAt = Date.parse(issue.closed_at ?? '');
    const timeline = json(gh, `repos/${repo}/issues/${number}/timeline?per_page=100`, { paginate: true });
    const candidates = [...new Set(timeline
      .filter((e) => e.event === 'cross-referenced' && e.source?.issue?.pull_request?.merged_at)
      .map((e) => e.source.issue.number))];
    let found = null;
    for (const n of candidates) {
      const pull = json(gh, `repos/${repo}/pulls/${n}`);
      const mergedAt = Date.parse(pull.merged_at ?? '');
      if (!pull.merged_at || pull.base?.ref !== base) continue;
      if (Number.isFinite(closedAt) && Math.abs(closedAt - mergedAt) > CLOSE_WINDOW_MS) continue;
      if (!found || mergedAt > found.mergedAt) found = { pull, mergedAt, number: n };
    }
    if (!found) return { state: 'not-merged', detail: `#${number} is closed, but no pull request merged into ${base} closed it` };
    const files = json(gh, `repos/${repo}/pulls/${found.number}/files?per_page=100`, { paginate: true });
    const { diff, truncated } = renderDiff(files);
    return { state: 'merged', detail: `the change of #${number} is #${found.number}`, pr: found.number, sha: found.pull.merge_commit_sha ?? null, files: files.map((f) => f.filename), diff, truncated };
  } catch (error) {
    return { state: 'unknown', detail: `the change of #${number} could not be read: ${String(error.message).slice(0, 120)}` };
  }
}

/** The text of the change from the `patch` of each file, capped; a file whose patch is absent (binary, too large) is named only. */
export function renderDiff(files) {
  let out = '';
  let truncated = false;
  for (const f of files) {
    const part = `--- ${f.filename}\n${f.patch ?? '(no text diff: binary or too large)'}\n`;
    if (Buffer.byteLength(out) + Buffer.byteLength(part) > MAX_DIFF_BYTES) {
      truncated = true;
      break;
    }
    out += part;
  }
  return { diff: out, truncated };
}

/** The line of the build-preflight finding for a pattern that is not usable; null when it is. */
export function patternFinding(number, result) {
  if (result.state === 'merged' || result.state === 'unknown') return null;
  return { kind: 'input', input_kind: 'pattern', name: `#${number}`, detail: result.state === 'missing' ? 'the pattern issue does not exist' : 'the change of the pattern is not merged yet' };
}
