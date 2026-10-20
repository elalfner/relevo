# Design

## Context

See `proposal.md` (Why) for the problems. What matters for the approach:

- `go` is a skill (`skills/go/SKILL.md`) that follows rules and calls scripts in `scripts/`. The scripts hold the rules that must not vary from run to run; the skill is prose. This change follows that split: every new rule is a script with a test, and the skill only says when to run it.
- The planner (`scripts/lib/plan.mjs`, run by `go-plan.mjs`) already receives each issue with its `title` and `body`, and returns a `start` decision that travels as base64 JSON to the build job (`--decision`). The skill treats that JSON as data.
- Hand-off messages are rendered by `scripts/lib/messages.mjs` from a catalog per language. `built`, `qa_failed`, `changes_requested` and `approved` already take their command from a small `COMMANDS` map; `needs_spec` has a hard-coded sentence.
- `go` commits the specification on its own before the build. The developer's code is not committed until QA passes (step 6), so QA sees it only as uncommitted work. Checked with a throwaway repository: `git diff <base>...HEAD` shows nothing of uncommitted work, `git diff <base>` shows tracked changes but not new files, and `git add --intent-to-add` makes new files appear.
- `openspec instructions apply --change <id> --json` (OpenSpec 1.14.3) returns `contextFiles` (artifact id to paths), `progress` (`total`, `complete`, `remaining`), `tasks`, `state` (`blocked` when artifacts are missing), `missingArtifacts` and `instruction`.
- `openspec status --change <id> --json` lists every artifact with `status` (`done`, `ready`, `blocked`, `skipped`) and `requires`.
- `claude-code-action` runs under `--max-turns` and `--max-budget-usd`. The runner ends the process; the agent gets no chance to push.

## Goals / Non-Goals

**Goals:**
- Every behaviour in the proposal is enforced by a script and a test, not only by sentences in a skill.
- One implementation of "stage, scan, check paths, commit", of the preflight and of the next-step line, ready for the other skills to adopt later.
- No change to the lifecycle labels, to `relevo.yml` keys, or to what a person types.

**Non-Goals:**
- Making `fix`, `review` or `ship` use the shared scripts (their own changes do that).
- Stack profiles: the generated-file exclusions stay Flutter-specific here and move to a profile in the platform-registry change.
- Sandboxing the operating system. The protected-paths guard and the install rule reduce what a diff can do; they do not isolate the runner.

## Decisions

### D1. The kind of existing branch is decided by which paths changed

A script `branch-state.mjs <base> <branch> <change_id>` fetches the remote branch and lists `git diff --name-only origin/<base>...origin/<branch>`. If every path is under `openspec/changes/<change_id>/` the branch is `spec-only`; if any path is elsewhere it is `implementation`. `go` passes the result to the message as `recovery` (`fix` or `delete-branch`).

- *Alternative:* look at commit subjects (`docs: specification for #n`). Rejected: subjects are free text and a later version may change them; paths are what the recovery depends on.
- `qa_failed` gets an optional `branch_state` (`pushed` by default, `unsafe`, `existing`). The existing `pushed: false` stays as an alias of `unsafe`, so current callers and tests keep working.

### D2. "Specification complete" is read from artifact statuses

`go` runs `openspec status --change <id> --json` after the last artifact and a pure function `planningComplete(status)` returns true when every artifact is `done` or `skipped`. If not, `go` writes what is missing and checks once more; a second miss is the failure "specification incomplete".

- *Alternative:* trust `isPlanningComplete` from the same JSON. Not used until its meaning is confirmed on a finished change (open question); the per-artifact rule is explicit and matches the propose workflow of OpenSpec itself.

### D3. The developer is driven by `instructions apply`

Before `relevo:dev` runs, `go` runs `openspec instructions apply --change <id> --json`, passes `contextFiles` and the tasks that are not complete to the agent, and after the agent reports it reads `progress.remaining`. `remaining > 0` is "tasks left unfinished"; `state: blocked` is "specification incomplete". The `tasks_done` and `tasks_total` of the `built` message come from `progress`.

