# Design

## Context

`planInit` lists installs as items with `install: true` and an exact `command` or detail; the skill shows each and runs it only after a yes, and `applyPlan` skips them. `install.plugin-project` already reads `.claude/settings.json` through the `pluginDeclaration` fact, and `doctor` shares that fact. `preflight.mjs` fails `openspec` with the fix "run /relevo:doctor". Pull request 33 added `.claude/hooks/session-start.sh` and the hook registration to this repository only. The hook environment sets `CLAUDE_CODE_REMOTE=true` in web sessions. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A project that uses Relevo from Claude Code on the web finds OpenSpec in every new session, with the person's consent.
- `go` never continues without OpenSpec.

**Non-Goals:**
- Installing the plugin from a hook: the declaration that `init` writes already makes Claude Code offer it.
- Any behaviour on a terminal or in a workflow, which have OpenSpec already.
- Antigravity, which does not read Claude Code hooks.

## Decisions

- **One inline command, no script file.** The hook's `command` is a single line: skip unless `CLAUDE_CODE_REMOTE` is `true`, skip when `command -v openspec` succeeds, otherwise `OPENSPEC_TELEMETRY=0 npm install --global @fission-ai/openspec`. A script file would be a second tracked file in every project and would not follow the plugin's version. Alternative: a script in the plugin, called through `${CLAUDE_PLUGIN_ROOT}`; rejected because the variable is not available to a project hook and the plugin may not be loaded yet when the hook runs.
- **Opt-in through the install item**, in the same style as `install.plugin-project`: shows the hook, runs only on a yes. This keeps "installing dependencies is explicit": the person consents once, at `init`, to an install that then repeats in each session.
- **The merge is done by the skill, not by hand-editing in the script.** `init` proposes the hook as data (`item.hook`) and the skill merges it with the existing JSON, adding to `hooks.SessionStart` and keeping every other key. A file that does not parse is never touched (a manual line), as for the plugin declaration.
- **A fact `webHook` from `.claude/settings.json`**: true when any `SessionStart` command contains `@fission-ai/openspec`. Matching the package name tolerates a person who wrote their own form.
- **Doctor judges it only in a remote session.** The hook has no use elsewhere, so a warning on a terminal would be noise for most projects. Alternative: always warn; rejected for that reason. A warning, not a failure: the project can run without it.
- **The preflight message carries the instruction.** The agent reads the failure output, so the stop order and the install command belong there as well as in `skills/go/SKILL.md`. The closed list of OpenSpec commands stays as it is: the install is run by the person, not by `go`.
- **This repository uses the same line.** The script of pull request 33 is removed in favour of the inline command, so the form that `init` ships is the one that is tested here.

## Risks / Trade-offs

- [A global npm install on every new web session adds seconds to the start] → It runs only when `openspec` is missing, and the container state is cached after the first run.
- [The package could change or be compromised] → It is the same package the workflows install; the person agreed to the exact line; a pin to a version is a possible later step.
- [A hook that matches the package name could be a false positive] → The only effect is that `init` does not offer the line; the person can add it by hand.
- [Claude Code changes the variable that marks a web session] → The hook then does nothing and `doctor` stays quiet; the preflight still stops `go` with the install command.

## Open Questions

- Whether to pin the OpenSpec version in the hook. It can be decided later without changing the specs or the tasks.
