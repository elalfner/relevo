import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const load = (name) => {
  const text = readFileSync(root(`skills/${name}/SKILL.md`), 'utf8');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return { meta: parse(front), body };
};
const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

for (const name of ['init', 'doctor']) {
  test(`${name}: frontmatter uses only documented fields and has a description within the limit`, () => {
    const { meta } = load(name);
    Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
    assert.equal(meta.name, name);
    assert.ok(String(meta.description).length <= 1536);
  });

  test(`${name}: every script it runs exists`, () => {
    const { body } = load(name);
    const scripts = [...body.matchAll(/scripts\/([\w-]+\.mjs)/g)].map((m) => m[1]);
    assert.ok(scripts.length > 0);
    scripts.forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is missing`));
  });
}

test('init changes the repository, so Claude never starts it on its own', () => {
  assert.equal(load('init').meta['disable-model-invocation'], true);
});

test('Scenario: Plan before changes - init shows the plan and waits for a yes before applying', () => {
  const { body } = load('init');
  assert.ok(body.indexOf('init.mjs plan') < body.indexOf('init.mjs apply'));
  assert.match(body, /Never apply a change before the person says yes to the plan/);
  assert.match(body, /one direct yes\/no question/);
});

test('Scenario: Second run - the skill relies on the idempotent plan and never overwrites what differs', () => {
  const { body } = load('init');
  assert.match(body, /makes? a second run harmless|second run harmless/);
  assert.match(body, /Never overwrite a workflow or `relevo\.yml` that already exists and differs/);
});

test('Scenario: Never touches the API key - init tells the person to add it themselves', () => {
  const { body } = load('init');
  assert.match(body, /Never read, write, print or ask for the model API key or any token/);
  assert.match(body, /repository secrets/);
});

test('Scenario: Offer to install and Declined - one confirmed command at a time, and go and ship wait for OpenSpec', () => {
  const { body } = load('init');
  assert.match(body, /never install anything before they confirm that exact command/i);
  assert.match(body, /one at a time/);
  assert.match(body, /`go` and `ship` will not run until the OpenSpec tool is installed/);
});

test('Scenario: Not an admin - the settings GitHub refused are shown to be changed by hand', () => {
  assert.match(load('init').body, /prints the exact settings to change by hand/);
});

test('init applies the files before the branch rules, because the rules would block pushing them to the default branch', () => {
  const { body } = load('init');
  assert.match(body, /--skip protection,push-scope/);
  assert.match(body, /commit and push the new files first/);
});

test('init runs doctor at the end, never commits and never creates openspec files by hand', () => {
  const { body } = load('init');
  assert.ok(body.lastIndexOf('doctor.mjs') > body.indexOf('init.mjs apply'));
  assert.match(body, /Never commit or push/);
  assert.match(body, /Never create files under `openspec\/` by hand/);
});

test('Scenario: Running doctor - the skill performs no write operation', () => {
  const { body } = load('doctor');
  assert.match(body, /only reads; it never changes anything/);
  assert.match(body, /Never run a command that writes/);
  assert.match(body, /Never read, print or ask for the value of a secret/);
  assert.ok(!/gh (issue|pr|label) (create|edit|comment)|git (add|commit|push)/.test(body.replace(/no `git add`, no install/, '')));
});

test('doctor points to init for the fixes and says what enforces approval when protection is unavailable', () => {
  const { body } = load('doctor');
  assert.match(body, /\/relevo:init/);
  assert.match(body, /written confirmation `ship` asks for/);
});

test('Scenario: Monorepo - init asks for the stack, the folder and the targets of each platform and writes platforms', () => {
  const init = readFileSync(new URL('../skills/init/SKILL.md', import.meta.url), 'utf8');
  assert.match(init, /the platforms: for each one a name, its stack/);
  assert.match(init, /`platforms` \(a map of name to `\{ stack, path, targets \}`\)/);
  assert.match(init, /`stackProfiles`/);
  assert.match(init, /`platform: flutter-android` line stays as it is/);
  assert.doesNotMatch(init, /today `flutter-android`/);
});

test('the doctor skill says it reads the profile of each platform and the skills of each role', () => {
  const doctor = readFileSync(new URL('../skills/doctor/SKILL.md', import.meta.url), 'utf8');
  assert.match(doctor, /toolchain and the targets of each platform's stack profile/);
  assert.match(doctor, /the extra skills of each role/);
});

test('Scenario: Front and back - init asks for the linked repositories and writes links', () => {
  const init = readFileSync(new URL('../skills/init/SKILL.md', import.meta.url), 'utf8');
  assert.match(init, /the repositories this one depends on, if any \(`owner\/repo`/);
  assert.match(init, /`links` \(a list of `owner\/repo`, possibly none\)/);
});

test('Scenario: init asks where go runs and with which credential, and says what decides it', () => {
  const init = readFileSync(new URL('../skills/init/SKILL.md', import.meta.url), 'utf8');
  assert.match(init, /where `go` builds: in the cloud, on each person's machine, or both \(the default\)/);
  assert.match(init, /with an API key from the Anthropic Console \(the default\) or with a subscription token/);
  assert.match(init, /`limits\.concurrent_agents` to 1/);
  assert.match(init, /repository variable `RELEVO_CLOUD_GO` \(`off` pauses the cloud at once, with no pull request\)/);
  assert.match(init, /`runs` \(`cloud`, `local` or `both`\), `credential` \(`api_key` or `subscription`\)/);
});

// ---------- stack profiles

test('Scenario: init names the three stacks the plugin ships, their folders and targets', () => {
  const init = readFileSync(new URL('../skills/init/SKILL.md', import.meta.url), 'utf8');
  assert.match(init, /are the stacks Relevo ships with: `flutter`, `vue` and `laravel`/);
  assert.match(init, /for Vue: `web`; Laravel has none/);
  ['flutter', 'vue', 'laravel'].forEach((stack) => assert.ok(existsSync(new URL(`../stacks/${stack}.md`, import.meta.url)), `stacks/${stack}.md exists`));
});
