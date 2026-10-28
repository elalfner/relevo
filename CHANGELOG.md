# Changelog

All notable changes to Relevo are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **The `go` workflow template installs the Supabase CLI** for a Supabase platform (`supabase/setup-cli`, guarded by the stack), and `/relevo:doctor` fails when the workflow has no active Supabase step, as it does for Flutter and Laravel. Copy `relevo-go.yml` again to get the step.
- **`docs/stacks.md` explains how to use the `supabase` profile**: the folder layout the Supabase CLI expects inside the platform, one timeline of migrations, how to bring an existing remote project in (`supabase init`, `link`, `db pull`) and the case of a second project.

### Fixed

- **`/relevo:init` no longer says that `go` builds only a repository with one platform.** Since 0.2.0 `go` builds the platform each issue names with its `Platform:` line.

## [0.9.1] - 2026-10-27

### Added

- **`RELEASING.md` explains the Trusted Publisher.** The one-time setting on npmjs.com (organization or user, repository, workflow filename `release.yml`, no environment, and Allow `npm publish` ticked), the secret to delete and the token to revoke, what a mismatch looks like, how to re-run after fixing it, and the hardening that npm recommends once it works.

### Changed

- **The release workflow publishes without a token.** It uses npm Trusted Publishing: the package is published with the identity of the workflow run, on Node 24, and the secret `NPM_TOKEN` is no longer read or checked. A step before the publish prints the versions of Node and npm, and a failed login fails the Publish step with npm's own message. This is for the maintainer: nothing that runs in a project changes, and the package has the same contents as 0.9.0 apart from the version number.

### Known limits

- This is the first version published with the identity of the run. Until it has run, it is not verified that the trusted publisher on npmjs.com matches the user, the repository and the file name; a mismatch fails the Publish step and publishes nothing.
- The trusted publisher allows `npm publish`. npm recommends allowing only staged publishing (`npm stage publish`, which a maintainer approves with two-factor authentication), a stronger gate; it is left for a later change because npm's documentation does not say whether that command takes `--provenance` and `--access public`.

## [0.9.0] - 2026-10-27

### Added

- **`/relevo:init` updates a workflow that differs, by a three-way merge.** It finds the published template closest to the file, fetches it with `npm`, and merges it with the file and the current template. A clean merge is offered in the plan with its difference and written on your agreement, keeping your own changes (your credential line, your runner); a conflict writes nothing and shows both versions; when no published version is close it asks which one the workflow came from. Only files under `.github/workflows/` are written.
- **Each workflow template starts with `# relevo-template: X.Y.Z`,** the version of its text, apart from the pin `RELEVO_VERSION` (the version of the scripts). Raising the pin by hand no longer hides that the text is old.
- **`/relevo:doctor` reports the versions it can read without the network:** the plugin in use, each installation that Claude Code lists for your user and this repository, and the pins of the workflows. It warns when the scopes differ (with the command that updates the lagging one), when the text of a workflow is older than its pin and when a workflow has no stamp.
- **An upgrade page,** `docs/upgrading.md`, with what carries a version, the order that does not break a project (older versions reject the settings a newer `relevo.yml` adds) and how `init` updates a workflow.

### Changed

- **The cloud agent loads the plugin from the package the workflow pins** (`--plugin-dir` on the folder the job unpacks), not from a marketplace. One pin, `RELEVO_VERSION`, decides the scripts and the skills; before, the marketplace entry had no version and a cloud run took the latest plugin. Nothing is cloned from the plugin repository, so a private plugin repository no longer needs `RELEVO_PLUGIN_TOKEN`, and the build stops before the agent when the package lacks `.claude-plugin/plugin.json`. A workflow copied from an older version keeps the marketplace until `/relevo:init` updates it; a project that does nothing keeps working.
- **`/relevo:doctor` puts what needs action first.** The text report starts with a line that says what it judged (the repository, and whether the workflows were read from the default branch or the working copy), then lists the `FAILURES`, the `WARNINGS` and the `NOTES`, each with its count, and only counts the checks that passed. `/relevo:doctor --all` (and `relevo doctor --all`) lists every check as before. `--json` still lists every check and the exit status is the same: 1 only when a check failed. A person or a program that parsed the text layout should use `--json`.
- **A new level, `note`,** for information that asks for nothing: the reminder about the terms of a subscription token, the subscription explanation, a skill reserved for you and iOS on a machine that is not macOS. A note is neither a failure nor a warning.
- **One result per cause.** Workflows that run on another runner than `runner.labels` (the check of 0.8.0 printed one failure per file) are one failure that names them all, and so are workflows that are not installed, disabled or not yet listed. The closing line counts results, not files.

### Known limits

- The update of a workflow by a merge was checked on the five workflows of a real project through its plan (no conflict, its own runner and credential kept) and by tests with the published templates, but a written update, committed and run, has not been done yet.
- The cloud agent loading the plugin from the pinned package was checked on one self-hosted Linux runner with a subscription token, in two runs. It was not checked on a GitHub-hosted runner or with an API key, which use the same option of the action.
- `claude-code-action` keeps its own state in the home of the runner's user, and Relevo does not remove it: settings, caches and the transcripts of its sessions (28 MB after the runs of one runner), which hold what the agent read and wrote. It also installs its own default plugin there.
- `/relevo:init` needs `npm` and a network connection to fetch the published templates it merges with. Without them it leaves the workflow as it is and says why.
- A workflow of Antigravity from a very old version may conflict where it should not: the old template is rendered with its agent blocks only if that package carries them.
- The versions that `/relevo:doctor` lists come from `claude plugin list --json`; if `claude` is not on the path it warns and the other checks run.

## [0.8.0] - 2026-10-26

### Added

