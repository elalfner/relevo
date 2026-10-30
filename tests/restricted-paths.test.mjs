import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PATTERNS, RESTRICTED_REASON, RestrictedPathError, agyReadDenials, assertNotRestricted, checkRestricted, claudeDenyRead, claudeReadRules,
  claudeSettings, denyPatterns, filterRestricted, findRestrictedFiles, formatRestricted, invalidRestrictedEntries, isRestricted, leftOutText,
  restrictedList, restrictedRule,
} from '../scripts/lib/restricted-paths.mjs';

test('Scenario: A variant of the environment file - .env and .env.production are restricted at any depth', () => {
  ['.env', '.env.production', '.env.local', 'api/.env', 'apps/web/.env.staging'].forEach((p) => assert.equal(isRestricted(p), true, p));
});

test('Scenario: The example file stays readable - .env.example is not restricted, at any depth', () => {
  assert.equal(isRestricted('.env.example'), false);
  assert.equal(isRestricted('apps/web/.env.example'), false);
  assert.equal(restrictedRule('.env.example'), null);
});

test('private keys, credential files, mobile configuration and the secrets folder are on the base list', () => {
  ['config/private.pem', 'deploy/server.key', 'id_rsa', 'home/.ssh/id_ed25519', '.npmrc', 'web/.npmrc', '.netrc', 'android/app/google-services.json',
    'ios/Runner/GoogleService-Info.plist', 'android/key.properties', 'secrets/a.txt', 'secrets/deep/b.json'].forEach((p) => assert.equal(isRestricted(p), true, p));
});

test('ordinary files are not restricted, and secrets/ is anchored at the root of the repository', () => {
  ['README.md', 'lib/main.dart', 'src/environment.ts', 'docs/secrets/readme.md', 'keys.md', 'package.json'].forEach((p) => assert.equal(isRestricted(p), false, p));
});

test('the rule that covers a path is named, and the path is normalized before the match', () => {
  assert.equal(restrictedRule('./config/private.pem'), '*.pem');
  assert.equal(restrictedRule('config\\private.pem'), '*.pem');
  assert.equal(restrictedRule('secrets/a.txt'), 'secrets/');
});

test('Scenario: A project adds its own - restricted_paths adds to the base and never takes from it', () => {
  const list = restrictedList({ restricted_paths: ['infra/prod.tfvars', '*.secret'] });
  assert.equal(isRestricted('infra/prod.tfvars', list), true);
  assert.equal(isRestricted('infra/prod.tfvars'), false, 'without the entry it is an ordinary file');
  assert.equal(isRestricted('x/a.secret', list), true);
  BASE_PATTERNS.forEach((pattern) => assert.ok(list.includes(pattern), `${pattern} stays`));
  assert.deepEqual(restrictedList({}), BASE_PATTERNS);
  assert.deepEqual(restrictedList(), BASE_PATTERNS);
  assert.deepEqual(restrictedList({ restricted_paths: ['.env'] }), BASE_PATTERNS, 'repeating a base entry adds nothing');
});

test('the secrets folder of every platform below the root is restricted too', () => {
  const list = restrictedList({ platforms: { web: { path: 'apps/web' }, api: { path: '.' } } });
  assert.equal(isRestricted('apps/web/secrets/a.txt', list), true);
  assert.equal(isRestricted('apps/web/secrets/a.txt'), false);
});

test('the example file can be listed by a project on purpose, and then it is restricted', () => {
  assert.equal(isRestricted('.env.example', restrictedList({ restricted_paths: ['.env.example'] })), true);
});

test('Scenario: A restricted file in the diff - the check names the path and the rule', () => {
  const r = checkRestricted(['lib/a.dart', 'config/private.pem', 'config/private.pem', '.env.example']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, [{ path: 'config/private.pem', rule: '*.pem' }]);
  assert.equal(checkRestricted(['lib/a.dart']).ok, true);
  assert.match(formatRestricted(r.violations), new RegExp(`config/private\\.pem {2}${RESTRICTED_REASON}`));
});

test('filterRestricted keeps what may be published and says what it left out, by name', () => {
  const { kept, left } = filterRestricted(['a.txt', '.env', '.env.example', 'k/x.pem']);
  assert.deepEqual(kept, ['a.txt', '.env.example']);
  assert.deepEqual(left, ['.env', 'k/x.pem']);
  assert.match(leftOutText(left), /left out 2 restricted files \(\.env, k\/x\.pem\)/);
  assert.equal(leftOutText([]), '');
});

test('assertNotRestricted throws a typed error before anything is opened, and lets the example through', () => {
  assert.throws(() => assertNotRestricted('.env'), (e) => e instanceof RestrictedPathError && e.path === '.env' && e.rule === '.env');
  assert.doesNotThrow(() => assertNotRestricted('.env.example'));
  assert.doesNotThrow(() => assertNotRestricted('lib/a.dart'));
});

