# Tasks

## 1. Preflight: lock files, stale dependencies and the install command

- [x] 1.1 In `scripts/lib/web-preflight.mjs`, detect the lock file of the platform folder (`package-lock.json`, then `pnpm-lock.yaml`, then `yarn.lock`) and return `install` with the frozen command of design decision 3, or `null`; verify with new cases in `tests/web-preflight.test.mjs` for each lock file and for none
- [x] 1.2 Add the stale check of design decision 2 (npm hidden lock file by `version`, optional entries skipped, missing hidden file counts as stale; pnpm and yarn checked for presence only; unknown shapes never stale) with exit 7 `deps_stale` run right after the `node_modules` check; verify with tests for: matching, a changed version, a missing optional platform package, a missing hidden file, a pnpm project, and an unreadable hidden file
- [x] 1.3 Update the usage comment and JSON output of `scripts/web-preflight.mjs` (exit 7, `install` in the output) and verify by running it on a fixture folder in a test

## 2. Review skill and spec text

- [x] 2.1 In `skills/review/SKILL.md` step 2: for exit 3 and 7, show `install` and run it from the platform folder only on a yes, check that the manifest and lock file are unchanged (restore them otherwise), then run the preflight again; with `install` `null`, ask the person to install and stop; on a failed install show the error and stop, never retrying another way; after an install, tell the person to restart a running dev server (design decision 6). Verify with `tests/skill-review.test.mjs` assertions on that text
- [x] 2.2 In the same step: exit 4 installs nothing, says Playwright is missing from the project's development dependencies and names `/relevo:init` and `npm install -D playwright`; exit 5 still asks before `npx playwright install chromium`; remove the `--no-save` and lock restore lines, and change the hint of `scripts/web-review.mjs` when Playwright does not resolve to the same advice. Replace the test at `tests/skill-review.test.mjs:260` with one that checks the new wording and that `--no-save` is gone, and update `tests/web-review-run.test.mjs`
- [x] 2.3 In `stacks/vue.md`, Verification keeps "dev and QA never install" and adds that review may offer the frozen install of the project's lock file; Targets says `init` adds Playwright to `devDependencies`. Verify `tests/stack-profiles-shipped.test.mjs` and `tests/stack-profile.test.mjs` pass

## 3. Init and doctor

- [x] 3.1 Extract the Playwright resolution doctor uses (`scripts/lib/doctor.mjs`, `entry.playwright`) to a shared helper that also tells whether its Chromium is installed, and make doctor use it; verify `tests/doctor.test.mjs` passes unchanged
- [x] 3.2 In `scripts/lib/init.mjs` `planInit`, add `install.playwright.<platform>` and `install.chromium.<platform>` for each Vue platform with a `web` target (design decision 5), with the `cd <path> &&` command and the "left to commit" detail, and feed the facts from the init script; verify with `tests/init.test.mjs` cases: missing, Chromium only, already set up, a non-Vue platform, a Vue platform without `web`
- [x] 3.3 In `renderConfig`, set `autopilot: precheck` for a new `relevo.yml` with a Vue web platform; with an existing file whose autopilot is `off`, add a `manual` item; verify with `tests/init.test.mjs` cases for both and for a Flutter-only repository (stays `off`)
- [x] 3.4 Doctor's `autopilot.<platform>.playwright` warning names `/relevo:init` and `npm install -D playwright`; verify with `tests/doctor.test.mjs`
- [x] 3.5 In `skills/init/SKILL.md` step 4, say that the Playwright install changes `package.json` and the lock file, left to commit with the other new files, and that a declined install means a browser review of that platform stops until it is installed; verify with `tests/skill-init-doctor.test.mjs`

## 4. Documentation

- [x] 4.1 `docs/commands.md` and `docs/commands.es.md`: the `init` and `review` entries describe the Playwright setup and the confirmed frozen install; verify both files say the same thing
- [x] 4.2 `CHANGELOG.md` under Unreleased: the behaviour change for existing Vue projects (run `/relevo:init` once and commit) and the new install offer in review

## 5. Check

- [x] 5.1 `npm test` and `openspec validate vue-review-deps --strict` pass
- [ ] 5.2 On a scratch `create-vue` project with a Vue web platform: run init and accept both installs; delete `node_modules` and run a browser review (the install is offered and works); change a version in `package-lock.json` (exit 7 is offered); confirm Playwright survives the install and review never asks for it again. Record the result in the change
  - Partial result (2026-10-23), on a fresh `npm create vue@latest -- --ts --default` project: after `npm install` the preflight reports no stale dependencies (the optional packages of other platforms are skipped) and stops at exit 4 without Playwright; after `npm install -D playwright`, a version changed in `package-lock.json` gives exit 7 with `npm ci --ignore-scripts`; without `node_modules` it gives exit 3 with the same command; after `npm ci --ignore-scripts` Playwright still resolves and the preflight reaches the address check (exit 6). `vueWebFacts` reports `{ playwright: true, chromium: true }` for that project and `false` for a folder without it. Still to do by hand: `/relevo:init` and `/relevo:review` end to end on a GitHub repository.

