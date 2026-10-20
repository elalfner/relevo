// Where `go` builds. Implements the "execution-modes" specification: nothing is stored in relevo.yml, the mode is
// derived from what is installed, the secrets that exist and a repository variable.

export const API_KEY_SECRET = 'ANTHROPIC_API_KEY';
export const SUBSCRIPTION_SECRET = 'CLAUDE_CODE_OAUTH_TOKEN';
export const CLOUD_VARIABLE = 'RELEVO_CLOUD_GO';

/**
 * The credential mode from the names of the repository secrets:
 * { mode: 'api_key' | 'subscription' | 'both' | 'none', usable: boolean }.
 */
export function credentialMode(secretNames = []) {
  const key = secretNames.includes(API_KEY_SECRET);
  const token = secretNames.includes(SUBSCRIPTION_SECRET);
  if (key && token) return { mode: 'both', usable: true };
  if (key) return { mode: 'api_key', usable: true };
  if (token) return { mode: 'subscription', usable: true };
  return { mode: 'none', usable: false };
}

/** Does the cloud build? The go workflow is on the default branch and the variable is not `off`. */
export function cloudBuilds({ workflowPresent, variable = null }) {
  return Boolean(workflowPresent) && String(variable ?? '').trim().toLowerCase() !== 'off';
}
