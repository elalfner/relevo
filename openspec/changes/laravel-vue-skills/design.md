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

**A new header key, `skills_when_installed`, for skills that depend on the project.** Boost installs the skills of the packages a project uses (Tailwind, Livewire, Pest and others), and a Laravel repository without Boost has none of them, so a note for each missing one, as the Flutter set does, would be noise. The key has the shape of `skills`, merges by union, and is resolved by `go`: a listed skill whose folder is on the base branch is given to the role and marked as a default; one that is not is left out of the output without a note. A skill that is there but has scripts or is reserved for the person is still reported, because that is a fact about a skill the project did install. `skills.disable` removes a skill from this key too. Alternative: list them under `skills` and make `doctor` ignore the ones that do not apply. Rejected: `doctor` cannot know which skills apply to a project.

**Laravel: two skills, `laravel-best-practices` and `testing-best-practices`.** The first is the general guidance of the framework and fits any Laravel project (4.6 KB, with its rules read only when needed); the second covers the tests, which the profile text does not (4.2 KB). A fresh Laravel 13 project got both from `boost:install --skills` (checked on 2026-10-29), together with `tailwindcss-development`, `infer-conventions` and `deploying-to-cloud`. The last two are 12.6 and 15.7 KB and are not for writing or auditing code in a run; the skills of Livewire, Inertia, Flux, Tailwind and `pest-testing` apply only when the package is used, so a project that wants them lists them under `skills` itself; the stacks page says how.

**Laravel: `boost:install --skills` only.** It installs the skills and leaves the guidelines (`CLAUDE.md`) and the MCP server alone, because `init` never writes the rules file of a project. The install runs from the folder of the platform, which is where `artisan` lives and where Boost resolves `.claude/skills`, so `path: api` gets `api/.claude/skills` and the lookup of the previous change finds it. The two commands are offered separately, as optional installs, and the person is told to commit `.claude/skills/`, `composer.json` and `composer.lock`: Laravel's advice to ignore generated files would hide the skills from the cloud runner, which `doctor` now warns about.

**Vue: the body gains a checklist, and two community skills are offered.** The checklist comes from the security, performance and testing pages of vuejs.org, keeps to what can be read in a diff, and stays under 2 KB so the body the agents receive on every run does not grow much. The two skills of `vuejs-ai/skills` (12.6 KB together) are offered as an optional install and used only when installed; the person who installs them has accepted that they are not official. Alternatives: write our own (the checklist already holds the checkable part, and a long skill would be unverified text of ours); leave `vuejs-ai/skills` out (the person would have no route to them). `doctor` says nothing when they are absent: the plugin does not recommend them, it only makes them easy to take.

**The offers share one shape with Flutter's.** One install per platform folder, shown with `cd <folder> &&`, run by the skill after a yes to that command alone, declining changes nothing else. The table of sources stays apart from `RECOMMENDED` in `scripts/lib/doctor.mjs`, which makes `doctor` note a missing skill, so that Vue is offered and not recommended.

**One warning for every stack: a skill folder ignored by git.** `git check-ignore` on `.claude/skills` and `.agents/skills`, in the folder of the platform and at the root, when they exist. It is a warning, not a note, because the result is a run that silently lacks skills the person believes it has. It says nothing when git cannot tell.

## Risks / Trade-offs

- **`boost:install --skills` may ask which agents to install for** → with `--no-interaction` it asks nothing and installs for the agents it detects on the machine (Claude Code, Cursor, Kiro and OpenCode in the test, which wrote `.claude/skills/`, `.agents/skills/` and `.kiro/skills/`, and `boost.json`); on a machine with no agent that Boost detects it may install nothing, which `doctor` shows as Boost present with no skill committed. The plan tells the person to commit `.claude/skills/` and the folders of the agents they use.
- **The rendered skills may hold files the script check rejects** → none did: the five installed folders hold 35 files, all Markdown, real files and not links; a skill that would be left out would still be dropped from the set.
- **The documentation of Boost does not list `laravel-best-practices` or `testing-best-practices`** → a fresh Laravel 13 project got both (Boost 2.10, `boost:install --skills --no-interaction`, 2026-10-29); a Laravel 10 or 11 project may not, and then they are absent and skipped without a trace.
- **`vue-best-practices` tells the agent to read four reference files on every Vue task** (`reactivity`, `sfc`, `component-data-flow`, `composables`: 33.8 KB, checked on 2026-10-29), so the skill costs about 44 KB of reading per run and role, while the budget of 20 KB counts only its `SKILL.md` (10.5 KB); `vue-testing-best-practices` is an index of references read by symptom and costs little → the stacks page says so, and `skills.disable` switches the skill off; the profile does not list more than the two.
- **Content of the community skills may be wrong** → only two are offered, they are committed by a person, protected from the run, and subordinate to the rules of Relevo and of the project; the label says what they are.
- **The upstream projects may rename a skill** → the skill is then absent and skipped without a trace; the cost is a stale list, which a later change can fix.
