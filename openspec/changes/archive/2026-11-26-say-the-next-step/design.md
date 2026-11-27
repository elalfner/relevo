# Design

## Context

See `proposal.md` for the motivation; decisions D4 to D17 and constraints C1, C2 and C5 of #223 apply.

- `scripts/lib/next-step.mjs` holds the table. A state may have reasons, and the first one is the default. `nextStep().line` opens with `Your next step` or `Nothing to do now` (`Tu siguiente paso`, `Nada que hacer ahora`).
- `tests/next-step.test.mjs` requires the entries to be exactly the label keys.
- Several messages already guide in words of their own (`ship_stopped`, `queued_*`, `blocked_notice`), without those prefixes.
- Two lines are written by workflow shell, not by the catalog: the lost runner in `relevo-go.yml` and the ship fallback in `relevo-ship.yml`.

## Goals / Non-Goals

**Goals:** one source for the step; a test that a new message kind cannot slip past; the smallest rewording of messages that already guide.

**Non-Goals:** moving existing wording onto the table; correcting texts of the table or the specification that this change does not need.

## Decisions

### The table

| Entry | Command | Who |
|---|---|---|
| `draft` | `/relevo:issue {n}` (hint: `/relevo:think #{n}` first if the idea needs exploring) | spec writer |
| `closed` | none | nobody |
| `in-review`, reasons `continue` (default) and `local` | `/relevo:review {n}`; `/relevo:ship {n}` | assignee; the person |
| `building`, reasons `agent` (default) and `lost-runner` | none; none | nobody; assignee |

Reasons reuse the existing mechanism, and the defaults leave every current caller unchanged. `lost-runner` has no command because the labels come first, so a line that opened with `/relevo:go` would be wrong. `local` needs a new role, `person` ("the person" / "la persona"), because a files project has no assignee.

`NEXT_STEP_STATES` becomes the label keys plus `draft` and `closed`; the test compares with exactly that set. The step after `init` is not a state, so it is a separate export, printed by `next-step.mjs --after init`, and never joins `NEXT_STEP_STATES`.

### The state comes from the labels, in code

`next-step.mjs --labels "<names>"` picks the entry: the exclusive lifecycle label, under the configured names, else `draft`. With `needs-reviewer` next to a state it prints both lines. Skills use it so that the model does not map labels to states. A closed issue has no labels, so a caller passes `--state closed`.

`needs-spec` and `build-failed` depend on a reason that the labels do not carry, and the default (`missing`, `fix`) can be wrong. With `--labels` and no `--reason` on these two, the command names the state and says that its last comment on the issue gives the step; it prints no command. A skill that knows the reason passes it. Alternative rejected: always taking the default, which could send a resumable build to `fix`.

### Skill reports

| Skill | At the end |
|---|---|
| `review` | `--labels` after the move to `pr-open`; files project with a recorded pass: `--state in-review --reason local`; review not passed: `--labels` |
| `fix` | a completed fix: `--labels` with the new labels. A fix that stops keeps its instruction to run `fix` again |
| `ship` | stopped: `--labels` with the labels as they are, or `--state closed`. Merged: `--state closed` replaces the first sentence of the promotion reminder; the version tag note stays. A merged files project keeps its report, since no pull request promotes it |
| `init` | `--after init`, after the steps by hand |

In a files project, a `ship` that stops for a cause other than the review (a dirty tree, another branch checked out) while the recorded review still holds uses `--reason local`.

### Messages

The test holds a class for every kind in `MESSAGE_KINDS`. By default a `hand-off` must contain the act prefix of the table (ignoring case) and a `wait` the wait prefix. A kind that already guides in other words declares its own pattern for each language instead, so its text does not change. Kinds with variants (`build_failed`, `run_no_outcome`, `fix_done`) are rendered for each. Alternative rejected: requiring the prefix everywhere, which rewords about fifteen messages that are not broken (D7).

D4's rule about responsibility is tested on the table: an entry is either `nobody` with a hint, or a role with a hint.

Reading of the catalog (verifies A1 of the issue). Reworded:

| Kind | Class | Change |
|---|---|---|
| `review_reminder` | hand-off | approve it or request changes on GitHub |
| `ready_denied`, `_maintainer` | hand-off | someone with write (maintain) access applies `ready`, if it should be built |
| `go_denied`, `_maintainer` | hand-off | someone with that access applies `go` or runs `/relevo:go <n>` |
| `urgent_denied`, `_maintainer` | wait | nothing to do: only the early start was refused |
| `go_building` | wait | the `building` line of the table |
| `go_already_built` | hand-off | the line of the table for `state` |
| `run_progress` | wait | the `building` line of the table |
| `fix_done` | hand-off | the line of the table for `state` |
| `ship_done` | wait | nothing left to do for the issue, then the promotion sentence |

Already guiding, left as they are: `ship_retry`, `ship_stopped`, `ship_not_approver`, `ship_no_ci`, `ship_needs_app`, `ship_failed`, `queued_*`, `blocked_notice`, `run_waiting`, `usage_limit_retry`, `run_failed_early`, `run_no_outcome` and the kinds that already use the prefix. `info` is `local_progress`, `local_status`, `local_no_build`, `local_progress_off` and `run_progress_closed`.

`go_already_built` and `fix_done` gain a required value `state`. The planner passes it for the first; `skills/fix` passes the `to` of `fix-state.mjs` for the second. Planner, renderer and skills ship in the same plugin version, so no older caller is left. `fix` stops passing the English `ask` for the assignee: with a `recipient` and no `ask`, the mention goes in front of the table line, which also fixes that line in a Spanish repository. For a reviewer the `please re-review` ask stays, followed by the table line.

### Workflow lines

The lost-runner step adds the `lost-runner` line, as a literal in each language with `$ISSUE`, after the run link. A test runs the step, as `tests/workflow-go.test.mjs` already does, and compares the line with `nextStep()`. The ship fallback gains "apply relevo:ship again" and a Spanish version chosen from `work/relevo.yml`, as the go workflow reads the language.

## Risks / Trade-offs

- [A new message passes the test with a loose pattern of its own] → patterns are per kind and visible in review; the default is the prefix.
- [A skill report is prose the model may skip] → skill tests require the command in each `Report` section, and the issue asks for one manual run of each.
- [Projects keep the old workflow lines] → the changelog says that `/relevo:init` brings them.
- [The specification still says "apply `ready` again" for a branch with only the specification, while the table says `relevo:go` or `--retry`] → an existing mismatch, left as it is here.
- [`record-qa-findings` edits `fix_done` and `skills/fix`] → build one, then the other, and run `openspec validate --all` after archiving.