- **Choose where the Relevo workflows run.** The new setting `runner.labels` in `relevo.yml` (default `[ubuntu-latest]`) names the runner of every workflow, for example `[self-hosted, linux-build]`. `/relevo:init` writes it into the workflows it adds, and `/relevo:doctor` fails when the `runs-on` of a workflow on the default branch is not the one in `relevo.yml`. There is no setting for whether the runner is ephemeral: Relevo cannot check it, so a runner other than GitHub's is assumed to keep its files between jobs, and `doctor` says so.
- **The workflows leave nothing behind on a runner that persists.** Each job installs OpenSpec under its temporary folder at a pinned version (`OPENSPEC_VERSION`) instead of globally, the Antigravity run keeps its binary, plugin and settings in a home folder of the job, and a last step that always runs removes what the job added to the workspace. The toolchain check also covers `git`, `gh`, `jq` and `node`, and reports a missing tool without needing `jq` to do it.
- **`relevo:urgent`: start an issue without waiting its turn.** An overlay label, next to the issue's state, that puts the issue before all the others in the queue and skips the check of the assignee's unreviewed work (`limits.built_unreviewed_per_person`). It skips nothing else: a complete specification, merged dependencies and `limits.concurrent_agents` still apply, and an urgent issue with a dependency still open is `blocked` with a notice that says so. It counts only when the person who applied it could mark the issue `ready` (write access, or maintainer access when `trust` is `public`); any other label is removed with a comment that names who applied it. Applying it to a `queued` issue starts the queue evaluation at once, and the hand-off message of an issue that started over the limit says how many built issues the assignee now has waiting. `/relevo:init` creates the label and `/relevo:doctor` checks it; a repository set up earlier runs `/relevo:init` once. The name can be changed in `labels.urgent`.
- **Ship with a label.** The new workflow template `relevo-ship.yml` ships an issue when a person applies `relevo:ship` to it: the steps of `/relevo:ship` (`scripts/ship-unattended.mjs`), with the same checks and no model, so it needs no model credential and no local copy. The label is the written confirmation of the person who ships under `review.merger`; anything that stops it is commented on the issue and the label is removed. Nothing from the pull request's branch runs, and `relevo.yml` is read from the base branch. `RELEVO_CLOUD_SHIP=off` pauses it. `/relevo:init` creates the label and adds the workflow in every setup.
- **A GitHub App for repositories that require checks.** With the secrets `RELEVO_SHIP_APP_ID` and `RELEVO_SHIP_APP_KEY`, the ship workflow pushes, merges and closes with the App's token, so the project's CI runs on the archive commit, and waits for it.
- **`review.ship_without_ci`** (default `false`) lets the label merge a pull request on which no check ran.
- `/relevo:doctor` fails when the base branch requires approval of the last push, and checks what the ship workflow needs. The approval comment names the label when the ship workflow is installed.
- **A browser review installs the project's dependencies when you agree.** `scripts/web-preflight.mjs` now also detects `node_modules` that does not match `package-lock.json` (exit 7), for example after the merge with the base branch, and prints the frozen install of the lock file. The review offers that exact command (`npm ci --ignore-scripts`, `pnpm install --frozen-lockfile --ignore-scripts` or `yarn install --immutable`) instead of asking you to run `npm install` yourself; it never runs package scripts and never retries another way.
- **`/relevo:init` sets up a Vue platform for its browser review:** it offers to add Playwright to the platform's development dependencies and to download its Chromium, and a new `relevo.yml` with a Vue web platform gets `review.autopilot: precheck`.

### Changed

- **A workflow edited by hand to another runner now fails `/relevo:doctor`.** Set `runner.labels` in `relevo.yml` to the labels of that runner (one line, for example `runner:` and `  labels: [self-hosted, linux-build]`) and the check passes with a note that the runner is assumed to persist.
- **OpenSpec in the sessions of Claude Code on the web.** `/relevo:init` offers, with a yes to it alone, a `SessionStart` hook in `.claude/settings.json` that installs OpenSpec when it is missing, only in a remote session (`scripts/web-hook.mjs` adds it and keeps the rest of the file). `/relevo:doctor` warns in a web session when the repository has no such hook. When OpenSpec does not run, the preflight of `go` now says to stop, gives the install command and forbids writing the change files by hand, so the agent no longer goes on from memory.
- **A browser review no longer installs Playwright with `--no-save`.** That install was removed by the next `npm install`, so every review asked for it again. Playwright now belongs in the project's development dependencies: when it is missing, the review stops and points to `/relevo:init`. For a project set up before this release, run `/relevo:init` once and commit `package.json` and the lock file. Doctor's Playwright check now resolves it from the folder of the platform and names `/relevo:init` as the fix.
- **The checks of the approved head count for the archive commit** when it changes only `openspec/` and has no checks of its own, in `/relevo:ship` too, so a push that started no workflow no longer reads as "no CI".

### Known limits

- `runner.labels` and the per-job cleanup have not run on a real self-hosted runner. Two things are assumed and not checked: that the runner empties `$RUNNER_TEMP` between jobs, and that `claude-code-action` leaves no token or cache outside the workspace. Run `relevo-go` once on such a runner and look at what it leaves before relying on either.
- With `agent.build: antigravity`, the job now uses a home folder of its own (`HOME` under `$RUNNER_TEMP`); that path is tested on the text of the workflow and with a fake agent, not on a real runner.
- `/relevo:doctor` cannot see an SDK installed on the machine: with the Flutter or PHP step of `relevo-go.yml` commented out because the runner already has the SDK, it still reports that the go workflow installs no toolchain, and that failure can be ignored.

## [0.7.0] - 2026-10-23

### Added

