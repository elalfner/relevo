# Proposal

## Why

`init` labels the optional `.relevo/stacks/<stack>.md` "(not committed)", while the same plan says the new `.claude/settings.json` is "left for you to commit". People and agents read the first as "keep this file out of git" and leave it untracked. Relevo needs the file in git: `.relevo/` is a protected path, the cloud run reads the profile from its checkout, and a stack the plugin does not ship is defined only by that file. An untracked file means the cloud and every teammate run without the project's rules, and `doctor` still reports the repository layer as if it applied everywhere.

## What Changes

- The plan line, the `init` skill, the spec and the docs say the profile file is created and **left for the person to commit**, in the same words used for `.claude/settings.json`. `init` still never commits it.
- The report of `init` names `.relevo/stacks/<stack>.md` among the new files to commit when it created one.
- `doctor` warns when a platform's profile uses `.relevo/stacks/<stack>.md` and git does not track that file, saying that the cloud and a fresh clone use only the plugin's profile (or have no profile, for a stack the plugin does not ship), and how to fix it.
- The CHANGELOG records both under Unreleased.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: "Init sets up the repository" says the profile file is left for the person to commit instead of "without committing it"; "Doctor reads the profile of each platform" adds a warning for an untracked repository layer.

## Impact

- `scripts/lib/init.mjs` (plan text of `stack-profile.<stack>`), `skills/init/SKILL.md` (question and report).
- `scripts/lib/doctor.mjs` (fact gathering in `gatherPlatforms`, a new result in `platformChecks`).
- `tests/init.test.mjs`, `tests/doctor.test.mjs`.
- `docs/stacks.md`, `docs/stacks.es.md`, `docs/configuration.md`, `docs/configuration.es.md`, `CHANGELOG.md`.
- No change to how profiles are resolved, to protected paths or to the workflows.
