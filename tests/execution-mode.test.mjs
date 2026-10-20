import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudBuilds, credentialMode } from '../scripts/lib/execution-mode.mjs';

test('Scenario: the credential mode is deduced from the name of the secret', () => {
  assert.deepEqual(credentialMode(['ANTHROPIC_API_KEY', 'OTHER']), { mode: 'api_key', usable: true });
  assert.deepEqual(credentialMode(['CLAUDE_CODE_OAUTH_TOKEN']), { mode: 'subscription', usable: true });
  assert.deepEqual(credentialMode(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']), { mode: 'both', usable: true });
  assert.deepEqual(credentialMode([]), { mode: 'none', usable: false });
  assert.deepEqual(credentialMode(undefined), { mode: 'none', usable: false });
});

test('the cloud builds only with the workflow installed and the variable not off', () => {
  assert.equal(cloudBuilds({ workflowPresent: true }), true);
  assert.equal(cloudBuilds({ workflowPresent: true, variable: 'on' }), true);
  assert.equal(cloudBuilds({ workflowPresent: true, variable: 'off' }), false);
  assert.equal(cloudBuilds({ workflowPresent: true, variable: ' OFF ' }), false);
  assert.equal(cloudBuilds({ workflowPresent: false }), false);
  assert.equal(cloudBuilds({ workflowPresent: false, variable: 'off' }), false);
});
