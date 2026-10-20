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

Relevo ships the `flutter`, `vue` and `laravel` profiles. `/relevo:go` resolves the profile of your platform and hands it to the developer and QA agents.

## The profiles Relevo ships

| Stack | `analyze` | `test` | `format` | Target |
|---|---|---|---|---|
| `flutter` | `flutter analyze --no-pub` | `flutter test --reporter=compact --no-pub` | `dart format` | `android`, `ios`, `web` |
| `vue` | `vue-tsc --build` then `eslint . --cache` | `vitest run` | `prettier --write src/` | `web` |
| `laravel` | `vendor/bin/pint --test` | `php artisan test` | `vendor/bin/pint` | none |

- The commands QA runs never rewrite your code. This matters for Vue: the `lint` script that `npm create vue` generates uses `--fix`, so the profile calls the tools directly (through `npx --no-install`, with the versions your project pins) and does not use `npm run lint`.
- Each profile was run on a project created for it (`npm create vue@latest` with TypeScript, Vitest, ESLint and Prettier; `composer create-project laravel/laravel`). The Vue `analyze` fails on a type error, a `v-for` without `:key`, an unused variable, an explicit `any` and a single-word component name, and does not fail on `v-html`, a listener that is never removed or props copied out of reactivity. The Laravel `analyze` and `test` fail on a style problem and on a failing test, and do not fail on a mass-assignment hole, an N+1 query or a missing authorisation. The text of each profile tells QA which of those to look for by reading.
- A project that uses `pnpm` or `yarn`, `oxlint`, or PHPStan replaces the command in `relevo.yml`, for example `checks: { analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse" }`.
- The profiles require no extra skill. To give the developer or QA a skill of your own (a Laravel best-practices skill, say), list it in `.relevo/stacks/<stack>.md` under `skills`.
- A profile can have a section `Questions for the issue writer`. `/relevo:issue` asks those the idea leaves open (for a backend: who is authorised and what an error looks like); the developer and QA never receive it.

## Adding your own rules

| Layer | Where | What it is for |
|---|---|---|
| 1 | `CLAUDE.md`, or several files in `qa.rules_from` | The conventions of your project. This is the most common one. |
| 2 | `platforms.<name>.checks` in `relevo.yml` | Another command for a check, for example `fvm flutter test`. |
| 3 | `.relevo/stacks/<stack>.md` | More hygiene, tools or skills for a stack. It adds to the plugin's profile and never replaces it. A stack the plugin does not ship is defined only by this file. |

`/relevo:init` can create a commented file for the third layer. `/relevo:doctor` shows which layers each platform uses.

## Extra skills per role

- A profile can list skills for the roles `dev`, `qa`, `issue` and `review`. `fix` uses those of `dev` and `qa`.
- The agent reads the `SKILL.md` of each one and only the parts that apply. The rules of Relevo and of your project win over any skill.
- A skill is used only if it is on the base branch, if the person has not reserved it for themselves with `disable-model-invocation`, and if it has no scripts. A skill with scripts must be named one by one in `skills.allow_scripts`.
- `/relevo:doctor` lists the skills that were left out and why, warns when the skills of a role are larger than 20 KB, and warns when a skill no longer matches `skills-lock.json`.

## What an unattended run cannot change

- `relevo.yml`, everything under `.relevo/`, the folders of skills and `skills-lock.json`, because they decide the checks the work is held to. A run that touches them ends in `qa-failed`.
- The files you list in `qa.rules_from`.
- Files outside the folder of the platform of the issue (apart from the change's own specification, `GLOSSARY.md` and `docs/adr/`), unless the issue lists them in `Allow-paths:`.
- The command of a check, from a profile: only `relevo.yml` can replace one.
