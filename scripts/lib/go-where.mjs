// Where `/relevo:go` runs, and whether the cloud can build. Implements "Go does not build in a remote session" of the
// web-sessions specification: a session of Claude Code on the web builds nothing; it may only offer the build request.

import { isRemote } from './gh-web.mjs';
import { cloudBuilds, credentialMode } from './execution-mode.mjs';

const GEMINI_SECRET = 'GEMINI_API_KEY';

/**
 * Whether the cloud can answer a `go` label: the go workflow is on the default branch, a model credential exists and
 * RELEVO_CLOUD_GO is not `off`. `secrets` is null when the names could not be read (they need admin access): the credential
 * is then unknown, not missing, and the go workflow itself says so on the issue if it is missing.
 * Returns { builds, reason: null | 'no_workflow' | 'no_credential' | 'paused', credential: 'present' | 'missing' | 'unknown' }.
 */
export function cloudState({ workflowPresent, secrets = null, variable = null, agentBuild = 'claude' }) {
  const credential = !Array.isArray(secrets)
    ? 'unknown'
    : (agentBuild === 'antigravity' ? secrets.includes(GEMINI_SECRET) : credentialMode(secrets).usable) ? 'present' : 'missing';
  if (!workflowPresent) return { builds: false, reason: 'no_workflow', credential };
  if (!cloudBuilds({ workflowPresent, variable })) return { builds: false, reason: 'paused', credential };
  if (credential === 'missing') return { builds: false, reason: 'no_credential', credential };
  return { builds: true, reason: null, credential };
}

/** Where the skill runs: a remote session (Claude Code on the web) or a machine, and what the cloud can do. */
export function whereGoRuns({ env = process.env, ...facts }) {
  return { remote: isRemote(env), cloud: cloudState(facts) };
}

/**
 * Read the facts with a `gh` client (`(args) -> stdout`, throws on failure): the workflow file on the default branch, the names
 * of the secrets and the variable that pauses the cloud. Nothing is changed.
 */
export function readCloudFacts({ gh, repo }) {
  const api = (path) => JSON.parse(gh(['api', path]));
  let workflowPresent = false;
  try {
    api(`repos/${repo}/contents/.github/workflows/relevo-go.yml`);
    workflowPresent = true;
  } catch {
    workflowPresent = false;
  }
  let secrets = null;
  try {
    secrets = (api(`repos/${repo}/actions/secrets`).secrets ?? []).map((s) => s.name);
  } catch {
    secrets = null;
  }
  let variable = null;
  try {
    variable = api(`repos/${repo}/actions/variables/RELEVO_CLOUD_GO`).value ?? null;
  } catch {
    variable = null;
  }
  return { workflowPresent, secrets, variable };
}
