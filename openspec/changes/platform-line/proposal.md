# Proposal

## Why

`platform-registry` lets `relevo.yml` declare several platforms (a Vue front and a Laravel back in one repository, say), but `go` refuses to build any repository that has more than one, because nothing says which platform an issue belongs to. This change gives the issue a way to say it, and makes every command that needs the stack (`go`, `fix`, `review`, `issue`) take it from there.

Facts read in the code while preparing this change: `parseIssueBody` knows `Depends-on:` and `Allow-paths:` lines but no platform; `planGo` stops with the decision `platform` when the registry has more than one entry; the decision that travels to the build job has no stack or path; `go-plan.mjs` writes only `action` and `decision_b64` to the workflow output, so the build job cannot choose a toolchain; `fix` and `review` read the profile of nothing (they launch `dev` and `qa` without one); `commit-change.mjs` refuses protected paths but has no notion of the folder of a platform.

## What Changes

- **`Platform:` line.** An issue names its platform with `Platform: <name>`, like `Depends-on:`. With one platform in `relevo.yml` the line is optional; with several it is required, and the name must exist in `platforms`. Two different `Platform:` lines are a problem.
- **The gate.** `planGo` resolves the platform of the issue. A missing line (with several platforms) or an unknown name sends the issue to `needs-spec` with the reason `missing`, like any other missing part of the specification. This replaces the "several platforms" refusal of the previous change. The `start` decision carries `platform`, `stack`, `path` and `targets`.
- **One platform per issue, and the issue stays in it.** `commit-change.mjs` takes `--within <path>` and refuses files outside the folder of the platform, except the change's own specification folder, `GLOSSARY.md` and `docs/adr/`. An `Allow-paths:` line can authorize an extra folder, such as a shared package. A feature that needs two platforms is two issues with `Depends-on:`.
- **Run from the platform folder.** `go` resolves the profile and the role skills for the platform of the decision, and tells `dev` and `qa` to run the commands of the profile from the platform folder.
- **Toolchain per stack.** `go-plan.mjs` also writes `platform`, `stack` and `path` to the workflow output, and the `go` workflow template guards the setup steps of each stack with them, so a Vue issue does not install Flutter.
- **`fix` and `review` find the platform again.** A new command `platform-of.mjs` reads the `Platform:` line of an issue and prints the platform; both skills use it to resolve the profile.
- **`issue`.** It deduces the platform from the paths the idea mentions, asks only when it cannot, writes the line, and `check-issue.mjs` fails a draft that needs the line and lacks it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platforms`: one platform per issue, named in the issue, and how it is resolved.
- `go`: the gate, the decision, the scope of a diff and the commands' folder, the workflow output; the "one platform per run" requirement is removed.
- `issue`: the `Platform:` line when writing and updating an issue.
- `fix`: the platform is found again from the issue.
- `review`: the platform is found again from the issue when the review needs QA again.

## Impact

- Code: `scripts/lib/issue-parse.mjs`, `scripts/lib/issue-check.mjs`, `scripts/check-issue.mjs`, new `scripts/lib/platform-of.mjs` and `scripts/platform-of.mjs`, `scripts/lib/plan.mjs`, `scripts/go-plan.mjs`, `scripts/lib/commit-change.mjs`, `scripts/lib/protected-paths.mjs` (or a sibling module for scope), `scripts/lib/messages.mjs`.
- Content: `skills/go`, `skills/fix`, `skills/review`, `skills/issue`, `templates/issue.md`, `templates/workflows/relevo-go.yml`, `docs/issue-format.md`, `docs/stacks.md` and `docs/stacks.es.md`.
- Tests: for each changed script and skill, plus the workflow template.
- Not changed: links between repositories (`Depends-on: owner/repo#N`), execution modes, `review` adapters per target, `status` grouped by platform.
