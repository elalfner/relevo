import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// The workflows install the published package at a pinned version. These tests keep the pin in step with the
// package, keep every job from running a script its guard does not check, and keep any repository clone out.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const pkg = JSON.parse(read('package.json'));
const files = readdirSync(`${root}templates/workflows`).filter((f) => f.endsWith('.yml'));

test('every workflow pins the version of the package and it is the version of this package', () => {
  assert.ok(files.length >= 5);
  files.forEach((f) => {
    const m = /^env:\n  RELEVO_VERSION: '([\d.]+)'$/m.exec(read(`templates/workflows/${f}`));
    assert.ok(m, `${f} pins RELEVO_VERSION`);
    assert.equal(m[1], pkg.version, `${f} pins ${m[1]} but the package is ${pkg.version}`);
  });
});

test('no workflow clones the plugin repository for its scripts', () => {
  files.forEach((f) => assert.doesNotMatch(read(`templates/workflows/${f}`), /repository: elalfner\/relevo/, f));
});

test('every script a job runs from the plugin exists in the package and is named by a guard that stops the run', () => {
  files.forEach((f) => {
    const text = read(`templates/workflows/${f}`);
    const ran = [...text.matchAll(/node "?(?:\.relevo-plugin|\$RUNNER_TEMP\/relevo)\/(scripts\/[\w.-]+\.mjs)/g)].map((m) => m[1]);
    assert.ok(ran.length > 0, `${f} runs a plugin script`);
    const guarded = [...text.matchAll(/for f in ([^;\n]+?);? do\n/g)].flatMap((m) => m[1].trim().split(/\s+/));
    ran.forEach((script) => {
      assert.ok(existsSync(`${root}${script}`), `${script} is run by ${f} but does not exist`);
      assert.ok(guarded.includes(script), `${f} runs ${script} without checking that the package has it`);
    });
    assert.match(text, /\|\| \{ echo "::error::The Relevo package \$RELEVO_VERSION lacks \$f"; exit 1; \}/, `${f} stops and names the missing path`);
  });
});

test('the guard runs before the script it protects, in the same job', () => {
  files.forEach((f) => {
    const text = read(`templates/workflows/${f}`);
    const guard = text.indexOf('lacks $f');
    const first = text.search(/node "?(?:\.relevo-plugin|\$RUNNER_TEMP\/relevo)\/scripts\//);
    assert.ok(guard > 0 && guard < first, `${f}: install and guard come first`);
  });
});

test('Scenario: Reading the template - the plugin for the model action comes from the pinned package, not from a marketplace', () => {
  const go = read('templates/workflows/relevo-go.yml');
  assert.match(go, /--plugin-dir \$\{\{ runner\.temp \}\}\/relevo/);
  files.forEach((f) => {
    const active = read(`templates/workflows/${f}`).replace(/^\s*#.*$/gm, '');
    assert.doesNotMatch(active, /plugin_marketplaces|^\s+plugins:/m, `${f} adds no marketplace and installs no plugin from one`);
    assert.doesNotMatch(active, /RELEVO_PLUGIN_TOKEN/, f);
  });
});

test('Scenario: A release - every template starts with the stamp of the version of the package', () => {
  files.forEach((f) => {
    const first = read(`templates/workflows/${f}`).split('\n')[0];
    const m = /^# relevo-template: (\d+\.\d+\.\d+)$/.exec(first);
    assert.ok(m, `${f} starts with "# relevo-template: X.Y.Z"`);
    assert.equal(m[1], pkg.version, `${f} is stamped ${m[1]} but the package is ${pkg.version}`);
  });
});

test('Scenario: A pin raised by hand - the stamp is a line of its own, apart from the pin', () => {
  files.forEach((f) => {
    const text = read(`templates/workflows/${f}`);
    assert.equal((text.match(/relevo-template:/g) ?? []).length, 1, `${f} has one stamp`);
    assert.notEqual(text.indexOf('# relevo-template:'), text.indexOf('RELEVO_VERSION:'), f);
  });
});

test('RELEASING.md tells the maintainer to move the stamp with the pin, and gives the right reason for publishing first', () => {
  const releasing = read('RELEASING.md');
  assert.match(releasing, /`# relevo-template:`/);
  assert.match(releasing, /templates on `main` never pin a package version that does not exist/);
  assert.doesNotMatch(releasing, /marketplace on `main` never names/);
});
