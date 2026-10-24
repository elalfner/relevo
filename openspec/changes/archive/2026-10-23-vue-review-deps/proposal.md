# Proposal

## Why

A browser review of a Vue issue makes the person run `npm install` by hand and asks again to install Playwright every time. Review installs Playwright with `--no-save`, so the next `npm install` or `npm ci` removes it, because npm deletes packages the project does not declare. The Vue profile says Playwright belongs in the project's `devDependencies`, but neither `init` nor `review` puts it there. And the preflight only checks that `node_modules` exists, not that it matches the lock file that the merge with the base branch may just have changed.

## What Changes

- `init`, for each platform with stack `vue` and a `web` target, offers two installs, each confirmed on its own:
  - adding Playwright to the platform's `devDependencies` (`npm install -D playwright`, run in the platform's folder; the changed `package.json` and lock file are left for the person to commit);
  - installing its Chromium (`npx playwright install chromium`).
- When `init` creates `relevo.yml` for a repository with a Vue web platform, it sets `review.autopilot` to `precheck`, because a browser review cannot run with `off`. When `relevo.yml` already exists with `off`, it reports it as a manual step instead of rewriting the file.
- **BREAKING** (review behaviour): when Playwright does not resolve from the project, review no longer installs it with `--no-save`. It says that Playwright is missing from the project, names `/relevo:init` (or the exact `npm install -D playwright` command), and stops. Installing Chromium after confirmation stays, because it does not touch the project.
- The browser preflight detects dependencies that are **stale** as well as missing, by comparing the lock file with what is installed. It reports the frozen install command that fits the lock file: `npm ci --ignore-scripts`, `pnpm install --frozen-lockfile --ignore-scripts` or `yarn install --immutable`. With no lock file it reports no command.
- When dependencies are missing or stale, review offers that exact command and runs it only on a yes. It never runs package scripts, never retries with scripts after a failure, and stops showing the error when the install fails. With no lock file it only warns and stops, as today.
- The Vue profile and the review and init specs are aligned: Playwright is a project dependency set up by `init`; review may offer a frozen install of the project's own lock file; dev and QA still never install anything.

Out of scope: the agent starting the main dev server of the review. That rule ("the server the person started is never stopped or restarted") is a separate decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the requirement "A browser review checks its tools and the app before driving" changes. Dependencies must be installed **and match the lock file**. Review offers a confirmed frozen install without scripts. Playwright is no longer installed with `--no-save`: review sends the person to `init`.
- `init-doctor`: `init` offers Playwright as a dev dependency and its Chromium for Vue web platforms, and sets `review.autopilot` to `precheck` in a new `relevo.yml` with a Vue web platform. Doctor's Vue check gives `/relevo:init` as the fix.

## Impact

- `scripts/lib/web-preflight.mjs` and `scripts/web-preflight.mjs`: lock file detection, a new stale check with its own exit code, and the `install` command in the JSON output.
- `scripts/lib/init.mjs` (plan items and `renderConfig`), and the facts that `init` gathers for each Vue platform (whether Playwright resolves; reuse what doctor already computes).
- `scripts/lib/doctor.mjs`: the fix text of `autopilot.<platform>.playwright`.
- `skills/review/SKILL.md` (step 2, the preflight exit codes), `skills/init/SKILL.md` (the installs of step 4), `stacks/vue.md` (Verification and Targets).
- `openspec/specs/review/spec.md`, `openspec/specs/init-doctor/spec.md`.
- Tests: `tests/web-preflight.test.mjs`, `tests/init.test.mjs`, `tests/doctor.test.mjs`, and the skill text tests that check review and init wording.
- Projects already set up: the next `init` run offers Playwright; until then review stops and points to it instead of installing it for one run.
