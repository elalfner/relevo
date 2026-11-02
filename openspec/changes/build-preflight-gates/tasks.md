# Tasks

## 1. Finding classes in the QA contract

- [x] 1.1 Add `scripts/lib/qa-findings.mjs` and `scripts/qa-findings.mjs`: read a QA report, return its numbered findings with their `Class:` (`fixable`, `input`, `spec`, `policy`), treat a missing or invalid class as `fixable`, and say whether every finding is non-fixable and which class the first non-fixable finding has. Verify with a new `tests/qa-findings.test.mjs`: all non-fixable, mixed, no classes, a malformed class, a report that passes (no findings).
- [x] 1.2 `agents/qa.md`: the output contract says that each finding ends with a `Class:` line and defines the four classes with one example each. Verify with `tests/agents.test.mjs`, which must check the contract text and that the first line is still `QA PASSED` or `QA REJECTED`.
- [x] 1.3 `skills/go/SKILL.md` step 5 and `skills/fix/SKILL.md`: run `qa-findings.mjs` on a rejection; when no finding is `fixable` skip the retries and take the usual failure path keeping the work, and when the findings are mixed retry as before and name the class of the first non-fixable finding if QA still rejects. Verify with `tests/skill-go.test.mjs` and `tests/skill-fix.test.mjs` (the skills mention the script, the skip and the mixed rule).
- [x] 1.4 `scripts/failure-comment.mjs` and `scripts/render-message.mjs`: the failure comment states the class and the next step for each class, in English and Spanish. Verify with `tests/messages.test.mjs` for both languages and every class.

## 2. The reasons `inputs` and `policy` and the missing-dependencies exit

- [x] 2.1 Add the reasons `inputs` and `policy` to the table of next steps (`scripts/lib/next-step.mjs`) with the owner and the command for each, and to the message renderer, in both languages. Verify with `tests/next-step.test.mjs` (every state and reason has an entry in both languages) and `tests/messages.test.mjs`.
- [x] 2.2 Add the `qa-failed` message for a build that stops because the installed paths of the platform are missing: it names the path and the step to enable. Verify with `tests/messages.test.mjs`.

## 3. The `External inputs` section of the issue

- [x] 3.1 `scripts/lib/issue-parse.mjs` and `scripts/lib/issue-check.mjs`: parse the section (`<kind>: <name>: <what it is for>`), fail an unknown kind, a `file` that leaves the repository and a `link` to a repository outside `links`, and pass an issue without the section. Verify with `tests/issue-parse.test.mjs` and a check test for each scenario of the spec.
- [x] 3.2 `skills/issue/SKILL.md`: ask for the external inputs that the issue does not state, write the section, say that an input a script cannot verify is listed in the hand-off, and never invent one. Verify with `tests/skill-issue.test.mjs`.
- [x] 3.3 `docs/issue-format.md` and `docs/issue-format.es.md`: the section, its kinds and an example, with the same headings and commands in both languages. Verify with `node --test tests/docs-claims.test.mjs`.

## 4. The preflight script

- [x] 4.1 Add `scripts/lib/build-preflight.mjs` and `scripts/build-preflight.mjs` with `--stage issue`: check the declared inputs (a file exists on the base branch, a link is fetched or already in the fetch manifest, a secret or a variable is present in the environment without printing its value, a `manual` input never blocks, a kind the job cannot verify counts as manual), and print a JSON decision (`ok` or `needs-spec` with the reason `inputs` and the findings). Verify with `tests/build-preflight.test.mjs`: missing file, present file, manual input, secret never printed, no section.
- [x] 4.2 The same script with `--stage spec`: read the task lines of `tasks.md`, take conservative path tokens, compare them with the single list of protected and restricted paths that the commit guard already uses (find it in `scripts/lib` and reuse it, do not copy it), allow a dependency manifest only when the issue's `Allow-paths:` lists it, ignore paths that appear only in prose or in the design, and print the same JSON with the reason `policy`, the task and the path. Verify with fixtures of `tasks.md` for each scenario of the `go` spec, including a protected path, an allowed manifest and a path only mentioned.
- [x] 4.3 Make the script say in its output and in `docs/security.md` that it is an optimisation and not a control, and add a test that every rule it applies is also refused by the existing guard (the commit stage or QA) for the same input. Verify with `tests/build-preflight.test.mjs`.

