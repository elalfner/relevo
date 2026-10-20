# Proposal

## Why

`go` and its `dev` and `qa` agents have gaps that were found by reading and running the code, not by speculation:

- A retry after a failed run collides with the branch the failed run pushed ("branch already exists") and the comment says nothing about what to do.
- The specification step never confirms that every artifact exists before validating, and `dev` is handed only a directory, so it reads the whole change by hand while the task count is done by hand as well.
- The specification promises that the branch is pushed when the budget is exceeded, but the runner cuts the run (`--max-turns`, `--max-budget-usd`) without giving the agent a chance to push. The agent also cannot see its own turn counter.
- `qa` is told to review "the diff against the base branch", but at that point the developer's work is not committed: `git diff <base>...HEAD` shows nothing of it, and `git diff <base>` misses new files until they are marked with `git add -N`. On a retry `qa` repeats its whole protocol, and `flutter test` runs without `--no-pub`.
- Only `go` lists the OpenSpec commands it uses. Nothing stops a skill or agent from calling another one.
- `go` reads the issue again after `ready` is applied. In a public repository the author of the issue, who is often a stranger, can edit the text between a maintainer's `ready` and the build. Anyone can also edit it later without notice.
- Nothing deterministic stops a diff from touching sensitive paths (workflows, `relevo.yml`, skill folders, dependency manifests) or from adding a dependency whose install scripts run before `qa` ever sees it.
- The three steps "stage named files, scan the diff, commit" and the preflight checks are repeated in prose in several skills and will drift.

## What Changes

- **Branch already exists.** `go` still refuses and ends in `qa-failed`, but the comment now says what to do by cause: with implementation commits on the branch, run `/relevo:fix <n>`; with only the specification commit, delete the remote branch and apply `ready` again.
- **Specification step.** After the last artifact, `go` re-reads `openspec status --change "<id>" --json` and requires every artifact to be done before `openspec validate`.
- **Build step.** Before launching `relevo:dev`, `go` runs `openspec instructions apply --change "<id>" --json` and hands `dev` its context files and pending tasks. Progress (`remaining`) comes from that command instead of counting `[x]` by hand.
- **Budget cut.** The specification and the skill state what really happens: the runner stops the run, nothing is pushed by the agent, and the workflow's final step marks `qa-failed` with the job status and a link to the run. "Stay within `run_max_turns`" leaves the skill.
- **Diff under review.** `go` makes the developer's new files visible (`git add --intent-to-add` on the files `dev` reported) and defines the diff as `git diff origin/<base>` with generated files excluded. On a retry `qa` audits only the files in `dev`'s report plus each earlier finding. `flutter test` gets `--no-pub` in both agents.
- **Closed OpenSpec command lists** for `go`, `dev` and `qa`, enforced by a test that fails when a skill or agent uses an `openspec <subcommand>` outside its list. On any failure the agent shows the output and takes the failure path; it does not try other flags.
- **Shared scripts, adopted by `go` here** (other skills adopt them in their own changes): `commit-change.mjs` (explicit staging, diff scan, protected-paths guard, commit), `preflight.mjs` (configuration, OpenSpec, clean tree, optional GitHub login) and `next-step.mjs` (one "next step" line per issue state, in the repository language).
- **Next step in messages.** The `built`, `qa_failed` and `needs_spec` messages take their next-step line from `next-step.mjs`. `needs_spec` carries a reason (`missing` or `ambiguous`) and `qa_failed` carries the recovery for an existing branch.
- **Protected paths.** A staged diff that touches hard-protected paths (`.github/`, `relevo.yml`, `.relevo/`, skill folders) fails the run with "protected path in the diff". Dependency manifests and lock files may be touched only when the issue says so with an `Allow-paths:` line. Nothing is pushed.
- **Issue integrity.** The planner computes a hash of the issue title and body when it claims the issue and puts it in the decision. `go` verifies it before writing the specification and fails with "issue changed after ready" (nothing pushed) when it differs. The hand-off message quotes the short hash.
- **Supply chain.** The workflow template installs dependencies without running package scripts where the stack allows it, and `dev` may not add a dependency unless the issue authorizes it. Whether the `id-token: write` permission is needed is verified and, if it is not, removed.

## Capabilities

### New Capabilities

<!-- None: the behaviour belongs to capabilities that already exist in openspec/specs/. -->

### Modified Capabilities

- `go`: recovery message for an existing branch; status re-check before validation; build driven by `instructions apply`; budget-cut behaviour; the diff `qa` reviews and the retry scope; closed OpenSpec command lists; safe commit through one script; protected-paths gate; preflight through one script.
- `security`: the issue text `go` builds is the text a person approved (hash check); protected paths; dependencies and install scripts.
- `issue-lifecycle`: hand-off messages end with a next-step line from one source, `needs_spec` carries its reason and `qa_failed` its recovery.

## Impact

- `skills/go/SKILL.md`, `agents/dev.md`, `agents/qa.md`.
- `templates/workflows/relevo-go.yml` (final-step wording, install commands, permissions) and `templates/issue.md` plus `docs/issue-format.md` (the optional `Allow-paths:` line).
- `scripts/lib/plan.mjs` and `scripts/go-plan.mjs` (hash and allowed paths in the decision), `scripts/lib/issue-parse.mjs` (`Allow-paths:`), `scripts/lib/messages.mjs` (reason, recovery, next-step line).
- New: `scripts/commit-change.mjs`, `scripts/preflight.mjs`, `scripts/next-step.mjs`, `scripts/issue-hash.mjs` and their `scripts/lib/` modules, plus the allowed-command table.
- Tests: `tests/skill-go.test.mjs`, `tests/agents.test.mjs`, `tests/workflow-go.test.mjs`, `tests/go-plan-output.test.mjs`, `tests/messages.test.mjs`, `tests/plan.test.mjs`, `tests/issue-parse.test.mjs`, and new tests for each script and for the command lists.
- Documentation: `docs/commands.md` and `docs/commands.es.md` (the `go` row), `docs/issue-format.md`, `CHANGELOG.md`. The English and Spanish pages must keep the structure `tests/readme-sync.test.mjs` checks.
- Not in this change: the platform registry and stack profiles, the `Platform:` line, dependencies between repositories, run modes and credentials, the other skills adopting the shared scripts, issue format v2, and the review adapters.
