# Design

## Context

The machinery for a stack of your own exists and stays as it is: `resolveProfile` takes `.relevo/stacks/<stack>.md` as the whole profile when the plugin has none, `validateConfig` lets `platforms.<name>.checks` name only the commands the profile defines, and `doctor` already warns when that file is not tracked. What is missing is guidance. `stackProfileTemplate` writes a file built to add to a plugin profile, `init` creates it only on request, and `toolchainChecks` judges only the three stacks of its table.

One constraint shapes the template: a key of `checks` is valid only if the profile defines that command. A stack profile without `analyze` therefore cannot be completed from `relevo.yml` either, so the template has to declare the command names.

## Goals / Non-Goals

**Goals:**
- A person who names a stack the plugin does not ship reaches a complete profile and a cloud build that can run its checks, guided by `init`, the docs and `doctor`.
- No false sense of safety: nothing that passes without checking is ever written for the person.

**Non-Goals:**
- Profiles for particular languages in the plugin, a generic fallback profile, or any change to merging and resolution.
- Writing the toolchain step of `relevo-go.yml` from `init`: the versions and the caching are the project's choice, and the template already says to add a step guarded by the stack name.

## Decisions

**The template has two forms, chosen by whether the plugin has a profile for the stack.** `stackProfileTemplate(stack, { own })`: with a plugin profile it stays as it is (commented lines that add to it); for an own stack it also has the commented commands `analyze`, `test` and `format` with the hint to fill them, `tools`, `generated` and a body with the two headings the shipped profiles use (hygiene for the developer, what the auditor looks for in the diff). Whether the plugin has the profile is read from the `stacks/` folder of the plugin, the same lookup that resolution uses.
Alternative: a single richer template. Rejected: for a shipped stack it would suggest commands that `mergeProfiles` ignores and `doctor` reports as ignored.

**The commands are commented, not written.** A placeholder such as `echo todo` would pass QA without checking. Commented lines keep the profile valid, make `doctor` warn until they are written, and show where. The Go example lives in the docs, not in the template, so no language is privileged in the code.
Alternative: ship uncommented defaults per well-known language (`go vet`, `go test ./...`). Rejected here: that is the work of option B (profiles in the plugin), which needs each one run on a real project.

**`init` proposes the file for an own stack instead of waiting to be asked.** The plan item `stack-profile.<stack>` is added for every platform whose stack the plugin does not ship, with the same `todo` and the same rule: created, not committed, listed in the report. The person can decline (`answers.declinedStackProfiles`), and then `doctor` is what says what is missing. `answers.stackProfiles` keeps its meaning for any stack. `planInit` learns which stacks the plugin ships from `templates.shippedStacks`, the `stacks/` folder read by the script; without it nothing is proposed on its own.

**`checks` accepts `analyze`, `test` and `format` for a stack of the repository.** Validation lets `checks` name only commands the profile defines, and the template leaves them commented, so without this a profile could not be completed from `relevo.yml`. Only for a profile that has no plugin layer; a shipped stack keeps its own list.

**`doctor` warns, it does not fail, for the commands.** A repository-only profile without `analyze` or `test` is a gap the person may be filling right now, and the commands in `checks` count. Resolved commands (after `checks`) are the ones judged. It judges only profiles with `layers` equal to `['repository']`, so a shipped stack is never judged.

**The toolchain check learns the guard, not the language.** For a stack of `platformFacts` that has no entry in `TOOLCHAIN_ACTIONS` and a repository-only profile, the check looks, in the active lines (comments removed, as today), for `needs.decide.outputs.stack == '<stack>'`. It is a warning and not a failure, because the guard is the convention of the template and a project may install the toolchain another way (a container image, a self-hosted runner that has it); the message says so, as the existing one does. A stack whose `tools` are only `node` and `npm` is skipped because the job installs Node for Relevo itself; `vue` is shipped and keeps being unjudged.
Alternative: fail like the three known stacks. Rejected: for those the action name is exact, for an own stack the guard is only a convention.

**The docs carry the walkthrough.** One section "Your own stack" in `docs/stacks.md` and `docs/stacks.es.md`, replacing nothing: layer 3 of the table keeps its sentence and links to it. It shows a Go profile, the step `actions/setup-go` guarded by `needs.decide.outputs.stack == 'go'`, `npm`-style `--ignore-scripts` advice translated to `go mod download`, and the reminder to commit the file. A test compares both pages as `readme-sync` and `docs-claims` do for other claims.

## Risks / Trade-offs

- [The Go example ages: commands or action versions change] → The docs say they are an example and name `checks` as the way to change a command; the example pins no version of Go beyond what `setup-go` needs.
- [The guard is a convention, so a working custom workflow draws a warning] → The message says to ignore it if the toolchain is installed another way, as the existing one does.
- [`init` proposing the file again for a repository that declined it] → The proposal is a plan item like the others; once `relevo.yml` and the workflows exist, a run of `init` only reports what is missing, and the person declines again at no cost.
- [A stack name that equals a later shipped profile] → The plugin's profile then takes over and the file becomes a layer; `doctor` already reports ignored commands.

## Migration Plan

Nothing to migrate: a repository that already has `.relevo/stacks/<stack>.md` keeps it and gets, at most, the new warnings. Rolling back is removing the warnings and the second form of the template.
