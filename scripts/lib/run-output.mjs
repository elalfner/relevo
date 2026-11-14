// Decides what a run prints and saves of the agent's output. Implements "The agent output of a run can be shown,
// redacted" and "The full output is refused for a public repository".
//
// `output`      print the redacted rendering of the agent log, with the results
// `transcript`  save the trimmed transcript when the run ends abnormally (commands only unless `output`)
// `refused`     the full output was asked for and refused, with its `reason`
// It fails closed: a configuration that cannot be read, or a public repository, prints and saves nothing.

const truthy = (v) => v === true || String(v ?? '').trim().toLowerCase() === 'true';

/**
 * config  the validated configuration, or null when relevo.yml is missing or invalid
 * input   the `full_output` input of a manual start ("true", "false", or nothing for a run started by a label)
 */
export function decideOutput({ config, input } = {}) {
  const asked = truthy(config?.run?.full_output) || truthy(input);
  if (!config) {
    return { output: false, transcript: false, refused: asked, reason: asked ? 'relevo.yml is missing or invalid, so the trust level is unknown' : null };
  }
  if (config.trust === 'public') {
    return { output: false, transcript: false, refused: asked, reason: asked ? 'trust is "public": the agent output may hold secrets and the artifacts of a public repository are readable by anyone' : null };
  }
  return { output: asked, transcript: true, refused: false, reason: null };
}
