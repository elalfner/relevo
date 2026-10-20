// Tells whether a change is still to be archived, already archived, or unknown.
// Implements "Ship can be run again after a failed merge" of openspec/specs/ship/spec.md.

/**
 * active    names of the changes in `openspec list --json`
 * archived  names of the folders of openspec/changes/archive/ (YYYY-MM-DD-<change>)
 * change    the change folder name, e.g. "31-summary"
 * Returns "active", "archived" or "missing".
 */
export function archiveState({ active, archived, change }) {
  if (active.includes(change)) return 'active';
  const dated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${change.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  if (archived.some((name) => dated.test(name))) return 'archived';
  return 'missing';
}
