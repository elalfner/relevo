# Design

## Context

See proposal.md for the motivation. What exists today, read from the code on this branch:

- A profile can list skills per role, and `go` resolves each name to a `SKILL.md` on the base branch in `.agents/skills` or `.claude/skills` **at the root**, refusing links, scripts and skills reserved for the person (`scripts/lib/role-skills.mjs`). The `flutter` profile lists none.
- `doctor` counts the Flutter recommendation as present when the plugin `dart-flutter` is installed at the user scope, or when a `flutter-` folder exists in any of `.claude/skills`, `.agents/skills` or `~/.claude/skills`. `init` then offers nothing. The plugin never reaches the cloud runner.
- The hard-protected paths (`scripts/lib/protected-paths.mjs`) are anchored at the root of the repository: `.claude/skills/` and `.agents/` protect the root folders only, so a skill under `app/.claude/skills/` would be editable by an unattended run.
- A profile's merge keeps the plugin's lists and adds the repository's, so the repository cannot remove an entry (`mergeProfiles` in `scripts/lib/stack-profile.mjs`).
- The official Flutter skills, read from `flutter/agent-plugins` on 2026-10-29: 25 `SKILL.md` files, 211 KB together, none with a `scripts/` folder (three have `examples/*.dart`, which Relevo's script check does not count). Claude Code reads project skills from `.claude/skills/` and, for a subfolder, from `<subdir>/.claude/skills/`, loaded the first time a file under that subfolder is read; its documentation does not mention `.agents/skills`. The `skills` installer (`npx skills add ... --agent claude-code`) writes to the current folder's `.claude/skills/`, and by default links instead of copying (`--copy` copies).

## Goals / Non-Goals

**Goals:**

- A Flutter repository that ran `init` and committed what it wrote has the default skills where the cloud runner and `dev` and `qa` use them.
- The only thing a repository can switch off in a profile is a default skill, by name.

**Non-Goals:**

- Installing all 25 skills, or choosing skills per issue.
- Detecting the Antigravity IDE route, which `doctor` cannot see.
- Verifying in this change that a subagent inherits the lazy loading of a nested skills folder (see Risks).

## Decisions

**The default set is two skills, listed in the plugin's profile under `skills.dev` and `skills.qa`.** `flutter-add-widget-test` (6.4 KB) and `dart-add-unit-test` (4.7 KB) come to 11.1 KB, under the 20 KB budget of a role, and neither prescribes an architecture or a package. They cover what the profile's body does not: how to write the tests of a feature. `dev` and `qa` get the same list because QA audits against the standards the developer builds with. `issue` and `review` get none: they do not write code. The set was fixed on 2026-10-29 by reading the `SKILL.md` of each candidate. Left out: all 25 (211 KB, and each description costs context on every turn whether or not it is used); `flutter-fix-layout-issues`, whose workflow says to run the app in debug mode and hot reload it, which no agent does in a run, and whose layout rules the profile body already carries; `dart-run-static-analysis` (it applies `dart fix --apply`, which rewrites code, and QA never rewrites code); `dart-generate-test-mocks` (it adds `mockito` and `build_runner`); the architecture, HTTP, routing and JSON skills (they would contradict the rule that the profile imposes no architecture). `dart-add-unit-test` has one example with Mockito: it shows a pattern and does not tell the agent to add the package, and a dependency is still added only when the issue allows it.

**Defaults live in the plugin's existing `skills` lists, with no new header key.** Whether a listed skill is a default is known by resolving the plugin's profile alone, and a skill the repository listed itself keeps today's behaviour (a warning when it is left out). Alternative: a `recommended_skills` header key. Rejected for this change: it adds parsing, merging and a concept to explain, and the origin of a name is already recoverable. If the Laravel change needs "use it only if present" for names that depend on `composer.json`, it can introduce the key then.

**`skills.disable` is a list under `skills` in the repository's profile only.** The parser accepts it there and rejects it in the plugin's profile. After the merge, the names it lists are removed from every role list; a name in `requires_skills` is kept and reported as ignored, and a name no list has is reported as matching nothing. It removes nothing else. With the keys of the `review` block, which `dev` already allows a repository to replace, this is the second exception to "the repository only adds", and the security requirement says so.

**Skills are installed into the folder of the platform.** `init` runs `npx skills add flutter/agent-plugins --skill <each missing skill> --agent claude-code --copy --yes` from `<path>`, and adds `--agent universal` when Antigravity is in use. `--copy` because Relevo treats a symlink as a skill it does not trust unless the target is on the base branch, and a copy needs no such reasoning. A platform with `path: .` installs at the root. Alternative: always the root. The platform folder keeps the skills of a Flutter app apart from those of the other platform in a monorepo, so the agent of a backend platform never sees them; the root lookup stays as a fallback so existing repositories keep working.

**Lookup order and protection follow the platform.** `go` looks in `<path>/.claude/skills`, `<path>/.agents/skills`, then the same two at the root. The protected-path rules gain the same folders under each platform's path, at any depth below that path, so the move to the platform folder does not open a hole that the root does not have. Skills still come only from the base branch and are still checked against `skills-lock.json` by `doctor`.

**Presence means committed.** `recommendedSkillFacts` stops counting the user-scope plugin and the home folder, and counts `.agents/skills` for Antigravity only. The plugin result is kept only to word the note ("works here, does not reach the cloud runner"). `doctor` can still say nothing about an agent it cannot check. The skill-presence checks of required skills (OpenSpec's own, Supabase) keep counting the home folder, because those concern the machine running the command.

**`init` stops offering the plugin.** It installed the same skills for one machine only and made the note disappear without helping the cloud. The docs keep the two `claude plugin` commands as an optional extra for working locally, where the plugin also brings the Dart MCP server.

## Risks / Trade-offs

- **A nested skills folder may not load for a subagent of the cloud run** → `dev` and `qa` read the skills through the explicit paths Relevo gives them, so the nested folder only affects discovery by name; task 1 tests a real run and the folder can move to the root without a spec change.
- **`skills-lock.json` lands in the folder the installer runs from** (checked on 2026-10-29 in a scratch repository: from `app/` it writes `app/skills-lock.json` and `app/.claude/skills/`, real files, no links) → the lock file of a platform is protected like the root one and `doctor` compares each skill folder with the lock in the folder that holds it.
- **Upstream renames or removes a skill of the set** → the skill is left out with a note, never a failure; `skills-lock.json` and the hash check make a changed skill visible, and the person commits what they install, so nothing changes under a run.
- **Third-party instructions reach an unattended agent** → they are committed by a person, protected from the run, limited to two skills without scripts, and subordinate to Relevo's and the project's rules (existing requirement).
- **Repositories that relied on the plugin see a new note** → it is a note, with the command; stated in the changelog.
