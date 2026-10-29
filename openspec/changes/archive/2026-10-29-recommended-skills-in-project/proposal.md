# Proposal

## Why

The official Dart and Flutter skills only help the unattended build when they are in the repository: the cloud runner sees what is committed to the base branch, not a plugin installed on one machine. Today `doctor` counts a plugin of the user scope as "present" and `init` then says nothing, so a Flutter repository can pass every check and still build in the cloud without any skill. Relevo also hands no skill to `dev` and `qa` by default, so even a committed folder is only used when the person lists each skill by hand.

## What Changes

- `init` installs a short, fixed set of the official Flutter skills into the folder of each Flutter platform (`<path>/.claude/skills/`, and `.agents/skills/` for Antigravity), as optional installs confirmed one by one, and asks the person to commit them.
- The `flutter` profile lists that set under `skills` for `dev` and `qa`. A skill the plugin's profile lists but the repository does not have is reported once by `doctor` as a note with its install command, and is left out of the run with the existing reason; it never blocks.
- A plugin installed on a machine no longer counts as the skills being present: `doctor` says it works locally and does not reach the cloud runner. `.agents/skills` counts for Antigravity only, not for Claude Code.
- The repository can switch off a skill the plugin lists, by name, with `skills.disable` in `.relevo/stacks/<stack>.md`. It cannot remove a command, a tool or a required skill.
- Skills are looked up in the folder of the platform first and then at the root, and the skill folders of a platform (`<path>/.claude/skills/`, `<path>/.agents/`) become hard-protected paths, as the root ones already are.
- The stacks page, in both languages, explains the difference between a required skill (`requires_skills`, a `doctor` failure when missing) and a recommended one, says that `dev` and `qa` now receive the set, and drops a bullet that appears twice.

Out of scope: Laravel (Laravel Boost) and Vue, which are a separate change; skills from pub.dev packages; the Dart MCP server entry and the official rules, which stay manual steps; skills of the user's own home folder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: the three requirements on the recommended Flutter skills (what `doctor` reports and for whom, that a recommended skill never blocks, what `init` offers).
- `platforms`: the profile of the repository may switch off a default skill by name; the `flutter` profile lists the default set for `dev` and `qa`.
- `role-skills`: skills are resolved from the folder of the platform before the root; a default skill the repository lacks is left out with a distinct reason.
- `security`: the skill folders of a platform are hard-protected at any depth; `skills.disable` does not weaken the checks.
- `documentation`: the stacks page explains required versus recommended skills and no longer says that Relevo hands no skill to `dev` and `qa`.

## Impact

- Code: `scripts/lib/doctor.mjs` (recommended facts and checks), `scripts/lib/init.mjs` (the offers), `scripts/lib/stack-profile.mjs` (parse and merge `skills.disable`), `scripts/lib/role-skills.mjs` and `scripts/role-skills.mjs` (lookup by platform), `scripts/lib/protected-paths.mjs`.
- Profile: `stacks/flutter.md` gains skill names under `skills.dev` and `skills.qa`.
- Docs and skills: `docs/stacks.md`, `docs/stacks.es.md`, `skills/init/SKILL.md`, `skills/doctor/SKILL.md`, `CHANGELOG.md`.
- Tests: `tests/doctor.test.mjs`, `tests/init.test.mjs`, `tests/stack-profile.test.mjs`, `tests/stack-profiles-shipped.test.mjs`, the role-skills and protected-paths tests, `tests/docs-claims.test.mjs`.
- Behaviour: a Flutter run now reads up to two skills per role; the budget of 20 KB per role stays.
