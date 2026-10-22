# Design

## Context

- `planInit` emits `stack-profile.<stack>` with the text "a commented profile that adds to the plugin's (not committed)", next to `install.plugin-project`, which says the new `.claude/settings.json` "is left for you to commit". `init` never commits anything; `manual.push` asks the person to commit and push the new files.
- `doctor` resolves each platform's profile in `gatherPlatforms` through `resolveProfile`, which returns `layers` (`plugin`, `repository`, or both). `platformChecks` turns the layers into the `platform.<name>.profile` line. The repository file is read from the working copy, so an untracked file counts as a layer.
- `doctor` already asks git whether something is tracked: `openspecRootTracked` runs `git ls-files openspec` through `p.tool`, and treats a failure as "not tracked".

## Goals / Non-Goals

**Goals:**
- One wording for "created, not committed by `init`, yours to commit" across the plan, the skill, the spec and the docs.
- A `doctor` warning when the repository layer would not reach the cloud or a clone because git does not track it.

**Non-Goals:**
- Checking that the file is on the base or default branch. Tracked on a feature branch is enough for this warning; what the cloud reads is the checkout of its own branch.
- Warning about uncommitted edits to a tracked profile file.
- Having `init` commit the file, or changing how layers merge, the protected paths or the workflows.

## Decisions

**D1. Warn, do not fail.** A local profile that is not yet committed is a normal state right after `init`, and the person may still be editing it. A failure would make the first `doctor` run red for a step the plan already lists as "by hand". This holds also for a stack the plugin does not ship: the message says the cloud has no profile for that stack, which is enough to act on, and `go` in the cloud already fails clearly when the profile is missing.
Alternative: fail when the repository file is the whole profile. Rejected for now to keep one rule and one id per platform.

**D2. Detect with `git ls-files --error-unmatch <path>`.** It exits non-zero for an untracked path and is read-only. The fact is gathered in `gatherPlatforms` only when `layers` includes `repository`, stored on the platform entry as `repositoryLayerTracked` (`true`, `false`, or `null` when git could not answer: no git, not a repository). `null` adds no warning, so `doctor` outside a repository or without git says nothing new.
Alternative: `git ls-files <path>` and test for empty output, as `openspecRootTracked` does. Equivalent; `--error-unmatch` makes the intent explicit and does not depend on parsing output. Either is acceptable; follow whichever matches the probe helpers best.

**D3. A separate result id.** The warning is `platform.<name>.profile.tracked`, emitted after `platform.<name>.profile`, so the existing pass line and its tests stay as they are. The fix text: commit `.relevo/stacks/<stack>.md` and push it with the rest of the repository's Relevo files.

**D4. Same words as `.claude/settings.json`.** The plan line becomes "Create `.relevo/stacks/<stack>.md`, a commented profile that adds to the plugin's (left for you to commit)". The skill's question and report, the spec, `docs/stacks*.md` and `docs/configuration*.md` use the same idea. The Spanish pages say it in Spanish.

## Risks / Trade-offs

- [A person deliberately keeps machine-only rules in that file] → The warning is a warning; the docs say that the file is meant to be committed and that personal rules belong elsewhere (for example a local `CLAUDE.md` that is not in `qa.rules_from`).
- [git answers slowly in a large repository] → One `ls-files` call per platform with a repository layer; negligible.
