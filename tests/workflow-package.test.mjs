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
    const ran = [...text.matchAll(/node \.relevo-plugin\/(scripts\/[\w.-]+\.mjs)/g)].map((m) => m[1]);
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
    const first = text.indexOf('node .relevo-plugin/scripts/');
    assert.ok(guard > 0 && guard < first, `${f}: install and guard come first`);
  });
});

test('the model action still installs the plugin from the marketplace entry, and the guard has no token to hold', () => {
  const go = read('templates/workflows/relevo-go.yml');
  assert.match(go, /plugin_marketplaces: https:\/\/github\.com\/elalfner\/relevo\.git/);
  assert.match(go, /plugins: relevo@relevo/);
  files.forEach((f) => assert.doesNotMatch(read(`templates/workflows/${f}`).split('plugin_marketplaces')[0], /RELEVO_PLUGIN_TOKEN \|\| github\.token/, f));
});
