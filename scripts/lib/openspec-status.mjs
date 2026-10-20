// Reads the JSON of `openspec status --change <id> --json`.
// Implements "The specification is complete before it is validated" of the go specification.

/** Artifacts that are neither done nor skipped, in the order OpenSpec lists them. */
export function pendingArtifacts(status) {
  return (status?.artifacts ?? []).filter((a) => !['done', 'skipped'].includes(a.status)).map((a) => a.id);
}

/**
 * Is the specification of the change complete? True when it has artifacts and every one is `done` or `skipped`
 * (a change that declares `skip_specs` has its specs artifact `skipped`, and that is complete).
 */
export function planningComplete(status) {
  const artifacts = status?.artifacts ?? [];
  return artifacts.length > 0 && pendingArtifacts(status).length === 0;
}
