# Pilot findings: solo repository (task 3.6)

Date: 2026-10-14. Repository: a private sandbox with a minimal Flutter app, `review.mode: none`, one person. The agent ran in GitHub Actions through `anthropics/claude-code-action@v1`; the review ran on a physical Android 14 device.

This is the first time the code that talks to GitHub ran against the real API. Until now it had only been tested with simulated clients.

## Verdict

The cycle `go` → `review` → `ship` completed for one issue:

1. `relevo:ready` started the workflow. The issue moved `ready` → `building` → `built`, the branch `feature/1-add-a-reset-button-to-the-counter` was pushed, and the hand-off comment was correct.
2. `review` ran on the device: three captures, four checklist lines confirmed, `REVIEW PASSED`, pull request opened against `dev` and the issue moved to `pr-open`.
3. `ship` ran with the written confirmation: the specification was archived into `openspec/specs/` and `openspec/changes/archive/`, the pull request was squash-merged, the branch deleted, the issue closed as completed and its labels removed.

`fix` was not needed: the review found no defect, so that command was not exercised.

## What worked against the real API

| Area | Result |
|---|---|
| `go-plan.mjs` gates and `--claim` | Correct decision and labels for every path below |
| Milestone missing | Not started; comment names the missing milestone |
| Assignee missing | Not started; comment names the missing assignee |
| Incomplete specification | `needs-spec`, comment lists "edge cases"; no build |
| Dependency not merged (`Depends-on: #1`) | `blocked`, comment names #1 |
| Dependency merged | Issue built on top of the merged work |
| Capacity (`built_unreviewed_per_person: 1`, one built issue waiting) | `queued`, no branch, no build |
| `render-message.mjs` (`built`, `needs_spec`, no-milestone, no-assignee, blocked) | Text is clear and carries the right next step |
| `check-issue.mjs` | Flagged a missing "Edge cases" section and an empty title |
| `ship-check.mjs` | Correct against a real pull request, including "GitHub has not finished checking whether the pull request can be merged" right after a push (it resolved on retry) |
| `scan-diff.mjs`, `check-archive.mjs`, `stage.mjs`, `label-change.mjs` | No problems |
| `device.mjs`, `capture.mjs`, `review-state.mjs` | Worked on a real device; `audit` returned `REVIEW PASSED` |

## What failed, with the exact error

### F1. The runner cannot install the plugin from a private repository (blocking)

```
✘ Failed to add marketplace: Failed to clone marketplace repository: Cloning into '...'
fatal: unable to get password from user
##[error]Action failed with error: Failed to add marketplace 'https://github.com/<owner>/relevo.git' (exit code: 1)
```

The template uses a plain URL for `plugin_marketplaces`. That works only when the plugin repository is public. Workaround used: a read-only fine-grained token stored as a secret and put in the URL (`https://x-access-token:<token>@github.com/<owner>/relevo.git`). The marketplace and `relevo@relevo` then installed without trouble.

### F2. An unattended run can end before its subagent finishes (blocking, intermittent)

The agent started the `relevo:dev` subagent in the background and the headless session ended:

```
"subtype": "background_tasks_changed" ... "subtype": "task_started"
"result": "The dev agent is building; I'll wait for its report."
```

The run finished green after 39 s, the issue stayed on `building`, and no comment or branch appeared. It happened in both attempts on issue 2 before the fix; the build of issue 1, which ran the subagent in the foreground, worked. Fix that held: the environment variable `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'` on the action step. The next run of the same issue built correctly. Fixed in this repository (template and skill, with tests).

### F3. Authentication failed with a subscription token that was pasted wrongly

```
"result": "Not logged in · Please run /login"
```

`claude setup-token` prints the token over two lines. Pasting it as shown broke it. Stripping whitespace (`pbpaste | tr -d '[:space:]' | gh secret set ...`) fixed it. Not a defect of Relevo, but anyone setting up the secret will meet it; the future `init` and the documentation should say so.

### F4. A failed run with `is_error` only says why when full output is on

Without `show_full_output: true` the log says only `Claude result reported subtype success with is_error:true`. With it, the actual message appears. Useful while piloting; not meant for production, since it prints the whole conversation to the log.

### F5. Preflight failure left the issue untouched and silent

`openspec list --json` reported `no_openspec_root`, because `openspec init` creates empty folders (`openspec/specs`, `openspec/changes/archive`) and git does not store empty folders. The agent stopped correctly and changed nothing, but nobody was told: the issue stayed `relevo:ready` with no comment. The same silence happens for any failure before `go-plan` (F1, F3).

### F6. The workflow has no toolchain step

The template installs Node and OpenSpec only. QA runs `flutter analyze` and `flutter test`, so a Flutter project needs a Flutter step. Added as a commented example in the template.

## Parameters of `claude-code-action` that differ from the template (task 6.4)

| Parameter | Template | Used in the pilot | Why |
|---|---|---|---|
| `anthropic_api_key` | `${{ secrets.ANTHROPIC_API_KEY }}` | not used | A subscription token was used instead |
| `claude_code_oauth_token` | not present | `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` | Run on a subscription. Accepted together with `--max-budget-usd` and `--max-turns` |
| `plugin_marketplaces` | plain URL | URL with a read-only token | F1 |
| `show_full_output` | not present | `true` | F4, only while piloting |
| step `env: CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | not present | `'1'` | F2 |
| extra step `subosito/flutter-action@v2` | not present | stable channel, cached | F6 |

Confirmed against the real run, no change needed: `plugins: relevo@relevo`, `prompt: /relevo:go <n>`, `claude_args` with `--max-turns`, `--max-budget-usd` and `--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task"`, `github_token`, and the `permissions` block. The `id-token: write` permission was not exercised by anything seen in the log. The issue `labeled` event runs the workflow file from the **default branch**, not from the base branch, so workflow changes must reach `main` to take effect.

## `id-token: write` is not needed (task 6.2 of `harden-go-and-agents`)

The build job of `relevo-go.yml` was run in the sandbox repository without `id-token: write`, from `main`. Issue #20 (a small change to the counter screen) went from `ready` to `relevo:built` in about 3 min 30 s, with the hand-off comment posted, QA passed, and every step of the `build` job green, including `claude-code-action`. The template passes `github_token`, so the action does not need the OIDC exchange. The permission was removed from the template.

## `go` with `platforms` and the stack profile (task 6.4 of `platform-registry`)

With `platforms` (one `flutter` entry, target `android`) in the `relevo.yml` of the sandbox repository, and the plugin of `main` with the generic agents, issue #23 (a small change to the counter screen) went from `ready` to `relevo:built` with the hand-off comment, 2 of 2 tasks done and QA passed. The comment quotes the hash of the issue text (`Built from the issue text: de609816`), which shows the `go` of the hardened version was the one that ran.

