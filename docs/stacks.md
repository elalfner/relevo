# Stacks and platforms

English · [Español](stacks.es.md)

Relevo builds more than one kind of project. What changes from one to another (the commands that check the code, the typical bugs, the tools) lives in a **stack profile**, not in the agents. This page explains how to declare your platforms, what a profile holds and how to add your own rules.

## Declare the platforms

Each platform has a name, a stack, the folder where it lives and, for stacks that have them, targets. `relevo.yml` holds them:

```yaml
platforms:
  app:
    stack: flutter
    path: .
    targets: [android, ios, web]
```

- A repository with one platform uses `path: .`. A monorepo has one entry per platform, each with its folder.
- The older line `platform: flutter-android` still works and means one Flutter platform with the Android target. Do not set both.
- With several platforms, each issue says which one it is for with a line `Platform: web` (the name is a key of `platforms`). With one platform the line is optional. An issue without it, or with a name that does not exist, goes back to the spec writer. A feature that needs two platforms is two issues, the front depending on the back with `Depends-on:`.
- `/relevo:init` asks for all of this and writes it.

## What a stack profile holds

A profile is the file `stacks/<stack>.md` of the plugin. Its header is read by scripts and its text is read by the agents.

- The commands that verify the code: `analyze`, `test` and `format`.
- The generated files that are left out of the diff QA reviews.
- The tools the stack needs, and the tool each target needs (for Flutter: `adb` for Android, `xcrun` for iOS, which runs only on macOS, and nothing for the web).
- The skills it requires and the extra skills for each role.
- A text with the hygiene the developer follows and what QA looks for in the diff.

Relevo ships the `flutter`, `vue`, `laravel` and `supabase` profiles. `/relevo:go` resolves the profile of your platform and hands it to the developer and QA agents.

## The profiles Relevo ships

| Stack | `analyze` | `test` | `format` | Target |
|---|---|---|---|---|
| `flutter` | `flutter analyze --no-pub` | `flutter test --reporter=compact --no-pub` | `dart format` | `android`, `ios`, `web` |
| `vue` | `vue-tsc --build` then `eslint . --cache` | `vitest run` | `prettier --write src/` | `web` |
| `laravel` | `vendor/bin/pint --test` | `php artisan test` | `vendor/bin/pint` | none |
| `supabase` | `supabase db lint` | `supabase test db` | `npx prettier --write supabase/` | none |

- The commands QA runs never rewrite your code. This matters for Vue: the `lint` script that `npm create vue` generates uses `--fix`, so the profile calls the tools directly (through `npx --no-install`, with the versions your project pins) and does not use `npm run lint`.
- The `flutter` profile follows the official Flutter documentation (architecture, data and backend, testing, performance, and the Dart MCP server), as read on 2026-10-22. The developer avoids, and QA looks for in the diff, the common layout errors, costly work in `build()`, long lists without a builder, `Opacity` and clipping in animations, heavy parsing on the UI isolate and `dart:html` (it prevents the Wasm build). With the Dart MCP server the agents use only the tools that write nothing (`analyze_files`, `lsp`, `read_package_uris`, `run_tests` when enabled). The profile does not impose an architecture: the agents follow the one your rules declare, and only with none declared does new code use the layers of Flutter's architecture guide. QA reports an architecture finding only against a rule you wrote down. If your project requires Command and Result objects, a state-management package or a layout of folders, write it in your rules (`qa.rules_from`).
- The `supabase` profile implements Database-as-Code for monorepo projects (e.g. `app` in Flutter and `backend` in Supabase):
  - All tests execute hermetically against local Docker containers (`supabase test db` using pgTAP); Relevo agents never connect to remote cloud instances.
  - The profile assigns the official `supabase/agent-skills` (`supabase` and `supabase-postgres-best-practices`) to `dev`, `qa`, and `issue`.
  - The developer maintains test data in `supabase/seed.sql` idempotently (`INSERT ... ON CONFLICT DO NOTHING`).
  - Deployments to the cloud after PR merge are managed via `.github/workflows/deploy-supabase.yml` (automatic push to Staging on `dev` and gated release to Production on `main`).

