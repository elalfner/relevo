# Design

## Context

The profile of each stack lists the `tools` it needs (`stacks/flutter.md` has `tools: [flutter]`); `doctor` already probes them on a person's machine. The decision job outputs `platform`, `stack` and `path`; the build job installs the toolchain, then OpenSpec, then runs the agent. The package is unpacked into the workspace only after the agent, because the agent's preflight requires a clean working tree. The generic report step of the build job turns a failed job into `qa-failed` with a comment that says the run ended without a result.

## Goals / Non-Goals

**Goals:**
- A missing tool is found in seconds, before any model turn.
- The comment says what to do, not "read the log".

**Non-Goals:**
- Installing tools, or checking dependencies of the project.
- Replacing the doctor, which still reads the workflow text before any run.

## Decisions

- **Reuse the profile.** The tools come from the resolved profile of the platform, the same one the agents receive, with the repository's `.relevo/stacks` layer applied, so a project that adds a tool to its profile gets it checked with no change here. The probe is `<tool> --version`; a tool that does not run is missing.
- **Unpack outside the workspace.** `npm pack` into `$RUNNER_TEMP`, extracted to `$RUNNER_TEMP/relevo`, and `--plugin-root` points there. The project's `relevo.yml` and `.relevo/stacks` are read from the workspace. Nothing is written inside it.
- **Stop with a specific comment and `qa-failed`.** Putting the issue back to `ready` would start the workflow again and loop. `qa-failed` plus a comment that names the cause and the fix is the same recoverable state every other failure uses. The step that stops posts the comment itself; the generic report step then sees a label other than `ready`, `queued` or `building` and stays silent, which is how it already behaves.
- **A new message and a next-step reason.** `toolchain_missing` with `assignee`, `issue`, `title`, `tools` and `platform`; its next step has no command, as `delete-branch` has none, and a hint that points to `relevo-go.yml` and to `/relevo:doctor`.
- **Order in the job.** After the toolchain steps and the OpenSpec install, immediately before the agent, so it judges what the agent will find.

## Risks / Trade-offs

- A tool that exists under another name (an alias, a wrapper) is reported missing; the profile can drop it from `tools`. The comment says where the list comes from.
- One more step in a template that projects customise; the doctor's text check and this one agree on the common case.
- The step runs for every cloud build; it adds about a second and one extra unpack.
