# Design

## Context

See proposal.md for the motivation. What exists today, read on 2026-10-29:

- `recommended-skills-in-project` is merged. The `flutter` profile lists its default skills under `skills`, and a listed skill that is not on the base branch is left out of the run with a note from `doctor` that carries its install command. `skills.disable`, the lookup in the folder of the platform before the root, the protection of the skill folders and `skills-lock.json` of each platform, and `recommendedInstallCommand` (in `scripts/lib/doctor.mjs`) are in `dev`.
- The profiles of `laravel` and `vue` list no skill. The body of `vue` (5 KB) already says no `v-html` with outside data, no `href` built from user input, props kept reactive, listeners removed, a stable `:key`; it does not say user-built templates, `innerHTML` in render functions, `:style` from user CSS, `javascript:` URLs, props that change for a whole list, `shallowRef`, virtualized lists, or how Vue says to test.
- Laravel Boost (`laravel/boost`) is a development dependency. `php artisan boost:install` takes `--guidelines`, `--skills` and `--mcp`, and detects the packages from `composer.json`. For Claude Code it writes skills to `.claude/skills` under the project root (`skillsPath` in `src/Install/Agents/ClaudeCode.php`, read on 2026-10-29), and guidelines to `CLAUDE.md`. Its skills are Blade templates in the Boost repository (`SKILL.blade.php`) that the installer renders. The Boost documentation says the generated files may be added to `.gitignore`. A skill `laravel-best-practices` (a `SKILL.md` of 4.6 KB plus `rules/*.md`) is in the Boost repository; the documentation's list of skills does not name it.
- `vuejs-ai/skills` (MIT, 3.2 thousand stars, last pushed 2026-10-23) holds eight skills and 211 files, none with a script. It calls itself an early experiment that "may be incomplete due to hallucinations", and its author says an unofficial project. `vue-best-practices` is 10.5 KB and `vue-testing-best-practices` 2.1 KB.

## Goals / Non-Goals

**Goals:**

- A Laravel or Vue repository can get skills into the repository with a command that `init` shows, and `dev` and `qa` use them only once they are committed.
- Nothing is reported for a skill that does not apply to the project.

**Non-Goals:**

- Giving `dev` and `qa` the skills of every package Boost knows.
- Running the guidelines or the MCP server of Boost, or editing `CLAUDE.md`.
- Writing skills for Vue.

## Decisions

**A new header key, `skills_when_installed`, for skills that depend on the project.** `pest-testing` applies only to a project that uses Pest, and a Laravel repository without Boost has none of them, so a note for each missing one, as the Flutter set does, would be noise. The key has the shape of `skills`, merges by union, and is resolved by `go`: a listed skill whose folder is on the base branch is given to the role and marked as a default; one that is not is left out of the output without a note. A skill that is there but has scripts or is reserved for the person is still reported, because that is a fact about a skill the project did install. `skills.disable` removes a skill from this key too. Alternative: list them under `skills` and make `doctor` ignore the ones that do not apply. Rejected: `doctor` cannot know which skills apply to a project.

**Laravel: two skills, `laravel-best-practices` and `pest-testing`.** The first is the general guidance of the framework and fits any Laravel project (4.6 KB, with its rules read only when needed); the second covers the tests, which the profile text does not. The skills for Livewire, Inertia, Flux, Tailwind and the others are 3 to 10 KB each and apply only when the package is used, so a project that wants them lists them under `skills` itself; the stacks page says how. The two names are a starting point: task 1 reads the rendered skills and fixes the set.

**Laravel: `boost:install --skills` only.** It installs the skills and leaves the guidelines (`CLAUDE.md`) and the MCP server alone, because `init` never writes the rules file of a project. The install runs from the folder of the platform, which is where `artisan` lives and where Boost resolves `.claude/skills`, so `path: api` gets `api/.claude/skills` and the lookup of the previous change finds it. The two commands are offered separately, as optional installs, and the person is told to commit `.claude/skills/`, `composer.json` and `composer.lock`: Laravel's advice to ignore generated files would hide the skills from the cloud runner, which `doctor` now warns about.

**Vue: the body gains a checklist, and two community skills are offered.** The checklist comes from the security, performance and testing pages of vuejs.org, keeps to what can be read in a diff, and stays under 2 KB so the body the agents receive on every run does not grow much. The two skills of `vuejs-ai/skills` (12.6 KB together) are offered as an optional install and used only when installed; the person who installs them has accepted that they are not official. Alternatives: write our own (the checklist already holds the checkable part, and a long skill would be unverified text of ours); leave `vuejs-ai/skills` out (the person would have no route to them). `doctor` says nothing when they are absent: the plugin does not recommend them, it only makes them easy to take.

**The offers share one shape with Flutter's.** One install per platform folder, shown with `cd <folder> &&`, run by the skill after a yes to that command alone, declining changes nothing else. The table of sources stays apart from `RECOMMENDED` in `scripts/lib/doctor.mjs`, which makes `doctor` note a missing skill, so that Vue is offered and not recommended.

**One warning for every stack: a skill folder ignored by git.** `git check-ignore` on `.claude/skills` and `.agents/skills`, in the folder of the platform and at the root, when they exist. It is a warning, not a note, because the result is a run that silently lacks skills the person believes it has. It says nothing when git cannot tell.

## Risks / Trade-offs

- **`boost:install --skills` may ask which agents to install for** → if a non-interactive run cannot choose Claude Code, the install becomes a step the person runs in their own terminal, and the plan says so instead of running it; task 1 runs it in a scratch project to find out.
- **The rendered skills may hold files the script check rejects** → the check is on the installed folder; task 1 lists it, and a skill that would be left out is dropped from the set.
- **The documentation of Boost does not list `laravel-best-practices`** → task 1 confirms the installer writes it for a Laravel project; if it does not, the set is `pest-testing` and the skills that it does write.
- **Content of the community skills may be wrong** → only two are offered, they are committed by a person, protected from the run, and subordinate to the rules of Relevo and of the project; the label says what they are.
- **The upstream projects may rename a skill** → the skill is then absent and skipped without a trace; the cost is a stale list, which a later change can fix.