test('Scenario: Invalid value - an absolute path, a path that leaves the repository and a negation are named', () => {
  const bad = invalidRestrictedEntries(['/etc/passwd', '../outside', 'a/../../b', '~/keys', '!.env', 'infra/prod.tfvars']);
  assert.deepEqual(bad.map((b) => b.entry), ['/etc/passwd', '../outside', 'a/../../b', '~/keys', '!.env']);
  assert.match(bad[0].reason, /relative/);
  assert.match(bad[1].reason, /leaves the repository/);
  assert.match(bad[4].reason, /base list cannot be reduced/);
});

test('Claude gets Read rules and sandbox read denials for the list, and the example file is not among them', () => {
  const rules = claudeReadRules();
  assert.ok(rules.includes('Read(**/.env)'));
  assert.ok(rules.includes('Read(**/.env.production)'));
  assert.ok(rules.includes('Read(**/*.pem)'));
  assert.ok(rules.includes('Read(./secrets/**)'));
  assert.ok(!rules.some((r) => r.includes('example')), 'no rule names the example file');
  assert.ok(!rules.includes('Read(**/.env.*)'), 'the glob that would cover the example file is written out');
  const deny = claudeDenyRead();
  assert.ok(deny.includes('**/.env'));
  assert.ok(deny.includes('./secrets'));
  assert.ok(!deny.includes('**/.env.*'));
  ['.env.example'].forEach((name) => assert.equal(denyPatterns().some((p) => p.replace(/\*\*\//, '') === name), false));
});

test('a project entry shows in both Claude lists, anchored when it names a path and at any depth when it names a file', () => {
  const list = restrictedList({ restricted_paths: ['infra/prod.tfvars', '*.secret'] });
  assert.ok(claudeReadRules(list).includes('Read(./infra/prod.tfvars)'));
  assert.ok(claudeReadRules(list).includes('Read(**/*.secret)'));
  assert.ok(claudeDenyRead(list).includes('./infra/prod.tfvars'));
});

test('outside the repository the folders are written from an absolute root', () => {
  const settings = claudeSettings(restrictedList(), { root: '${{ github.workspace }}' });
  assert.ok(settings.permissions.deny.includes('Read(/${{ github.workspace }}/secrets/**)'));
  assert.ok(settings.sandbox.filesystem.denyRead.includes('/${{ github.workspace }}/secrets'));
  assert.ok(settings.sandbox.filesystem.denyRead.includes('**/.env'));
  assert.equal(settings.sandbox.enabled, undefined, 'not enabled unless asked for');
  const on = claudeSettings(restrictedList(), { root: '/r', enabled: true });
  assert.equal(on.sandbox.enabled, true);
  assert.equal(on.sandbox.failIfUnavailable, false);
});

test('Antigravity gets one read_file rule for each restricted file that exists, by absolute path, never a glob', () => {
  const files = ['.env', 'api/.env.production', '.env.example', 'lib/a.dart', 'secrets/k.txt'];
  const rules = agyReadDenials(files, BASE_PATTERNS, '/work/repo');
  assert.deepEqual(rules, ['read_file(/work/repo/.env)', 'read_file(/work/repo/api/.env.production)', 'read_file(/work/repo/secrets/k.txt)']);
  assert.ok(rules.every((r) => !r.includes('*')));
  assert.deepEqual(agyReadDenials([], BASE_PATTERNS, '/work/repo'), []);
});

test('findRestrictedFiles lists directories by name and never opens a file', () => {
  const tree = {
    '/r': [{ name: '.env', isDirectory: false }, { name: '.env.example', isDirectory: false }, { name: 'api', isDirectory: true }, { name: 'node_modules', isDirectory: true }, { name: '.git', isDirectory: true }],
    '/r/api': [{ name: '.env.production', isDirectory: false }, { name: 'a.php', isDirectory: false }],
    '/r/node_modules': [{ name: 'x.pem', isDirectory: false }],
  };
  const opened = [];
  const readdir = (dir) => {
    opened.push(dir);
    if (!tree[dir]) throw new Error('missing');
    return tree[dir];
  };
  assert.deepEqual(findRestrictedFiles('/r', BASE_PATTERNS, { readdir }), ['.env', 'api/.env.production']);
  assert.ok(!opened.includes('/r/node_modules'), 'dependencies are not walked');
});

test('Scenario: The other example files stay readable - .env.sample, .env.template and .env.dist are not restricted, at any depth', () => {
  ['.env.sample', '.env.template', '.env.dist', 'apps/web/.env.sample'].forEach((name) => {
    assert.equal(isRestricted(name), false, name);
    assert.equal(restrictedRule(name), null, name);
  });
  assert.equal(isRestricted('.env.production'), true);
  assert.equal(isRestricted('.env.sample', restrictedList({ restricted_paths: ['.env.sample'] })), true, 'a repository can still add one');
});