## 5. The checks in the build job and in `go`

- [x] 5.1 `templates/workflows/relevo-go.yml`: after the fetch step and the toolchain check, a step that runs `--stage issue`; when the decision is `needs-spec`, or the fetch manifest lists refused references, post the `needs-spec` comment and the label change through the same scripts that `go` uses, set an output, and skip the agent step with its `if:`. The closing steps must still run and must not report a run that ended without an outcome. Verify with `tests/agent-workflow.test.mjs` and `tests/go-plan-output.test.mjs` (the step exists, the agent step is guarded, the closing steps run) and by reading the rendered workflow for the Antigravity block.
- [x] 5.2 `skills/go/SKILL.md`: after `spec-ready.mjs` confirms the specification and before `relevo:dev` runs, run `--stage spec`; on `needs-spec` take the existing path with the reason `policy` and the quoted task. Keep the existing handling of a refused reference for a workflow without the new step. Verify with `tests/skill-go.test.mjs`.
- [x] 5.3 Check that a workflow without the new step still works: render the previous template, run the checks of the plugin against it, and confirm that `doctor` does not fail on it. Verify with `tests/skill-init-doctor.test.mjs` and a test with the old template as a fixture.

## 6. Installed paths in the stack profiles

- [x] 6.1 `scripts/lib/stack-profile.mjs` and `scripts/stack-profile.mjs`: read the optional `installed:` list of a profile, add the repository profile's paths to the plugin's and never remove one. Verify with the profile tests for each scenario of the `platforms` spec.
- [ ] 6.2 Add `installed:` to `stacks/vue.md`, `stacks/laravel.md` and `stacks/flutter.md` (none for `stacks/supabase.md`). Before writing each path, check it in a freshly installed project of that stack, and write down which command created it. Verify with the profile tests and with the command that each path exists after the install step in that project.
- [x] 6.3 `scripts/toolchain-check.mjs` and the build job: after the check of the tools, check the installed paths relative to the folder of the platform; a missing one ends with `qa-failed` before the agent and the message of task 2.2. Verify with `tests/` for the toolchain check (missing path, present path, no list) and a workflow test.
- [x] 6.4 `scripts/doctor.mjs`: warn when a platform's profile lists installed paths and the `go` workflow has no active step that installs its dependencies, naming the platform and the step; say nothing when the profile lists none. Verify with `tests/doctor.test.mjs` and `tests/skill-init-doctor.test.mjs`.
- [x] 6.5 `docs/stacks.md` and `docs/stacks.es.md`: the `installed:` key and what each plugin profile lists. Verify with `node --test tests/docs-claims.test.mjs`.

## 7. A conflict with the base branch

- [x] 7.1 `agents/dev.md`: an integration mode that receives the conflicted files and the scenarios, keeps the behaviour of both sides, adds a test that fails if either side is lost where the platform allows, edits only the conflicted files and the new test, and reports what it kept from each side. Verify with `tests/agents.test.mjs`.
- [x] 7.2 `scripts/conflict-scope.mjs` and its library: besides the check of files under `openspec/`, say whether every conflicted file is inside the folder of the platform or the change folder, and list those outside. Verify with `tests/conflict-scope.test.mjs`.
- [x] 7.3 `skills/review/SKILL.md`, step of the synchronisation: on a conflict inside the folder of the platform, hand it to the developer agent in integration mode, run QA with the retries of `qa.retries`, and go on; when the agent cannot resolve it, QA still rejects, or a conflicted file is outside the allowed folders, run `git merge --abort`, leave the branch as it was and stop with the message that names the files. Verify with `tests/skill-review.test.mjs` for each scenario of the `review` spec.
- [x] 7.4 `scripts/branch-state.mjs`: probe a merge of the base branch without changing the tree (`git merge-tree --write-tree` where available) and report `conflict`, `clean` or `unknown` with the files in conflict. Verify with `tests/branch-state.test.mjs` using throwaway repositories for a conflicting branch, a clean one and a git that cannot probe.
- [x] 7.5 `scripts/status.mjs`: the alert on a branch behind the base branch includes that result. Verify with the status tests and a rendered alert in both languages.

