# Tasks

## 1. Registry and configuration

- [x] 1.1 Add `scripts/lib/platforms.mjs` (`normalizePlatforms(raw)`: legacy `platform: flutter-android` to one `app` entry with stack `flutter`, path `.`, targets `[android]`; checks of `stack`, `path` (relative, no `..`) and `targets` list) and use it from `scripts/lib/config.mjs`: `platforms` setting, `platform` and `platforms` together fail, the validated result has `config.platforms` and no `platform`, default is the legacy value. Verify with additions to `tests/config.test.mjs`: legacy form, monorepo, both forms, absolute path, `..`, unknown target when the known targets are given, and every existing assertion still passing.
- [x] 1.2 Accept `qa.rules_from` as a string or a list (normalized to a list), add `platforms.<name>.checks` (validated against the commands of the profile when given) and `skills.allow_scripts` (list of names) in `scripts/lib/config.mjs`; update the callers that took a string (`scripts/commit-change.mjs`, `scripts/check-issue.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/protected-paths.mjs` takes a list). Verify with additions to `tests/config.test.mjs`, `tests/protected-paths.test.mjs` and `tests/commit-change.test.mjs`: a list protects every file, a string still works, an unknown `checks` key fails and lists the valid ones.
- [x] 1.3 Add `skills-lock.json` to the hard tier of `scripts/lib/protected-paths.mjs`. Verify with `tests/protected-paths.test.mjs`: refused even when listed in `Allow-paths:`.

## 2. Stack profiles

- [x] 2.1 Add `scripts/lib/stack-profile.mjs` (`parseProfile(text)`, `mergeProfiles(plugin, repository)` with the rules of D2, `applyChecks(profile, checks)`, `resolveProfile({ platform, config, read })` with the filesystem injected) and `scripts/stack-profile.mjs --platform <name> [--config relevo.yml] [--plugin-root <dir>]` (exit 0 prints JSON, 1 the stack has no profile, 2 bad usage). Verify with `tests/stack-profile.test.mjs`: layers concatenate, a repository command is ignored and reported, `checks` wins, a stack with only the repository file, a stack with neither, an empty body.
- [x] 2.2 Write `stacks/flutter.md`: the header of D1 (commands `flutter analyze --no-pub`, `flutter test --reporter=compact --no-pub`, `dart format`; generated `*.g.dart`, `*.freezed.dart`; tools `flutter`; targets `android: adb`, `ios: xcrun`, `web: ""`) and the body with the hygiene list of `agents/dev.md` and the bug list of `agents/qa.md`, moved without losing a sentence. Verify with `tests/stack-profile.test.mjs`: the plugin's file resolves, and each hygiene sentence of the old agents (kept as a fixture list in the test) appears in the body.
- [x] 2.3 Add `stacks/` to the plugin structure. Verify with `tests/plugin-structure.test.mjs`: the folder exists and every profile parses and has the header keys.

## 3. Role skills

- [x] 3.1 Add `scripts/lib/role-skills.mjs` and `scripts/role-skills.mjs --role <role> --platform <name> [--base origin/dev]` (reads the base branch with `git cat-file` and `git ls-tree`; output per skill: path, or left out with its reason; exit 0 even when some are left out, 2 on bad usage). Verify with `tests/role-skills.test.mjs` in a throwaway repository: a skill on the base branch, one only in the working tree, one with `disable-model-invocation`, one with a script left out, the same one allowed by `skills.allow_scripts`, and `fix` using the lists of `dev` and `qa`.
- [x] 3.2 Add the size budget and the lock comparison as pure functions (`skillBytes(paths)`, `lockDifferences(lock, hashes)`) used by `doctor`. Verify with `tests/role-skills.test.mjs`: 30 KB gives the warning, 10 KB does not, a changed folder is named, a missing lock file gives no difference.

## 4. Agents and go