- **Screenshots in a browser review.** The review script gets `capture(name, check, { fullPage })`: `check` asserts the state the shot shows and runs first, so a screenshot saved under the wrong name fails instead of passing unnoticed. The PNG goes to the run's output folder, the agent sees only its path, and it is recorded in the review state. Captures are taken while the person tests: `review-state.mjs capture` refuses after `agree`.
- **`scripts/web-preflight.mjs`** checks a browser review before it drives: `node_modules`, Playwright and its Chromium, and the address with the module scripts of its page. Playwright is installed only with the person's permission, with `--no-save`, and `package-lock.json` is restored. With `--wait` it is the readiness probe of a server the agent started.
- **`scripts/extra-server.mjs`** starts, checks and stops the dev servers the agent needs for lines that require another configuration: a free port only, a process group of its own, a record in `evidence/servers.json`, and it never stops a server it did not start. It refuses to remove a variable while `.env` files exist, because the dev server loads them by itself; it never reads them.
- **`scripts/dev-server-guard.mjs`**: the review no longer switches to the base branch while the dev server under review runs from the working tree, which broke that server until it was restarted.
- **`review-state.mjs qa-pass`** records the hash of the review script QA passed; the runner refuses any other content, so an edited script needs QA again.

### Changed

- **The browser runner enforces the gates itself.** `web-review.mjs` reads the review state (`--state`) and refuses before any browser starts when the autopilot is `off`, the data was not confirmed, the review is agreed, or the script is not the one QA passed. It also refuses a script that takes a screenshot itself, saves a PDF, trace, video, HAR, download or storage state, uploads a local file or passes any `path:` option, and it writes the script's console, redacted, to `script-console.txt` instead of its own output. When the page itself fails, it names that (for example a 500 on a module) before the script's timeout. A run with the default `--out` warns before it replaces a log; each extra run uses `evidence/run-<port>`.
- **The review skill has a browser branch** in steps 2, 3, 5, 8 and 9, a plan of the walk in the brief (`browser`, `command`, `read`, `server <port>`), project commands that leave tracked files as they were, a warning when `relevo.yml` has uncommitted changes, and an evidence hand-off that offers only the PNG files and deletes a folder with none without asking. `review-adapter.mjs` gives the advice for `review.autopilot: off` on a browser (recommend `verify`, `precheck` as the cautious option) in the language of `relevo.yml`, and `review-brief.mjs --autopilot` adds a fixed note that the person confirms every line.
- A project command's exit code can now verify a line in `verify`; a line checked by reading code, CI or docs is only pre-checked.

### Known limits

- The new browser review has not yet run on a real Vue issue: the runner, the preflight, the extra servers and the guard were tested with a real Chromium and real processes, but a whole `/relevo:review` on the sandbox repository, with a dev server running from the working tree, is still to do.
- `extra-server.mjs` and `dev-server-guard.mjs` need `lsof`. Where it is missing (Windows) no extra server is started and the review does not switch to the base branch; it says why.
- `extra-server.mjs` looks for `.env` files in the folder it runs from; for a platform in a subfolder (`platforms.<name>.path`) the agent must run it there.
- The script check and `qa-pass` are a tripwire: they stop a mistake, not an agent that skips them on purpose.
- A review script written for 0.6.0 that calls `page.screenshot` or `console.log`, or a run without `review-state.mjs init`, `confirm-env` and `qa-pass`, is now refused.

## [0.6.0] - 2026-10-23

### Added

- **`doctor` warns when the repository's profile is not in git.** When a platform's profile uses `.relevo/stacks/<stack>.md` and git does not track that file, `doctor` warns that the cloud run and a fresh clone use only the plugin's profile (or have no profile, for a stack the plugin does not ship) and says to commit it.

### Changed

- **An interactive `/relevo:go` in Claude Code builds in a worktree of its own.** Before, it built in the checkout of the session, so two sessions building two issues changed each other's branch and OpenSpec files, and your uncommitted changes stopped a run. Now the skill makes the worktree with the new `scripts/go-worktree.mjs` (`.relevo-worktrees/` next to the repository, from `origin/<base>`, the place `--local` already uses), enters it with `EnterWorktree` by path, and builds there while you watch in your session. It is removed when the issue ends `built` or a gate stops the run before anything is built, and kept, with its path, after a failure. A second run on the same issue stops and names the worktree. The cloud, `--local` and a session that is already in a worktree build where they are. `/relevo:review` still runs in the main checkout.
- **The Flutter profile follows the official Flutter documentation**, as read on 2026-10-22: architecture and its case study, data and backend, testing, performance and the Dart MCP server. The developer and QA now cover the common layout errors, costly work and new futures in `build()`, long lists without a builder, `Opacity` and clipping in animations, heavy parsing on the UI isolate, `dart:html` and `package:js` (they prevent the Wasm build), and plugins in unit tests. The profile no longer imposes or assumes an architecture: the agents follow the one the project's rules declare, new code uses the layers of Flutter's guide only when none is declared, and QA reports an architecture finding only against a written rule. The Dart MCP server is named by its tools: the agents use the ones that write nothing, and never `dart_format`, `dart_fix`, `pub` or the tools that drive an app during a run. `*.mocks.dart` is left out of the review as generated code.

### Fixed

- **`init` no longer says the repository's profile is "not committed".** The words were read as "keep it out of git". The plan, the skill and the docs now say that `.relevo/stacks/<stack>.md` is created and left for you to commit, like `.claude/settings.json`, and the report names it among the new files to commit and push.

### Known limits

- The worktree of an interactive `/relevo:go` was tried by hand, with two runs at once on the sandbox repository; the issue numbers and the logs of that run were not kept. A session that ends midway leaves its worktree in `.relevo-worktrees/`, and `doctor` does not list leftover worktrees. `go-worktree.mjs create` reads `relevo.yml` from the current folder, so `/relevo:go` started from a subfolder of the repository stops with an error.
- The Flutter profile follows the docs as read on 2026-10-22. The review autopilot for Android still drives the app with `flutter_driver`, which the Flutter testing docs now treat as legacy in favour of `integration_test`.

