# Tasks

## 1. The platform line

- [x] 1.1 Parse `Platform:` in `scripts/lib/issue-parse.mjs` (`platform: string[]`, names in order, outside code fences) and describe the optional line in `templates/issue.md` and `docs/issue-format.md`. Verify with additions to `tests/issue-parse.test.mjs` and `tests/template.test.mjs`: one name, two names, a name inside a fenced block ignored, no line gives an empty list.
- [x] 1.2 Add `scripts/lib/platform-of.mjs` (`resolvePlatform({ platforms, body })`: `missing`, `unknown`, `conflict`, the one-platform default, messages that list the platforms). Verify with `tests/platform-of.test.mjs`: every scenario of the `platforms` delta (one platform without a line, several with a line, missing, unknown, two different lines, the same name twice is not a conflict).
- [x] 1.3 Add `scripts/platform-of.mjs --issue <n> [--repo owner/name] [--config relevo.yml] [--input file]` (prints the JSON of D3; exit 1 unresolved with the message on stderr, 2 bad usage). Verify with `tests/platform-of.test.mjs` using `--input`: the printed fields, the exit codes, and an invalid `relevo.yml`.
- [x] 1.4 Make the check fail a draft that needs the line or names a wrong one: `checkIssueDraft({ ..., platforms })` and `scripts/check-issue.mjs --platforms web,api`. Verify with additions to `tests/issue-check.test.mjs`: missing line with two platforms, unknown name, two names, no line with one platform passes, existing calls without `platforms` unchanged.

## 2. Planner, messages and workflow output

- [ ] 2.1 Replace the `platform` decision of `scripts/lib/plan.mjs` by the resolution of D1/D2: an unresolved platform joins the `needs-spec` path with the platform message in `missing`, and a resolved one adds `platform`, `stack`, `path` and `targets` to the `start` decision; remove the `platform` message kind and its text from `scripts/lib/messages.mjs`. Verify with `tests/plan.test.mjs` (the three `go` gate scenarios, one platform unchanged, the permission check still first) and `tests/messages.test.mjs` (the removed kind no longer exists, the `needs_spec` text carries the platform message in both languages).
- [ ] 2.2 Write `platform`, `stack` and `path` to the `--github-output` file in `scripts/go-plan.mjs` (empty unless the decision is `start`). Verify with `tests/go-plan-output.test.mjs`: a Vue platform gives `stack=vue`, a non-start decision gives empty values, and the base64 decision still round-trips with the new fields.

## 3. Scope of a commit

- [ ] 3.1 Add `scripts/lib/platform-scope.mjs` (`checkScope(paths, { within, change, allow })`, tier `scope`, text "outside the platform") and `--within <path>` to `scripts/commit-change.mjs`, unstaging as for the other refusals. Verify with `tests/platform-scope.test.mjs` and additions to `tests/commit-change.test.mjs`: a file in another platform refused, the change folder, `GLOSSARY.md` and `docs/adr/` accepted, a path matching `--allow` accepted, `within` of `.` not restricted, a refused commit leaves unrelated staged files alone.

## 4. Agents and skills

- [ ] 4.1 Add the platform folder to the inputs of `agents/dev.md` and `agents/qa.md` ("run the commands of the profile from this folder; the diff you audit outside it is a rejection unless the issue allowed it"). Verify with `tests/agents.test.mjs`: both name the folder, neither names a stack, the existing assertions pass.
- [ ] 4.2 Update `skills/go/SKILL.md`: read `platform`, `stack`, `path` from the decision, pass `--platform` to `stack-profile.mjs` and `role-skills.mjs`, give the agents the folder, call `commit-change.mjs --within <path>` and take the failure path with the reason `outside the platform`. Verify with `tests/skill-go.test.mjs` (flags implemented, the reason named in the failure path) and `tests/openspec-commands.test.mjs`.
- [ ] 4.3 Update `skills/fix/SKILL.md` and `skills/review/SKILL.md` to run `platform-of.mjs`, then `stack-profile.mjs` and `role-skills.mjs` with `--platform`, give the agents the profile and the folder, and stop with the message when the platform cannot be resolved; `fix` commits with `--within`. Verify with `tests/skill-fix.test.mjs` and `tests/skill-review.test.mjs`: the scripts named exist, their flags are implemented, the stop is stated.
- [ ] 4.4 Update `skills/issue/SKILL.md`: deduce the platform from the paths of the idea, ask once when ambiguous, write the line only when the repository has several platforms, split an idea that needs two platforms, pass `--platforms` to `check-issue.mjs`. Verify with `tests/skill-issue.test.mjs`: the new rules are present and the flags used exist.

## 5. Workflow template, documentation and integration

- [ ] 5.1 Expose `platform`, `stack` and `path` from the `decide` job of `templates/workflows/relevo-go.yml` and guard the commented setup steps with `needs.decide.outputs.stack`, adding commented Vue and Laravel examples. Verify with `tests/workflow-go.test.mjs`: the outputs exist, every guarded example names a stack, no `pull_request_target`, limits still match `relevo.yml`.
- [ ] 5.2 Update `docs/stacks.md` and `docs/stacks.es.md` (the line, one platform per issue, the scope rule, remove "go builds a repository with one platform"), and add the entry to `CHANGELOG.md` under Unreleased. Verify with `tests/readme-sync.test.mjs` and `tests/changelog.test.mjs`.
- [ ] 5.3 Run `npm test`, `openspec validate --all`, `openspec validate platform-line --strict` and `claude plugin validate .`. Verify that every test passes and that validation reports no new error.
- [ ] 5.4 In the sandbox repository, run `go` on one small issue that says `Platform: app`. Verify by the run's outcome: the issue reaches `relevo:built` with the hand-off comment; record the result in `docs/pilot-findings.md`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied, then verify the archived result.
