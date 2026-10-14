import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationId } from '../scripts/lib/appid.mjs';

test('reads the application id from the Kotlin and Groovy build files', () => {
  assert.equal(applicationId('android {\n  defaultConfig {\n    applicationId = "com.example.counter"\n  }\n}'), 'com.example.counter');
  assert.equal(applicationId("defaultConfig {\n    applicationId 'com.example.old'\n}"), 'com.example.old');
});

test('returns null when the file has no application id', () => {
  assert.equal(applicationId('android { namespace = "com.example" }'), null);
});
