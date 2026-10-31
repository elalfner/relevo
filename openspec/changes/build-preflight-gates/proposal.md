## Why

In a sample of ten issues from one real web project, the cloud build started 16 times and ended with a built issue only 8 times. Every one of the 8 other runs was avoidable before the agent spent a turn: a reference or file the runner could not read, a specification that asked for a protected path or a dependency without `Allow-paths:`, or a toolchain that was not installed. In all 8 the agent had already started, and four of them used 13 to 18 turns, a full build and a QA retry, for something the developer agent can never fix. After the build, five of the iterations a person had to start by hand were merges of the base branch into the feature branch.

This is one sample, so the numbers are a hypothesis to confirm elsewhere, not a law. The change therefore also makes every project able to see its own distribution of outcomes and causes. The goal is a first build that does not fail for reasons the issue, the runner or the repository already contained.

## What Changes

- **A preflight with no model, at two points.** One script checks what the build will need and sends the issue to `needs-spec` with a stated reason when something is missing. It runs first in the build job, before the agent starts, on what the issue says, and again inside `go`, after the agent wrote the specification and before the developer agent runs, on what the tasks and the design say:
  - the inputs the issue depends on can be read (references and linked files, which the job already fetches before the agent starts, and the other inputs the issue declares: keys, assets, endpoints, other repositories);
  - the files the issue, the tasks and the design say they will touch are not protected paths, and a dependency manifest is touched only when the issue lists it in `Allow-paths:`;
  - the dependencies the stack needs are installed, not only its tools, so that analysis and tests can run.
- **The refused references stop the run before the agent.** Today the job fetches the references, and the agent still starts, spends turns and only then reports `needs-spec`. When the fetcher refuses a reference, a script posts the `needs-spec` comment and the agent does not start.
- **`/relevo:issue` asks for the external inputs of the work** (keys, assets, endpoints, files of other repositories, accounts) and records them in a section the preflight can check. An input that cannot be verified by a script is listed in the hand-off instead of being assumed.
- **QA rejections are classified.** A finding says whether the developer agent can fix it or whether it needs the issue, an input or a policy decision. When every finding is of the second kind, `go` skips the retries and ends in the usual failure exit with the class and the next step in the comment, instead of paying a second developer and QA cycle that cannot succeed. The work is kept as it is today.
- **A conflict between the feature branch and the base branch is resolved by the developer agent, not left to a person.** `review` already merges the base branch first and stops when a conflict cannot be resolved cleanly. Instead of stopping, it hands the conflict to `relevo:dev` with the files, then runs QA again, and stops only when the agent cannot resolve it. `status` already alerts on a branch that fell behind; the same alert says whether the merge would conflict.
- **Each run records its phases and its outcome class.** The machine-readable usage comment gains the seconds and the turns of each phase, and the class of the outcome (built, needs input, needs specification, protected path, QA rejected after retries, conflict). The visible progress comment is unchanged and is still replaced by one line when the run ends.
- **`status` and the daily digest summarise those records**, so a team sees how many runs ended in each class and where the time went in its own project.
- **A QA that passed with checks that did not run is investigated.** One hand-off said the analysis, lint and tests had not run, while QA had passed. QA's own rules say it must reject when it cannot run them. The change finds out whether this is a gap in the flow and, if it is, closes it.

Out of scope: the specialist review lenses and the model and effort settings of each role (a later change), the interface decisions made in `think` (a later change), automatic merging of the base branch without QA, and any change to branch protection or to who may approve or merge.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: a preflight with no model before the agent and between the specification and the developer agent; the build job stops before the agent when a reference is refused or an installed path is missing; QA findings are classified and non-fixable ones skip the retries; the usage record carries phases and the outcome class.
- `issue-lifecycle`: `needs-spec` gains the two reasons the preflight produces (`inputs`: an input that cannot be read or is not available; `policy`: a task that needs a protected path or a dependency without permission), each with its next step in the single table of next steps and its message. Missing tools or missing installed dependencies keep ending in `qa-failed` before the agent, as missing tools do today.
- `init-doctor`: `doctor` warns when a platform's profile lists installed paths and the workflow has no step that installs the dependencies.
- `issue`: `/relevo:issue` asks for the external inputs of the work and writes them in a section that the preflight checks.
- `platforms`: a stack profile may name the paths that must exist once the dependencies are installed, so that the preflight can tell a missing installation from a working one.
- `review`: a conflict with the base branch is handed to the developer agent and checked by QA before the person tests; the review stops only when the agent cannot resolve it.
- `status`: the alert on a branch behind the base branch says whether the merge conflicts, and the report summarises outcome classes and phase times from the usage records.
- `documentation`: the guide, the issue format, the execution page and the security page describe the preflight, the new reasons and the records, in English and Spanish.

## Impact

- `skills/go/SKILL.md`, `skills/issue/SKILL.md` and its references, `skills/review/SKILL.md`, `agents/qa.md` (the class of each finding), `agents/dev.md` (an integration mode that takes the files in conflict).
- Scripts: `go-plan.mjs`, `design-fetch.mjs`, `toolchain-check.mjs`, `failure-comment.mjs`, `next-step.mjs`, `render-message.mjs`, `run-usage.mjs`, `branch-state.mjs`, `status.mjs`, `digest.mjs`; one new script for the preflight, whose name and whose input are decided in the design.
- The `go` workflow template: a step that posts the `needs-spec` comment and ends the job without the agent when the fetcher refuses a reference.
- The profiles in `stacks/` and `scripts/stack-profile.mjs`, for the optional list of installed paths.
- Messages and the table of next steps, with their Spanish versions.
- `docs/guide.md`, `docs/issue-format.md`, `docs/execution.md`, `docs/security.md` and their Spanish pages.
- Tests for each script and skill above, and `tests/docs-claims.test.mjs`.
- No change to `relevo.yml` keys unless the design decides that a check needs a setting; no change to the labels other than the new reasons of `needs-spec`.
