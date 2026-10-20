## Context

See `proposal.md`. The two profiles are written from what the commands do on freshly created projects, and the parts that cannot be proved by a command are written as guidance for the agents and marked as such.

## Goals / Non-Goals

**Goals:** a Vue repository and a Laravel repository can be declared, resolved, checked by `doctor` and built, with commands that work and do not rewrite code under QA; the questions of a stack reach only the issue writer.

**Non-Goals:** a backend review; a cloud build of either stack; supporting every package manager and every analyser by default (the repository overrides a command).

## Decisions

**D1. Command names are fixed.** `dev` and `qa` run `analyze`, `test` and `format`, so each profile defines exactly those. When a stack needs several tools for analysis they are chained with `&&` in one command; the first failure stops it and shows the output.

**D2. Vue commands.** All through `npx --no-install`, so the project's own pinned versions run and nothing is downloaded during a run:
`analyze: npx --no-install vue-tsc --build && npx --no-install eslint . --cache`, `test: npx --no-install vitest run`, `format: npx --no-install prettier --write src/`. `vue-tsc --build` writes only to `node_modules/.tmp` (checked on the real project); `eslint --cache` writes `.eslintcache`, ignored by the project's `.gitignore` (the profile body tells the developer to add it if it is not). `oxlint` is not in the default because it is optional in `create-vue`; a repository that has it adds it with `checks`. The package manager is npm by default; a repository on pnpm or yarn replaces the commands.

**D3. Laravel commands.** `analyze: vendor/bin/pint --test`, `test: php artisan test`, `format: vendor/bin/pint`. Pint is in the skeleton; PHPStan is not and is a repository override. Tools: `php` and `composer`.

**D4. Hygiene text names what the commands do not catch.** Each profile body has three parts as `flutter.md` does: verification, hygiene for the developer, what the auditor looks for. The lists come from the plan (Vue: reactivity lost when destructuring props, listeners and timers not removed, `v-for` without a key, `v-html` with data from outside, loading and error states, double submit; Laravel: N+1, mass assignment, authorisation, validation, unsafe migrations, queue idempotency) and a verification step on the real projects marks which the tools already catch (for example `vue/require-v-for-key` through `eslint-plugin-vue`) so the body does not ask QA to look for what a command enforces.

**D5. Questions are a section of the profile.** `parseProfile` splits the body at the heading `## Questions for the issue writer` (up to the next heading of level 2): the section goes to `profile.questions` and is removed from `profile.body`. `mergeProfiles` joins the questions of both layers. `stack-profile.mjs --role issue` prints `{ platform, stack, questions }`; without `--role` the output is as before and has no `questions` key, so `dev` and `qa` never pay for them.

**D6. Skills are referenced, not required.** `requires_skills` stays empty in both profiles: a skill that does not exist in a repository would make `doctor` warn forever. The bodies say where to list a skill (`.relevo/stacks/<stack>.md`, `skills.dev` and `skills.qa`), and the page on stacks gives the example of a Laravel best-practices skill.

**D7. Real projects as the check.** The two commands lists are run on a project created with `npm create vue@latest` (TypeScript, Vitest, ESLint, Prettier) and one created with `composer create-project laravel/laravel`, passing, and then each is made to fail on purpose (a type error, a failing test, a style error; for Laravel a style error and a failing test) to see that the command exits non-zero. The findings page records the output and what could not be done.

## Risks / Trade-offs

- The profiles are written from two fresh projects, not from a team's long use; a real team will find rules to add. They add them in `.relevo/stacks/<stack>.md`, which can extend but not weaken a profile.
- `npx --no-install` fails if the dependencies were not installed; the workflow template has the install step for both stacks commented, and `doctor` does not check that `node_modules` exists (a run installs them).
- Laravel's default test run uses the project's `.env.testing` or SQLite in memory; a project that needs a database in tests needs it available in the build. The profile body says so.
