# Design

## Context

See proposal.md - Why. What shapes the approach:

- In the `build` job the agent is one step (`claude-code-action`, or `agy` when `agent.build: antigravity`). Steps of a job run in series, so nothing else can run beside it as a step, and the execution log of the agent exists only after the step ends.
- The block between `# relevo:agent-step begin` and `end` is replaced for Antigravity and nothing else of the workflow changes (a test checks it). Whatever watches the run must live outside that block to serve both agents.
- The agent's preflight needs a clean working tree. Nothing for the progress may be written in the workspace.
- The package of the plugin is already unpacked at `$RUNNER_TEMP/relevo` by the step "Check the toolchain", before the agent. The tests slice the workflow between that step and the agent block, so a step inserted there is read by them.
- The `go` skill already reports to the issue through scripts (`render-message.mjs`, `label-change.mjs`), and `sla.mjs` already finds its comments by hidden markers. Hand-off texts go through the catalog of `messages.mjs`, in the language of `relevo.yml`.
- Environment variables set by the workflow reach the tools of the agent (`GH_TOKEN` and `OPENSPEC_TELEMETRY` already do), which is how the skill can find the announcement file.

## Goals / Non-Goals

**Goals:**
- A watcher that lives exactly as long as the job and cannot overwrite the closing line.
- Progress that works with either agent and degrades, never fails, when something is missing: an old workflow with a new plugin, a new workflow with an old package, a local run, an agent that does not announce.

**Non-Goals:**
- Seeing inside a subagent. Only the phase and the attempt are known.
- A progress comment for `go --local` runs: there is no issue run to watch there, and the announcement does nothing outside the workflow.
- A configuration option for the interval.

## Decisions

### D1. One script with three commands, a library behind it

`scripts/progress.mjs` (a thin wrapper, like `run-usage.mjs`) over `scripts/lib/progress.mjs`:

- `watch` is the loop of the workflow: it renders the text, writes when it changed, and ends by itself.
- `phase <name> [--attempt n]` is what the skill calls to announce a phase.
- `close` writes the closing line.

The library is pure where it can be: `renderProgress(state)`, `deducePhase(tree)`, `countTasks(text)`, `shouldWrite(previous, next)`, and the GitHub client is injected (`gh(args) -> stdout`) as in `sla.mjs` and `status-data.mjs`, so it is tested without a network.

*Alternative: shell in the workflow.* Rejected: the workflow templates avoid logic in YAML, and the rules (change detection, closed marker, deduction) need tests.

### D2. The watcher is a background process of the same job, not a second job

A step before the agent starts `node progress.mjs watch` detached and saves its PID. It reads the working tree and `$RUNNER_TEMP`, so it sees the tasks done and the announced phase.

*Alternative: a parallel job.* Rejected: it sees only the API of GitHub, not `tasks.md`, and it takes a second runner while the build lasts, which weighs on private repositories of the free plan.

### D3. The watcher ends by itself; the stop step is only the polite path

`watch` exits when any of these holds:

1. the stop file exists (the final step creates it);
2. the issue no longer carries `relevo:building` (checked every fifth round, not every one);
3. a hard limit of minutes passed (the `timeout-minutes` of the job plus a margin, given as an argument).

The 3rd is the safety net for a runner that persists between jobs and for a job that is cancelled. The final step (`if: always()`) creates the stop file and waits for the process to leave, up to a few seconds, before anything else. Relying on the runner to kill orphans is not enough.

### D4. Where the phase comes from: announced, with the tree as a fallback

The skill calls `progress.mjs phase <name>` at the start of each step. It writes `phase.json` under `$RELEVO_PROGRESS_DIR` (`$RUNNER_TEMP/relevo-progress`, set for the later steps through `$GITHUB_ENV`). Without the variable the command does nothing and exits 0, which is also the local case.

When there is no announcement, the phase is deduced from the tree and git (an announcement, when there is one, always wins; the decision of the workflow also gives the branch of the issue, because the job starts on the default branch, which can be ahead of the base branch and must not read as a delivery):

| What exists | Phase |
|---|---|
| no folder for the change | planning |
| folder without a complete `tasks.md` | specification |
| tasks with unchecked items | development |
| all tasks checked, nothing committed | QA |
| the checkout is on the branch of the issue and holds a commit above the base branch | delivery |

The table cannot tell QA from a retry of development, which is why the announcement exists; the table only keeps the comment alive. The change id comes from the `decision_b64` the build job already has (it is data, read as JSON and never as an instruction, and only its `change_id` and `branch` are used).

*Alternative: only the table.* Rejected: it cannot show the attempt.

### D5. Rendering: minutes, language, and writing only on change

The text goes through the catalog of `messages.mjs` (two new kinds, `run_progress` and `run_progress_closed`, in each language), so it follows `language`. The time is whole minutes. `shouldWrite` compares the rendered text with the last text written, kept in memory and in the state file; a round with the same text writes nothing. That makes a check every 30 seconds a write about once a minute or on a change, and it is why seconds are not shown.

### D6. The comment: found once, recognised by marker and author

The first write creates the comment through `gh api` and saves its id in the state file, so later rounds do not list the comments. If the id is lost, the comment is searched by the marker `<!-- relevo:progress -->` among the comments of the Actions bot only: a person who types the marker in a comment is not edited, and could not be with that token anyway. The closed comment carries a second marker, `<!-- relevo:progress:closed -->`.

### D7. Closing: after the failure report, never overwritten

The final steps, all `if: always()`, in this order:

```
 agent
 -> report what the run used         (exists)
 -> report a run without an outcome  (exists)
 -> stop the watcher and wait for it (new)
 -> close the progress comment       (new)
```

Closing after the failure report makes the line true. Before each write the watcher reads the comment and does nothing if the closed marker is there (D3 plus this is the second layer). The line does not look for the result comment: it says the run ended, that the result is in the last comment, and links the Actions run, as the failure report already does.

### D8. A step that cannot fail the job

Every new step is `continue-on-error: true`, tests for the script before using it and skips silently when the package lacks it (unlike "Check the toolchain", which stops the job). A new workflow with an older package, or the reverse, shows no progress and builds as before. The watcher catches its own errors, writes them to the log and keeps going.

## Risks / Trade-offs

- [The environment variable does not reach the tools of an agent] → the announcement does nothing and the comment shows the phase deduced from the tree; the pilot checks it on a real run before the change is called done.
- [The watcher outlives a cancelled job on a persistent runner] → the hard limit of D3.
- [Two writes meet at the end] → the stop step waits, and the closed marker is read before each write.
- [The inserted step breaks tests that read the region before the agent block] → they are updated in the same change, keeping what they assert (the toolchain check stays first and the workspace stays untouched).
- [Rate limits of the API] → one write a minute and one label read every five rounds, per run, far below the limits of `GITHUB_TOKEN`.
- [The phase is the word of the agent] → a wrong or missing announcement only changes the label; the time and the tasks come from the workflow.

## Migration Plan

- The workflow template changes. The stamp `relevo-template` and `RELEVO_VERSION` follow the version of the release, so they are bumped when it is cut, as `RELEASING.md` says; the `Unreleased` entry of the changelog lists the new steps and the upgrade for existing projects (take the new `relevo-go.yml` through `/relevo:init`, which merges it).
- Nothing needs the progress: an existing project without the new workflow keeps working, and its skill calls do nothing.
- Rollback is removing the new steps from the workflow; no data is stored.
