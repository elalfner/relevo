## Context

See `proposal.md`. Facts that shape the design (read in the code):

- `scripts/lib/yaml-lite.mjs` parses maps, inline lists of scalars and block lists, but not lists of maps or non-empty inline maps. The registry and the profile header must be nested maps and lists of scalars.
- `scripts/lib/config.mjs` validates from a flat `SETTINGS` table and rejects unknown keys per group; `platform` is an enum with one value and a default.
- `scripts/lib/protected-paths.mjs` has the hard tier (`.github/`, `relevo.yml`, `.relevo/`, `.claude/skills/`, `.agents/skills/`, the rules file) and `commit-change.mjs` already refuses them; the agents are not told.
- `doctor` has `TOOLCHAIN = { 'flutter-android': ... }`, reads `adb` as a warning and requires fixed skills for `think`.
- `go` reaches the agents through its skill; the decision that travels to the build job is produced by `planGo`.

## Goals / Non-Goals

**Goals:** one registry; profiles as data; agents that carry no stack knowledge; a repository can add rules without forking the plugin and cannot weaken the checks; extra skills per role with a small trusted surface; a repository with the legacy setting behaves exactly as before.

**Non-Goals:** the `Platform:` line and per-issue platform choice (next change), the workflow installing only one toolchain, links between repositories, execution modes, `review` adapters per target, Laravel and Vue profiles.

## Decisions

**D1. The profile is a Markdown file with a header read by scripts.** `stacks/<stack>.md` starts with a `---` header in the subset `yaml-lite` parses and ends with prose. Header keys: `stack`, `commands` (`analyze`, `test`, `format`, each a string), `generated` (list of globs), `tools` (list of command names), `requires_skills` (list), `skills` (map role to list), `targets` (map target to the tool it needs, empty string for none). Alternative: JSON or YAML files next to a Markdown body: two files per stack drift apart. Alternative: ask the agent to read the profile: not deterministic and costs tokens at every run.

**D2. Layers add, and only `relevo.yml` replaces.** The resolver reads the plugin's file, then `.relevo/stacks/<stack>.md`, and merges lists by concatenation without duplicates and bodies by concatenation. A scalar (`commands.*`) set by both keeps the plugin's value and is reported as ignored. `platforms.<name>.checks` is applied last and wins. Reason: `.relevo/` and `relevo.yml` are protected, so replacement lives where the review of the project already looks; a file that a run could rewrite cannot loosen the checks.

**D3. Resolution is a script.** `scripts/stack-profile.mjs --platform <name> [--config relevo.yml] [--plugin-root <dir>]` prints JSON; `go` hands the JSON to the agents. The logic is in `scripts/lib/stack-profile.mjs` with the filesystem injected, so it is tested without a repository.

**D4. Normalization in one place.** `scripts/lib/platforms.mjs` holds `normalizePlatforms(raw)`: the legacy `platform: flutter-android` becomes `{ app: { stack: 'flutter', path: '.', targets: ['android'] } }`. `validateConfig` stores the normalized map in `config.platforms` and drops `platform` from the validated result, so every consumer reads one shape. Target names are checked against the profile, so validation needs the profile's `targets`; to keep `config.mjs` pure, it receives the known targets of a stack through an optional argument and checks them only when given. `validate-config.mjs` and `doctor` give it.

**D5. `checks` and `skills.allow_scripts` are ordinary settings.** `checks` is validated against the commands of the profile (D1), so a typo fails instead of being ignored. `qa.rules_from` becomes `string | string[]`; the normalized value is always a list, and callers that took a string (`commit-change`, `check-issue`, `doctor`) take the list.

**D6. Skills are resolved by `scripts/role-skills.mjs`.** `--role dev --platform web` prints, for each skill listed for the role, either `{ name, path }` or `{ name, left_out, reason }`. It reads the base branch with `git cat-file` / `git ls-tree` (`origin/<base>:<dir>/<name>/SKILL.md`), so a skill added by the branch is not trusted. A folder counts as having scripts when it contains a file with a script extension (`.sh`, `.js`, `.mjs`, `.cjs`, `.ts`, `.py`, `.rb`, `.php`) or a `scripts/` directory. Alternative: rely on the agents' own judgement of a skill: that leaves the threat of code that runs to a model.

**D7. The agents become generic by moving text, not by adding text.** The Flutter hygiene and bug list of `dev` and `qa` move to the body of `stacks/flutter.md`; the agents keep the protocol and say "read the profile you are given". The diff command takes its exclusions from `generated`. A test checks that neither agent contains the words `flutter`, `Flutter`, `dart`, `Android` or `adb` outside examples, so stack knowledge cannot creep back.

**D8. `go` with several platforms stops in the planner.** `planGo` returns a decision `platform` (removes `ready`, as `no-milestone` does, because the queue re-evaluates `ready` issues and would repeat the comment; a comment names the platforms) when `Object.keys(platforms).length > 1`. The `Platform:` line replaces this in the next change. Alternative: use the first platform: silently builds the wrong half of a monorepo.

**D9. `skills-lock.json` becomes hard-protected.** It is the file that vouches for the skills; letting a run change it defeats the hash check.

**D10. `doctor` reads the profile, it does not own a table.** `TOOLCHAIN` and the fixed `adb` check are replaced by `tools` and `targets` from the resolved profile. A target's tool missing is a warning because a repository may never run `review` for that target; the toolchain itself stays a failure.

## Risks / Trade-offs

- [A migration changes behaviour for existing repositories] → the legacy setting normalizes to the same single platform; tests keep every current `doctor` and `init` assertion green, and the new ones are additions.
- [The profile header grows until `yaml-lite` is not enough] → the header is limited to the subset on purpose; a feature `yaml-lite` lacks is a reason to simplify the header, not to add a parser.
- [The merged profile is large and spends tokens] → the agents receive only the resolved platform's profile; skills are paths, read on demand; `doctor` warns over 20 KB per role.
- [A skill is trusted because it is on the base branch, and the base branch can hold a bad one] → the branch rules and the review of the pull request that added it are the control; `skills-lock.json` and `doctor` detect later changes.
- [The moved Flutter text loses something] → the move is verified by a test that every sentence of the old hygiene lists appears in `stacks/flutter.md`.

## Migration Plan

Repositories with `platform: flutter-android` need no change. `init` on a new repository writes `platforms`. The plugin ships `stacks/flutter.md`; no file is copied into the repository. Rollback: revert the change; `platform` was never removed.

## Open Questions

- Whether the sandbox repository should switch to `platforms` to exercise the new form; it can be decided when the change is verified.
