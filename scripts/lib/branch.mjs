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
