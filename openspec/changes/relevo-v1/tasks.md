## 1. Foundations

- [x] 1.1 Plugin manifest, marketplace entry and repository layout (`skills/`, `agents/`, `templates/`, `docs/`, `evals/`)
- [x] 1.2 `relevo.yml` schema, defaults and validator
- [x] 1.3 Label set with configurable names and message templates (English default, `language` switch)
- [x] 1.4 Shared helpers: safe staging, temporary-marker and credential scan, hand-off message builder

## 2. Agents

- [x] 2.1 `dev` agent for Flutter: implements change tasks, never commits
- [x] 2.2 `qa` agent for Flutter: read-only, compares the diff with scenarios, reads rules from `qa.rules_from`
- [x] 2.3 Prefer the Dart tooling server for analysis and tests, with terminal fallback

## 3. Core commands (stage 0.1, solo pilot)

- [x] 3.1 `go`: gates, queue, unattended build, QA with retry, outcomes (`built`, `qa-failed`, `needs-spec`, `blocked`, `queued`)
- [x] 3.2 `review`: base synchronisation, shot list and checklist, capture, log audit, pull request after verification
- [x] 3.3 `fix`: specification first, developer, QA, state preserved
- [x] 3.4 `ship` with `review.mode: none`: archive, merge, close-out
- [x] 3.5 Cloud workflow for `go` (label trigger, concurrency group, budget caps)
- [x] 3.6 Pilot in a solo repository and record findings
- [x] 3.9 `go` workflow: final step that reports a run which ended without an outcome (pilot proposal 1)
- [x] 3.10 Pilot follow-ups: comment when an issue is queued, log audit limited to the app under review, credential and private-repository alternatives in the `go` template (pilot proposals 2, 5, 6)
- [x] 3.8 `think`: invoke `openspec-explore` then `grill-with-docs` in one conversation, stop with install hints when a required skill is missing, hand off to `create`, leave documentation uncommitted (rewrite `skills/think/SKILL.md`)
- [x] 3.7 `create`: turn an idea into issues that pass the spec gate (questions, dependencies, checked before creation)

## 4. Team features (stage 0.2)

- [x] 4.1 `ship` with `review.mode: peer`: invoker is not the author, approval check, written confirmation
- [x] 4.2 Capacity gate and queue re-evaluation workflow
- [x] 4.3 Review SLA reminder and escalation
- [x] 4.4 Review-event workflow that sets `changes-requested` and returns to `pr-open`
- [x] 4.5 Reviewer selection (fewest open reviews, rotation, `roles` approvers, `needs-reviewer`)
- [x] 4.6 `status` (per-person, spec-writer view, alerts, capacity warning)
- [x] 4.7 Daily digest workflow
- [ ] 4.8 Pilot with one milestone in a team repository

## 5. Setup and verification

- [x] 5.1 `init`: plan first, idempotent, labels, branches, rulesets, workflows, ignore file, never touches the API key
- [x] 5.2 `doctor`: all checks, fix hints, read-only
- [x] 5.3 Fallback checklist when the person is not an administrator
- [x] 5.4 Dependency detection (OpenSpec, git, platform toolchain, device bridge, and the `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling` skills) with install hints; confirmed install offer in `init`
- [x] 5.5 `doctor` check that approvals are not dismissed on new commits

## 6. Security

- [ ] 6.1 Ruleset template: pull request required, `feature/*` push scope, no automation approval
- [ ] 6.2 Treat issue content as data; closed tool list for the unattended agent
- [ ] 6.3 `trust: public` restrictions
- [ ] 6.4 Verify the exact parameters of the GitHub Action that runs the agent against its current documentation

## 7. Acceptance tests

- [ ] 7.1 Behaviour tests from the specs (QA twice rejected does not advance; no "done" means no audit; no approval means `ship` stops; author cannot `ship`)
- [ ] 7.2 Sandbox repository with a minimal Flutter app for end-to-end runs
- [ ] 7.3 Continuous validation of skill frontmatter and `relevo.yml`

## 8. Release

- [ ] 8.1 English README with a short demo, Spanish translation
- [ ] 8.2 Sanitise content: no names, keys, URLs or history from private sources
- [ ] 8.3 Credit and licence notices for any third-party material actually redistributed (none planned)
- [ ] 8.4 Public release with a version tag and changelog