## [0.5.0] - 2026-10-22

### Added

- **Relevo works with Antigravity.** `relevo init` asks which tools the team uses (Claude Code, Antigravity) and whether the scope is the project or the machine. For Antigravity it renders a native plugin from the same skills and agents, with the same commands (`/relevo:go`), and installs it into `.agents/plugins/relevo/` or, for the machine, with `agy plugin install`. The script path is written into the text (Antigravity does not substitute a plugin root variable), the agents `relevo-dev` and `relevo-qa` get an explicit tool list (QA without the tools that write), and a file `.relevo-adapter.json` records the version and a hash of each file so that `relevo update` can render again without overwriting an edit, and `doctor` can report it. Claude Code users change nothing.
- **A cloud build with Antigravity CLI.** `agent.build: antigravity` in `relevo.yml` replaces the model step of the go workflow (the file is one: its agent step and its credential line are marked blocks) with `agy`, pinned by version and sha512, a user-level settings file with the web denied and only listed commands allowed, and a run guard (`agent-guard.mjs`) that reads the event stream, stops the agent at `limits.run_max_turns` or `limits.run_max_tokens` or at a time limit, and fails the run when a tool was refused (Antigravity exits 0 in that case). The secret is `GEMINI_API_KEY`. `limits.run_max_cost` is refused with this agent because it has no cost limit; `trust: public` is refused for now.
- **Protected paths for the files of other agents.** `.agents/`, `.gemini/`, `AGENTS.md` and `GEMINI.md` (the last two at any depth) cannot be committed by a run.
- **`doctor` knows Antigravity.** It checks the rendered plugin, and with `agent.build: antigravity` it looks for `GEMINI_API_KEY` instead of an Anthropic credential. `docs/security.md` says, for each agent, what is enforced, what is partial and what does not exist.
- **`go-local.mjs` runs with Antigravity too.** With `agent.build: antigravity` it starts `agent-guard.mjs run` in the worktree, with the token and turn limits of `relevo.yml` and a time limit of 50 minutes, and keeps the worktree when the guard refuses to start. It uses your own `agy` settings, not the restricted ones of the cloud step.
- **An interactive `/relevo:go` in Antigravity no longer builds in the workspace root.** It starts a `self` builder subagent with `Workspace: 'share'`, arms a `schedule` watchdog and ends the builder with `manage_subagents kill`, so that several chats can build at once without switching each other's branch.
- **`review` goes back to the base branch** after opening the pull request, only in the main checkout and when no other worktree holds that branch; it never fails the review for it.
- **Supabase stack.** A profile `stacks/supabase.md`, a deploy workflow template and `doctor` checks for the Supabase CLI, Docker and the Supabase skills.

### Known limits

- A local Antigravity run (`go-local.mjs`) does not write the restricted `agy` settings that the cloud step writes.

- Antigravity was tried on CLI 1.4.4 with `agy -p` in scratch folders (commands, skills, subagents, permission rules, the event stream, plugin installation). The whole cloud workflow has not run on a real runner, and the key and the plugin installation on a clean runner are not yet checked.
- That the quality of the adversarial QA holds with a Gemini model is not known.

## [0.4.0] - 2026-10-21

### Added

- **`relevo install` asks where to install.** Without `--scope`, in a terminal, it shows a list chosen with the arrows and Enter (or a number): Project, with the folder that gets `.claude/settings.json`, Machine, and Only me; the project is preselected inside a git repository and the machine outside one, and Esc or Ctrl-C cancel without changing anything. Without a terminal it never waits: it uses the project inside a repository and the machine outside one, and says why. No new dependency: the selector is part of the package.
- **Fixed: `relevo update` no longer defaults to the machine scope.** It passed `--scope user` when none was given, so an installation at the project scope was not the one updated; now no scope is passed and Claude Code updates the installation of the current project.
- **The cloud build checks the toolchain before the agent starts.** A new script, `toolchain-check.mjs`, probes each tool that the profile of the platform lists (`flutter`; `php` and `composer`) with `--version`, and the build job runs it right before the agent, from a copy of the package outside the workspace. If a tool is missing, no model turn is spent: the issue becomes `qa-failed` with the new comment `toolchain_missing` (English and Spanish), which names the tools and says to enable the toolchain step and apply `ready` again. Before this, the developer wrote the code and QA found out at the end, after a full run.
- **`/relevo:status` says what it could not read.** A read that `gh` refuses (the repository variable that pauses the cloud, the go workflow file, the comparison of a pull request with its base) is listed under "Could not read", with the reason, and an empty "Nothing is waiting on you." says "(from what could be read)". Before, the report looked complete, and without the pause variable it could leave out the issues you could build by hand. The JSON output has `unread`.
- **`/relevo:init` declares the plugin in the project.** The plan has a new install line, confirmed with its exact command: `claude plugin marketplace add elalfner/relevo --scope project --sparse .claude-plugin && claude plugin install relevo@relevo --scope project`, so that a teammate who clones the repository is offered the plugin even when you installed it for your machine. The new `.claude/settings.json` is left for you to commit; a settings file that is not valid JSON is never rewritten. `/relevo:doctor` warns when the repository does not declare the plugin.

### Changed

- **`relevo install` asks where to install**, and the project is the default inside a git repository. Before, without `--scope`, it installed for the machine. Pass `--scope user` to keep the old result without the question.

### Known limits

- The check of the toolchain before the agent starts (`toolchain-check.mjs`) was tested with fake tools and on the text of the workflow, not yet on a real runner without the SDK: it needs this version published first.
- `relevo install` was tried in a pseudo-terminal with a fake `claude`, not in every terminal emulator and not with a real Claude Code.
- `/relevo:init` declaring the plugin in the project was tried with the script and the two commands, not inside a Claude Code session that asks for the confirmation.
- The workflows still pin the version of the package by hand (`RELEVO_VERSION`), and the package is still published with an npm token kept as the secret `NPM_TOKEN`.

