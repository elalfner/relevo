# Design

## Context

See `proposal.md` for the motivation. What exists today and shapes the approach:

- The build job already runs a toolchain check and a fetcher of references before the agent starts (`toolchain-check.mjs`, `design-fetch.mjs`). When the fetcher refuses a reference, the agent still starts: `go` reads the manifest and takes the `needs-spec` path, after spending turns.
- The specification is written by the agent inside `go`, so the tasks and the design do not exist when the job starts. A check on them can only run inside `go`.
- `qa` rejects a protected path, a dependency manifest without `Allow-paths:` and a restricted file, and the commit guards refuse them again. These stay the enforcement. A QA rejection after the retries ends in `qa-failed` with the work kept.
- `review` already merges the base branch into the feature branch first, re-runs QA, and stops when a conflict "cannot be resolved cleanly". `status` already alerts on a branch behind the base branch.
- The progress comment is edited while a run is in progress and is replaced by one line when it ends. A separate hidden usage comment (`relevo:usage`) holds machine-readable figures.
- Every `needs-spec` reason needs an entry in the single table of next steps and a message, in English and Spanish.

## Goals / Non-Goals

**Goals:**

- Find, without a model turn, what would make a build fail for a reason that is not code.
- Never spend a developer and QA retry on a finding the developer cannot fix.
- Let a person see, per project, how runs end and where the time goes.
- Keep every existing guard as the enforcement. The preflight only saves cost.

**Non-Goals:**

- The specialist review lenses, the model and effort per role and the mechanical gate with a receipt (change `specialist-review-lenses`).
- Interface decisions in `think` and `issue` (change `interface-decisions-upfront`).
- Detecting needed inputs from free text, or making the declared inputs mandatory.
- Merging the base branch without QA, or any change to branch protection, approval or merge.
- Making the agent itself faster. This change removes failed and repeated runs, not turns inside a successful one.

## Decisions

Each decision says whether it came out of the exploration with the maintainer (**decided**) or is proposed here and still to confirm when the design is reviewed (**proposed**).

### D1. One preflight script with two stages (decided in principle, name proposed)

A new script `build-preflight.mjs` takes `--stage issue` or `--stage spec`. It prints a JSON decision, `ok` or `needs-spec` with a `reason` (`inputs` or `policy`) and a list of findings, and uses the exit code the other gates use. `issue` runs in the build job before the agent, on the issue text and the environment. `spec` runs inside `go` right after `spec-ready.mjs` confirms the specification and before `relevo:dev` runs, on `tasks.md` and `design.md`.

Alternatives: only in-agent (rejected: it costs the turns the change wants to save); only in the job (rejected: the tasks do not exist yet).

### D2. A refused reference ends the job before the agent (proposed)

After the fetch step, the job reads the manifest. If it lists refused references, a step posts the existing `needs-spec` comment through the same renderer `go` uses, with the reason and the text of the refusal, sets an output, and the agent step is skipped through its `if:`. The closing steps still run and must not report "a run that ended without an outcome" for this case. A workflow without the step keeps today's behaviour, so an older workflow still works.

### D3. Declared inputs: an optional section checked by a script (proposed)

The issue gains an optional section `## External inputs` (heading in English like the others). Each bullet is `- <kind>: <name or path>: <what it is for>`, with `kind` one of:

| kind | What the script does |
|---|---|
| `file` | The path exists on the base branch |
| `link` | `owner/repo:path`, with the repository in `links`: fetched with the same fetcher |
| `secret`, `variable` | Presence only, never the value, in the job environment |
| `manual` | Never blocks; listed in the hand-off so a person confirms it |

An unknown kind is an error of the issue check. An issue without the section passes. `/relevo:issue` asks for the inputs, as it already asks about screens and data, and writes the section. A missing input produces `needs-spec` with the reason `inputs`.

Alternatives: infer the inputs from the text (rejected: unreliable, and a wrong guess blocks a good issue); one `Requires:` line (rejected: cannot say what each input is for).

### D4. Protected paths and manifests are checked on the task lines, as an optimisation (proposed)

At the `spec` stage the script extracts conservative path-like tokens (a `/` or a known file name) from the task lines of `tasks.md` and checks them against the protected and restricted lists that the run guard and the commit scan already use, so there is one source. A match is `policy`, unless it is a dependency manifest listed in `Allow-paths:`. A task that adds a dependency without naming a file is matched by a short list of verbs and words in the languages of the repository. Paths mentioned only in prose, in code pointers or in the design are ignored, to avoid blocking an issue that only reads them. This is best effort and says so in its message: the commit guards and QA remain the enforcement, and a protected path that the script missed is still refused later.

Alternative: scan the whole issue for any protected name (rejected: too many false positives on issues that read those files).

### D5. Installed dependencies, not only tools (proposed)

