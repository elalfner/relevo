# Proposal

## Why

A cloud build whose runner lacks the toolchain of the stack fails only at the end: the developer writes the code, QA tries to run `flutter analyze`, finds no SDK and rejects. That is a full run, about 14 turns and half a dollar of the subscription, spent to learn something that the first second of the job could have said (the sandbox's first build, #37, and the experiment #40). The doctor now fails when a Flutter or Laravel project has no toolchain step, but it reads the workflow text: it cannot see a step that is present and broken, a custom stack, or a runner image that changed. The build job should check, before the agent starts, that the tools the profile of the platform asks for are on the path.

## What Changes

- A new script, `toolchain-check.mjs --platform <name>`, resolves the profile of the platform (the same resolution as everything else), runs `<tool> --version` for each tool the profile lists (`flutter`; `php` and `composer`; and so on) and prints which are missing. It exits 1 when any is.
- The build job runs it right before the agent step, from a copy of the package unpacked outside the workspace (the agent needs a clean working tree, so nothing is unpacked inside it before it runs). When it fails, no model turn is spent: the issue moves to `qa-failed` and one comment says which tools are missing on the runner, that nothing was built, and what to do: enable the toolchain step in `relevo-go.yml` and apply `ready` again after removing `qa-failed`.
- The comment is a new message, `toolchain_missing`, in English and Spanish, with its next step in the table of next steps.
- A stack whose profile lists no tools is not checked.
- The execution and guide pages and the changelog say it; both languages.
- Out of scope: installing the missing tool for the person, and checking the dependencies of the project.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the cloud build checks the toolchain before the agent starts.

## Impact

- New `scripts/toolchain-check.mjs` and `scripts/lib/toolchain-check.mjs`, a message kind and a next-step reason, one step in `templates/workflows/relevo-go.yml`, tests of each, the pages and the changelog.
- A cloud build with a complete toolchain behaves as before and adds about a second.
