# Tasks

## 1. References and the closed list

- [x] 1.1 Parse `Depends-on:` references in `scripts/lib/issue-parse.mjs`: `dependsOn` keeps the local numbers, `dependsOnExternal` holds `{ repo, number }`, `dependsOnInvalid` the tokens of neither form; an external reference with no repository after `#`, or a word, is invalid. Verify with additions to `tests/issue-parse.test.mjs`: `#12` stays local, `acme/api#12` is no longer local (the old defect), a mixed line, repeated references collapsed, a malformed token, a reference inside a code fence ignored, existing assertions unchanged.
- [x] 1.2 Add the `links` setting to `scripts/lib/config.mjs` (`owner/repo` list, no repeats, default `[]`). Verify with additions to `tests/config.test.mjs`: the three scenarios of the configuration delta, and that a configuration without `links` still validates with `links` equal to `[]`.
- [x] 1.3 Make the issue check understand references: `checkIssueDraft({ ..., links })` fails an invalid token (showing the two accepted forms) and an external repository outside `links` (naming it and listing the linked ones); `scripts/check-issue.mjs --links a/b,c/d`. Verify with additions to `tests/issue-check.test.mjs`: not linked, malformed, linked passes, without `links` the external reference is judged as not linked, and existing calls unchanged.

## 2. Reading and the gate

- [x] 2.1 Add `realGhLinks(env)` to `scripts/lib/github.mjs` (the `gh` client with `GH_TOKEN` taken from `GH_LINKS_TOKEN` when set, otherwise the ordinary client) and make `gather` take `ghLinks`, return `completedExternal` and `unreadable` for the references in `links` only, and read nothing for a repository outside `links`. Verify with additions to `tests/github.test.mjs` using a fake client: completed, open, closed as not planned, a 404, a repository outside `links` never asked, one request per distinct reference, and the local reads still using `gh`.
- [x] 2.2 Make `planGo` use the external dependencies (`planGo({ ..., repo, completedExternal, unreadable })`): an external repository outside `links` adds a missing part to the `needs-spec` route; external blockers join the local ones in the `block` decision with the text of D5; the own repository in full counts as local. Verify with additions to `tests/plan.test.mjs`: every scenario of the `links` and `go` deltas (completed, open, unreadable with its text, not linked, own repository, mixed local and external).
- [x] 2.3 Pass `ghLinks` from `scripts/go-plan.mjs` and `scripts/requeue.mjs`, and the repository name to `planGo`. Verify with additions to `tests/go-plan-output.test.mjs` and `tests/requeue.test.mjs` using `--input` state with `completedExternal`: a blocked decision names the external reference, and a state with it completed starts.
- [x] 2.4 Map the secret in the workflow templates: `GH_LINKS_TOKEN: ${{ secrets.RELEVO_LINKS_TOKEN }}` in the gate step of `relevo-go.yml` and in the queue step of `relevo-queue.yml`, with a comment that it is only needed for private linked repositories. Verify with additions to `tests/workflow-go.test.mjs` and the queue workflow test: both steps map it, no other step does, and the token is not used with `github_token`.

## 3. Status, doctor and init

- [x] 3.1 Show external blocks in `status`: `gatherStatus` reads each external dependency of the blocked issues (through `ghLinks`) and `buildStatus`/`renderStatus` print "waiting for acme/api#12 (in-review)", "(open)" or "(could not be read)" in both languages. Verify with additions to `tests/status.test.mjs`: the three states, a local-only block unchanged, Spanish.
- [x] 3.2 Add the links checks to `scripts/lib/doctor.mjs`: each link readable and public or private, the secret name present, the rule of the delta (private without the secret fails, public without it warns, no links says nothing). Verify with additions to `tests/doctor.test.mjs`: the three scenarios plus an unreachable link.
- [x] 3.3 Make `init` ask for `links` (answers `links`, written to `relevo.yml`) and remind about `RELEVO_LINKS_TOKEN` without reading it; update `templates/relevo.yml` with a commented `links:` line and `skills/init/SKILL.md`. Verify with additions to `tests/init.test.mjs`, `tests/template.test.mjs` and `tests/skill-init-doctor.test.mjs`: the answer is written and validates, the reminder names only the secret, and the template still validates.

## 4. The issue skill

- [ ] 4.1 Update `skills/issue/SKILL.md` and `templates/issue.md`: the `Depends-on: owner/repo#N` form, the draft for a linked repository shown whole and created only on an explicit yes, the reuse of the data contract of a dependency, `check-issue.mjs --links`. Verify with `tests/skill-issue.test.mjs`: each rule is present, the flags used exist, and `tests/template.test.mjs` still passes.
- [ ] 4.2 Document the form in `docs/issue-format.md` (the dependency section) and the setting in `docs/configuration.md` and `docs/configuration.es.md` (`links` and the secret). Verify with `tests/readme-sync.test.mjs`.

## 5. Integration

- [ ] 5.1 Add the entry to `CHANGELOG.md` under Unreleased (the `owner/repo#N` form and the fixed misreading, `links`, `RELEVO_LINKS_TOKEN`, `status`, `doctor`, `init`, `issue`; copy the workflows again). Verify with `tests/changelog.test.mjs`.
- [ ] 5.2 Run `npm test`, `openspec validate --all`, `openspec validate cross-repo-dependencies --strict` and `claude plugin validate .`. Verify that every test passes and that validation reports no new error.
- [ ] 5.3 In the sandbox repository, add `links: [elalfner/relevo]` and the secret `RELEVO_LINKS_TOKEN` (the person creates it), then label ready an issue that says `Depends-on: elalfner/relevo#<an issue closed as completed>` and another that depends on an open one. Verify by the runs: the first reaches `relevo:built`, the second stays `relevo:blocked` with the notice naming the reference; record both in `docs/pilot-findings.md`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied, then verify the archived result.
