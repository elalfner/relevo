// Whether Relevo understands the schema of a change. Implements "A build stops on a schema it does not understand" of the go
// specification.
//
// Relevo reads `tasks.md` as the `spec-driven` schema of OpenSpec defines it (sections `## N.`, tasks `- [ ] N.M`, tracked by
// `apply.tracks: tasks.md`). Another schema may track other files in another shape, and the groups and the progress would be
// wrong without a message. The two facts come from the apply instructions that `go` already asks OpenSpec for:
// `schemaName` and `taskTrackingConfigured`. A field that is missing is an answer Relevo does not understand, never a pass.
//
// An optimisation, as the build preflight is: the build also fails later if the tasks cannot be read.

export const SUPPORTED_SCHEMA = 'spec-driven';

/**
 * instructions  the parsed output of `openspec instructions apply --change <id> --json`
 * Returns { ok: true, schema } or { ok: false, schema, reason, detail } where `reason` is the reason of the failure path.
 */
export function checkApplySchema(instructions) {
  const schema = typeof instructions?.schemaName === 'string' && instructions.schemaName !== '' ? instructions.schemaName : null;
  if (schema !== SUPPORTED_SCHEMA) {
    const named = schema ?? 'unknown';
    return {
      ok: false,
      schema: named,
      reason: `unsupported schema: ${named}`,
      detail: `the change uses the OpenSpec schema "${named}"; Relevo builds only with "${SUPPORTED_SCHEMA}": set \`schema: ${SUPPORTED_SCHEMA}\` in openspec/config.yaml`,
    };
  }
  if (instructions.taskTrackingConfigured !== true) {
    return {
      ok: false,
      schema,
      reason: 'unsupported schema: task tracking is not configured',
      detail: `OpenSpec reports that the schema "${schema}" does not track the tasks of the change, so the progress and the groups cannot be read`,
    };
  }
  return { ok: true, schema };
}

/**
 * The default schema that `openspec/config.yaml` names, read from its text.
 * A full YAML parse is not used on purpose: the file usually holds block scalars (`context: |`), which the small parser of Relevo
 * does not read, and the key is always at column 0, so a line that starts with `schema:` cannot be inside one.
 * Returns { state: 'default' } when there is no `schema` line (OpenSpec's own default, `spec-driven`, applies),
 * { state: 'named', schema } for a plain name, and { state: 'unreadable' } for a line whose value is empty or is not a plain name.
 */
export function schemaFromConfigText(text) {
  const line = String(text ?? '').split('\n').map((l) => l.replace(/\r$/, '')).find((l) => /^schema\s*:/.test(l));
  if (line === undefined) return { state: 'default', schema: SUPPORTED_SCHEMA };
  const value = line.replace(/^schema\s*:/, '').replace(/\s+#.*$/, '').trim().replace(/^(["'])(.*)\1$/, '$2');
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) ? { state: 'named', schema: value } : { state: 'unreadable' };
}