### Upgrading from 0.3.1

- Run `/relevo:init`: it lists the five workflow templates as different (the version, and in `relevo-go.yml` the toolchain check). Copy them, then set `RELEVO_VERSION` to `0.4.0` in each, and `/relevo:doctor` will tell you if one is missing.
- If the plugin is installed for your machine only, `/relevo:init` now offers to declare it in the project so that your team gets it; commit the new `.claude/settings.json`.
- `relevo update` now updates the installation of the current project when you do not pass a scope.

## [0.3.1] - 2026-10-21

### Added

- **The build installs the toolchain of the stack.** The build job of the `relevo-go.yml` template sets up Flutter (`subosito/flutter-action`) and PHP with Composer for Laravel (`shivammathur/setup-php`) with no editing, each step guarded by the stack of the platform of the issue so only that one runs; Vue needs only Node, which the job already has. Installing the dependencies stays the project's choice. Before this, the steps were commented examples, and the first cloud build of the sandbox failed QA with "Flutter SDK is not installed" after a paid run.
- **`/relevo:doctor` fails** when the go workflow is installed and has no active toolchain step for a Flutter or Laravel platform, and `/relevo:init` tells you, for a go workflow that differs from the template, to check that step. See [What the build installs](docs/execution.md#what-the-build-installs).
- **A rejected cloud build keeps its work.** When QA rejects the work after the retries, or tasks are left unfinished, `go` commits the work in progress to the issue's branch before it pushes, as `wip: rejected by QA (#<n>)`, through the same safe commit as a successful build (a protected path, a file outside the platform, a marker or a credential still stops it and nothing is pushed). The issue stays `qa-failed` and no pull request opens. The comment says the branch holds work that QA did not approve, with `/relevo:fix <n>` as the next step and `/relevo:think` plus `/relevo:issue <n>` to rethink, and `fix` takes the finding from that comment as the defect. Before this, the code existed only in the runner and was lost, so a build that failed only because the tests could not run had to be paid for again ([docs/guide.md](docs/guide.md#qa-failed)).

### Changed

- **Get started is simpler.** One install path (the two `claude plugin` commands run in the project folder with `--scope project`; the npm shortcut stays in Install and on the cover), a shorter setup step with the rare cases moved to the table of problems, a note that the build installs the toolchain but not the dependencies of a Vue or Laravel project, and one plain sentence for ruleset, OpenSpec root, milestone, secret and QA. English and Spanish.

### Known limits

- That a rejected cloud build keeps its work (`wip: rejected by QA`) was tested on the text of the skill and the scripts, not yet on a real rejected run in the sandbox: the failure path is run by a model, and the commit inside the runner has not been seen.
- The toolchain steps cover Flutter and Laravel (Vue needs only Node); another stack needs its own step, and installing the dependencies of the project is still yours to add.
- The workflows pin the version of the package by hand (`RELEVO_VERSION`); `/relevo:init` and `/relevo:doctor` report an old pin, but nothing updates it.
- The first publication of the package used an npm token kept as the secret `NPM_TOKEN`; npm Trusted Publishing, which needs none, is not set up yet.

### Upgrading from 0.3.0

- Run `/relevo:doctor`: if it says the go workflow installs no toolchain, copy the Flutter or Laravel step of the current template into the build job of your `relevo-go.yml`.

## [0.3.0] - 2026-10-21

### Added

- **A lean installation and one command.** Relevo is published as the npm package `@elalfner/relevo`, whose file list holds only what runs (the manifest, scripts, skills, agents, stack profiles, templates, licence and notice); the marketplace entry installs the plugin from it. `npm install -g @elalfner/relevo` gives the `relevo` command: `relevo install [--scope user|project|local]`, `update`, `doctor` and `version`. A project install is declared in `.claude/settings.json`. Measured with a local registry: the repository is 5.2 MB, the package 170 kB, and the plugin cache of a project-scope install holds no documentation, tests or OpenSpec history. See [Install](docs/install.md#what-is-installed).
- **The workflows install the package, not the repository.** Each of the five templates sets `RELEVO_VERSION`, unpacks `@elalfner/relevo` at that version and stops, naming the missing file, if a script its job runs is not in the package. `RELEVO_PLUGIN_TOKEN` is no longer needed for the scripts. `/relevo:doctor` reports a workflow that still clones the repository, one without a pin, a pin that differs from the installed plugin and a plugin that lost a folder.
- **A release workflow** publishes the package when a `vX.Y.Z` tag is pushed, after checking that the tag is the version and the tests pass ([RELEASING.md](RELEASING.md)).
- **Get started** ([docs/get-started.md](docs/get-started.md), also in Spanish): the shortest path from nothing to the first merged pull request for a person working alone, in eight steps, each with the command to copy, what you should see and what to do if you do not, and a table of the problems a newcomer meets. It is the first link of the cover and the index. A test runs the example issue of the page through `check-issue` and checks that the output it quotes is output the code produces. The install page no longer says that Flutter is the only stack.

### Changed

- The skill `issue` no longer reads `docs/issue-format.md` at run time; the template carries the section comments, and the long explanation is online.

### Known limits

- The first publication of `@elalfner/relevo` uses an npm token kept as the repository secret `NPM_TOKEN`; switching to npm Trusted Publishing, which needs no token, is planned after the package exists.
- That `claude-code-action` installs the plugin from the `npm` entry of the marketplace in a real run was not seen before the release; the action still clones the repository named in `plugin_marketplaces` for the catalogue.
- The workflows pin a version by hand (`RELEVO_VERSION`): `/relevo:init` and `/relevo:doctor` report an old pin, but nothing updates it.

### Upgrading from 0.2.0

- Run `/relevo:init`: it lists the five workflow templates as different. Copy them, then set `RELEVO_VERSION` to the version you installed. The old workflows stop working once the plugin repository no longer carries the scripts in the layout they clone.
- Install the command with `npm install -g @elalfner/relevo` if you want it; the plugin installed with `claude plugin install` keeps working.

## [0.2.0] - 2026-10-20

### Added

- **Where `go` builds** is derived, not configured: from the workflows that are installed, the model secret that exists and the new repository variable `RELEVO_CLOUD_GO` (`off` pauses the cloud at once, with no pull request; the queue pauses with it). A cloud without a credential no longer fails: the issue stays `ready` and a comment says to run `/relevo:go <n>` on a machine or to add the secret. See [Where `go` runs](docs/execution.md).
- **`go-local.mjs <issue>`** (and `/relevo:go <n> --local`) builds an issue on a person's machine, in a separate git worktree, with the same turn and cost limits and the same closed tool lists as the workflow (written once in `scripts/lib/run-flags.mjs` and compared with the template by a test).
- **Two credentials**: `doctor` deduces `api_key` or `subscription` from the secret name, warns when both exist, shows the state of the pause variable, reminds to read Anthropic's current terms for a subscription, and warns when a subscription is used with more than one concurrent agent. `init` asks where `go` runs and with which credential, switches the credential line of the workflow and sets `concurrent_agents` to 1 for a subscription.
- **After each cloud run** a comment gives the turns, the cost (notional with a subscription) and the tokens read from the agent's execution log, when it has them; a run that stopped at a usage limit or an empty credit says so and tells you to label the issue `ready` again later. The log format and the limit messages are not documented, so both readers are tolerant and say nothing when unsure.
- **`status`** lists the `ready` issues assigned to you with `/relevo:go <n>` when the cloud is not building, and alerts about an issue stuck on `building` (`limits.building_alert_hours`, default 3).
- **Dependencies between repositories**: `Depends-on: owner/repo#N` names an issue of another repository, and the new `links` setting of `relevo.yml` is the closed list of repositories an issue may depend on. The gate waits until the other issue is closed as completed, notices on the queue's schedule, and reads private repositories with a read-only token stored as the secret `RELEVO_LINKS_TOKEN` (public ones need none). An issue that names a repository outside `links`, or whose dependency cannot be read, says so instead of building.
- **`status`, `doctor` and `init` know the links**: `status` shows what a blocked issue waits for in another repository and its state; `doctor` checks that each linked repository can be read and that the secret exists (its name only); `init` asks for `links` and reminds about the secret.
- **`issue` drafts the other side**: when a feature depends on work in a linked repository it drafts that issue, shows it whole, creates it there only if asked, and offers to reuse the `## Data contract` of the issue it depends on.
- **`Platform:` line** in the issue: an issue names the one platform it is for (required with several platforms in `relevo.yml`, optional with one). `go` resolves it, passes the platform, stack and folder to the agents, and a draft without it fails the check. `fix` and `review` find the platform again with the new `platform-of.mjs`.
- **Scope of a commit**: `commit-change.mjs --within <folder> --change <id>` refuses files outside the folder of the platform (the change's specification, `GLOSSARY.md`, `docs/adr/` and `Allow-paths:` aside); the reason is "outside the platform".
- **`fix` keeps the work QA rejected**: it is saved in a stash named `relevo-fix #<n> iteration <k>` (`fix-stash.mjs`), the tree is left clean and the next `fix` offers it back. A branch that holds only the specification is recognised (`branch-work.mjs`), and the task list is checked before the developer and before the commit (`fix-tasks.mjs`): only the corrections are open, one of them a `Test:` task unless it is `(device only)`.
- **`ship` is safer and repeatable**: an approval counts only for the commit it was given on (or the head recorded at the start, across the archive commit), the issue must be `pr-open`, the change is validated and has no open task before archiving, and an already archived change skips the archive (`archive-state.mjs`). A conflict inside `openspec/` after the archive is recovered with a revert, a merge of the base and a new archive, with normal pushes (`conflict-scope.mjs`).
- **Who may run `ship`**: with `review.merger: approver` the person must be a member of `team.members`, not the author or the spec writer, and in `roles` mode one of `team.approvers`; an eligible person who did not approve confirms in writing that they did not.
- **Issue format v2**: optional sections for what the agreement settled (`Outcome`, `Decisions` with ids `D1`..., `Constraints` with `C1`..., `Code pointers`, `Verification`, `Assumptions`, `Open questions`) and a `Related:` line; earlier issues still pass. `go` copies those sections word for word into `design.md` ("From the issue: ...", through the new `issue-sections.mjs`), and `qa` rejects a build that breaks a decision or a constraint, citing its id. See [Writing an issue Relevo can build](docs/issue-format.md).
- **Open questions block the build**: a question under `Open questions` or the text `NEEDS CLARIFICATION` fails `check-issue` and sends a ready issue back as `ambiguous`, whose next step names `/relevo:think #<n>`. A body over about 8,000 characters passes with a warning.
- **Nothing is lost between `think` and `issue`**: `think` writes what it settled with ids before it asks for the reserved interview, and `issue` checks with `issue-coverage.mjs` that every id reached an issue or was discarded on purpose. `/relevo:think #42` starts from an issue that came back.
- **`issue`** asks, in a separate question after creating, whether to apply `ready` (and swaps `needs-spec` for `ready` after an update), searches for similar open issues first, reads only the specifications the issue touches, and keeps its update flow in `skills/issue/references/update.md`.
- **`review` starts with a brief** (`review-brief.mjs`): about five lines with fixed caps, computed from the issue and the `built` comment.
- **Not yet**: the `Design reference` section (pictures and example code for the front) comes in a later change, after the download of pasted attachments is tried against a private repository.
- **`review` audit without evidence is not a pass**: an empty device log, or one with no line from the app, now gives `REVIEW INCONCLUSIVE` (before, the empty log passed and a log without the app's process was audited as a whole). It cannot be waived, and `decide` refuses it.
- **Waivers**: the person can write `waive <number> <reason>` for a finding; with every finding waived the verdict is `REVIEW PASSED (with waivers)` and the pull request body lists them with the reasons. The agent never proposes one, and a fix that changes the specification clears them.
- **`review` is safer around the pull request**: a micro-fix is committed (with the scan) before the pull request opens, the remote branch is brought in before the base is merged, the assignee is compared with who runs it, an existing pull request is reused, and the log is kept with `review-state.mjs drain` as the person tests.
- **Review adapters and an Autopilot**: `review.autopilot` (`off` by default, `precheck`, `verify`) and `review.allowed_origins` in `relevo.yml`. `review` now asks `review-adapter.mjs` how a platform and target are reviewed (a device with `adb`, or a browser; iOS says it is not available yet) and stops before changing anything when there is none. With the autopilot on, the agent walks the checklist and records its own result per line (`precheck`), or marks lines it proved (`verify`), while the person confirms and agrees; the pull request lists what was verified automatically. A web target runs a Playwright script that `qa` reads first, in `web-review.mjs`: a clean browser that can reach only `localhost`, the page and the allowed origins, with credentials passed by variable name and redacted from the output. The audit understands a browser log. `doctor` checks `lib/main_driver.dart`, the `flutter_driver` dependency and Playwright. The default is `off` because the Flutter driver flow has not been run against a real app.
- **Profiles for Vue and Laravel** (`stacks/vue.md`, `stacks/laravel.md`), written and run on projects created for the purpose. The commands QA runs are read-only (the `lint` script of `npm create vue` uses `--fix`, so the profile calls `vue-tsc`, `eslint` and `vitest` directly through `npx --no-install`; Laravel uses `pint --test` and `php artisan test`), and each body says which defects the commands catch and which QA has to find by reading. A repository replaces a command (pnpm, `oxlint`, PHPStan) with `platforms.<name>.checks`. `doctor` knows how to install `composer` and `npm`.
- **Questions for the issue writer**: a profile can have a section `## Questions for the issue writer`, kept out of what `dev` and `qa` receive (`stack-profile.mjs --role issue` prints it) and asked by `/relevo:issue` when the idea leaves them open.
- **Documentation**: a [Guide](docs/guide.md) (the life of an issue with the command of each step, what to do when a review finds a failure, a reviewer asks for changes, QA fails, the quota runs out or the behaviour is unknown, fix or a new issue, cloud or local, credentials and limits, public repositories) and a [Security model](docs/security.md) that says what Relevo protects and what it does not, both in English and Spanish. The page on the issue format now has a Spanish version; the commands page gives the argument and an example of every command; the configuration page covers every setting, the profile layers, `checks` and what the limits mean with each credential. Tests check that every command, script, label and file a page names exists, that every setting appears on the configuration page, and that the guide says what the hand-off messages say.
- **Design reference**: an optional `## Design reference` section in the issue points to a file of the repository, a picture pasted into the issue, a file of a linked repository (`owner/repo:path`) or example code, and says what must match. `check-issue` checks that the files exist, the repositories are in `links` and the links are GitHub attachments. `design-fetch.mjs`, run by `go`, downloads attachments and linked files into `.relevo-design/` (excluded from git) inside fixed limits: GitHub domains only, five files, images up to 5 MB by their first bytes, text up to 200 KB, the token sent only to GitHub. `go` adds a scenario "Matches the reference ..." for each reference, which becomes a line of the review checklist, `dev` reproduces it with the project's own tokens and invents no asset, and `qa` checks the code against it. The new setting `design.images` (default `false`) controls whether pasted pictures are downloaded and shown to the model, because they may show customer data. A reference that cannot be fetched sends the issue back to its writer.
- **Scripts** that hold the rules `go` must not vary: `preflight`, `issue-hash`, `branch-state`, `spec-ready`, `intent-to-add`, `commit-change` and `next-step`, plus the protected-paths and OpenSpec-command tables they and the tests share.
- **`Allow-paths:` line** (optional) in the issue format: the dependency files a change may touch. The files that control the workflow (`.github/`, `relevo.yml`, `.relevo/`, skills, the project rules file) can never be listed.

- **Platform registry**: `platforms` in `relevo.yml` (stack, folder and targets of each platform); the older `platform: flutter-android` still works as one Flutter platform for Android.
- **Stack profiles** (`stacks/<stack>.md` in the plugin, starting with `flutter`): the commands that verify the code, the generated files left out of the diff, the tools, the targets and the typical bugs, in one file. A repository adds to a profile with `.relevo/stacks/<stack>.md` and replaces a command only with `platforms.<name>.checks`.
- **Extra skills per role** (`dev`, `qa`, `issue`, `review`), resolved from the base branch by `scripts/role-skills.mjs`; a skill with scripts is used only when `skills.allow_scripts` names it. `doctor` lists the skills left out, warns over 20 KB per role and compares each skill with `skills-lock.json`.
- **Documentation**: [Stacks and platforms](docs/stacks.md), in English and Spanish.

### Changed

- **`doctor` no longer fails when no model secret exists**: the cloud cannot build, but a local build can, so it warns. Copy the `go` and queue workflows again to get the pause variable, the credential check and the new report steps.
- **`Depends-on: acme/api#12` is no longer read as issue 12 of this repository.** Until now every `#number` of a `Depends-on:` line was taken as local, which could unblock the wrong issue. Copy the workflows again to get `GH_LINKS_TOKEN` in the gate and the queue.
- **`go` with several platforms** builds the platform the issue names instead of refusing; an issue that does not name a valid platform goes to `needs-spec` with the list of platforms. The decision `platform` and its message of the previous release are gone.
- **`fix` commits through `commit-change.mjs`** (protected paths, scan and the platform folder in one step) instead of staging and scanning by hand.
- **The `go` workflow template** exposes `platform`, `stack` and `path` from the `decide` job, and its setup examples are guarded by the stack (Flutter, Vue, Laravel); copy `relevo-go.yml` again to get them.
- **Agents `dev` and `qa` are generic**: the Flutter text moved to the Flutter profile, and `go` hands them the resolved profile. They do not edit `relevo.yml`, `.relevo/` or `skills-lock.json`, and `qa` rejects a diff that touches them.
- **`qa.rules_from`** accepts a list of files; every listed file is protected. `skills-lock.json` is a protected path.
- **`doctor`** reads the toolchain and the targets from the profile of each platform. The checks `tools.toolchain` and `tools.device-bridge` are now `tools.<tool>` (for example `tools.flutter`) and `tools.target.<platform>.<target>`.
- **`init`** asks for the platforms (name, stack, folder, targets) and writes `platforms`; it can create a commented `.relevo/stacks/<stack>.md`, which it never commits.
- **`go` is hardened**: it checks that the issue text is the one that was approved (hash), refuses protected paths and temporary markers or credentials in what it commits, never touches a branch that already exists (the comment says how to recover, by its content), reads the progress of the build from `openspec instructions apply`, uses only a closed list of OpenSpec commands, and ends every comment with the next step from one table in English and Spanish.
- **Agents `dev` and `qa`** run only `openspec status` and `openspec instructions apply`; QA reviews the diff of the working tree against `origin/<base>`, and on a retry still runs analysis and all tests.
- **Workflow template**: copy `relevo-go.yml` again to get the new wording of the final step (a run can be cut at its turn or cost limit) and the install examples without package scripts.

- **`create` is now `issue`**: `/relevo:create` is gone, with no alias, and `/relevo:issue` replaces it. Without an argument it writes new issues exactly as before; with an issue number it updates the description of an existing one.

### Upgrading from 0.1.0

- Copy the workflow templates again (`relevo-go.yml` and `relevo-queue.yml`) into `.github/workflows/`: they gain the pause variable `RELEVO_CLOUD_GO`, the check for a model credential, the read-only token for linked repositories, the reports of what a run used and the stack-guarded install examples. Running `/relevo:init` again lists what differs from the templates without overwriting anything.
- `relevo.yml` needs no change: every new setting has a default (`platforms` from the older `platform:` line, `links`, `review.autopilot` off, `design.images` false, `limits.building_alert_hours`). `/relevo:init` lists what it would add.
- `/relevo:create` is now `/relevo:issue`.

### Known limits

- Several parts have been exercised by tests and by pieces run for real in a development environment, but not yet on a live team or a real build: a cloud build of an issue in the format v2 or for a Vue or Laravel platform, a real `go --local` run, the Flutter driver flow and the `precheck` and `verify` modes of the review against a real app, the download of a real pasted attachment for a design reference, the circular buffer of a real device, and a review by more than one person. Each is recorded in [pilot findings](docs/pilot-findings.md).
- `review.autopilot` is `off` by default for that reason, and `design.images` is `false` by default because a screenshot can show customer data.
- A backend (Laravel) has no `review` adapter, and the review of iOS is not available yet.

## [0.1.0] - 2026-10-15

The first release. It covers the whole cycle for one person, from an idea to a merged pull request, on a Flutter Android project hosted on GitHub.

### Added

- **Commands**, as a Claude Code plugin named `relevo`: `init`, `doctor`, `think`, `create`, `go`, `review`, `fix`, `ship` and `status`.
- **Agents** `dev` and `qa`: the developer implements a specified change and the QA agent audits it, read-only, against the specification and the project rules.
- **Workflows** to copy into a repository: `go` (a light `decide` job that runs the gates and claims the issue, then a `build` job that runs the agent), the queue, the review events, the review SLA reminder and the daily digest.
- **The issue lifecycle**: eleven labels, hand-off messages in English and Spanish, one message per hand-off, and a work-in-progress limit per person.
- **`relevo.yml`**: one configuration file per repository, validated, with defaults.
- **Documentation that travels in the issue**: the glossary entries and decision records settled while thinking go in a `Documentation` section of the issue, are written by `go` in the same pull request as the feature, and are checked by QA.
- **Security**: issue text treated as data, a closed tool list with no web access for the unattended agent, a `trust` level, a ruleset that keeps the agent on `feature/*` branches, and the verified inputs of the agent runner (see `docs/action-parameters.md`).
- **Verification of the project itself**: acceptance tests that run the real scripts, a structure test for every skill, agent and template, and a CI workflow.
- **Documentation** in English and Spanish, the findings of two pilots in `docs/pilot-findings.md`, and the design and specifications in `openspec/`.

### Known limits

- Only the one-person path has run on GitHub and on a real device. Approval by a second person, the `peer` and `roles` review modes, the review reminder and escalation, the review events and the reviewer selection are covered by tests only. A team that uses them may find problems; they will be corrected in a later release.
- Platform: Android with Flutter. Tracker and Git provider: GitHub.
- Branch protection and rulesets need a public repository or a paid plan on GitHub. Without them, approving and merging are enforced only by the written confirmation that `ship` asks for.
- The plugin works together with tools it does not bundle: the OpenSpec command line, `git`, the GitHub CLI and, for `think`, the skills of OpenSpec and mattpocock/skills. `doctor` reports what is missing and `init` offers to install it.
