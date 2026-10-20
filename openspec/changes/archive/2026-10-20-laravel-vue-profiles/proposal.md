# Proposal

## Why

The registry of platforms accepts any stack name, and `go`, `fix` and `review` resolve a profile for it, but the plugin ships a profile only for `flutter`. A repository that declares `stack: vue` or `stack: laravel` fails `doctor` with "no profile for stack", so the multi-stack work of the earlier changes cannot be used for the two stacks that motivated it: a Vue front and a Laravel back, in one repository or in two. The profiles were deliberately left for last because they have to be written against real projects, not from memory. This change writes them and checks them on real projects created for the purpose.

Facts read while preparing it, by creating a Vue project with `npm create vue@latest` and a Laravel project with `composer create-project laravel/laravel` and running the commands:

- The Vue template's own `lint` script is `run-s lint:*` with `oxlint . --fix` and `eslint . --fix --cache`: it **rewrites files**. QA is read-only, so a profile that said `npm run lint` would make QA edit the code. The checks have to be written without `--fix`. `eslint --cache` writes `.eslintcache`, which the template's `.gitignore` already covers.
- `npm install` of the template fails on npm 10.9 with `Cannot read properties of null (reading 'edgesOut')` (a peer set of `jsdom` and `canvas`); `--legacy-peer-deps` installs it. That is an environment fact for the notes of the profile, not something Relevo can fix.
- The Laravel skeleton ships `laravel/pint` and `phpunit` and no static analyser, so `phpstan` cannot be assumed; `php artisan test` and `vendor/bin/pint --test` exist in every project.
- The agents run the commands called `analyze`, `test` and `format`; a profile has to define those three.
- Agents receive the whole profile, so anything only the issue writer needs (the questions to ask for a stack) would be paid for by `dev` and `qa` at every run unless it is kept apart.

## What Changes

- **Two profiles shipped with the plugin**: `stacks/vue.md` (target `web`) and `stacks/laravel.md` (no targets). Each has the commands `analyze`, `test` and `format` written to be read-only where QA runs them, the generated files left out of the diff, the tools it needs, and a body with the hygiene for the developer and what QA looks for in the diff. They reference skills by name for the repository to add (`.relevo/stacks/<stack>.md`); they do not require a skill that may not exist.
- **Questions for the issue writer, kept apart.** A profile may have a section `## Questions for the issue writer`. It is not part of the body that `dev` and `qa` receive; `stack-profile.mjs --role issue` prints it, and `issue` asks those questions when the issue is for that platform. Flutter gets its section too.
- **`doctor`** knows how to install `composer` and probes the tools of the two stacks.
- **Documentation**: the page on stacks lists the three profiles, says what each check does and does not catch, and explains how to override a command for a package manager other than npm or for a static analyser.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platforms`: the plugin ships three profiles; a profile can carry questions for the issue writer, resolved apart from the body.
- `issue`: the questions of the stack of the platform are asked.

## Impact

- Code: `scripts/lib/stack-profile.mjs`, `scripts/stack-profile.mjs`, `scripts/lib/doctor.mjs`.
- Content: `stacks/vue.md`, `stacks/laravel.md`, `stacks/flutter.md`, `skills/issue/SKILL.md`, `skills/init/SKILL.md`, `docs/stacks.md` and `docs/stacks.es.md`, `CHANGELOG.md`.
- Not in this change: reviewing a backend (`review` has no adapter for Laravel and says so), a cloud build of a Vue or Laravel issue (the workflow template already has commented install steps for both; trying them needs this change on `main`), and a model-written change built on either stack. The commands are run for real on the two projects; a full `go` is not.