- Observed on this change (21 tasks): each entry of `tasks` has `id` (a sequential index, not the `1.1` label, which is inside `description`), `description`, `done`, `sourcePath` and `line`; `contextFiles` maps `proposal`, `specs`, `design` and `tasks` to absolute paths. The pending tasks are the entries with `done: false`.
- *Alternative:* keep counting `[x]` in `tasks.md`. Rejected: it duplicates OpenSpec's own count and breaks if the checkbox format changes. `scripts/lib/tasks-file.mjs` stays, because `fix` uses it.
- `dev` and `qa` may run the same command (read-only) to refresh progress.

### D4. QA reviews the working tree against the base, with new files marked

After `dev` reports, `go` runs `intent-to-add.mjs <files from dev's report>`, which validates the names like `stage.mjs` does, skips paths git ignores, and runs `git add --intent-to-add -- <paths>`. QA then runs `git diff origin/<base> -- . ':(exclude)*.g.dart' ':(exclude)*.freezed.dart'`. On a retry the pathspec is the files in `dev`'s new report. QA never touches the index (`disallowedTools` already blocks Write and Edit; the instruction says so explicitly).

- *Alternative:* QA reads `git status` and opens untracked files one by one. Rejected: more tool calls, easy to miss a file.
- *Alternative:* `go` writes the diff to a file. Rejected: QA must be able to re-run the command and narrow the paths itself.
- `commit-change.mjs` later stages real content on top of the intent-to-add entries without any special case.
- `flutter test` gets `--no-pub` next to the existing `flutter analyze --no-pub`, in both agents.

### D5. The budget cut is reported by the workflow, not by the agent

The skill loses "stay within `run_max_turns`" and the spec scenario changes (done in the delta). The final workflow step keeps marking `qa-failed`; its comment says that the run may have reached the turn or cost limit, because the job status alone cannot tell a cut from another failure. `run_max_turns` and `run_max_cost` stay in the decision for reporting.

- *Alternative:* make the agent count tool calls and push early. Rejected: it cannot see the runner's counters, and a self-imposed limit would be a second, inconsistent one.

### D6. Closed OpenSpec lists live in one table, tested against the text

`scripts/lib/openspec-commands.mjs` exports the allowed subcommands per file: `go`, `dev`, `qa`. Each of the three files has a section `## OpenSpec commands` with the list in inline code. A test checks that (a) the section equals the table and (b) every `openspec <subcommand>` found in a fenced block, or in inline code outside that section and outside lines that say "never" / "do not", is on the table. Prohibitions are written as "Never ..." so they are not read as uses.

- `go`: `--version`, `list`, `new change`, `status`, `instructions <artifact>`, `instructions apply`, `validate`.
- `dev` and `qa`: `status`, `instructions apply` (read-only).
- Other skills are added to the table by their own changes; until then the test covers only these three files, and says so.

### D7. One commit script, with protected paths

`commit-change.mjs --message <m> [--allow <globs>] -- <paths...>` does, in order: validate names with `explicitStageArgs`; check protected paths on the names and on `git diff --cached --name-only` after staging; `git add`; scan `git diff --cached` with `scanDiff`; commit. On any finding it unstages only the named paths (`git reset -q -- <paths>`), prints each finding with file and line, and exits 1 without committing. It prints no secret, only the kind. Exit 2 is bad usage.

- `scripts/lib/protected-paths.mjs` has two tiers. **Hard** (never allowed, whatever the issue says): `.github/`, `relevo.yml`, `.relevo/`, `.claude/skills/`, `.agents/skills/`, and the file named by `qa.rules_from` (so a defect cannot be fixed by rewriting the rule). **Soft** (allowed only through `Allow-paths:`): `pubspec.yaml`, `pubspec.lock`, `package.json`, the npm, pnpm and yarn lock files, `composer.json`, `composer.lock`, `Gemfile`, `Gemfile.lock`.
- A small glob matcher (`*`, `**`) is written instead of using `path.matchesGlob`, which is experimental in the Node versions the plugin supports (`>=20.19`).
- `Allow-paths:` is parsed in `issue-parse.mjs` like `Depends-on:` (comma separated). `check-issue.mjs` reports a hard-protected path in it as a problem. The planner copies the list into the `start` decision as `allow_paths`, and `go` passes it to the script.

### D8. A shared preflight