## 8. Phases and outcome classes in the usage record

- [x] 8.1 `scripts/progress.mjs` and the progress reader of the workflow: record a timestamp when the announced phase changes, in a file local to the run. Verify with `tests/progress-skill.test.mjs` and a test of the reader with a sequence of phases and attempts.
- [x] 8.2 `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs`: write `phases` (name, attempt, seconds) and `class` into the `relevo:usage` marker, with the classes of the `go` spec, and keep reading comments that lack them. Verify with the usage tests: a built run with a retry, each class, an old comment, and a reader that ignores unknown keys. The visible progress comment must not change.
- [ ] 8.3 Set the class at each exit of `go`, the workflow and `go-local.mjs`. Verify with `tests/skill-go.test.mjs` and the workflow tests that every exit writes one class.
- [x] 8.4 `scripts/status.mjs` and `scripts/digest.mjs`: print, for a window of days, the count per class and the seconds per phase from the usage records, say how many runs have no record, and store nothing. Verify with the status and digest tests, including runs from before the records.

## 9. The QA that passed without its checks

- [ ] 9.1 Reproduce the case in a test project: remove the install step, run the build up to the agent, and confirm that the run now stops before the agent (task 6.3). Then look for any other path in which `QA PASSED` can follow a report that says analysis, lint or tests did not run, by reading `agents/qa.md`, the `go` skill and the hand-off script. If one exists, add a requirement and a task here; if none, record the result in `design.md` under D10. Verify by the test and by the note.

## 10. Documentation

- [ ] 10.1 `docs/guide.md` and `docs/guide.es.md`: what each reason means (`inputs`, `policy`), what to do after each, and how a conflict in `review` is handled. Verify with `node --test tests/docs-claims.test.mjs`.
- [ ] 10.2 `docs/execution.md` and `docs/execution.es.md`: the checks before the agent, the step that is new in the workflow, how a project takes it through `/relevo:init` and raises `RELEVO_VERSION`, and that an older workflow keeps working. Verify with `node --test tests/docs-claims.test.mjs`.
- [ ] 10.3 `docs/security.md` and `docs/security.es.md`: the checks are not a security control and the guards remain. Verify with `node --test tests/docs-claims.test.mjs`.
- [ ] 10.4 `docs/` pages that describe `status` and the digest: the new alert and the summary. Verify with the docs tests.

## 11. Integration checks

- [ ] 11.1 Run `npm test` and `openspec validate --all`, the two steps of the CI, and confirm both pass.
- [ ] 11.2 Run a local build (`go-local.mjs`) on a throwaway repository with an issue that declares a missing input, one whose task edits a protected file, and one that is valid; each of the first two must stop before the developer agent with the right reason, and the third must build.
- [ ] 11.3 Search the files of this change and the new documentation for the name of any real project, organisation or customer used as an example during the exploration, and confirm that none appears.

## Workflow follow-up

- At release time, raise the version in `.claude-plugin/plugin.json` and `package.json` and add the entry to `CHANGELOG.md` on `dev` first, as `CLAUDE.md` says, then promote `dev` to `main` and tag.
- Archive the change on `dev` with `/opsx:archive` once merged; the main specs `go`, `issue-lifecycle`, `issue`, `platforms`, `review`, `status`, `init-doctor` and `documentation` receive the added and modified requirements.
