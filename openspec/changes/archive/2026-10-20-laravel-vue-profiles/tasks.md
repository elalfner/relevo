# Tasks

## 1. The profile mechanism

- [x] 1.1 Split the section `Questions for the issue writer` out of the body in `scripts/lib/stack-profile.mjs` (`profile.questions`, joined by `mergeProfiles`) and add `--role issue` to `scripts/stack-profile.mjs`. Verify with additions to the stack profile tests: the section removed from the body, joined across layers, a profile without it giving an empty list, the output without `--role` having no `questions` key, `--role issue` printing the questions only, a section that ends at the next heading.

## 2. The profiles

- [x] 2.1 Write `stacks/vue.md` and `stacks/laravel.md` (D1 to D6) and add the questions section to `stacks/flutter.md`. Verify with tests: both parse with no errors, define `analyze`, `test` and `format`, the Vue profile defines the target `web` and the Laravel profile none, `analyze` and `test` contain no write option (`--fix`, `--write`), `requires_skills` is empty, the bodies have the three parts, and `validate-config` accepts platforms of both stacks with their targets.
- [x] 2.2 Add `composer` to the install hints of `doctor` and check that the tools of both profiles are probed. Verify with additions to `tests/doctor.test.mjs`: a Vue platform with node and npm present passes, with npm missing fails naming the install hint; a Laravel platform with `php` and `composer` present passes and with `composer` missing fails with its hint; the resolved profiles are listed.
- [x] 2.3 Update `skills/issue/SKILL.md` (resolve the questions with `stack-profile.mjs --platform <name> --role issue` and ask those the idea leaves open) and `skills/init/SKILL.md` (the stacks the plugin ships, their folders and targets). Verify with additions to `tests/skill-issue.test.mjs` and `tests/skill-init-doctor.test.mjs`: the script and flag exist and are implemented, the questions are asked with the other missing information, and init names the three stacks.

## 3. Real projects

- [x] 3.1 Create the two projects (`npm create vue@latest` with TypeScript, Vitest, ESLint and Prettier; `composer create-project laravel/laravel`), run the three commands of each profile through `stack-profile.mjs` and a `relevo.yml`, and make each fail on purpose (type error, lint error, failing test, style error). Record the output, the defects each tool does and does not catch (for example `v-for` without key, an N+1 query, mass assignment) and what had to change in the profiles because of it. Verify: every command exits 0 on the fresh project and non-zero on the defect, and `git status` of each project shows no tracked file modified by `analyze` or `test`.
- [x] 3.2 A sandbox run with a `relevo.yml` of both stacks in one monorepo: `platform-of.mjs` and `stack-profile.mjs` for each platform, `review-adapter.mjs` for each, and `doctor`. Record what happened.

## 4. Documentation and integration

- [x] 4.1 Update `docs/stacks.md`, `docs/stacks.es.md` and `CHANGELOG.md`. Verify with `tests/readme-sync.test.mjs` and the changelog test.
- [x] 4.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 4.3 Record in `docs/pilot-findings.md` what was found on the real projects and what could not be tried (a cloud build of either stack, a Laravel review, a model-written change).