A stack profile may list `installed:` paths that must exist in the folder of the platform once the install step ran (for example the dependency folder of the package manager). The build job checks them right after the toolchain check. When one is missing the run ends like a missing tool does today: `qa-failed` with a comment that names the missing path and the install step to enable, and no model turn. Without the key the check is skipped. `/relevo:doctor` warns when a platform's profile lists `installed:` and the workflow has no step that installs dependencies. This is the cause behind the case where analysis, lint and tests did not run (D10).

### D6. QA findings carry a class; only non-fixable findings skip the retries (proposed)

Each numbered finding in a `QA REJECTED` report gets a `Class:` of `fixable`, `input`, `spec` or `policy`. A missing or invalid class counts as `fixable`, which is today's behaviour. `go` skips the retries only when every finding is non-fixable. A mixed report is retried as today, and if it still fails the first non-fixable finding names the class in the failure comment. Nothing about the labels changes: the run ends in the usual `qa-failed` exit with the work kept, and the comment says the class and the next step (supply the input, then `/relevo:fix`, or `/relevo:issue`). The new `needs-spec` reasons are therefore produced only by the preflight, before any work exists.

Alternative: send non-fixable rejections to `needs-spec` (rejected: the work already exists and would be thrown away when the specification is rewritten).

### D7. A conflict with the base branch goes to the developer agent (proposed)

When `review` merges the base branch and the merge conflicts, it no longer stops at once. If every conflicted file is inside the folder of the platform or the change folder, it starts `relevo:dev` in an integration mode: the agent receives the conflicted files and the scenarios, keeps the behaviour of both sides, and adds a test that fails if either side is lost, where the platform allows. Then QA runs again. If QA rejects after `qa.retries`, or the agent cannot resolve, `review` runs `git merge --abort`, leaves the branch as it was and stops with today's message. A conflict outside those folders stops as today. `ship` is not changed.

### D8. `status` probes the merge without changing anything (proposed)

`branch-state.mjs` uses `git merge-tree --write-tree` where git provides it, which reports a conflict without touching the tree, and says `unknown` otherwise. The alert on a branch behind the base branch says whether the merge would conflict.

### D9. The usage record carries phases and an outcome class (proposed)

The existing 30-second reader of the announced phase appends a timestamp when the phase changes, so the closing step can write `phases` (name, attempt, seconds) and `class` into the `relevo:usage` JSON. Tokens per phase are not recorded, because the execution log gives totals only. The classes are `built`, `inputs`, `policy`, `qa-fixable-after-retries`, `qa-non-fixable`, `conflict` and `other`. Readers ignore unknown keys, and old comments simply lack them. `status` and the digest read these comments for a window of days and print counts per class and total seconds per phase. The visible progress comment is not changed.

### D10. The "QA passed, checks did not run" case (decided to investigate)

Reproduce it from the saved hand-off and the QA report, find where the claim and the result diverged, and decide with the evidence. The expected cause is a missing installation, which D5 stops before the agent starts. The guarantee that no `QA PASSED` exists without a verified run of the checks belongs to the receipt of the `specialist-review-lenses` change. If the investigation finds another cause, it becomes a requirement here.

### D11. The preflight is never a security control (decided)

Every rule in D1 to D5 is repeated by a guard that already exists and stays in force. A bug in the preflight can cost a build or let one more run reach the guards; it cannot let a protected change through.

## Risks / Trade-offs

- [Wrong protected-path match blocks a good issue] → only task lines, a shown reason with the matched token, and the issue can be rewritten with `/relevo:issue`. The commit guards still decide in the end.
- [Declared inputs are not used] → `/relevo:issue` asks for them every time and the section is optional, so the benefit grows with use. The usage classes show whether `inputs` failures keep happening.
- [The developer agent resolves a conflict wrongly] → QA runs after, a test guards both sides, the merge is aborted on failure and the person still tests on the device.
- [A new `needs-spec` reason without its message or next step] → the next-step table has a test that every state and reason has an entry in both languages.
- [Changing the workflow template] → an older workflow keeps working without the new step; the guide says to take the new file through `/relevo:init` and raise `RELEVO_VERSION`.
- [The numbers come from one sample project] → the classes in D9 let each team measure its own before relying on these conclusions.

## Migration Plan

1. Land the scripts, skills, agent changes and messages with their tests. The plugin works with an old workflow.
2. Update the workflow template and the docs. A project takes the new template through `/relevo:init` and raises `RELEVO_VERSION`.
3. Roll back by restoring the previous workflow file and plugin version: no label, config key or stored data changes shape, and the new keys of the usage comment are ignored by older readers.

## Open Questions

- Whether the job can check the presence of a secret by a name read from the issue. If it cannot, the `secret` and `variable` kinds fall back to `manual`.
- The wording of the new messages and the exact list of verbs for D4 in each language: settled while writing the tasks.
- The window of days that `status` reads: the one the digest already uses, unless it proves too long.
