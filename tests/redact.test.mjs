import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { redact, REDACTED } from '../scripts/lib/redact.mjs';
import { BASE_PATTERNS } from '../scripts/lib/restricted-paths.mjs';

const root = new URL('../', import.meta.url).pathname;

// Values shaped like the content of the files on the restricted list. None is a real credential.
const FIXTURES = {
  '.env': { text: 'DATABASE_URL=postgres://app:hunter2pass@db.example.com:5432/app\nSTRIPE_SECRET_KEY=sk_live_51Habcdefghijklmnop\nAPP_NAME=demo', values: ['hunter2pass', 'sk_live_51Habcdefghijklmnop'] },
  'id_rsa': { text: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACD0exampleexampleexampleexampleexample\n-----END OPENSSH PRIVATE KEY-----', values: ['b3BlbnNzaC1rZXktdjEAAAAABG5vbmU', 'exampleexampleexample'] },
  '.npmrc': { text: '//registry.npmjs.org/:_authToken=npm_aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5', values: ['npm_aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5'] },
  '.git-credentials': { text: 'https://octocat:ghp_16C7e42F292c6912E7710c838347Ae178B4a@github.com', values: ['ghp_16C7e42F292c6912E7710c838347Ae178B4a'] },
  '.pgpass': { text: 'db.internal:5432:appdb:appuser:S3cr3tPassw0rd', values: ['S3cr3tPassw0rd'] },
  'key.properties': { text: 'storePassword=android-store-pass-9\nkeyPassword=android-key-pass-9\nkeyAlias=upload\nstoreFile=/home/ci/upload.jks', values: ['android-store-pass-9', 'android-key-pass-9'] },
  'google-services.json': { text: '{"client":[{"api_key":[{"current_key":"AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY"}]}]}', values: ['AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY'] },
  'headers': { text: 'curl -H "Authorization: Bearer ya29.a0AfH6SMBx1234567890abcdef" https://api.example.com\nANTHROPIC_API_KEY=sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv', values: ['ya29.a0AfH6SMBx1234567890abcdef', 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv'] },
  'aws': { text: 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE', values: ['AKIAIOSFODNN7EXAMPLE'] },
  'jwt': { text: 'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', values: ['eyJhbGciOiJIUzI1NiJ9'] },
};

test('Scenario: The content of a restricted file - no value shaped like one survives', () => {
  Object.entries(FIXTURES).forEach(([name, { text, values }]) => {
    const out = redact(text);
    values.forEach((v) => assert.ok(!out.includes(v), `${name}: "${v}" survived: ${out}`));
    assert.ok(out.includes(REDACTED), name);
  });
});

test('the fixtures cover every kind of file of the base list', () => {
  const covered = ['.env', 'id_rsa', '.npmrc', '.git-credentials', '.pgpass', 'key.properties', 'google-services.json'];
  covered.forEach((n) => assert.ok(BASE_PATTERNS.includes(n) || BASE_PATTERNS.some((p) => p.startsWith(n.split('.')[0])), n));
  assert.ok(BASE_PATTERNS.includes('.pgpass') && BASE_PATTERNS.includes('key.properties'));
});

test('Scenario: A secret the job holds - the exact value goes, plain and in base64', () => {
  const key = 'a-model-credential-without-any-known-shape';
  const text = `used ${key} and ${Buffer.from(key).toString('base64')} and more`;
  const out = redact(text, { secrets: [key] });
  assert.ok(!out.includes(key));
  assert.ok(!out.includes(Buffer.from(key).toString('base64')));
  assert.equal(out, `used ${REDACTED} and ${REDACTED} and more`);
});

test('a secret with a regex special character is replaced as text, not as a pattern', () => {
  const secret = 'p@ss(w0rd)+[x]*.{1}$^|\\end';
  const out = redact(`value is ${secret}!`, { secrets: [secret] });
  assert.equal(out, `value is ${REDACTED}!`);
});

test('a longer secret is not cut by a shorter one that it contains', () => {
  const out = redact('x tokentokentoken-extended-value y', { secrets: ['tokentoken', 'tokentokentoken-extended-value'] });
  assert.equal(out, `x ${REDACTED} y`);
});

test('a value too short to be a secret is not replaced by value', () => {
  assert.equal(redact('the flag is true', { secrets: ['true', '1', ''] }), 'the flag is true');
});

test('ordinary text, ids, hashes and paths are unchanged', () => {
  const text = 'npm test -> 42 passed\ncommit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39\nsrc/components/Button.vue\nissue #129 run 42282428478\nmax_turns=100';
  assert.equal(redact(text), text);
});

test('an unterminated private key block is cut to the end of the text', () => {
  const out = redact('before\n-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890\nmore');
  assert.equal(out, `before\n${REDACTED}`);
});

test('nothing but text is read: no path is opened and the module imports no file system', () => {
  const source = readFileSync(`${root}scripts/lib/redact.mjs`, 'utf8');
  assert.doesNotMatch(source, /from ['"](?:node:)?(?:fs|fs\/promises|guarded-fs)|require\(['"]fs|readFile|\.\/guarded-fs/);
  assert.equal(redact('/etc/passwd ./.env'), '/etc/passwd ./.env');
  assert.equal(redact(undefined), '');
  assert.equal(redact(null, { secrets: null }), '');
});