`preflight.mjs [--checks config,openspec,openspec-root,clean-tree,gh]` runs the checks `go` lists today in step 0 and prints one line per failure with its fix; exit 1 on any failure. It calls the configuration loader directly and runs `openspec --version` and `openspec list --json` (the root must be an object). `gh auth status` is optional so that other skills can ask for it. The command runner is injected, so the tests need neither OpenSpec nor GitHub.

### D9. Next step from one table

`scripts/lib/next-step.mjs` exports a table keyed by lifecycle state (and by reason for `needs-spec`) with `command`, `who` and a short hint in `en` and `es`, and `nextStep({ state, reason, issue, language })`. `messages.mjs` replaces its `COMMANDS` map and the hard-coded `needs_spec` sentence with it. `needs_spec` gains a `reason` field (`missing` or `ambiguous`; `missing` by default so the current callers keep working). A test iterates `LABEL_KEYS` and fails when a key has no entry. For `ambiguous` the command is `/relevo:issue <n>` and the hint mentions `/relevo:think`; no new syntax is promised for `think`.

- The CLI `next-step.mjs --state built --issue 42` prints the line, for skills' final reports. The message catalog keeps its "Your next step:" wording; `who` is for the report line, because a message already names its recipient.

### D10. The issue hash is computed once, by the planner

`scripts/lib/issue-hash.mjs` exports `issueHash({ title, body })`: SHA-256 of the normalized title and body (`\r\n` to `\n`, trailing spaces removed per line, ends trimmed). `planGo` adds `issue_hash` to the `start` decision from the title and body it already holds. `go` runs `issue-hash.mjs --repo <owner/name> --issue <n> --expect <hash>` before writing the specification: it reads title and body with `gh issue view --json title,body`, and exits 1 on a difference. The `built` message quotes the first 8 characters.

- A manual run uses the hash from the `go-plan` output, so both paths are checked the same way.
- A decision without `issue_hash` (made by an older planner) is not rejected: `go` continues and says in its report that the text was not verified.
- Residual risk, stated in the documentation: an edit before the planner reads the issue is not caught, and the hash does not cover comments.

### D11. Dependencies

`dev` gets a rule: do not add a dependency unless the issue's `Allow-paths:` names its manifest; otherwise report it as an open question (which `go` already turns into `needs-spec`). The workflow template gets commented install examples without package scripts (`npm ci --ignore-scripts`, `composer install --no-scripts`) and a note that Dart's `pub` runs no install-time scripts, so for the one platform supported today the note is informational. The `id-token: write` permission is not changed here: a task verifies in the sandbox repository whether the action needs it, and the template changes only if the run succeeds without it.

## Risks / Trade-offs

- [A maintainer fixes a typo after `ready` and the run fails with "issue changed after ready"] → the message says to apply `ready` again; the cost is one retry, and it is the point of the check.
- [`git add --intent-to-add` changes the index] → only intent-to-add entries for files `dev` reported, never content; `commit-change.mjs` and `git restore --staged` handle them. Ignored paths are skipped.
- [The closed-list test reads prose] → a fixed section and a "never" convention keep it predictable; a new skill must add its row to the table.
- [Protected paths block a legitimate dependency change] → `Allow-paths:` in the issue is the supported way, and the failure message says so.
- [`Allow-paths:` is written by whoever wrote the issue, possibly a stranger in a public repository] → only maintainers apply `ready`, the hash blocks later edits, and hard-protected paths cannot be allowed at all.
- [The exclusions in the QA diff are Flutter-specific] → acceptable while `flutter-android` is the only platform; they move to the stack profile in the platform-registry change.
- [Spec-only detection by path] → uses the `change_id` of the decision; a branch made by something else with other paths is classified `implementation`, which sends the person to `/relevo:fix` and its own checks.

## Migration Plan

No data migration. The decision JSON gains optional fields (`issue_hash`, `allow_paths`); a skill that does not know them ignores them, and a missing hash is tolerated as described. Repositories that copied `relevo-go.yml` before this change keep working; they get the new final-step wording and install notes only when they copy the template again, which the changelog says. Rollback is reverting the change: no state is stored outside the repository.

## Open Questions

- Whether `isPlanningComplete` is equivalent to the per-artifact rule of D2; if it is, D2 may use it later.
- Whether `claude-code-action` needs `id-token: write` when `github_token` is given (verification task).
