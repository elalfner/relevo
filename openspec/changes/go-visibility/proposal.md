# Proposal

## Why

A person who starts `go` cannot see what it is doing. The clearest case is a local build: `go-local.mjs` runs the build in a child process whose only output is its final answer, the build lasts longer than a session keeps a command in the foreground, and nothing writes its progress anywhere, so the person has to ask in the chat how it is going. That is the build that uses the person's own credential under the turn and cost limits and the closed tool lists of an unattended run, and `split-ready-and-go` makes it the normal way to build on a machine.

The progress that a cloud build shows has gaps too. Its comment gives the phase, the tasks done and the minutes, and it showed `Tasks: 0 of N` for the whole development of the two builds recorded in `docs/pilot-findings.md`, which then jumped to `N of N` when QA started: the developer agent marks the tasks when its launch ends, and both issues were small enough to be one group. Nothing says which group of a longer build is in progress. And the skill is strict about how the QA lenses are launched (one Agent call each, in the foreground, never in the background) and loose about the developer (it only says "launch the agent"), with no name for the launch of a group, so even where the subagents are visible the developer is hard to tell apart.

## What Changes

The progress of a local build, which is the main part:

- **A local build reports the same progress as a cloud build, without a model.** The check that edits the progress comment in the cloud already reads the phase that `go` announces, the tasks done and the minutes from files. A build started by `go-local.mjs` runs that same check, which writes the same lines to the terminal when they change and keeps the current state in a file outside the working tree. The skill is not changed for it: it already announces its phase wherever the progress folder exists.
- **The state of a local build can be read while it runs.** A command prints the current progress of the local build of an issue (the phase, the tasks, the group, the minutes and when it last changed), so a session that started the build in the background, or `status`, shows it without interrupting the build. When the build ended, it says how.

What every build shows:

- **The group in progress comes from the checkpoint.** The script that commits the checkpoint of each group already receives its number and the number of groups. It records them for the progress, and the progress shows the group in progress out of the groups of the run. `go` announces nothing new and no turn is added.
- **The launch of the developer is as explicit as the launch of a lens.** Every launch of the developer (build, fix, integrate, replica) is one Agent call in the foreground, never in the background, and `go` does not end its turn while it runs. Each launch of a group carries a description that names it (`build 2/3: 2.1, 2.2`), as a replica launch already does, so that a session and the usage comment show which launch is which. `fix` follows the same rule.
- **Unmarked tasks are found at their group, not at the end.** After each group the checkpoint script also says which tasks of that group are still unmarked. When the developer reported why it could not finish them, `go` takes the path it already takes for an open question, at that group. When it reported nothing, `go` launches the developer once more for those tasks alone; if they are still unmarked the run ends as it ends today (`tasks left unfinished`), but at that group and not after all of them.

To be decided on evidence:

- **Whether the developer should mark each task as it finishes.** It would make the count move inside a group, and it costs turns: each mark is an edit, and every turn of the developer reads its whole context again. A build with several groups already moves the count group by group, so this is needed only if real builds stay at zero for long. The design starts by reading the progress of builds of larger issues; the rule is added to the developer agent only if they show it, written so that the mark goes in the same step as the start of the next task.

An optional improvement, after a spike:

- **An interactive build without a permission prompt at each step.** A build in a person's session shows the subagents as the session shows them, but it runs on the model and the accumulated context of that session, with no hard limits, and a session with the default permissions asks before each command and each edit. A spike in a desktop and in an editor session settles whether the skill can carry the tool list of the workflow (the same allowed tools and the same refused ones) so that the build neither stops to ask nor gains tools. If it cannot, the interactive build stays as it is and the guide says how to allow the tools by hand, and that a local build is the one that reports progress.

Not in this change: showing the subagents of a local build as cards (they belong to the child process and no session can show them); a progress comment on the issue for a local build (it would be written by the person and not by the bot, which changes who may edit it); a heartbeat for local builds; lines of narration that the model writes before and after each group (the scripts already know what they would say); anything about the labels, which belong to `split-ready-and-go`.

Open questions for the design:

1. Whether the lines of a local build also name each launch of an agent, read from the event stream of the child process, or whether the phase, the group and the tasks are enough.
2. Where the state file of a local build lives so that it survives the worktree being removed and is found by the issue number.
3. Whether an interactive build should run under the turn and cost limits of an unattended run, which a session cannot set for itself.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-modes`: a local build reports its progress in the terminal and keeps it where it can be read while the build runs; what an interactive build shows and what it costs; its tool list, as far as the spike allows.
- `go`: the progress shows the group in progress, recorded by the checkpoint; the launch of the developer is one foreground call with a description that names the group; unmarked tasks are found after each group, with one relaunch only when the developer reported no reason; the developer marks each task as it finishes, only if the evidence asks for it.
- `status`: the progress of a local build of the person is shown.
- `fix`: its launches of the developer follow the same rule.

## Impact

- Code: `scripts/go-local.mjs` and `scripts/lib/go-local.mjs` (the progress folder and the check of a local build), `scripts/progress.mjs` and `scripts/lib/progress.mjs` (a writer for the terminal and the state file, the group in progress, the command that prints the state), `scripts/checkpoint.mjs` and `scripts/lib/tasks-file.mjs` (the group and its unmarked tasks), `scripts/lib/status.mjs`, `scripts/lib/messages.mjs` (English and Spanish), `scripts/lib/run-usage.mjs` (the description of a group launch), and their tests.
- Content: `skills/go/SKILL.md` and `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, `skills/status`, `agents/dev.md` only if the evidence asks for it, `docs/execution.md` in both languages.
- Cost: the progress of a local build and the group in progress come from scripts and add no turn. A relaunch for unmarked tasks costs one launch of the developer, in a case that today ends the whole run as failed. Marking each task as it finishes, if it is adopted, adds turns of the developer, which count against the limit of the run.
- Order: independent of the other three changes; it touches `skills/go/SKILL.md`, `go-local.mjs` and the progress comment, as `split-ready-and-go` and `build-runner-labels` do, so the later one rebases.
