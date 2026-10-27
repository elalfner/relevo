# Proposal

## Why

Every Claude Code session on the web starts in a fresh container without the OpenSpec command line, which `go`, `doctor` and the review need. The agent then reports "OpenSpec is not installed" and goes on from memory, writing the change files by hand, which `go` forbids. A person who works only on a terminal or through the workflows never meets this: their machine keeps OpenSpec, and the workflows install it. Today Relevo's own repository has a `SessionStart` hook for it (pull request 33), but a project that adopts Relevo gets nothing, and the preflight of `go` does not tell the agent to stop.

## What Changes

- `/relevo:init` plans one more line: install OpenSpec in the sessions of Claude Code on the web. It is an install the person confirms, with the exact hook shown, like the other installs. The hook is merged into the repository's `.claude/settings.json` as a one-line `SessionStart` command that runs only in a remote session (`CLAUDE_CODE_REMOTE=true`) and only when `openspec` is missing. There is no separate script file. The changed settings file is left for the person to commit.
- `/relevo:doctor` warns when it runs in a remote session and the repository has no such hook, with the fix next to it. It stays quiet on a terminal, where the hook has no use.
- The preflight of `go`, when OpenSpec does not run, says to stop, gives the install command and says to write nothing under `openspec/changes/` by hand. The skill `go` repeats it.
- Relevo's own repository uses the same one-line hook instead of the script of pull request 33, so there is one form to maintain.
- Out of scope: a hook that installs the Relevo plugin (the declaration in `.claude/settings.json` that `init` already writes covers it); installing OpenSpec from the plugin itself; Antigravity, which does not read Claude Code hooks.

## Capabilities

### New Capabilities

### Modified Capabilities
- `init-doctor`: init plans the OpenSpec hook for web sessions; doctor warns in a remote session when it is missing.
- `go`: the environment check stops with the install command and forbids writing the change by hand.

## Impact

- `scripts/lib/init.mjs` (a plan item and the merge of the hook), `scripts/lib/doctor.mjs` (a fact and a check), `scripts/lib/preflight.mjs` (the text of the OpenSpec failure), `skills/init/SKILL.md` and `skills/go/SKILL.md`.
- The install and commands pages in English and Spanish, the changelog and the tests.
- A repository gets a few lines in `.claude/settings.json`, or the file if it has none; the plan says so and nothing is written without a yes.
- `.claude/hooks/session-start.sh` of this repository is replaced by the same inline command.
