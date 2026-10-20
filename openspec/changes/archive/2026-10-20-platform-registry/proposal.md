# Proposal

## Why

Relevo only knows one stack. `platform` is an enum with one value (`flutter-android`); `agents/dev.md` and `agents/qa.md` are written in Flutter terms; `doctor` has one toolchain entry and treats `adb` as a warning; `init` asks for "the platform (today flutter-android)". The goal is to use Relevo on Vue, Laravel and Flutter (Android, iOS and web), in a monorepo or in separate repositories, without a second pair of agents per stack (a subagent cannot launch another subagent, and a chain of model sessions costs more).

Verified in the code while preparing this change: `scripts/lib/yaml-lite.mjs` does not parse lists of maps or non-empty inline maps, so the registry has to be written as nested block maps; `scripts/lib/protected-paths.mjs` already refuses `relevo.yml` and `.relevo/` in a commit, but neither agent is told so and `skills-lock.json` is not protected; `qa.rules_from` is a single string.

## What Changes

- **Platform registry.** `relevo.yml` gets `platforms:`, a map of name to `stack`, `path` and (for Flutter) `targets`. `platform: flutter-android` keeps working and means one platform with `stack: flutter`, `path: .`, `targets: [android]`. A repository with one entry behaves exactly as today.
- **Stack profiles.** A profile is a Markdown file `stacks/<stack>.md` in the plugin: a header that scripts read (verification commands, generated files left out of the diff, required tools, targets with their tool, role skills) and a body in prose that the agents read (hygiene and typical bugs). This change ships the `flutter` profile, with the content now spread over the agents. Laravel and Vue profiles are later changes; the mechanism accepts them.
- **Generic agents.** `dev` and `qa` keep the stack-independent protocol and take the resolved profile as an input. `go` resolves it with a script; the agents never choose it.
- **Layers for the user's own rules.** (1) `qa.rules_from` accepts a list of files; (2) `platforms.<name>.checks` replaces a verification command of the profile; (3) `.relevo/stacks/<stack>.md` in the repository adds hygiene, lists and skills to the plugin's profile, or defines a stack the plugin does not ship. A layer adds; it never removes what the plugin says.
- **Protected configuration.** `dev` is told not to edit `relevo.yml`, `.relevo/` or `skills-lock.json`; `qa` rejects a diff that touches them. `skills-lock.json` joins the hard-protected paths.
- **Role skills.** A profile can list extra skills per role (`dev`, `qa`, `issue`, `review`). `go` resolves them to file paths with a script that only accepts skills present on the base branch, invocable by the model, and without scripts unless `skills.allow_scripts` in `relevo.yml` names them.
- **`doctor`.** Reads the toolchain, the targets and the required skills from the profile of each platform, shows which profile layers are in use, fails when a platform names a stack with no profile, warns when the sum of the skill files of a role exceeds 20 KB, and compares skill folders with `skills-lock.json`.
- **`init`.** Asks the stack, the targets and the path of each platform and writes `platforms:`; offers, without committing it, a commented `.relevo/stacks/<stack>.md`.
- **`go` with several platforms.** Choosing the platform of an issue needs the `Platform:` line (a later change). Until then `go` builds a repository with exactly one platform and, with several, stops before claiming the issue with a comment that says so.

## Capabilities

### New Capabilities

- `platforms`: the registry, the stack profiles and their layers.
- `role-skills`: extra skills per role, how they are resolved and which are refused.

### Modified Capabilities

- `configuration`: `platforms` and `platform` as a shortcut, `qa.rules_from` as a list, `platforms.<name>.checks`, `skills.allow_scripts`.
- `go`: the profile is resolved and handed to the agents; the generated-file exclusions and verification commands come from it; several platforms are refused for now.
- `init-doctor`: `init` asks the stack, targets and path; `doctor` reads the profile, the targets and the skills.
- `security`: configuration and skill-lock files are protected; skills come from the base branch.

## Impact

- Code: `scripts/lib/config.mjs`, new `scripts/lib/platforms.mjs`, `scripts/lib/stack-profile.mjs`, `scripts/lib/role-skills.mjs` and their command-line wrappers, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, `scripts/lib/protected-paths.mjs`, `scripts/lib/plan.mjs`.
- Content: `stacks/flutter.md`, `agents/dev.md`, `agents/qa.md`, `skills/go/SKILL.md`, `skills/init/SKILL.md`, `skills/doctor/SKILL.md`, `templates/relevo.yml`.
- Tests and documentation: `tests/` for each new script and the changed agents, `docs/` (EN/ES), `CHANGELOG.md`.
- Not changed: the issue format (no `Platform:` line), the workflow template, `review`, `fix`, `ship`, `status`, links between repositories, execution modes.
