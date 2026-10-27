# Tasks

## 1. The setting

- [x] 1.1 Add `runner.labels` (list of non-empty strings, default `ubuntu-latest`) to `scripts/lib/config.mjs` and reject `runner.ephemeral` with the message of the spec; verify `tests/config.test.mjs` covers absent, a list, an empty list, a string and the persistence key
- [x] 1.2 Add the commented `runner` example to `templates/relevo.yml`; verify `node scripts/validate-config.mjs templates/relevo.yml` passes and `tests/template.test.mjs` passes
- [x] 1.3 Document `runner.labels` in `docs/configuration.md` and `docs/configuration.es.md`; verify both pages list the key with its default and the rule that Relevo assumes a runner persists

## 2. Templates that do not assume a new machine

- [x] 2.1 Render `runs-on` from `runner.labels` in `scripts/lib/agent-workflow.mjs` and `scripts/lib/init.mjs` for all seven jobs; verify `tests/agent-workflow.test.mjs` and `tests/init.test.mjs` cover the default, `[self-hosted, linux-build]` and a regeneration that keeps the labels
- [x] 2.2 Install OpenSpec per job under `$RUNNER_TEMP` at a pinned version in `relevo-go.yml` (and any other template that installs it), and add `OPENSPEC_VERSION` beside `RELEVO_VERSION`; verify `tests/workflow-go.test.mjs` no longer finds `npm install --global` and finds the pinned install
- [x] 2.3 Move the Antigravity binary and settings file in `templates/agents/antigravity-step.yml` under `$RUNNER_TEMP` and point the agent at that settings file; verify `tests/agent-workflow.test.mjs` finds no `$HOME` path
- [x] 2.4 Add the final `if: always()` step that removes `.relevo-plugin` and any other file a Relevo step added to the workspace, in each job that adds one; verify the template tests check the step exists, runs always and runs no `git clean`
- [x] 2.5 Extend `scripts/toolchain-check.mjs` with `git`, `gh`, `jq` and `node` for every stack, and keep the stop-before-the-agent behaviour; verify `tests/toolchain-check.test.mjs` has a case with `jq` missing that stops with no model turn and names it
- [x] 2.6 List the assumed tools in the header comment of each template; verify the template tests find the line

## 3. Doctor

- [x] 3.1 Add the runner check to `scripts/lib/doctor.mjs`: compare the `runs-on` of each Relevo workflow on the default branch with `runner.labels`; verify `tests/doctor.test.mjs` covers "A workflow edited by hand", "Workflows and setting agree" and "Hosted runner"
- [x] 3.2 Add the single persistence warning for a runner other than `ubuntu-latest`, in English and Spanish, with no claim about whether the runner is ephemeral; verify the test asserts the warning appears once and that its text never says "ephemeral" as a fact
- [x] 3.3 Ask for the labels in `init` only when the person says the repository uses a self-hosted runner; verify `tests/init.test.mjs` covers the default answer (no `runner` key) and the self-hosted answer

## 4. Documentation and release notes

- [x] 4.1 Add a "Self-hosted runners" section to `docs/execution.md` and `docs/execution.es.md`: setting the labels, the assumed tools, one runner serving CI and builds; verify both pages show a runnable example of `runner.labels`
- [x] 4.2 Add the persistence assumption, the runner-user permissions and the recommendation of an ephemeral runner or a container to `docs/security.md` and `docs/security.es.md`; verify the rows of the first table and the known limits mention the self-hosted case
- [x] 4.3 Add an entry to `CHANGELOG.md` that says existing hand-edited workflows fail `doctor` until `runner.labels` is set; verify the entry names the one-line fix
- [x] 4.4 Run the whole test suite and `openspec validate runner-selection --strict`; verify both pass

## Workflow follow-up

- Follow-up, not done in this change: run `relevo-go` once on a self-hosted runner of a project that uses Relevo (still pinned to 0.7.0, so with the old templates) and record in `docs/pilot-findings.md` what the job leaves outside the workspace (home folder, global npm prefix, `~/.claude`), whether the runner empties `$RUNNER_TEMP` between jobs, and whether `claude-code-action` stores a token or cache outside the workspace. If `$RUNNER_TEMP` is not emptied or a credential is left behind, `design.md` D3 and the final cleanup step must change. Until then the docs say this was not checked on a real runner.
- Try `runner.labels: [self-hosted, linux-build]` in a project that uses a self-hosted runner and run `/relevo:doctor` there.
- Archive the change after the review, and sync its specs into `openspec/specs/`.
