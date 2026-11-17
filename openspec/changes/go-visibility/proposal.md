# Proposal

## Why

A person who starts `go` cannot see what it is doing. The clearest case is a local build: `go-local.mjs` runs the build in a child process whose only output is its final answer, the build lasts longer than a session keeps a command in the foreground, and nothing writes its progress anywhere, so the person has to ask in the chat how it is going. That is the build that uses the person's own credential under the turn and cost limits and the closed tool lists of an unattended run, and `split-ready-and-go` makes it the normal way to build on a machine. It also says nothing at the end about what it used, when spending one's own tokens is the reason to build there.

The progress that a cloud build shows has a gap too. Its comment gives the phase, the tasks done and the minutes, but not which group of a longer build is in progress, and the developer agent marks the tasks only when the launch of a group ends: the two builds recorded in `docs/pilot-findings.md`, small enough to be one group, showed `Tasks: 0 of N` for the whole development. And the skill is strict about how the QA lenses are launched (one Agent call each, in the foreground, never in the background) and loose about the developer (it only says "launch the agent"), with no name for the launch of a group, so even where the subagents are visible the developer is hard to tell apart.

The words group and checkpoint are defined in `GLOSSARY.md`.

## What Changes

The progress of a local build, which is the main part:

- **A local build reports the same progress as a cloud build, without a model.** The check that edits the progress comment in the cloud reads its facts from a folder of files. A build started by `go-local.mjs` gets that folder and runs that same check, which writes a line to the terminal when something changes and keeps the current state in a file. The lines show only what the folder already records: the phase that `go` announces, the group in progress, the tasks done, when each QA lens starts and ends, each agent when it finishes, and the minutes. The event stream of the child process is not read. The lines are in the language of `relevo.yml`, and they work the same with either agent runner, because the check does not depend on the agent.
- **With the folder comes the budget guard.** The guard that counts the turns of the subagents and the minutes of the run reads the same folder, so a local build obeys it, which is what `go-local.mjs` already promises: the limits of the cloud.
- **The state lives next to the worktrees.** It is kept in a folder beside the worktrees of the repository, named by the repository and the issue number, outside every working tree. It survives the removal of the worktree and stays until another build of the same issue replaces it. Only the machine that runs the build can read it: other people see that an issue is being built locally by its `local` label, not how far it is.
- **The state can be read while the build runs.** A command prints the current progress of the local build of an issue and when it last changed, and how the build ended once it has. `status` shows the local builds of the person on that machine.
- **A local build says what it used.** When it ends it prints, and keeps in its state file, the totals of the run: turns, estimated cost and tokens, read from the final answer of the child process. There is no breakdown by agent, which would need the event stream, and nothing is posted on the issue: that usage belongs to the person's account, not to the repository, and the daily digest adds up cloud runs only.
- **`--local` from a session does not hold the session.** `/relevo:go <n> --local` starts the build in the background, gives the command that shows its progress and ends its turn. It does not ask again every few minutes. When the build ends, the session is told and reports the result.

What every build shows:

- **The group in progress comes from the checkpoint.** The script that commits the checkpoint of each group already receives its number and the number of groups. It records them for the progress, which shows the group in progress out of the groups of the run. `go` announces nothing new and no turn is added.
- **The launch of the developer is as explicit as the launch of a lens.** Every launch of the developer (build, fix, integrate, replica) is one Agent call in the foreground, never in the background, and `go` does not end its turn while it runs. Each launch of a group carries a description that names it (`build 2/3: 2.1, 2.2`), as a replica launch already does, so that a session and the usage comment show which launch is which. `fix` follows the same rule.
- **Unmarked tasks are found at their group, not at the end.** After each group the checkpoint script also says which tasks of that group are still unmarked. When the developer reported why it could not finish them, `go` takes the path it already takes for an open question, at that group. When it reported nothing, `go` launches the developer once more for those tasks alone; if they are still unmarked the run ends as it ends today (`tasks left unfinished`), but at that group and not after all of them.

The interactive build:

- **It uses the same state folder.** A build in a person's session shows the same progress and obeys the same budget guard as a local build. Its main agent has no turn or cost limit, because a session cannot set one for itself, and it runs on the model and the accumulated context of that session; the guide says both, and that a local build is the one with hard limits.
- **Without a permission prompt at each step, if a spike allows it.** A session with the default permissions asks before each command and each edit, and `go` makes hundreds. A spike in a desktop and in an editor session settles whether the skill can carry the tool list of the workflow (the same allowed tools and the same refused ones) so that the build neither stops to ask nor gains tools. If it cannot, the interactive build stays as it is and the guide says how to allow the tools by hand.

Not in this change: a rule that makes the developer mark each task as it finishes (it costs turns, and the group in progress already answers whether the build advances; it is one line in the developer agent if builds still look stopped afterwards); lines of narration that the model writes before and after each group (the scripts already know what they would say); naming each launch of an agent in the lines of a local build, and the usage of a local build by agent (both need the event stream of the child process); showing the subagents of a local build as cards (they belong to the child process and no session can show them); a progress comment or a usage comment on the issue for a local build; a heartbeat for local builds; anything about the labels, which belong to `split-ready-and-go`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-modes`: a local build reports its progress in the terminal, keeps its state beside the worktrees, obeys the budget guard and says what it used; the command that prints the state; `--local` from a session runs in the background; an interactive build shares the state folder and the guard, and its tool list as far as the spike allows.
- `go`: the progress shows the group in progress, recorded by the checkpoint; the launch of the developer is one foreground call with a description that names the group; unmarked tasks are found after each group, with one relaunch only when the developer reported no reason.
- `status`: the local builds of the person on that machine are shown with their progress.
- `fix`: its launches of the developer follow the same rule.
- `documentation`: the guide says what each way to build shows, costs and limits.

## Impact

- Code: `scripts/go-local.mjs` and `scripts/lib/go-local.mjs` (the state folder, the check, the totals of the run), `scripts/progress.mjs` and `scripts/lib/progress.mjs` (a writer for the terminal and the state file, the group in progress, the command that prints the state), `scripts/checkpoint.mjs` and `scripts/lib/tasks-file.mjs` (the group and its unmarked tasks), `scripts/run-budget.mjs` and `scripts/lib/phase-log.mjs` (the folder of an interactive build), `scripts/lib/run-usage.mjs` (the totals from a final answer, the description of a group launch), `scripts/lib/status.mjs`, `scripts/lib/messages.mjs` (English and Spanish), and their tests.
- Content: `skills/go/SKILL.md` and `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, `skills/status`, `docs/execution.md` in both languages.
- Cost: the progress and the group come from scripts and add no turn; `--local` from a session no longer spends turns asking. A relaunch for unmarked tasks costs one launch of the developer, in a case that today ends the whole run as failed.
- Order: independent of the other three changes; it touches `skills/go/SKILL.md`, `go-local.mjs` and the progress comment, as `split-ready-and-go` and `build-runner-labels` do, so the later one rebases.
