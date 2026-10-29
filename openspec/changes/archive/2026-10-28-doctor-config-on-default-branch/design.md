# Design

## Context

`gatherFacts` in `scripts/lib/doctor.mjs` already knows the default branch (`repos/<r>`, `default_branch`) and already reads files from it with the contents API (`contents/<path>?ref=<branch>`) to judge the workflows. `runChecks` is pure and turns facts into results. `relevo.yml` is parsed by `scripts/lib/yaml-lite.mjs` (`parse`), which `loadConfig` in `scripts/lib/config.mjs` wraps with validation and defaults. The working copy's `relevo.yml` is what the rest of `doctor` judges. It may be on a feature branch, so it stands for neither branch on GitHub.

## Goals / Non-Goals

**Goals:**
- One warning, with a fix, when the cloud would run with a `relevo.yml` that is not the one on the base branch.
- No noise from comments, ordering or whitespace.

**Non-Goals:**
- Saying which setting differs. The warning points at the two branches, and `git diff origin/<default> origin/<base> -- relevo.yml` shows the rest.
- Comparing the workflows between the two branches. The workflows are already judged on the default branch.

## Decisions

- **Both copies come from GitHub, not from the working copy.** The comparison reads `contents/relevo.yml?ref=<default>` and `contents/relevo.yml?ref=<base>`. The working copy may be a feature branch or hold unpushed edits, and neither is what the cloud or a build sees. Alternative: compare the default branch with the working copy. Rejected, because it would warn about every local edit.
- **Compare parsed values, not text.** Each text is parsed with `yaml-lite`'s `parse` and compared with `isDeepStrictEqual` from `node:util`. Comments, key order and whitespace are ignored. `loadConfig` is not used, because its defaults and profile lookups would hide a key that one branch sets to its default value, and that difference is still worth a warning. Alternative: compare the raw text. Rejected, because a comment change on `dev` would warn. When either text fails to parse, the texts are compared as strings, so a broken file on the default branch still shows up as a difference.
- **Facts.** `gatherFacts` sets `f.configOnBranches = { defaultBranch, base, same, missingOnDefault }`, or `null` when there is nothing to compare: no repository or sign-in, the default branch is the base branch, the base branch has no `relevo.yml`, or a read failed with anything other than a 404. A 404 on the default branch sets `missingOnDefault`. The base branch name comes from the working copy's valid config (`branches.base`, default `dev`), the same source the existing branch checks use.
- **Result.** `runChecks` emits `repo.config-default-branch`: `pass` when it is the same, and `warn` when it differs or is missing. The message names both branches and says the cloud uses the default branch's copy. The fix is: promote `<base>` to `<default>` through a pull request, or make `<base>` the default branch. It is a warning, not a failure, because promoting on a schedule is a valid way to work and nothing is broken. The result sits in the "GitHub side" block next to `repo.base-branch`.
- **Docs.** A new section "Which branch the cloud reads" in `docs/execution.md`, placed after "The three places", with its twin "Qué rama lee la nube" in `docs/execution.es.md` at the same position, to satisfy the parity rule. The `branches.base` row in both configuration pages gains one clause.

## Risks / Trade-offs

- [Two more API calls on every run] → They are small reads of one file each, and both are skipped when the default branch is the base branch.
- [A team that promotes on purpose sees a standing warning] → It is a warning, not a failure, so the exit status does not change, and the fix names the alternative of making the base branch the default branch.
- [The base name comes from the working copy's config, which may differ from both branches] → It is the same source `repo.base-branch` already uses. A rename of the base branch shows up first in that check.