The first run did not build: the planner queued the issue because the same person already had one built issue waiting (`built_unreviewed_per_person` is 1 in the sandbox). Closing that issue started the queued one on the next queue evaluation, a few seconds later, as designed.

Not seen directly: the log lines of `stack-profile.mjs` and `role-skills.mjs` in the build job; the result is what shows they ran without failing (a failed profile ends the run in `qa-failed` with the reason `profile not resolved`).

## `Platform:` line with one platform (task 5.4 of `platform-line`)

Issue #24 of the sandbox repository says `Platform: app`, the only platform of its `relevo.yml`. With the plugin of `main` (the `Platform:` line, the platform in the decision, `commit-change.mjs --within`) it went from `ready` to `relevo:built` with the hand-off comment: 4 of 4 tasks done, QA passed, and the hash of the issue text in the message (`f4339f71`). The build started at once because the previous built issue had been closed, so the per-person limit did not queue it.

What this shows: the parser reads the line, the planner resolves it, the platform folder `.` leaves the commit scope unrestricted, and nothing in the cloud run broke. What it does not show: the refusal of a file outside a platform folder, or a second platform; those are covered by the tests with throwaway repositories, not by a run.

## Dependencies between repositories (task 5.3 of `cross-repo-dependencies`)

The sandbox repository lists `elalfner/relevo` in `links`, and its secret `RELEVO_LINKS_TOKEN` is a read-only fine-grained token for that private repository. Two test issues were created in `elalfner/relevo` (one closed as completed, one left open) and two in the sandbox that depend on them.

- Issue #28 says `Depends-on: elalfner/relevo#13` (open). It went to `relevo:blocked` within seconds, and the comment names the reference: "Waiting for elalfner/relevo#13 to be merged". The comment does not say the issue could not be read, so the token read the private repository.
- Issue #29 says `Depends-on: elalfner/relevo#12` (closed as completed). It went from `ready` to `relevo:built` with the hand-off comment: 4 of 4 tasks done, QA passed.

Not run in the cloud: a dependency that cannot be read (no token), a repository outside `links`, and the wake-up of a blocked issue when the other repository finishes. The first two are covered by the tests; the wake-up is the queue's scheduled run, which was not waited for. Setting up this check also needed three changes in the sandbox that were not obvious: the secret mapped in two workflow steps, `links` in its `relevo.yml`, and a merge of `main` into `dev` because the squash-merged promotions had left the two branches with different history.

## Execution modes: pause and consumption (task 6.4 of `execution-modes`)

- With the repository variable `RELEVO_CLOUD_GO` set to `off`, the `go` run for a `relevo:ready` issue ended `skipped` in 1 second. The issue stayed `ready`, with no comment and no `building` label.
- After deleting the variable, `ready` had to be applied again (remove the label and add it back) for the build to start: the event that was skipped is not replayed. It then built to `relevo:built` in about 7 minutes.
- The agent runner's `execution_file` is a list of events whose `result` entry carries the turns, the cost and a `usage` object. The comment read "14 turns, about $0.43 (notional: a subscription is not billed per run), 5,207 tokens". The token count excludes tokens served from the prompt cache, which are reported apart.
- Not seen: a real usage-limit failure, the no-credential comment in the cloud, and a real `/relevo:go --local` run.

## `fix` and `ship` checks (task 3.3 of `fix-and-ship-hardening`)

- `fix-stash.mjs` on the sandbox repository: with a modified tracked file and an untracked one, `save` left the tree clean, `find` returned the stash of the issue and `pop` brought both files back.
- `archive-state.mjs` on the sandbox: a change archived in an earlier pilot reported `archived`; a change that does not exist reported `missing` with exit 1.
- Not tried: `ship-check.mjs` against a real pull request. The GitHub command line was not logged in in this environment, so it is not confirmed that `gh pr view --json reviews` returns the commit of each review as `commit.oid`; the code treats a review without it as not stale and adds the warning `review-commit-unknown`. Also not tried: the conflict after the archive (a real merge conflict was simulated in tests only) and a second approver.

## Issue format v2 (task 4.3 of `issue-format-v2`)