- [x] 4.1 Rewrite `agents/dev.md` and `agents/qa.md` as generic: remove the Flutter, Dart and Android text (it lives in `stacks/flutter.md`), add the input "the resolved profile and the skill paths", take the verification commands and the generated-file exclusions from the profile, forbid editing (`dev`) or reject a diff that touches (`qa`) `relevo.yml`, `.relevo/` and `skills-lock.json`. Verify with `tests/agents.test.mjs`: neither file contains `flutter`, `dart`, `android` or `adb` (case-insensitive), both name the profile input and the protected files, and the existing assertions about never committing, never editing `openspec/` and the `QA PASSED`/`QA REJECTED` first line still pass.
- [x] 4.2 Update `skills/go/SKILL.md`: after reading the decision, run `stack-profile.mjs` for the platform and `role-skills.mjs` for `dev` and `qa`; take `profile not resolved` as a failure reason; give both agents the profile and the skill paths; build the QA diff command from the profile's `generated` list. Verify with `tests/skill-go.test.mjs` (the new scripts exist, their flags are implemented, the reason is in the failure path) and `tests/openspec-commands.test.mjs` still passing.
- [x] 4.3 Make `scripts/lib/plan.mjs` return the decision `platform` (drops `ready`, a comment that names the platforms, no claim) when the registry has more than one platform, add the message in English and Spanish to `scripts/lib/messages.mjs`, and handle it in `scripts/go-plan.mjs` like `no-milestone`. Verify with additions to `tests/plan.test.mjs`, `tests/go-plan-output.test.mjs` and `tests/messages.test.mjs`: one platform builds as before, two platforms comment and change nothing, both languages.

## 5. Doctor and init

- [x] 5.1 Update `scripts/lib/doctor.mjs`: replace `TOOLCHAIN` and the fixed `adb` check with the tools and targets of each platform's resolved profile, report the layers, fail on a stack with no profile, warn about ignored repository values, list the role skills (left out, with scripts, allowed), apply the size and lock checks, and warn about missing files in `qa.rules_from`. Verify with `tests/doctor.test.mjs`: Flutter with Android and web, iOS on a non-macOS machine, an unknown stack, a skill left out, and every current assertion still passing for the legacy configuration.
- [x] 5.2 Update `scripts/lib/init.mjs` and `scripts/init.mjs`: answers carry `platforms` (name, stack, path, targets), write the block, keep a legacy `platform:` untouched, and create a commented `.relevo/stacks/<stack>.md` only when the person asks (not committed). Verify with `tests/init.test.mjs`: a monorepo answer, an existing legacy file left as it is, the optional profile file created uncommitted.
- [x] 5.3 Update `skills/init/SKILL.md`, `skills/doctor/SKILL.md` and `templates/relevo.yml` (the `platforms` block with the legacy line commented as the shortcut). Verify with `tests/skill-init-doctor.test.mjs` and `tests/template.test.mjs`: every flag the skills use is implemented and the template validates.

## 6. Documentation and integration

- [x] 6.1 Add `docs/stacks.md` and `docs/stacks.es.md` (the registry, the profile header, the three layers, role skills and what is refused) and link them from the README and `docs/commands*.md`. Verify with `tests/readme-sync.test.mjs`.
- [x] 6.2 Add the entry to `CHANGELOG.md` under Unreleased (registry, profiles, layers, role skills, `skills-lock.json` protected, `qa.rules_from` as a list, `go` and several platforms). Verify with `tests/changelog.test.mjs`.
- [x] 6.3 Run `npm test`, `openspec validate --all` and `openspec validate platform-registry --strict`, and `claude plugin validate .` when available. Verify that every test passes and that validation reports no new error.
- [x] 6.4 In the sandbox repository, change `relevo.yml` to `platforms` with one `flutter` entry and `targets: [android]`, run `doctor`, and run `go` on one small issue. Verify by the run's outcome: the issue reaches `relevo:built` with the hand-off comment; record the result in `docs/pilot-findings.md`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied, then verify the archived result.
