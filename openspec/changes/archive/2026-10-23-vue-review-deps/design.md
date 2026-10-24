# Design

## Context

See proposal.md for the motivation. The pieces in play today:

- `scripts/lib/web-preflight.mjs` runs its checks in order and stops at the first failure: `node_modules` exists (exit 3), Playwright resolves from the project (exit 4), its Chromium exists (exit 5), the address answers (exit 6). Everything that touches the machine is injected (`exists`, `readFile`, `loadPlaywright`, `fetch`), and `tests/web-preflight.test.mjs` uses that.
- `skills/review/SKILL.md` step 2 maps those exit codes to what the agent tells the person. For exit 4 and 5 it runs `npm install --no-save playwright`, then restores the lock file.
- `scripts/lib/init.mjs` `planInit` builds items. An item with `install: true` carries a `command` that the agent shows and runs only on a yes (init SKILL step 4). `applyPlan` never runs installs. `renderConfig` sets lines of the `relevo.yml` template. An existing `relevo.yml` is never rewritten.
- `scripts/lib/doctor.mjs` already computes, for each Vue platform, whether Playwright resolves (`entry.playwright`, through `require.resolve` in the platform folder).
- `scripts/lib/dev-server-guard.mjs` can tell which processes listen on the port of the address under review.

## Goals / Non-Goals

**Goals:**
- One place decides whether the dependencies are missing or stale, and which command installs them: the preflight. The skill only shows its answer.
- Stale detection that works offline, reads only files, and never needs to run npm.

**Non-Goals:**
- Detecting staleness for pnpm or Yarn: only whether dependencies are missing.
- Monorepo lock files above the platform folder (a workspace root). The preflight looks in the platform folder only. With none there, it reports no command.
- Starting or restarting the person's dev server.

## Decisions

### 1. The preflight reports the install command; the skill runs it

`webPreflight` gains a lock file detection in the platform folder. The first match wins, in this order: `package-lock.json`, then `pnpm-lock.yaml`, then `yarn.lock`. The result carries `install`: the frozen command for that lock file, or `null` without one. Exit 3 stays "dependencies missing". A new exit 7, `deps_stale`, means "installed but do not match the lock file". Both carry `install`.

The skill shows `install` and runs it on a yes, from the platform folder, then runs the preflight again. Building the command in code, not in the skill text, means it is tested, and the agent never composes an install command itself.

Alternative considered: the skill picks the command from the files it sees. Rejected: untested, and the agent could improvise a non-frozen `npm install`.

### 2. Staleness by comparing the lock file with what the package manager recorded

- **npm**: npm writes `node_modules/.package-lock.json` on every install. For each entry of `packages` in `package-lock.json` other than the root (`""`), the hidden file must have the same key with the same `version`. An entry marked `optional: true` that is missing from the hidden file is not stale, because npm skips optional packages for other platforms (esbuild, rollup binaries). If the hidden file is missing but `node_modules` exists, the dependencies count as stale: the install was not done by npm from this lock.
- **pnpm and yarn**: only the missing check. pnpm's `node_modules/.pnpm/lock.yaml` leaves out the optional packages it skipped for this platform, so comparing its text with `pnpm-lock.yaml` would report every Vite project as stale. Comparing it package by package needs a YAML parser, which is not worth it for now.

Alternative considered: comparing modification times. Rejected: `git switch` and `git merge` touch the lock file without changing it, which would offer installs for no reason. Comparing contents is deterministic and cheap.

Alternative considered: running `npm ls --all` to compare. Rejected: slow, needs npm, and fails on peer warnings that do not matter for a review.

### 3. Frozen installs without scripts

| Lock file | Command |
|---|---|
| `package-lock.json` | `npm ci --ignore-scripts` |
| `pnpm-lock.yaml` | `pnpm install --frozen-lockfile --ignore-scripts` |
| `yarn.lock` | `yarn install --immutable` |

These are the same rules as the go workflow template (`--ignore-scripts` where the tool offers it). `yarn install --immutable` has no portable flag to skip scripts across Yarn 1 and Berry, so it is shown as it is and the person decides. Frozen installs never change the manifest or the lock file. After the install, the skill still checks `git status --porcelain` for those two files and restores them if they changed, as it does after project commands.

On failure the skill shows the error and stops. It never retries without `--ignore-scripts`: a package that needs its install script is a decision for the person.

### 4. Playwright belongs to the project; review stops asking for it

Exit 4 changes meaning in the skill: no install. The skill says Playwright is missing from the project's development dependencies, names `/relevo:init` and the command `npm install -D playwright`, and stops. Exit 5 (Chromium missing) still offers `npx playwright install chromium` on a yes, because the browser lives in the user's cache, outside the project. The `git restore` of the lock file goes away from that path, because nothing touches the project there.

After a frozen install of a project that declares Playwright, Playwright resolves again. The `--no-save` cycle is gone.

### 5. Init: two install items per Vue web platform, plus the autopilot

`planInit` receives, for each configured Vue platform with a `web` target, the facts `playwright` (resolves) and `chromium` (installed). It reuses the resolution doctor already does, extracted to a shared helper so both read the same answer. Items:

- `install.playwright.<platform>`: `cd <path> && npm install -D playwright`, when it does not resolve. The detail says `package.json` and the lock file are left to commit.
- `install.chromium.<platform>`: `cd <path> && npx playwright install chromium`, when Chromium is missing or Playwright is being added. Init's step 4 runs installs in plan order, so Playwright is added first.

`renderConfig` sets `autopilot: precheck` when the answers have a Vue platform with a `web` target and the person gave no other value. With an existing `relevo.yml` whose autopilot is `off`, the plan adds a `manual` item. This follows the rule that init never rewrites an existing file.

Alternative considered: running `npm install -D playwright` from review on a yes. Rejected: it would change `package.json` on the issue's feature branch and mix a tooling change into the issue's pull request.

### 6. The person's dev server after an install

An install replaces `node_modules` under a running Vite server, which can break it. When the install ran and the preflight then fails on the address (exit 6), or a listener on the port runs from this folder (`dev-server-guard`), the skill tells the person to restart their server. It never restarts the server itself.

## Risks / Trade-offs

- [The npm hidden lock file format changes between npm versions] → The comparison uses only `packages[key].version` and `optional`, present since lockfileVersion 2. Unknown shapes count as "cannot tell" and fall back to the missing check. That case never reports stale, so a review is not blocked.
- [`--ignore-scripts` leaves a package that needs a postinstall broken] → The page or a module then fails at exit 6, with the detail shown. The person can run the install with scripts themselves. Review does not.
- [Platforms whose lock file sits at a workspace root] → No command is offered and the person installs by hand, as today. This is listed as a non-goal and can be added later without changing the specs' behaviour for single-package projects.
- [Existing Vue projects keep failing at exit 4 until they run init] → Doctor already warns. The review message names `/relevo:init`, and the changelog explains the change.

## Migration Plan

Ship in a minor release. Projects set up before it see, at their next review, the message that Playwright is missing from the project and `/relevo:init`. One init run and one commit fix it for good. No data or state file changes. Rolling back restores the `--no-save` behaviour.
