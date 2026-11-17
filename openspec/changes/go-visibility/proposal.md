# Proposal

## Why

A person who starts `go` cannot see what it is doing. Three things hide it. The progress comment of a cloud build shows `Tasks: 0 of N` for the whole development and jumps to `N of N` when QA starts (recorded twice in `docs/pilot-findings.md`), because the developer agent marks the tasks when its launch ends, not as it finishes each one. The skill is strict about how the QA lenses are launched (one Agent call each, in the foreground, never in the background) and loose about the developer (it only says "launch the agent"), and it gives the launch of a group no name and says nothing in the session before or after it, so even in an interactive session the developer is hard to tell from the rest. And a build started with `go-local.mjs` runs in a child process whose only output is its final answer, so the session that started it shows a long command and nothing else, and the person has to ask in the chat how it is going.

`split-ready-and-go` makes the local build the normal way to build on a machine, so what a person sees while it runs becomes part of the product.

## What Changes

- **The developer marks each task when it is done.** The developer agent checks a task in `tasks.md` as soon as its code exists and works, before it starts the next one, so the count of the progress comment moves during development. The rule that a task is checked only when it is done does not change.
- **A group that ends with unmarked tasks is not passed over.** After each group, the check that already commits its checkpoint also says whether the tasks of that group are marked. When some are not, `go` launches the developer again for those tasks alone, once, instead of going on with a count that says nothing was done; if they are still unmarked the run takes the failure path it takes today at the end (`tasks left unfinished`), but at that group, not after all of them.
- **The launch of the developer is as explicit as the launch of a lens.** Every launch of the developer (build, fix, integrate, replica) is one Agent call in the foreground, never in the background, and `go` does not end its turn while it runs. Each launch of a group carries a description that names it (`build 2/3: 2.1, 2.2`), as a replica launch already does, so that a session and the usage comment show which launch is which.
- **`go` says what it does, in one line, at each step of a group.** Before a launch it writes which group it starts, with its tasks and the mode; after it, what came back (files changed, tasks marked) and the checkpoint. The lines go in the same turns as the launch and the checkpoint, so no turn is added. In the cloud they are in the log of the run; in a session they are what the person reads.
- **The progress comment says which group is being built.** Next to the tasks done it shows the group in progress out of the groups of the run, which `go` announces as it announces the phase.
- **An interactive build can run without a permission prompt at each step.** A build in a person's session is where the subagents are visible, but a session with the default permissions asks before each command and each edit, and `go` makes hundreds. The design starts with a spike in a desktop and in an editor session that settles whether the skill can carry its own tool list (the one of the workflow: the same allowed tools and the same refused ones, the web and `curl` and `wget` among them) so that the build neither stops to ask nor gains tools the unattended run does not have. If it cannot, the proposal keeps the interactive build as it is and says so in the guide, with the way to allow the tools by hand.
- **`fix` follows the same rules for its launches**: explicit, in the foreground, named, with a line before and after.

Not in this change: showing the subagents of a `go-local.mjs` build as cards (they belong to the child process and no session can show them); a heartbeat for local builds; anything about the labels, which belong to `split-ready-and-go`.

Open questions for the design:

1. Whether the child process of `go-local.mjs` should print its progress as lines of text (the phase, the group, each launch), read from its event stream, or whether the interactive build is the answer for a person who wants to watch and `--local` stays silent.
2. Whether a local build should keep its progress where `status` can read it, as a cloud build keeps it in the comment.
3. Whether an interactive build should run under the turn and cost limits of an unattended run, which a session cannot set for itself.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the developer marks each task as it finishes; the check after a group and the single relaunch for unmarked tasks; the launch of the developer is one foreground call with a description that names the group; the lines `go` writes before and after a group; the progress comment shows the group in progress.
- `execution-modes`: what a person sees during an interactive build and during a local build; the tool list of an interactive build, as far as the spike allows.
- `fix`: its launches of the developer follow the same rules.

## Impact

- Code: `scripts/checkpoint.mjs` and `scripts/lib/tasks-file.mjs` (the tasks of a group that are marked), `scripts/progress.mjs` and `scripts/lib/progress.mjs` (the group in progress), `scripts/lib/messages.mjs` (English and Spanish), `scripts/lib/run-usage.mjs` (the description of a group launch), and their tests; `scripts/lib/go-local.mjs` and `scripts/lib/run-flags.mjs` only if the open questions are answered that way.
- Content: `agents/dev.md`, `skills/go/SKILL.md` and `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, `docs/execution.md` in both languages.
- Cost: the lines share turns that already exist and the check runs in a script, so a build that goes well costs what it costs today. A relaunch for unmarked tasks costs one launch of the developer, in a case that today ends the whole run as failed.
- Order: independent of the other three changes; it touches `skills/go/SKILL.md` and the progress comment, as `split-ready-and-go` and `build-runner-labels` do, so the later one rebases.
