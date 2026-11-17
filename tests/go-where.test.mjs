import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudState, readCloudFacts, whereGoRuns } from '../scripts/lib/go-where.mjs';

test('a remote session is told apart by CLAUDE_CODE_REMOTE, as everywhere else', () => {
  assert.equal(whereGoRuns({ env: { CLAUDE_CODE_REMOTE: 'true' }, workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'] }).remote, true);
  assert.equal(whereGoRuns({ env: {}, workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'] }).remote, false);
});

test('Scenario: Approved issue, cloud available - workflow, credential and no pause', () => {
  assert.deepEqual(cloudState({ workflowPresent: true, secrets: ['CLAUDE_CODE_OAUTH_TOKEN'], variable: null }), { builds: true, reason: null, credential: 'present' });
});

test('Scenario: The cloud cannot build - no workflow, no credential, or paused', () => {
  assert.equal(cloudState({ workflowPresent: false, secrets: ['ANTHROPIC_API_KEY'] }).reason, 'no_workflow');
  assert.equal(cloudState({ workflowPresent: true, secrets: [] }).reason, 'no_credential');
  assert.equal(cloudState({ workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'], variable: 'off' }).reason, 'paused');
  assert.equal(cloudState({ workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'], variable: ' OFF ' }).builds, false);
});

test('secrets that cannot be read leave the credential unknown, not missing', () => {
  assert.deepEqual(cloudState({ workflowPresent: true, secrets: null }), { builds: true, reason: null, credential: 'unknown' });
});

test('with Antigravity the credential is the Gemini key', () => {
  assert.equal(cloudState({ workflowPresent: true, secrets: ['GEMINI_API_KEY'], agentBuild: 'antigravity' }).builds, true);
  assert.equal(cloudState({ workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'], agentBuild: 'antigravity' }).reason, 'no_credential');
});

test('readCloudFacts reads the workflow, the secrets and the variable with gh api, and a failure of each is not fatal', () => {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const path = args[1];
    if (path.endsWith('relevo-go.yml')) return JSON.stringify({ name: 'relevo-go.yml' });
    if (path.endsWith('/actions/secrets')) return JSON.stringify({ secrets: [{ name: 'ANTHROPIC_API_KEY' }] });
    throw new Error('HTTP 404');
  };
  assert.deepEqual(readCloudFacts({ gh, repo: 'o/r' }), { workflowPresent: true, secrets: ['ANTHROPIC_API_KEY'], variable: null });
  assert.ok(calls.every((c) => c[0] === 'api'), 'only REST calls, which work in a remote session');
  assert.deepEqual(readCloudFacts({ gh: () => { throw new Error('HTTP 403'); }, repo: 'o/r' }), { workflowPresent: false, secrets: null, variable: null });
});