- An issue written in the earlier format (the sandbox's #33, pasted from GitHub) still passes `check-issue` and reads as four sections with `issue-sections.mjs`.
- Two v2 drafts for the sandbox, written from the real counter app: one with `Decisions`, `Constraints`, `Code pointers`, `Verification` and `Assumptions` passed; the same draft with a question under `Open questions` failed with the question quoted. `issue-sections.mjs --copy` printed the five sections unchanged, and `issue-coverage.mjs` listed an id of the agreement that no draft held as `WITHOUT DESTINATION`.
- Writing the draft showed why `Code pointers` say "check before trusting": the pointer I first wrote (`lib/screens/counter_screen.dart`) does not exist in the sandbox; the parity text is built in `lib/main.dart`.
- Not tried: a cloud build of a v2 issue, which needs this change on `main` (label events run the workflows of the default branch, and the plugin is installed from it); `QA` rejecting a broken decision by id; `think` in two moments and `think #n` and the `ready` offer, which are skill behaviour that needs a live conversation.

## `review` hardening (task 3.3 of `review-hardening`)

- Run through `review-state.mjs` on logcat-format samples (both `threadtime` lines and a process start line): an empty log, a log of another app only and a log of the app with no error gave `REVIEW INCONCLUSIVE`, `REVIEW INCONCLUSIVE` and `REVIEW PASSED`; an app log with an unhandled exception and a layout overflow gave `REVIEW REJECTED` with the findings numbered; waiving one then both with a reason gave `REVIEW REJECTED` and then `REVIEW PASSED (with waivers)`, and `decide` accepted it; `waived` printed the section for the pull request body and `sync` cleared the waivers.
- Before this change the same empty log gave `REVIEW PASSED` and a log without the app's process was audited as a whole, which is what R1 found by running `auditLog('')`.
- Not tried: the circular buffer of a real device (so it is not known how many lines a long review loses without `drain`), `adb` itself (none here), and a real pull request found or reused by the lookup. `review-who.mjs` was tried against the real login of `gh api user --jq .login` and recognised it, whatever the case of the assignee. In this cloud session `gh pr view --json` and `gh pr list --json` fail (they use GraphQL, which this environment blocks; only `gh api` REST calls work), so `ship-check.mjs` and the pull request lookup of `review` could not be run against a real pull request here, as in the pilot of `fix-and-ship-hardening`; they run on a person's machine, where `gh` is not restricted.

## Browser review and the autopilot (task 5.3 of `review-autopilot`)

- Run for real in this environment's Chromium: a small counter page (plain HTML, no Vue) served locally, a Playwright script written the way the agent would (two lines checked, one scenario about appearance left out), `review-state.mjs init --autopilot verify`, `confirm-env`, `web-review.mjs`, then `auto` for the two lines the runner reported `auto-ok`, `audit --package web` on `evidence/web-log.txt` and `decide`. `auto` was refused before `confirm-env`; the audit passed; `decide` refused until the third line (appearance) was confirmed by the person and the person agreed; the checklist showed the two automatic lines marked, and `auto-list` printed the section for the pull request body.
- In the tests the same runner blocked a request to another origin and recorded it, redacted a secret that the page echoed in the console, refused a script that imported `node:fs` before starting a browser, and wrote an empty log (so the audit is inconclusive) when the script never loaded a page.
- One thing found by running it: the browser also logs "Failed to load resource" for every blocked or failed request, which repeated what the request and response events already said and made a duplicate finding; the runner now skips that message.
- Another: a run with no page loaded had a log with only the header line and would have passed the audit; the runner now writes an empty log in that case.
- Not tried: the Flutter driver flow (no Flutter, no `adb`, no device and no Dart MCP server here), `precheck` and `verify` against a real app, a real Vue project (the page was plain HTML), iOS, and a review script written by a model rather than by hand. The default stays `off` for that reason.

## Profiles for Vue and Laravel (tasks 3.1 to 4.3 of `laravel-vue-profiles`)

Run on two projects created for this: a Vue project from `npm create vue@latest` (TypeScript, Vitest, ESLint, Prettier; Vue 3.5, Node 22) and a Laravel project from `composer create-project laravel/laravel` (Laravel 13, PHP 8.3), in one folder with a `relevo.yml` of two platforms. `stack-profile.mjs`, `platform-of.mjs`, `review-adapter.mjs` and `doctor` resolved both (doctor: profile = default of the plugin, node, npm, php and composer found, the web target needing no extra tool).

- **Fresh projects**: the three commands of each profile exit 0, and no tracked file is modified by `analyze` or `test` (only ignored files: `.eslintcache`, `node_modules`, `.phpunit.result.cache`).
- **Vue, caught** (non-zero exit): a type error, a `v-for` without `:key`, `v-if` with `v-for` on the same element (as a type error), an unused variable, an explicit `any`, a single-word component name, a failing test. **Not caught**: `v-html`, props copied out of reactivity (`const { count } = props`), a listener and a timer never removed, the index used as the key. The body of the profile now says so and asks the auditor to look for exactly those.
- **Laravel, caught**: a style problem (`pint --test` exits 1, naming the file and the fixers) and a failing test (`php artisan test` exits 1, naming the test, file and line). **Not caught**: a controller with `User::create($request->all())` and a loop that queries a relation (mass assignment and an N+1) passed both. The body says so.
- **Found by running them**: the `lint` script generated by `create-vue` runs `oxlint --fix` and `eslint --fix`, which rewrite files, so `npm run lint` cannot be a QA check; `npm install` of the template failed on npm 10.9.4 with `Cannot read properties of null (reading 'edgesOut')` and worked with `--legacy-peer-deps`; Laravel 13 prints the result of Pint and PHPUnit as JSON when the run is not interactive; the first Laravel install took minutes because the downloads from GitHub were refused and Composer fell back to cloning.
- **Tried**: the questions for the issue writer come out of `stack-profile.mjs --role issue` for the Laravel platform and are not in the output for `dev` and `qa`.
- **Not tried**: a cloud build of an issue for either stack (the workflow template has the install steps commented out; trying them needs this change on `main`), a model-written change on either project, a Laravel review (there is no adapter), Playwright against the Vue project, and `pnpm`, `yarn`, `oxlint` or PHPStan variants.

## Reading the guide against the sandbox (task 3.2 of `documentation-guide`)

The commands the guide and the commands page name were run from the sandbox clone: `go-local.mjs 33 --dry-run` printed the worktree and the `claude -p` line with the limits and the closed tool lists that `docs/execution.md` describes; `next-step.mjs` printed the line for a `qa-failed` issue whose branch has only the specification, as the guide says; `stack-profile.mjs`, `platform-of.mjs`, `review-adapter.mjs`, `archive-state.mjs` and `doctor` had been run in the earlier passes.

- **Corrected**: `review-state.mjs` printed a usage line that listed seven of its commands, so a person who typed it without arguments could not learn `waive`, `precheck` or `drain`; it lists all of them now.
- **Seen, and fixed later by `status-says-what-it-could-not-read`**: `status.mjs --repo owner/name` printed "Nothing is waiting on you." right after `gh` refused one of its reads (HTTP 403 on the Actions path, which this cloud session blocks). The message is true for the issues it could read, but it does not say that part of the data is missing. A person would want to be told; left as a follow-up.
- **Not tried**: a person new to Relevo following the guide from the start; the guide was read against the code, not used by someone who did not write it.

## Design reference (task 5.3 of `design-reference`)

Run in a throwaway repository with a `relevo.yml` that links `elalfner/relevo`, a file `design/home.png` and a draft issue whose `Design reference` pointed to that file, to `elalfner/relevo:docs/security.md` and to a file that does not exist.

- `check-issue.mjs` failed the draft naming `design/missing.png` ("does not exist in the repository") and passed it once that bullet was removed.
- `design-fetch.mjs --body-file` reported the repository file as available where it is, and downloaded the file of the linked repository with the real `gh api repos/.../contents/...` (5,142 bytes of text, decoded correctly), wrote `manifest.json`, added `/.relevo-design/` to `.git/info/exclude`, and `git status` did not show the folder.
- In the tests the fetcher refused another domain without making a request, stopped a redirect to another host (and did not send the token there), cut an image at the 5 MB cap while it streamed, refused a file named `.png` whose bytes were not an image and refused an SVG, and sent the token to `github.com` and not to the host that serves the file.
- **Not tried**: the download of a real pasted attachment. No issue of the sandbox or of this repository has one, and GitHub has no API to create one, so the redirect from `github.com/user-attachments/assets/<id>` to the signed host, and whether the token of the workflow can read an attachment of a private repository, are unverified. The fetcher reports a refusal with "the token may not read it" on a 403 or 404, and the way out is to commit the picture to the repository. To try it, a person pastes a small screenshot into an issue of the sandbox, turns on `design.images` and runs `design-fetch.mjs --issue <n>`.
- **Not tried either**: a build that reads the image with `Read` inside `go`, and `qa` judging an image; both are behaviour of the agents that needs a live run.

## Reading Get started as a newcomer (task 3.2 of `get-started`)

The page was followed as written as far as a cloud session allows, against a fresh shallow clone of the sandbox and an empty repository whose remote is the sandbox: `/relevo:doctor` (the script) and `/relevo:init` in plan mode, with an answers file for a one-person Flutter repository.

- **Corrected**: the page said the doctor prints `[pass]` and `[FAIL]` lines; it also prints `[warn]` lines (for example that `adb` is missing), which a newcomer will see, so it says so. The page said the plan "lists `relevo.yml`, the labels and the workflows"; the real plan has one line per change, tagged `[will do]` (what `init` does itself: install the missing skills, create the labels, the branch `dev`, two rulesets, secret scanning, five workflows, the `.gitignore` line) or `[by hand]` (what only the person can do: create the secret of the model, commit and push the new files to the default branch, and, in an empty project, run `openspec init`), and the step now describes exactly that. The `openspec init` case is in its "If not". The quoted tags are checked against the code by a test.
- **Confirmed**: the plan ends by telling the person to commit and push the new files to the default branch because a workflow only runs from there, and to create the API key and store it as the secret `ANTHROPIC_API_KEY` by hand, which is what steps 3 and 4 say.
- **Not followed here**: installing the plugin (`claude plugin ...`), creating the secret, the cloud build, the review on a device and `ship`; they are the parts of the page that no test or run in this environment has exercised. The expected build time ("a few minutes") comes from the first pilot.

## First cloud build of an issue in format v2 (sandbox #34)

Issue "Show a message when the counter is nineteen" with Outcome, Decisions D1, Constraints C1, Code pointers, Verification, Assumptions and a Design reference (`lib/main.dart`), created with `relevo:ready` and milestone Pilot 1.

- The build finished in about 3 minutes: `built` label, 3 of 3 tasks, QA passed, no pull request (as designed, `ship` opens it).
- `design.md` on the branch has the builder's own Context, Decisions and Assumptions, followed by "From the issue: Decisions / Constraints / Code pointers / Design reference / Verification / Assumptions", copied verbatim.
- The `built` comment lists 5 scenarios, the last one "Matches the reference lib/main.dart", so the Design reference became a checkable scenario.
- The run comment says 14 turns, about $0.49 notional.
- Not seen from this session: the QA report text and the citations of D1/C1 (no access to the run log); the branch has no review evidence yet.
- Not exercised: the repo-file and pasted-image paths of `design-fetch` (the reference was a file of the repository itself).

## Lean installation from the real registry (task 6.1 of `lean-install`)

Package `@elalfner/relevo@0.3.0`, published by the release workflow with provenance (139 files, 565 kB unpacked). In an empty project with a clean Claude Code home, on Claude Code 2.1.305: `claude plugin marketplace add elalfner/relevo#dev --scope project --sparse .claude-plugin` and `claude plugin install relevo@relevo --scope project` both finished without an error. The catalogue on disk was 388 KB; the plugin cache held 944 KB (the plugin folders, `LICENSE`, `NOTICE`, the two READMEs and `package.json`) and no `docs/`, `tests/` or `openspec/`. The project's `.claude/settings.json` declared the marketplace with `sparsePaths` and enabled `relevo@relevo`.

Not yet seen: a build in the sandbox with the new templates (task 6.2), because the templates must reach the default branch of the sandbox first and the marketplace entry must reach `main` of this repository.

## First cloud build with the 0.3.0 workflows (sandbox #37, task 6.2 of `lean-install`)

What worked: the label started the run; the `decide` job unpacked `@elalfner/relevo@0.3.0`, passed its guard and claimed the issue; the model action installed the plugin and ran `/relevo:go` and QA (14 turns, about $0.49 notional). So the plugin does install from the `npm` entry of the marketplace in a real run.

What failed, and was my mistake: QA rejected the build with "Flutter SDK is not installed in the QA environment". I replaced the sandbox workflows with the 0.3.0 templates (the sandbox ones were several versions old) and lost the one line the sandbox had added by hand, the Flutter setup step. In the template, the toolchain of each stack is a commented example that the project must uncomment. Restored in the sandbox with a one-block change (`flutter-action` when the stack is `flutter`).

Second attempt, after the Flutter step reached `main` and the branch with only the specification was deleted: `relevo:built` in about 5 minutes, 2 of 2 tasks, QA passed, 13 turns and about $0.49 notional. That is the cloud build of an issue in format v2 with the lean installation: the scripts from `@elalfner/relevo@0.3.0`, the plugin from the `npm` entry. The failed attempt left only the specification on the branch because the implementation is committed only after QA passes; a rejected cloud build loses its code, so `go` should commit it before it takes the failure path (proposed, not done).

Built later as `build-toolchain`: the template now ships the Flutter and Laravel steps active, guarded by the stack, and `doctor` fails when a Flutter or Laravel platform has no active step. Task 4.1 is covered by the second build of #37, whose build job carries the same active, guarded Flutter block as the template (the sandbox file is not otherwise identical to the template) and which reached `relevo:built` with QA passed; the template itself was not copied into the sandbox again.

The same trap waits for anyone who follows Get started: nothing there, nor in `/relevo:init` or `/relevo:doctor`, says that the build job needs the toolchain step enabled, and the first symptom is a QA failure after a paid run. Proposed: `doctor` should fail when the go workflow has no active toolchain step for a configured stack, and `init` should say so in its plan. Not done here.

## A rejected cloud build keeps its work (sandbox #40, task 5.1 of `keep-rejected-work`)

To see a rejection on purpose without touching the default branch of the sandbox, a branch `experiment/kept-test` carried the 0.3.1 go workflow with the Flutter step commented out (the failure of the first build of #37), and `relevo-go` was started by hand on that branch for #40, a small issue in format v2. A manual run reads the workflow file and `relevo.yml` of the branch it is started on. The first run was skipped in 14 seconds: #37 was built and unreviewed, and the limit of one per person kept #40 queued; the branch raised the limit to 2 and the second run built.

Result, in about 3 minutes and 14 turns (about $0.50 notional): `relevo:qa-failed`; the branch `feature/40-...` holds the specification commit and a second commit `wip: rejected by QA (#40)` with the code; the comment says "holds the work that QA did not approve (2 of 2 tasks done); it was kept as work in progress so nothing is lost", repeats the finding (flutter and dart are not installed, so analyze and test could not run) and gives `/relevo:fix 40` with `/relevo:think` and `/relevo:issue 40` as the other way. So the commit inside the runner works, through the safe commit, with the files the developer reported.

Not seen: `/relevo:fix 40` on a person's machine taking the finding from the comment and running the checks.

## Declaring the plugin in the project (task 5.1 of `declare-plugin-in-project`)

On a fresh clone of the sandbox with the plugin installed for the machine only, the `init` plan had the line "Declare the Relevo plugin in the project ... (claude plugin marketplace add ... --scope project ... && claude plugin install relevo@relevo --scope project)". After running those two commands the plan said the repository declares it, and `.claude/settings.json` was the only new file. The doctor warned before and passed after. Running it in a clone without `gh auth` showed that the check was inside the part that needs a GitHub sign-in, so it was moved to the local checks.

Not seen: `/relevo:init` inside a Claude Code session asking the person to confirm that command.

## `status` says what it could not read (task 4.1 of `status-says-what-it-could-not-read`)

Run from this cloud session against the sandbox, where the proxy refuses the Actions paths: the report listed what waits (#37 to review, #40 to fix), the milestone line, and then "Could not read, so this report may be incomplete: the variable RELEVO_CLOUD_GO (... HTTP 403): the issues you could build by hand may be missing". Before the change it printed the same list with no warning, which for a person with nothing waiting would have been "Nothing is waiting on you.". The reason line repeats the text that `gh` printed, so it is long when `gh` wraps the proxy's message.

## `relevo install` in a real terminal (task 5.1 of `interactive-install`)

Run in a pseudo-terminal with a fake `claude` on the path, four cases: in a git repository, Enter on the preselected project installed with `--scope project` and said where the settings went; in the same repository, the down arrow and Enter installed with `--scope user`; in a plain folder the list marked the project as "[not a git repository]", preselected the machine, and Enter installed with `--scope user`; Esc printed "Cancelled: nothing was installed." and exited 130 with no `claude plugin` command run. Seen on the way: the command calls `claude --version` twice before it starts (once in the main flow and once in `execute`), which is harmless and left as it is.

Not tried: a real terminal emulator that sends other key sequences, and a real Claude Code (the commands were a fake).

## The toolchain check before the agent (sandbox #41, task 5.1 of `toolchain-preflight`)

With `@elalfner/relevo@0.4.0` published, `relevo-go` was started by hand on the experiment branch (the 0.4.0 workflow with the Flutter step commented out) for #41, a small issue in format v2. The build job stopped at "Check the toolchain": within about 30 seconds of the start the issue was `relevo:qa-failed` with the comment "was not built: the runner has no flutter ... Nothing was built and no model turns were spent", and the next step pointing to `relevo-go.yml` and `/relevo:doctor`. There was no "This run used N turns" comment and no feature branch with code, so no model turn was spent, against about 14 turns and $0.50 notional for the same mistake in #37 and #40.

Seen: the description of the label `relevo:qa-failed` says "QA still rejected after the retries; branch is pushed", which is not true for this case (nothing was built, no branch); the comment is clear, the label text is not. Also seen: the release workflow reported success 21 seconds after the tag, and npm showed the version about 100 seconds later ("may take a few minutes").

## Times and costs per run

`total_cost_usd` comes from the action's own result. With a subscription token this is the notional price, not a charge.

| Run | Outcome | Time | Turns | Cost (USD) |
|---|---|---|---|---|
| Issue 1, plugin clone fails (F1) | failure | 39 s | 0 | 0 |
| Issue 1, not logged in (F3), twice | failure | 38 s, 48 s | 1 | 0 |
| Issue 1, no OpenSpec root (F5) | stopped at preflight | 49 s | 2 | 0.050 |
| Issue 1, build | `built` | 4 min 1 s | 14 | 0.368 |
| Issue 2, subagent in background (F2), twice | stuck on `building` | 2 min 43 s, 4 min 27 s | 12, 9 | 0.158, 0.103 |
| Issue 2, after the fix | `built` | 4 min 21 s | 15 | 0.397 |
| Four exit-path runs (`blocked`, `needs-spec`, no milestone, no assignee), plus `queued` | no build | 2 min 9 s to 2 min 30 s | 3 | 0.047 to 0.049 |

A built issue costs about 0.4 USD and takes about 4 minutes of agent time for a very small change. An issue that is rejected at the gate costs about 0.05 USD and 2 minutes, almost all of it installing Flutter, OpenSpec and the plugin before the agent starts. The review on the device took the person a few minutes; the log audit and the pull request took seconds. Every label change also starts a run that the job `if` skips immediately (two skipped runs appeared); harmless, but visible in the Actions list.

## Not tested, and why

- **Branch protection on the base branch.** GitHub refused it on a private repository of a free account: `Upgrade to GitHub Pro or make this repository public to enable this feature.` (HTTP 403). So "approving and merging are human acts, enforced by the platform" could not be checked. In this pilot it was enforced only by the written confirmation in `ship`.
- **`relevo-queue.yml`, `status`, the SLA reminder, the review-event workflow, the digest.** They do not exist yet: tasks 4.2 to 4.7 are open in `tasks.md`. `templates/workflows/` holds only `relevo-go.yml` and `scripts/` has no `status.mjs`. `blocked` and `queued` issues therefore do not start by themselves; the pilot relabelled issue 2 by hand.
- **`fix`.** The review found nothing to fix.
- **`peer` and `roles` modes, reviewer selection.** Out of scope for a solo repository.

## Smaller observations

- The `queued` decision changes the label but posts no comment, so the person sees only a label. The `blocked` comment says "It starts automatically when they are", which is false until task 4.2 exists.
- `review` requires `evidence/` to be ignored by git. The sandbox had no such line; it was added to `.git/info/exclude` for the pilot. This belongs in `init` (task 5.1).
- The log audit reads the whole `logcat`. Another Flutter app was running on the device and wrote to the same log (including a notification registration token). No false rejection happened this time, but the audit should read only the process of the app under review (`--pid` or the package name), and the review should warn that the log may hold other apps' data.
- A pull request body with `Closes #<n>` does not close the issue when the base branch is not the default branch; `ship` already closes it explicitly, as designed.
- After `ship`, `dev` and `main` diverge (the squash-merge lives only on `dev`). The release pull request handles it, as documented, but a `main`-only fix (such as a workflow file) cannot be fast-forwarded into `dev`.
- Commits made by the agent are authored by the action's bot account, not by the assignee. Fine, but worth saying in the documentation.

## Proposed changes (not done here)

1. **Report workflow failures on the issue.** Add a final step with `if: always()` (or `failure()`) that checks whether the issue is still `building` or still `ready` and, if so, moves it to `qa-failed` with a comment and the run link. This removes the silent failures of F1, F2, F3 and F5.
2. **Add the private-repository path and the subscription token to the template** as selectable options, and document them in the future `init`.
3. **`init` must create the tracked OpenSpec root** (`openspec/config.yaml` and `.gitkeep` files), add `evidence/` to `.gitignore`, and offer the toolchain step for the chosen platform (tasks 5.1 and 5.4).
4. **`doctor` should check** the secret names, that the plugin repository can be cloned by the runner, that approvals are not dismissed on new commits, and warn when branch protection is unavailable (task 5.2).
5. **Post a comment when an issue is queued**, and change the `blocked` text until the re-evaluation workflow (4.2) exists.
6. **Filter the log audit by process** of the app under review.
7. **Add a guard against the subagent problem in `go`'s own gates**: if the dev agent report is missing when the skill is about to end, take the failure path (the skill now says so; a script check would make it testable).
8. Decide how to enforce human approval on repositories where rulesets are unavailable (task 5.3), since this pilot ran without them.

---

# Second pilot: the full cycle with the queue, one person (task 4.8, partial)

Date: 2026-10-14 and 2026-10-15. Repository: the same sandbox, now public, with `review.mode: none`, one person, `built_unreviewed_per_person: 1`, a milestone with a due date. The plugin was installed the way another person would install it (`claude plugin marketplace add`, `claude plugin install`). Setup was done with `init` and checked with `doctor`.

## Verdict

Four issues went from `ready` to merged, two of them started by the queue and not by a person: #2 was reviewed and shipped; #4 sat `queued` while #2 was waiting, started by itself once #2 merged (after the fixes below), was built, reviewed and shipped; #3 came back `needs-spec`, was corrected, queued, started by the queue, built, reviewed and shipped. #5 was not started because it has no assignee, and said so in a comment. Two `dev` → `main` promotions were done with merge commits. `status` showed "Nothing is waiting on you" at the end.

Not tested, because it needs a second person: approval and merge by someone other than the author, `peer` and `roles` modes, the review reminder and escalation, the review-event workflow, reviewer selection and `needs-reviewer`. They are covered by unit tests only. Task 4.8 was closed on 2026-10-15 with this one-person pilot so that `relevo-v1` can be archived; whatever a team finds in those parts is corrected in a follow-up change.

## What `init` and `doctor` found and did on a real repository

- `doctor` run against the sandbox listed exactly what was missing (three skills, the workflows, `evidence/` in `.gitignore`, the model secret, a CI workflow) and went "All green" after the setup.
- `init apply` created labels, workflows and the ignore line, and two rulesets after the files were pushed.
- A second `init plan` still offered to turn on secret scanning and to ask for the credential although both existed: fixed, `init` now recognises them.
- Rulesets stop everyone, the owner included, from pushing to the base and release branches. A workflow only runs from the default branch. So the files must be pushed first and the rules applied after: `init apply --skip protection,push-scope`, then `init apply` again.
- Secret scanning was reported as set by `init` but read back as disabled once; repeating the same call enabled it. Cause unknown (possibly a delay). `doctor` now reads it back.

## What failed, with the exact error

### G1. The queue, review, SLA and digest workflows could not clone the plugin (blocking)

```
remote: Repository not found.
fatal: repository 'https://github.com/<owner>/relevo/' not found
```

Those four workflows check out the plugin repository for its scripts with the default token, which cannot read another private repository. This is F1 of the first pilot again, in four more files. Fixed: they pass `token: ${{ secrets.RELEVO_PLUGIN_TOKEN || github.token }}`. `doctor` now fails when a workflow checks out a private plugin repository without a token.

### G2. The agent runner refuses a build started by the queue (blocking)

```
Action failed with error: Workflow initiated by non-human actor: github-actions (type: Bot).
Add bot to allowed_bots list or use '*' to allow all bots.
```

The queue starts builds with `gh workflow run`, so the actor is the Actions bot. The build failed after 44 seconds, before it claimed the issue, so the issue stayed `queued` and the queue would have dispatched it again every 30 minutes. Fixed: `allowed_bots: github-actions` (that bot only, never `*`), and the final report step also moves an issue left `queued` by a failed job to `qa-failed`.

### G3. Which branch a workflow runs from

Workflows started by `issues` events, schedules and `workflow_dispatch` run the file on the **default branch**; workflows started by `pull_request` run the file on the **pull request's base branch**. A fix merged only into `dev` repaired `relevo-review` but not the queue. Every workflow change has to reach `main` and `dev`; with squash merges `dev` and `main` diverge, so promotions use merge commits.

### G4. `doctor` reported a false failure

Once, `doctor` said `dev` and `main` did not require a pull request while both rulesets were active; a second run passed. A failed read of the rulesets was being treated as "not protected". Fixed: a failed read is a warning. It also confused a `plugin_marketplaces` URL that carries a token with an unreachable one. Open: `doctor` reads the workflows in the working copy, not the ones on the default branch, so it did not notice that `main` still had the old files.

### G5. Two builds were dispatched for the same issue (open)

When #3 was relabelled, two queue runs started (one per label event), 15 seconds apart. Both decided `{"start":[3]}` and each dispatched `relevo-go` for #3. The queue only decides; the issue becomes `building` several minutes later, when the build job has installed Flutter and OpenSpec and reaches `go-plan --claim`. The second queue run therefore still saw #3 as `queued`. The per-issue concurrency group made the second build wait for the first and then finish quickly (it found the issue already built), so nothing was built twice, but it cost a runner start and about a minute of Actions time. Options: the queue marks the issue `building` when it dispatches (then `go` must accept a dispatched issue that is already `building`), or the queue checks for a `relevo-go` run already queued or in progress. Not done.

### G6. A comment was posted twice (fixed)

After the gates moved to the light `decide` job, labelling #5 `relevo:ready` (no assignee) produced the same comment twice, one second apart. The label event started `relevo-go` and `relevo-queue` together, and both evaluated the same ready issue and applied the same decision. The queue could also have dispatched a build for an issue whose own `go` run was already starting. Fixed: the queue acts only on issues already `queued` or `blocked`; a freshly ready issue belongs to the `go` run its label started. The light job took 23 seconds in total for this outcome (19 seconds in `decide`, `build` skipped, no Flutter install).

## Times

| Run | Outcome | Time |
|---|---|---|
| Queue evaluation | decision and dispatch | about 15 seconds |
| Build of #4, started by the queue | `built` | about 4 min 40 s |
| Build of #3, started by the queue | `built` | about 3 min 40 s |
| Duplicate build of #3 (G5) | ended quickly, issue already built | about 1 min of work after waiting 3 min |
| Run that does not build (label change, no `ready`) | skipped | 1 to 3 seconds |
| `ready` on an issue with nothing to build, after the two-job split (G6) | `decide` only, `build` skipped | 23 seconds |
| `go` run that did not start a build after the setup steps | no build | about 1 min |

Every label change starts two queue runs (the label is removed and another is added); both finish in seconds. No cost per run was read from the logs this time.

## Smaller observations

- The runner's setup (Flutter, OpenSpec, plugin) dominates the time of a run that does not build. A light first job that only decides, and a heavy second job that builds only on `start`, would remove that cost; not done.
- A queue run triggered by a closed issue or a label change evaluates all candidates, so one build can follow another label event within seconds.
- `relevo-go` `skipped` runs are expected: the job `if` rejects every label that is not `relevo:ready`.
- The `evidence/` folder stays on the person's machine with the `attach_to_pr` policy; the person decides whether to drag the screenshots into the pull request.
- Promoting `dev` to `main` is a separate pull request, as designed; `ship` does not do it.
- A repository that has rulesets and is public makes `trust: public` the right setting, but that requires a review mode other than `none`, so a one-person pilot keeps `trust: private-team` and is only safe while one person has write access.

## Proposed changes (not done here)

1. Make `doctor` read the workflow files from the default branch on GitHub.
2. Remove the duplicate dispatch (G5). Reduced by task 3.12 (claiming happens in the light job, within seconds); not removed entirely.
3. Split `relevo-go.yml` into a light job that runs the gates and a heavy job that builds only when the decision is `start`. Done in task 3.12, not yet seen running on GitHub.
4. Re-run this pilot with a second person to cover the untested parts.

# Antigravity CLI, checked before building the adapter (change `antigravity-adapter`, group 1)

Date: 2026-10-21. Antigravity CLI `agy` 1.4.4, macOS arm64, using the cached login of the Antigravity IDE (no API key). Everything below was observed with `agy -p` in scratch folders; nothing was run against a runner yet (task 1.5 is open).

## What holds

| Question | Observed |
|---|---|
| Headless output | `agy -p "<prompt>" --output-format json` returns `status`, `response`, `num_turns` (user turns, not model steps), `usage`; it did not hang without a terminal at 1.4.4 (the reports of the hang were on 1.2.x) |
| `--print-timeout` | The default is `0s` (waits for the turn), not 5 minutes as the documentation says: always pass it, and wrap the call in an outer timeout |
| `stream-json` | One event per step (`init`, `step_update` with `step_type`, `tool_name`, `tool_info`, per-step `usage`, then `result`); steps and tokens can be counted while it runs |
| Skills in `.agents/skills/<name>/` | Run as `/<name> <args>` in print mode; `$ARGUMENTS` expands to the arguments |
| `disable-model-invocation: true` | Honoured: such a skill is not offered to the model and still runs when typed |
| Global skills of the IDE (`~/.gemini/config/skills/`) | The CLI sees them |
| `disable-model-invocation` in a skill of a project plugin | Honoured as well: the skill is not offered to the model |
| Deny rule `command(curl)` in `~/.gemini/antigravity-cli/settings.json` | Blocks the call: the tool step ends in `ERROR`, the run ends `SUCCESS`, exit 0 |
| A command that no rule allows, headless | Auto-denied; exit 0; the JSON has `denied_actions` and stderr says so; the model sees a failed tool |
| Subagent call | Does not block: the main agent says it is waiting and the result arrives later as a system message inside the same run |
| `tools: [run_command, view_file]` (YAML list) in an agent | Honoured, plus a fixed base (`manage_task`, `send_message`, `list_resources`, `read_resource`, `call_mcp_tool`) |
| `agy plugin install <folder>` of a Claude Code plugin | Converts it (skills and agents copied, a `plugin.json` written); `agy plugin validate` says so |
| Plugin namespace | A plugin `relevo` with a skill `go` is `/relevo:go`, as in Claude Code |
| Project plugin | A plugin folder in `<project>/.agents/plugins/<name>/` is read by the CLI |

## What does not hold, or differs from Claude Code

- **`${CLAUDE_PLUGIN_ROOT}` and `${PLUGIN_ROOT}` are not set and not substituted in a skill.** The model improvised a lookup (`find`) instead, which is fragile and defeats a command allow rule. The installed path has to be written into the text.
- **A converted Claude agent has no command tool.** `disallowedTools` is ignored, `model: sonnet` makes a native agent fail to load, `tools: A, B` as a string makes it fail to load (it must be a YAML list), and with no `tools` it gets only reading tools: it could not run the project's tests.
- Agent tool names are the tool's own: `run_command`, `view_file`, `read_file`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `sed_file`, `grep_search`, `find_by_name`, `list_dir`, `search_web`, `read_url_content`, `invoke_subagent`. Permission rules use other action names (`command`, `read_file`, `write_file`, `read_url`, `execute_url`).
- In a native plugin, agents declared in `agents.json` use `{"entries":[{"path":"..."}]}`; an agent's name is the one in its frontmatter, without the plugin prefix.
- **Command rules apply to each command of a chain.** With only `command(node)` and `command(git)` allowed, `git status --short && node -v` and `cd /tmp && node -v` ran (`cd` needs no rule), and `node -v | cat` was denied because `cat` is not allowed. The allow list must name every program a skill pipes into.
- **A subagent inherits the parent's allow rules and the default `commandExecutionPolicy` is enough.** A subagent with `tools: [run_command, view_file, write_to_file]` ran `node -v`, `git status --short`, `npm view left-pad version` (network) and a file write in the workspace, both with the default policy and with `commandExecutionPolicy: auto`.
- **A subagent's result reaches the run via Reactive Wakeup.** The main agent states that it is waiting for the report and ends its turn without tool calls; the result arrives as a system message and the main agent is reactivated. Polling with `manage_subagents` must be forbidden in the skill prompt, as telling the agent "never end your turn" causes busy-wait loops.
- **`command_status` is not in Antigravity's tool registry.** Mapping Claude's `Bash` tool to `['run_command', 'command_status']` breaks subagent executor creation (`failed to construct executor: unknown component: tool "command_status" not found`). It must map to `run_command` only.
- **Not yet checked:** a keyless login on a runner, a real key on a runner.

## Checks before the upgrade path (2026-10-26)

Local checks of the change `upgrade-path` (tasks 1.2 to 1.4), made with the published packages 0.5.0 and 0.8.0 from `npm pack @elalfner/relevo@<version>` unpacked into a temporary folder. Claude Code and `git` as installed on the maintainer's machine. Task 1.1 (that `claude-code-action` forwards `--plugin-dir`) needs a run on GitHub and is not done.

### `--plugin-dir` keeps the names of the commands (task 1.2)

- `claude plugin validate <unpacked 0.8.0 package>` printed `Validation passed`.
- `claude --plugin-dir <unpacked 0.8.0 package> -p x --output-format stream-json --verbose`, reading only the first event (`system`, `init`) and stopping the process, so no model turn is spent. The event lists the plugin as `relevo` with source `relevo@inline` and version `0.8.0`, the nine commands `relevo:doctor`, `relevo:fix`, `relevo:go`, `relevo:init`, `relevo:issue`, `relevo:review`, `relevo:ship`, `relevo:status` and `relevo:think`, and the agents `relevo:dev` and `relevo:qa`. The names are the ones the marketplace route gives (`relevo@relevo`), so `/relevo:go <n>` and the agents the skill launches resolve the same way.
- Not checked: that the action passes the option on (task 1.1).

### `git merge-file` on the real case (task 1.3)

Files: the five workflows of a project that uses Relevo, as they are in its working copy (text of the 0.5.0 templates, pin raised by hand to `0.7.0`, runner `[self-hosted, linux-build]`, its own credential line) as "yours"; the 0.5.0 templates as the base; the 0.8.0 templates as "theirs". Command: `git merge-file -p <yours> <base> <theirs>`.

- **Raw, all five files conflict, on one line each:** `RELEVO_VERSION` is `0.7.0` in yours, `0.5.0` in the base and `0.8.0` in theirs. Nothing else conflicts.
- **With the pin of yours set to the pin of the base first (`0.5.0`), all five merge cleanly** (exit 0, no markers), and then setting the pin to `0.8.0` gives the result.
- The merged `relevo-go.yml` equals the 0.8.0 template plus exactly the project's own choices: `runs-on: [self-hosted, linux-build]` on both jobs, the token line active and the API key line commented out. It has the new text (`OPENSPEC_VERSION`, the cleanup step). `diff` against the 0.8.0 template shows only those four lines.

So the pin has to be set outside the merge, as the design says, and also normalised in "yours" before it. The same holds for the stamp line once templates carry it.

### A conflict is reported as one (task 1.4)

Same files, with a line of `relevo-go.yml` that both sides changed (`npm install --global @fission-ai/openspec`, which 0.8.0 replaced, edited in yours too).

- `git merge-file -p` exits with `1`, the number of conflicts, and the output holds one block between `<<<<<<<` and `>>>>>>>` with both versions. The file given as "yours" is not touched, because `-p` writes to the standard output.
- A usage error (a missing file) exits with `255`. A caller must therefore read an exit status from 1 to 127 as "that many conflicts" and anything else as an error, and write nothing in either case.

### `--plugin-dir` through `claude-code-action` (task 1.1)

Made on 2026-10-27 in a private project that uses Relevo, on its self-hosted Linux runner (user `ubuntu`), with a temporary workflow on a temporary branch, which was deleted afterwards. The step unpacks `@elalfner/relevo@0.8.0` into `$RUNNER_TEMP/relevo` as the go workflow does, and runs the action with `claude_code_oauth_token`, `--max-turns 3` and `--plugin-dir ${{ runner.temp }}/relevo` in `claude_args`, with no `plugin_marketplaces` and no `plugins`. A later step reads the first event (`system`, `init`) of the action's `execution_file`, which is a list of events, so what is reported is what was loaded and not what the model said.

- **The action forwards the option.** Two runs, the same result: the plugin `relevo`, source `relevo@inline`, version `0.8.0`, path `<runner>/_work/_temp/relevo`; the nine commands `relevo:doctor`, `relevo:fix`, `relevo:go`, `relevo:init`, `relevo:issue`, `relevo:review`, `relevo:ship`, `relevo:status`, `relevo:think`; the agents `relevo:dev` and `relevo:qa`. Design D1 of `upgrade-path` holds, and the fallback (the marketplace pinned by tag) is not needed.
- **The action refuses the `push` event** (`Unsupported event type: push`), so a check that has to live on a branch runs from a pull request. It accepted `pull_request`.
- **Even with no `plugins` input the action installed its own default plugin**, `code-review@claude-code-plugins` 1.0.0, into `~/.claude/plugins/cache` of the runner's user.

### What a Claude build leaves on a persistent runner (the follow-up of `runner-selection`)

Same runs. Names of files only, never contents.

- **`$RUNNER_TEMP` is emptied between jobs.** At the start of the second run, a minute after the first, it held only that job's own files; the tarball, the unpacked package, the marker, `claude-execution-output.js` and `claude-prompts/` of the first run were gone. The assumption of design D3 of `runner-selection` holds on this runner.
- **The action leaves a lot in the home of the runner's user, and nothing removes it:** under `~/.claude`, `settings.json`, `backups/`, `policy-limits*.json`, `remote-settings*.json`, `sessions/`, `projects/` (28 MB of session transcripts in this runner, across the runs it has done), `plugins/` (the default plugin and the built-in store) and `downloads/`; plus `~/.claude.json`, `~/.local/state/claude/locks`, the npm cache and logs in `~/.npm`, and the logs of the runner in `_diag`.
- **The marketplace route leaves more, and it accumulates.** The runner still had `~/.claude/plugins/marketplaces/relevo/`, a full clone of the Relevo repository with its tests, and `~/.claude/plugins/cache/relevo/relevo/0.6.0`, from earlier cloud runs of that project. A pinned `--plugin-dir` leaves nothing of the plugin: it lives in `$RUNNER_TEMP`.
- **No token was written in the files of the action.** A search for `sk-ant` in `~/.claude` and `~/.claude.json` found it only in the Relevo source and test fixtures of the marketplace clone and of the 0.6.0 cache (the patterns of the secret scanner and fake keys), and in none of the files of the action's own state. The token reached the action as an environment variable. Only that string was searched, and only in those places.
- **The tools the workflows assume are there:** `git`, `gh` and `jq` in `/usr/bin`; `node` and `npm` from the tool cache of the runner (`_work/_tool`), which persists.
- **What this means for a persistent runner:** the session transcripts stay on disk for as long as someone does not clean them, and they hold what the agent read and wrote (issue text, code). Relevo does not remove them.

## First cloud build with the progress comment and the usage marker (sandbox #41, task 6.1 of `live-run-progress`)

2026-10-28. The scripts were those of the commit `d3bb60b` of this repository, which the sandbox workflows fetched instead of a published version. The runner was `ubuntu-latest` with Node 22, and the credential was a subscription token.

- **Fetching the package from git: `npm pack` of a git spec fails on npm 10.** The first run stopped in the job `decide` at "Install the Relevo scripts" with exit code 1 and no message, because the step is silent. Reproduced with npm 10.9.2: `GitFetcher requires an Arborist constructor to pack a tarball`. It worked on the maintainer's machine (npm 11), so it only showed on the runner. The test workflows now clone the commit and pack the folder (`npm pack <folder>`), which works with npm 10. The published-version route (`npm pack @elalfner/relevo@<version>`) is not affected.
- **The failure path of a run without an outcome worked.** That same first run left the issue `relevo:qa-failed` with the comment "The run failed before it could decide what to do", and nothing was built.
- **The progress comment worked on the second run (run succeeded in 8 min, 16 turns).** One comment, created when the agent started and edited in place: specification, development with `Tasks: 0 of 2`, then `QA (attempt 1 of 2)` with `Tasks: 2 of 2` from minute 2, then delivery, then the closed line "The Relevo build ended after 8 min. The result is in the latest comment of this issue." with the link to the run. The minutes grew about once a minute and the text did not change in between. The issue got three comments from the run: the progress comment (closed), the hand-off and the usage comment.
- **`RELEVO_PROGRESS_DIR` reaches the tools of the agent.** The attempt number can only come from the announcement of the `go` skill, and it appeared. So a variable set through `$GITHUB_ENV` in an earlier step is in the environment of the Bash tool of `claude-code-action`.
- **The usage comment carried the marker** with the figures of the sentence: `<!-- relevo:usage {"turns":16,"cost":0.62,"tokens":6348,"cached":700441,"notional":true} -->`. The sentence said the cost is notional, as with every subscription run.
- **A wrong phase at the start, found and fixed.** The first text read "delivery" at 0 minutes. The job starts on the default branch, which in the sandbox is four commits ahead of the base branch, and the deduction took any commit above the base for a delivery. A commit now counts only when the checkout is on the branch of the issue.

Not seen: the planning phase (it was hidden by the wrong "delivery"), a QA rejection with the second attempt of development, a cancelled job, the daily digest line (the `relevo.yml` of the sandbox has no `digest.issue`), and a run with Antigravity.
