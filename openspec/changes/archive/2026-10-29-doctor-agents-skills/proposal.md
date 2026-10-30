# Proposal

## Why

Running `doctor` of `dev` on two real Flutter repositories (read-only, 2026-10-29) showed two faults of `recommended-skills-in-project`. In a repository with Flutter at the root and the default skills committed under `.agents/skills`, `doctor` says they are not committed for Claude Code, while `scripts/role-skills.mjs` gives `dev` and `qa` the paths `.agents/skills/flutter-add-widget-test/SKILL.md` and `.agents/skills/dart-add-unit-test/SKILL.md`: the report contradicts what `go` does. In a monorepo with the Flutter app in `app/`, the same missing skills are reported three times, one note per skill and the general note of the stack.

## What Changes

- **`.agents/skills` counts for Claude Code too.** The note `recommended.flutter.claude` judges the skill folders `go` reads: `.claude/skills` and `.agents/skills`, in the folder of the platform and at the root. `.agents/skills` stays the only folder that counts for Antigravity. The reason it did not count was how Claude Code finds skills by name; `dev` and `qa` do not depend on that, because Relevo hands them the path of each `SKILL.md`.
- **One note, not three.** For a stack that has a note of recommended skills, `doctor` no longer adds a note per skill that the plugin's profile lists and the repository lacks; the note of the stack already names them with their command. The per-skill note stays for a stack without one.
- `init` follows the same facts, so it offers no install for Claude Code when the skills are already under `.agents/skills`.

Out of scope: a real cloud run, the outdated workflows of those repositories, and anything about what `go` hands to `dev` and `qa`, which was already right.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: the requirement "Doctor notes the recommended Dart and Flutter skills" counts `.agents/skills` for Claude Code, and its scenario "Only `.agents/skills` and Claude Code" becomes a pass.
- `role-skills`: the requirement "A default skill that is not installed is a note" leaves the per-skill note to stacks that have no note of their own.

## Impact

- Code: `scripts/lib/doctor.mjs` (`recommendedSkillFacts` and the per-skill note), and `scripts/lib/init.mjs` through the same facts.
- Docs: the line of `CHANGELOG.md` that says `.agents/skills` counts for Antigravity only, and any sentence of `docs/stacks.md` and `docs/stacks.es.md` or `skills/doctor/SKILL.md` that says so.
- Tests: `tests/doctor.test.mjs` and `tests/init.test.mjs`.
- Behaviour: a repository with the default skills under `.agents/skills` gets a pass for Claude Code instead of a note; a monorepo gets one note instead of three.
