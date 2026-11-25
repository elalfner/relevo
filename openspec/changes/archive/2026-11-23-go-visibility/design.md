# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- **The progress of the cloud is a folder of files and a loop.** `$RELEVO_PROGRESS_DIR` holds `phase.json` (written by `progress.mjs phase`, which the skill runs at each step), the phase log, the lens log (`progress.mjs lens`), the ledger of agents (`run-budget.mjs record`) and the class of the outcome. `watch` (`scripts/lib/progress.mjs`) reads the phase, counts the boxes of `tasks.md` in the working tree (`readTreeFacts`) and edits one GitHub comment through an injected client. Without the variable every one of those commands does nothing, which is what a build on a machine gets.
- **The budget guard reads the same folder.** `run-budget.mjs check` says it does not know, and lets the run go on, when there is no folder.
- **`go-local.mjs` blocks.** It runs the agent with `spawnSync` and inherited output; `claude -p` prints only its final answer. The Antigravity path goes through `agent-guard.mjs`, which writes a summary file with the turns and the tokens.
- **Groups and checkpoints are scripts.** `task-groups.mjs` prints the groups of pending tasks; `checkpoint.mjs --k --of --tasks` commits each one. Neither writes to the progress folder, and the checkpoint does not look at the boxes. `go` checks the remaining tasks once, after the last group.
- **The skill is strict for lenses and loose for the developer.** `qa-run.md` asks for one Agent call per lens, in the foreground, never in the background. Step 4 of `SKILL.md` says "launch the `relevo:dev` agent"; only a replica launch has a description, which `run-usage.mjs` reads to list replicas apart.
- **Worktrees live beside the repository** (`.relevo-worktrees/<repository>-<issue>`, `scripts/lib/worktree-path.mjs`), for `go-local.mjs` and for an interactive build alike, and are removed after a clean end.
- A shell variable does not survive from one command of a session to the next, so an interactive build cannot set `RELEVO_PROGRESS_DIR` once for its scripts.

## Goals / Non-Goals

**Goals:**
- A build on a machine shows what a cloud build shows, from the same files and the same code.
- Nothing new is asked of the model: the skill keeps announcing its phase and running the scripts it already runs.
- One place on a machine says how a build is going, for `go-local.mjs`, for an interactive build and for `status`.

**Non-Goals:**
- Showing subagents of a child process as cards, or naming each launch from the event stream.
- A progress or usage comment on the issue for a build on a machine.
- A rule that makes the developer mark each task as it finishes.
- Limits on the main agent of an interactive build.

## Decisions