- Each profile was run on a project created for it (`npm create vue@latest` with TypeScript, Vitest, ESLint and Prettier; `composer create-project laravel/laravel`). The Vue `analyze` fails on a type error, a `v-for` without `:key`, an unused variable, an explicit `any` and a single-word component name, and does not fail on `v-html`, a listener that is never removed or props copied out of reactivity. The Laravel `analyze` and `test` fail on a style problem and on a failing test, and do not fail on a mass-assignment hole, an N+1 query or a missing authorisation. The text of each profile tells QA which of those to look for by reading.
- A project that uses `pnpm` or `yarn`, `oxlint`, or PHPStan replaces the command in `relevo.yml`, for example `checks: { analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse" }`.
- Only `supabase` requires skills. The `flutter` profile gives two recommended skills to `dev` and `qa`, and `laravel` and `vue` use skills only when they are installed (see below). To give the developer or QA a skill of your own (a Laravel best-practices skill, say), list it in `.relevo/stacks/<stack>.md` under `skills`.
- A profile can have a section `Questions for the issue writer`. `/relevo:issue` asks those the idea leaves open (for a backend: who is authorised and what an error looks like); the developer and QA never receive it.

### Using the `flutter` profile with the official skills

The Flutter team publishes skills and a Dart MCP server for coding agents ([Get started with AI](https://docs.flutter.dev/ai/get-started), read on 2026-10-28). The profile gives two of those skills to `dev` and `qa`, `flutter-add-widget-test` and `dart-add-unit-test`, because they cover how to write the tests of a feature, which the text of the profile does not. They are recommended and never required: the profile works without them, `/relevo:doctor` reports a missing one as a note, and `/relevo:init` offers the install as an optional command that you confirm.

| Tool | How to install | Where it lands |
|---|---|---|
| Claude Code, and the cloud runner | `npx skills add flutter/agent-plugins --skill flutter-add-widget-test --skill dart-add-unit-test --agent claude-code --copy --yes`, run from the folder of the platform (`cd app && ...` for `path: app`) | `.claude/skills/` and `skills-lock.json` in that folder, the root for `path: .`: commit both. |
| Antigravity CLI | The same command with `--agent universal` | `.agents/skills/` and `skills-lock.json` in that folder: commit both. The Dart MCP server needs an entry in `.agents/mcp_config.json`: `{ "mcpServers": { "dart": { "command": "dart", "args": ["mcp-server"] } } }`. |
| Antigravity IDE | Settings, Customizations, Build with Google Plugins, Download next to "Dart and Flutter" | Inside the IDE. `/relevo:doctor` cannot see it, so it never says that these skills are missing there. |

- **The cloud runner.** It reads only what is committed to the base branch. Commit the skills folder and `skills-lock.json`. A plugin installed on a machine does not reach the runner, and `/relevo:doctor` does not count it as the skills being installed.
- **What `dev` and `qa` receive.** The skills of the set that are committed: Relevo gives each agent the path of their `SKILL.md`, looking in `.claude/skills/` and `.agents/skills/`, in the folder of the platform first and then at the root, so skills installed for Antigravity count too. A skill of the set that is not committed is left out of the run, and `/relevo:doctor` reports one note with its command. A cloud run with these skills was not tried yet.
- **Switch one off.** List it under `skills.disable` in `.relevo/stacks/flutter.md`, for example `skills: { disable: [flutter-add-widget-test] }`. Only a skill of the plugin's lists can be switched off, never one under `requires_skills`.
- **They are protected.** An unattended run cannot change the skill folders or `skills-lock.json`, inside the folder of each platform as at the root.
- **More skills.** `flutter/agent-plugins` holds 25 (the Dart ones too). Install another with the same command and list it under `skills` in `.relevo/stacks/flutter.md` (see [Extra skills per role](#extra-skills-per-role)); each one you list is read at every run, and `/relevo:doctor` warns when a role passes 20 KB.
- **The plugin, for working on your machine.** `claude plugin marketplace add flutter/agent-plugins`, then `claude plugin install dart-flutter@dart-flutter`, installs all of them and the Dart MCP server in your Claude Code. It is an optional extra that stays on your machine, and Relevo does not count it.
- **Rules.** A plugin does not load rules by itself. If you want the official ones, copy them from the `rules` folder of `flutter/agent-plugins` into the rules file of your project (`qa.rules_from`); `/relevo:init` lists this as a step for you and never writes your rules file.

### Using the `laravel` profile with Laravel Boost

Laravel publishes its guidance for coding agents through [Laravel Boost](https://laravel.com/framework/docs/boost) (read on 2026-10-29), a development dependency that installs skills for the packages your project uses. The profile uses two of them, `laravel-best-practices` and `testing-best-practices`, only when they are installed and committed; when they are not, nothing is reported. Boost is recommended and never required: `/relevo:doctor` reports a note when it is missing, and `/relevo:init` offers the install as optional commands that you confirm one by one.

- **Install.** From the folder of the platform: `composer require laravel/boost --dev`, then `php artisan boost:install --skills --no-interaction`. `--skills` installs the skills and leaves the guidelines (`CLAUDE.md`) and the MCP server alone, and `--no-interaction` installs for the agents it finds on your machine without asking. Boost chooses the skills from `composer.json`: a fresh Laravel 13 project got `laravel-best-practices`, `testing-best-practices`, `tailwindcss-development`, `infer-conventions` and `deploying-to-cloud`.
- **Commit what it wrote.** `.claude/skills/`, `boost.json`, `composer.json` and `composer.lock`. Boost may also write the folders of the other agents it finds (`.agents/`, `.kiro/`), which you commit only if you use them. The Laravel documentation says the generated files can be kept out of git; for the skills that would hide them from the cloud runner, which reads only what is committed, and `/relevo:doctor` warns when a skill folder is ignored by git.
- **Other skills.** The skills for Livewire, Inertia, Flux, Tailwind or Pest apply only when you use the package and cost up to 10 KB each, so the profile does not list them. List the ones you want under `skills` in `.relevo/stacks/laravel.md` (see [Extra skills per role](#extra-skills-per-role)).
- **Switch one off.** `skills: { disable: [testing-best-practices] }` in `.relevo/stacks/laravel.md`.

### Using the `vue` profile with community skills

Vue publishes no skills for coding agents. The closest set is [vuejs-ai/skills](https://github.com/vuejs-ai/skills), a community project (MIT) that calls itself an early experiment whose skills "may be incomplete due to hallucinations". It is not official. `/relevo:init` offers two of its skills, `vue-best-practices` and `vue-testing-best-practices`, as an optional install, and the profile gives them to `dev` and `qa` only when they are installed. `/relevo:doctor` says nothing when they are absent.

- **Install.** `cd <folder of the platform> && npx skills add vuejs-ai/skills --skill vue-best-practices --skill vue-testing-best-practices --agent claude-code --copy --yes`. It writes `.claude/skills/` and `skills-lock.json` in that folder: commit both. The files are plain Markdown with no script (checked on 2026-10-29).
- **What they cost.** `vue-testing-best-practices` is an index of 2 KB whose references are read by symptom. `vue-best-practices` is 10 KB and tells the agent to read four reference files (34 KB) in every Vue task, so it adds about 44 KB of reading to each run of `dev` and of `qa`. Switch it off if that is too much.
- **Switch one off.** `skills: { disable: [vue-best-practices] }` in `.relevo/stacks/vue.md`.
- **The checklist is in the profile, not in a skill.** The text of the profile has the security, performance and testing points of the Vue documentation that can be read in a diff: a template built from user text, `innerHTML`, a shared prop that changes for every item of a list, a snapshot as the only assertion, and others.

### Using the `supabase` profile in a repository

- **Layout.** The commands of the profile run from the folder of the platform, and the Supabase CLI looks for `supabase/config.toml` inside it. A platform `backend` with `path: backend` therefore holds `backend/supabase/` (`config.toml`, `migrations/`, `tests/`, `seed.sql`, and `functions/` if you use edge functions). Keep the app in its own folder (for example `app/`, a Flutter platform with `path: app`): a platform whose folder is `.` is not restricted, so an issue for it could change the database folder, while two folders make Relevo refuse a change outside the platform of the issue.
- **One timeline of migrations.** The CLI applies `supabase/migrations/` in a single order. Group by module with the file name (`<timestamp>_<module>_<change>.sql`) and by folder in `tests/` and in the seed files (`[db.seed] sql_paths` in `config.toml`), not with a set of migrations per module.
- **From an existing remote project.** Run `supabase init` at the root of the platform, `supabase login`, `supabase link --project-ref <id>` and `supabase db pull`. The pull writes `supabase/migrations/<timestamp>_remote_schema.sql` as the baseline and records it as applied in the linked project. Read that file before you commit it: it can contain statements you did not expect, such as dropping an extension that the local stack enables by default. Write `supabase/seed.sql` by hand instead of dumping production data.
- **A second project (staging and production).** The pull marks the baseline as applied only in the project you linked. Before `supabase db push` runs against the other project, apply the baseline there or mark it as applied, or the push will try to create what already exists. `templates/deploy-supabase.yml` pushes to staging from the base branch and to production from the release branch, and does nothing until `supabase/migrations/` changes.
- **The cloud build.** The template of `relevo-go.yml` installs the Supabase CLI for a Supabase platform, and the hosted runner already has Docker. `/relevo:doctor` fails when the workflow has no active Supabase step. Copy `relevo-go.yml` again if your workflow predates it.

This section follows the Supabase documentation (local development workflow and CLI guides) as read on 2026-10-27. It describes the Supabase CLI, not behaviour of Relevo; check the guides if a command differs in your version.

## Adding your own rules

| Layer | Where | What it is for |
|---|---|---|
| 1 | `CLAUDE.md`, or several files in `qa.rules_from` | The conventions of your project. This is the most common one. |
| 2 | `platforms.<name>.checks` in `relevo.yml` | Another command for a check, for example `fvm flutter test`. |
| 3 | `.relevo/stacks/<stack>.md` | More hygiene, tools or skills for a stack. It adds to the plugin's profile and never replaces it. A stack the plugin does not ship is defined only by this file ([how](#your-own-stack)). |

`/relevo:init` can create a commented file for the third layer and leaves it for you to commit. Commit it: the cloud run and your teammates read it from git, so a file that stays only on your machine applies only there. `/relevo:doctor` shows which layers each platform uses, and warns while that file is not tracked by git.

## Tuning how a stack is reviewed

The header of `.relevo/stacks/<stack>.md` can carry a `review` block, and its body a section `## Review`. The plugin's `laravel` profile sets the defaults, so a Laravel repository needs neither.

```yaml
review:
  log: storage/logs/*.log        # the files the audit reads (a path or a glob); the default of laravel
  test: php artisan test         # the base command; the agent adds --filter to prove one line
  serve:                         # optional; without it the agent starts no server
    command: php artisan serve --port={port}
    url: http://localhost:{port}
    env:
      APP_ENV: testing
```

- A key you write replaces the plugin's default for that key (`/relevo:doctor` lists the ones you replaced). It is the one place a repository may replace a value of a profile, because the block says how the review is driven and is not a check of the code: `analyze`, `test` and `format` are still replaced only through `checks`.
- `serve` is started only with `review.autopilot` `precheck` or `verify`, after you confirmed that the data is not production, on a free port of `localhost`, through the script that records and stops it. Its `url` must be on `localhost`, `127.0.0.1` or `[::1]`, and the command is read only from this file on the base branch, never from an issue or a comment.
- The section `## Review` is free text for the agent, read only in a review. It can add steps and ask for more evidence. It cannot change that you confirm every line, that the log is audited, that `decide` gates the pull request, that environment files are never read, that no waiver is suggested or that no code is patched in a review: `/relevo:doctor` warns about a line that asks for one of them, and the review ignores it.
- A Laravel review has no device and no browser. With `review.autopilot` `off` you run the project's tests and tell the review (`ran <exit code>`); with `precheck` or `verify` the agent runs the existing test of each line and never writes one. A test run that passes writes nothing to `storage/logs`, so the recorded run, and not the log, is what shows that the code was exercised.

## Your own stack

Relevo ships profiles for `flutter`, `vue`, `laravel` and `supabase`. For any other stack (Go, Python, Rust...) you write the profile yourself, and the file is the whole profile:

1. Set `stack: go` (or the name you want) on the platform in `relevo.yml`. `/relevo:init` then proposes `.relevo/stacks/go.md` on its own, with the commands commented out; you can also create it by hand.
2. Write the commands QA runs, from the folder of the platform. `analyze` and `test` must not rewrite your code; only `format` may:

   ```markdown
   ---
   stack: go
   commands:
     analyze: go vet ./...
     test: go test ./...
     format: gofmt -w .
   generated: ['**/*.pb.go']
   tools: [go]
   ---

   # Go

   ## Hygiene for the developer

   - Return errors; do not discard them with `_`. Wrap them with `%w`.
   - Close what you open (`defer`), and pass a `context.Context` to what can block.

   ## What the auditor looks for in the diff

   - An ignored error, a goroutine with no way to stop, a shared map written without a lock.
   ```

   This is an example: adjust the commands to your project. A command is replaced later, without touching the file, with `platforms.<name>.checks` in `relevo.yml` (`analyze`, `test` and `format` are always accepted there).
3. Commit the file. The cloud run and your teammates read it from git; without it they have no profile for the stack.
4. If the cloud builds, add a step for the toolchain to the build job of `.github/workflows/relevo-go.yml`, guarded by the name of the stack, so an issue for another platform does not install it:

   ```yaml
   - if: needs.decide.outputs.stack == 'go'
     uses: actions/setup-go@v5
     with:
       go-version-file: ${{ needs.decide.outputs.path }}/go.mod
   ```

   Install the dependencies in the way your project prefers, from `needs.decide.outputs.path`.

`/relevo:doctor` warns when the profile of such a stack has no `analyze` or no `test`, and when the go workflow has no step guarded by the name of the stack (it does not warn for a stack whose tools are only `node` and `npm`, because the job already installs Node). It also warns while the file is not tracked by git.

## Extra skills per role

- A profile can list skills for the roles `dev`, `qa`, `issue` and `review`. `fix` uses those of `dev` and `qa`.
- The agent reads the `SKILL.md` of each one and only the parts that apply. The rules of Relevo and of your project win over any skill.
- A skill is used only if it is on the base branch, if the person has not reserved it for themselves with `disable-model-invocation`, and if it has no scripts. A skill with scripts must be named one by one in `skills.allow_scripts`.
- `/relevo:doctor` lists the skills that were left out and why, warns when the skills of a role are larger than 20 KB, and warns when a skill no longer matches `skills-lock.json`.
- A skill a profile lists under `requires_skills` is required: `/relevo:doctor` fails when it is not installed. A skill under `skills` is given to that role. A stack can use both for the same skill: `supabase` requires `supabase` and `supabase-postgres-best-practices` and gives them to `dev`, `qa` and `issue`. A recommended skill is one that the profile of the plugin gives to a role without requiring it (the two of `flutter`): when it is missing, `/relevo:doctor` reports a note and the run goes on without it.
- To switch a skill of the plugin off, name it under `skills.disable` in `.relevo/stacks/<stack>.md`; a required one cannot be.
- A profile can also list skills under `skills_when_installed`: they are given to the role when their folder is on the base branch, and nothing is reported when it is not. `laravel` and `vue` use it, because the skills they use depend on what the project installed.

## What an unattended run cannot change

- `relevo.yml`, everything under `.relevo/`, the folders of skills and `skills-lock.json` (inside the folder of each platform too), because they decide the checks the work is held to. A run that touches them ends in `qa-failed`.
- The files you list in `qa.rules_from`.
- Files outside the folder of the platform of the issue (apart from the change's own specification, `GLOSSARY.md` and `docs/adr/`), unless the issue lists them in `Allow-paths:`.
- The command of a check, from a profile: only `relevo.yml` can replace one.
