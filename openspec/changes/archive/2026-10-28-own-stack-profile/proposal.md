# Proposal

## Why

A team that builds in Go or Python has no profile in the plugin, and the spec already lets it define one in `.relevo/stacks/<stack>.md`. The way in is not guided: the file that `init` creates is a stub made to add to a plugin profile, with no commands, so the stack passes validation and then has nothing to run; the stacks page says the file defines such a stack and not how; and `doctor` neither notices a profile without `analyze` or `test` nor that the cloud build installs no toolchain for the stack, so every cloud build would fail QA after spending the run.

## What Changes

- When a platform's stack has no profile in the plugin, `init` proposes the file `.relevo/stacks/<stack>.md` by default and writes a profile meant to be the whole of it: the commands `analyze`, `test` and `format` as commented examples to fill in, the tools, the generated files and a body for the hygiene of the developer and what QA looks for. It never writes a command that would pass without checking anything.
- The stacks page, in both languages, gets a section "Your own stack" that walks through a Go example: the file, the commands, the cloud step, and the `checks` of `relevo.yml` for what changes later.
- `doctor` warns when the profile of a stack that only the repository defines has no `analyze` or no `test` (after `checks` are applied), and says to write them.
- `doctor` extends its check of the cloud toolchain to such a stack: with the go workflow installed, it reports a platform whose stack has no active step guarded by `needs.decide.outputs.stack == '<stack>'`, and names the line to add. A stack whose tools are only Node or npm is not judged, because the job already installs Node.
- Out of scope: profiles for Go, Python or any other stack in the plugin, a generic fallback profile, generating the toolchain step of the workflow from `init`, and changing how a profile is merged or resolved.

## Capabilities

### New Capabilities

### Modified Capabilities
- `init-doctor`: `init` proposes and writes a full profile for a stack the plugin does not ship; `doctor` warns about a repository-only profile without `analyze` or `test`; the toolchain check also judges such a stack.
- `documentation`: the stacks page, in both languages, explains how to define your own stack.

## Impact

- `scripts/lib/init.mjs` (`stackProfileTemplate`, the plan of `stack-profile.*`) and `skills/init/SKILL.md`: the profile is proposed by default for a stack without a plugin profile.
- `scripts/lib/doctor.mjs` (`platformChecks`, `toolchainChecks`) and the facts it gathers, with their tests.
- `docs/stacks.md`, `docs/stacks.es.md`, and the sentence about the toolchain in `templates/workflows/relevo-go.yml` (a comment only).
- No change to `relevo.yml`, to profile resolution, to the agents or to what a run can or cannot touch.