- **D1. One resolver for the progress folder.** A function returns `RELEVO_PROGRESS_DIR` when it is set, and otherwise, when the working directory is inside a worktree of `.relevo-worktrees/<repository>-<issue>`, the state folder of that issue if it exists. Every script that reads the variable today uses the resolver. The cloud is unchanged (the variable wins), `go-local.mjs` sets the variable for its child, and an interactive build finds the folder from its worktree with no variable. Alternative considered: have the skill prefix every command with the variable; rejected because one forgotten prefix silently loses a record.
- **D2. The state folder is `.relevo-worktrees/.state/<repository>-<issue>/`.** `go-local.mjs` and `go-worktree.mjs create` empty and create it before the build, so a new build replaces the state of the last one; neither removes it when the worktree goes. It is outside every working tree, so the clean-tree check and the commits never see it.
- **D3. The state is computed on read, not kept by a loop.** A function builds the snapshot of a build from the folder and the worktree: the phase, the group, the tasks, the start, the last change (the newest file time), the lens and agent records, and, when present, the outcome and the totals. `go-local.mjs status <issue>` and `status` call it. No background process is needed for it, so an interactive build needs none. When the worktree is gone the tasks come from the last snapshot written at the end of the build.
- **D4. `go-local.mjs` prints from its own process.** It starts the agent without blocking, and on an interval it takes the snapshot and prints a line when the phase, the group, the tasks or the newest lens or agent record differs from the last line; each line carries the minutes. The text comes from `renderMessage`, in the language of `relevo.yml`. The runner abstraction of `runLocal` gains an asynchronous `run` beside `capture`, so the tests still inject it. Alternative considered: a second process running `progress.mjs watch` with a terminal sink, as the workflow does; rejected because it leaves a process to clean up on a person's machine.
- **D5. The change id is known before the agent starts.** `readTreeFacts` needs the folder of the change. `go-local.mjs` reads the title of the issue (it already checks `gh`) and derives the id with the function the planner uses, `changeId`; an interactive build writes it into the state folder when it plans. Before either is known the snapshot has no tasks, as in the cloud before the specification exists.
- **D6. The groups are recorded by the scripts that know them.** `task-groups.mjs` writes the number of groups into the progress folder when there is one; `checkpoint.mjs` writes the number of the group it committed. The group in progress is the last committed plus one, capped at the total, while the phase is development. `renderProgress` gets the two numbers; the cloud comment gains one line and the local lines use the same text. Both writes are best effort and never fail their script.
- **D7. The checkpoint reports the unmarked tasks of its group.** `checkpoint.mjs` prints `unmarked`, the ids of `--tasks` that are still unchecked in the `tasks.md` of the change, using `uncheckedTasks`. The skill reads it: when it is not empty and the report of the developer has no open question, it launches the developer once for those tasks and runs the checkpoint of the same group again; when it is still not empty it takes the failure path with `tasks left unfinished`. The check after the last group stays, read from OpenSpec as today.
- **D8. Launch descriptions are a convention the usage reader knows.** `build <k>/<n>: <tasks>` for a group, `fix <attempt>` for a correction in `go`, `fix iteration <k>` in `fix`, `integrate` for a merge of the base. `run-usage.mjs` shows the description beside the agent entry when the launch has one; `replica <task id>` keeps its own list. The skill text gets the wording of `qa-run.md`: one Agent call, in the foreground, never in the background, and the turn does not end while it runs.
- **D9. The totals of a local build come from its final answer.** `go-local.mjs` asks `claude -p` for `--output-format json`, prints the `result` text as it printed the answer, and gives the object to `readUsage`, which already tolerates what it does not find; the Antigravity path reads the summary of the guard. The sentence is the one of the usage comment without the breakdown, printed and written into the state folder. Nothing is posted.
- **D10. `--local` from a session.** The skill runs `go-local.mjs` as a background command of the session and prints `go-local.mjs status <issue>` as the way to look. It ends its turn. The session is told when the command exits and then reports what it printed.
- **D11. The tool list of the skill follows a recorded spike.** A task tries, in the desktop app and in an editor extension, a skill whose frontmatter declares the allowed tools of the workflow, and records whether the session stops asking and whether a tool outside the list is still asked for. If it works, the frontmatter of `go` gets the list from `ALLOWED_TOOLS` of `run-flags.mjs`, and a test compares the two; if it does not, the frontmatter is not changed and the guide says how to allow the tools.

## Risks / Trade-offs

- [The resolver finds a state folder left by an earlier build] → D2 empties it at the start of each build; a script run by hand inside an old worktree writes into a folder that the next build clears.
- [The newest file time is not a heartbeat] → an agent that thinks for a long time changes nothing; the snapshot says when it last changed and does not call the build stuck.
- [`--output-format json` changes what the child prints on a failure] → the reader is tolerant and `go-local.mjs` prints the raw output when it is not the object it expects; a task covers a failed run.
- [A relaunch for unmarked tasks costs a launch] → only when the developer gave no reason, once per group; the alternative today is a failed run after every group was built.
- [More lines in the progress comment of the cloud] → one line, in the same comment; nothing is posted.
- [Same files as `split-ready-and-go` and `build-runner-labels`] → `SKILL.md`, `go-local.mjs` and `progress.mjs`; the changes are in different steps and functions, and the later one rebases.
