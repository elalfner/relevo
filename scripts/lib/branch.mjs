// Branch and change names derived from an issue.

const MAX_SLUG = 40;

/** kebab-case slug of a title: ASCII only, at most 40 characters, cut at a word boundary. */
export function slugify(title, max = MAX_SLUG) {
  let slug = String(title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > max) {
    const midWord = slug[max] !== '-';
    slug = slug.slice(0, max);
    if (midWord && slug.includes('-')) slug = slug.replace(/-[^-]*$/, '');
    slug = slug.replace(/-+$/g, '');
  }
  return slug || 'task';
}

export const changeId = (number, title) => `${number}-${slugify(title)}`;
export const branchName = (number, title) => `feature/${changeId(number, title)}`;

/** The issue number a feature branch was made for (`feature/12-add-total` -> 12), or null. */
export function issueFromBranch(branch) {
  const m = /^feature\/(\d+)-/.exec(String(branch ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * What an existing feature branch holds, from the paths it changes against the base branch:
 * `empty` (nothing), `spec-only` (only the change specification, under openspec/changes/<change_id>/) or `implementation`.
 */
export function classifyBranchChanges(paths, id) {
  const changed = (paths ?? []).map((p) => String(p).trim()).filter(Boolean);
  if (changed.length === 0) return 'empty';
  const prefix = `openspec/changes/${id}/`;
  return changed.every((p) => p.startsWith(prefix)) ? 'spec-only' : 'implementation';
}

/** What to tell the person about a failed run on a branch that already exists: fix it, or start again. */
export const recoveryForBranch = (kind) => (kind === 'implementation' ? 'fix' : 'delete-branch');
