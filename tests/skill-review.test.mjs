import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/review/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields; the hint is quoted so YAML reads it as text', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'review');
  assert.equal(meta['argument-hint'], '[issue-number]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 8);
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('every review-state subcommand the skill uses is implemented', () => {
  const source = readFileSync(root('scripts/review-state.mjs'), 'utf8');
  const used = [...body.matchAll(/review-state\.mjs (init|set|capture|audit|agree|decide|show)\b/g)].map((m) => m[1]);
  ['init', 'set', 'capture', 'audit', 'agree', 'decide'].forEach((c) => assert.ok(used.includes(c), `the skill never uses "${c}"`));
  new Set(used).forEach((c) => assert.ok(source.includes(`case '${c}'`), `review-state has no "${c}" command`));
});

test('every label and agent it uses is real', () => {
  const keys = [...body.matchAll(/label-change\.mjs --to ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(keys.includes('in-review') && keys.includes('pr-open'));
  new Set(keys).forEach((k) => assert.ok(LABEL_KEYS.includes(k), `"${k}" is not a label key`));
  assert.ok(LABEL_KEYS.includes('needs-reviewer'));
  [...new Set([...body.matchAll(/`relevo:(\w+)`/g)].map((m) => m[1]))].forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
});

test('the only adb commands in the skill are devices, logcat and the screenshot script', () => {
  const lines = body.split('\n').filter((l) => /\badb\b/.test(l));
  assert.ok(lines.length > 0);
  lines.forEach((l) => {
    const prohibition = /never|must not|only .*adb|no `adb/i.test(l);
    const allowed = /logcat|devices|device\.mjs|capture\.mjs/.test(l);
    assert.ok(prohibition || allowed, `adb line is neither a prohibition nor an allowed command: ${l}`);
  });
  // Every code block line that runs adb must be a log command.
  const code = [...body.matchAll(/```[\w]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n')).filter((l) => /\badb\b/.test(l));
  code.forEach((l) => assert.match(l, /logcat/, `adb in a code block must be a logcat command: ${l}`));
});

test('the observer rules are stated', () => {
  assert.match(body, /Never tap, swipe, type or press keys on the device/);
  assert.match(body, /Never send a message, make a call or press a send button in any other app/);
  assert.match(body, /Never open the screenshots/);
  assert.match(body, /Never patch code during the review/);
  assert.match(body, /Never commit the `evidence\/` folder, and never force-push/);
  assert.match(body, /\*\*Then end your turn\.\*\*/);
  assert.match(body, /Never go to step 5 without an explicit `done`/);
});

test('the pull request opens only when the script allows it, ready for review, with no images or session links', () => {
  assert.match(body, /Only when `decide` exited 0/);
  assert.match(body, /\*\*Do not open the pull request\.\*\*/);
  assert.match(body, /ready for review, not as a draft/);
  assert.match(body, /No images, no links to this session, no attribution lines/);
  assert.match(body, /Closes #\$ARGUMENTS/);
});

test('it admits it cannot attach images (spec: Screenshots attached by the person)', () => {
  assert.match(body, /GitHub has no API for attaching images, so you cannot upload them/);
  assert.match(body, /`evidence\.policy: local_only`: delete the `evidence\/` folder now/);
});

test('it synchronises with the base branch and re-runs QA when the merge changed something', () => {
  assert.match(body, /git merge --no-edit origin\/<base>/);
  assert.match(body, /git merge --abort/);
  assert.match(body, /launch the `relevo:qa` agent again/);
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});

test('Scenario: Another app logs an error - the audit is limited to the app under review', () => {
  assert.match(body, /app-id\.mjs/);
  assert.match(body, /audit --accumulated --package "\$package"/);
  assert.match(body, /ask the person to start the app, or restart it/i);
});

test('Scenario: QA after the sync - review finds the platform again and gives QA the profile and the folder', () => {
  assert.match(body, /scripts\/platform-of\.mjs --issue \$ARGUMENTS/);
  assert.match(body, /scripts\/stack-profile\.mjs --platform <platform>/);
  assert.match(body, /scripts\/role-skills\.mjs --role qa --platform <platform>/);
  assert.match(body, /If `platform-of\.mjs` exits 1, stop and tell the person what it printed/);
  assert.match(body, /the profile, the folder of the platform and the skill paths/);
});

// ---------- issue format v2

test('Scenario: Brief shown first - the review shows the computed brief before the shot list and the checklist', () => {
  const brief = body.indexOf('review-brief.mjs --issue');
  assert.ok(brief > 0 && brief < body.indexOf('A **shot list**') && brief < body.indexOf('checklist.mjs openspec/changes/<change folder>`, one numbered line'));
  assert.match(body, /computed and not written by you/);
  assert.match(body, /Show them as they are/);
  assert.ok(existsSync(root('scripts/review-brief.mjs')));
});

// ---------- review-hardening

test('Scenario: Empty log / Only other apps - inconclusive is not a pass, cannot be waived, and the person repeats the steps', () => {
  assert.match(body, /`REVIEW INCONCLUSIVE`/);
  assert.match(body, /it proves nothing, it is not a pass and it cannot be waived/);
  assert.match(body, /Ask the person to start the app again, repeat the steps, and audit once more/);
  assert.doesNotMatch(body, /may hold other apps' data/);
});

test('Scenario: Waiver with a reason - the waiver is the person\'s, the agent never proposes one', () => {
  assert.match(body, /Never waive a finding, and never suggest or hint that one could be waived/);
  assert.match(body, /`waive <number> <reason>`: the person's decision/);
  assert.match(body, /review-state\.mjs waive <number> <reason>/);
  assert.match(body, /`REVIEW PASSED \(with waivers\)`/);
  assert.match(body, /review-state\.mjs waived/);
  assert.ok(body.indexOf('review-state.mjs waived') > body.indexOf('Write the body to a file'), 'the waived section goes into the pull request body');
});

test('Scenario: Micro-fix accepted - the fix is committed through the script before the audit repeats', () => {
  const commit = body.indexOf('commit-change.mjs --message "fix: <summary> (#$ARGUMENTS)"');
  assert.ok(commit > 0);
  assert.ok(commit < body.indexOf('ask the person to restart the app and repeat the affected steps'));
  assert.match(body, /it stages exactly those files, scans them and refuses on a finding/);
});

test('Scenario: Long review - the log is drained after every message and the audit reads what was kept', () => {
  assert.match(body, /After \*\*each\*\* message of the person/);
  assert.match(body, /logcat -d -v threadtime \| node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/review-state\.mjs drain/);
  assert.match(body, /audit --accumulated/);
  const source = readFileSync(root('scripts/review-state.mjs'), 'utf8');
  assert.ok(source.includes("case 'drain'") && source.includes("'--accumulated'") && source.includes("case 'waive'") && source.includes("case 'waived'"));
});

test('Scenario: Someone else runs the review - the assignee is compared with the login and a written confirmation is asked', () => {
  assert.match(body, /review-who\.mjs --assignee/);
  assert.match(body, /gh api user --jq \.login/);
  assert.match(body, /ask the person for a written confirmation that they are reviewing it themselves/);
  assert.ok(existsSync(root('scripts/review-who.mjs')));
});

test('Scenario: Branch pushed from another machine - the branch is pulled before the base is merged, and a divergence stops it', () => {
  const pull = body.indexOf('git pull --ff-only origin <branch>');
  assert.ok(pull > 0 && pull < body.indexOf('git merge --no-edit origin/<base>'));
  assert.match(body, /never rebase, reset or force anything/);
});

test('Scenario: Pull request already open / Push rejected - the lookup comes before gh pr create, and nothing is forced', () => {
  const lookup = body.indexOf('gh pr list --head <branch> --state open --json number,url');
  assert.ok(lookup > 0 && lookup < body.indexOf('gh pr create --base <base>'));
  assert.match(body, /If `git push` was rejected, stop/);
  assert.match(body, /never a force-push/);
  assert.doesNotMatch(body, /git push[^\n]*--force/);
});

test('the change folder comes from openspec list, which is on the closed list of review', () => {
  assert.match(body, /`openspec list --json` names that starts with `\$ARGUMENTS-`/);
});

// ---------- review-autopilot

const autopilot = body.slice(body.indexOf('### Autopilot'), body.indexOf('### 5. Audit the log'));

test('Scenario: Android device / Web / No adapter - the adapter is resolved first and a missing one stops the review before anything changes', () => {
  assert.match(body, /review-adapter\.mjs --platform <platform>/);
  assert.match(body, /exits 1: no review is possible for that platform and target; show the `reason` and stop, changing nothing/);
  assert.match(body, /`needs_autopilot: true` and `review\.autopilot` is `off`, stop/);
  assert.match(body, /For an adapter whose kind is `device`: `node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/device\.mjs`/);
  assert.ok(body.indexOf('review-adapter.mjs') < body.indexOf('### 1. Synchronise with the base branch'));
});

test('the mode is stored when the review starts, and every command of the autopilot is implemented', () => {
  assert.match(body, /review-state\.mjs init openspec\/changes\/<change folder> --autopilot <review\.autopilot>/);
  const source = readFileSync(root('scripts/review-state.mjs'), 'utf8');
  ['confirm-env', 'precheck', 'auto', 'auto-list'].forEach((c) => {
    assert.match(body, new RegExp(`review-state\\.mjs ${c}\\b`), `the skill never uses ${c}`);
    assert.ok(source.includes(`case '${c}'`), `review-state has no ${c}`);
  });
  assert.ok(existsSync(root('scripts/web-review.mjs')) && existsSync(root('scripts/review-adapter.mjs')));
  ['--script', '--url', '--allow-origins', '--secret-env'].forEach((flag) => {
    assert.match(body, new RegExp(`web-review\\.mjs[^\\n]*${flag}`));
    assert.ok(readFileSync(root('scripts/web-review.mjs'), 'utf8').includes(`'${flag.slice(2)}'`) || readFileSync(root('scripts/web-review.mjs'), 'utf8').includes(`list('${flag.slice(2)}')`), `web-review does not implement ${flag}`);
  });
});

test('Scenario: Autopilot off - the section is skipped and the person does everything', () => {
  assert.match(autopilot, /When it is `off` skip this section: the person does everything/);
  assert.match(body, /The person does everything in the app, unless `review\.autopilot` is `precheck` or `verify`/);
  assert.match(body, /Never tap, swipe, type or press keys on the device/);
});

test('Scenario: Production data - nothing is driven or recorded before the written confirmation', () => {
  assert.match(autopilot, /ask the person to confirm in writing that the app points to data that is not production/);
  assert.ok(autopilot.indexOf('confirm-env') < autopilot.indexOf('**Walk the lines.**'));
  assert.match(autopilot, /Without it `precheck` and `auto` are refused/);
});

test('Scenario: Precheck / Verify - the person confirms every line in precheck, and appearance is never automatic', () => {
  assert.match(autopilot, /the line stays pending until the person writes `ok`/);
  assert.match(autopilot, /`verify`: in addition, when the `THEN` of a line was proved by an assertion, a semantic finder or the log/);
  assert.match(autopilot, /appearance, animation or fidelity to an image is never marked automatically/);
  assert.match(body, /output of `node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/review-state\.mjs auto-list`/);
});

test('the Flutter driver rules are written down', () => {
  ['launch_app', 'connect_dart_tooling_daemon', 'flutter_driver', 'get_runtime_errors', 'get_app_logs', 'hot_reload', 'enableFlutterDriverExtension'].forEach((t) => assert.match(autopilot, new RegExp(t)));
  assert.match(autopilot, /never pass `timeout` to `flutter_driver`/);
  assert.match(autopilot, /never by coordinates/);
  assert.match(autopilot, /if a finder fails twice, stop driving and go back to manual for that line/);
  assert.match(autopilot, /if it does not answer or is empty the audit is inconclusive/);
});

test('Scenario: Origin not allowed / Script reaches the file system - QA reads the script before the runner, the runner is the only way to run it', () => {
  const qa = autopilot.indexOf('launch `relevo:qa` on the script, read-only');
  const run = autopilot.indexOf('web-review.mjs --script');
  assert.ok(qa > 0 && run > qa, 'QA comes before the runner');
  assert.match(autopilot, /Only if it answers `QA PASSED`, run/);
  assert.match(autopilot, /a refused script is not run in any other way/);
  assert.match(autopilot, /can reach only `localhost`, the address under review and `review\.allowed_origins`/);
  assert.match(autopilot, /a tripwire, not a sandbox/);
  assert.match(autopilot, /audit with `--package web`/);
});

test('Scenario: Value in the output - credentials are names the person gives, never read or printed', () => {
  assert.match(autopilot, /`credentials\("NAME"\)` where `NAME` is an environment variable the person names; you never read, print or store its value/);
});

test('the forbidden ways of driving are named only to forbid them', () => {
  body.split('\n').filter((l) => /Appium|Maestro|adb shell input|coordinates/.test(l)).forEach((l) => {
    assert.match(l, /[Nn]ever|no `adb|not/, `a line names a forbidden tool without forbidding it: ${l}`);
  });
});

test('Scenario: Pull request opened successfully - review restores the working tree to the base branch', () => {
  assert.match(body, /### 9\. Return to base branch/);
  assert.match(body, /git switch <base>/);
});
