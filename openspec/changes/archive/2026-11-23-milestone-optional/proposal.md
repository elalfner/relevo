# Proposal

## Why

`go` refuses to build an issue that has no milestone, removes `ready` and `go`, and asks for one. The original design (`relevo-v1`, D2) gave the milestone three jobs: keep the agent from starting while the spec is still being edited, give an ordering context, and make bulk labelling cheap. None of them holds today. `ready` already guards the spec, and it is withdrawn when the title or body is edited afterwards. No code orders work by milestone. Bulk labelling works without one. The gate protects nothing about safety, cost or dependencies, and it sends a hotfix or a loose issue back for a full round (add a milestone, approve with `ready` again, request `go` again).

The milestone is still useful as information: it says which group or cut an issue belongs to, and `status` summarises it and warns about review capacity against its due date. That value stays; only the obligation goes.

## What Changes

- **BREAKING (for whoever relied on the gate):** an issue with no milestone is built like any other. The decision `no-milestone`, its comment `no_milestone` (English and Spanish) and the gate in `scripts/lib/plan.mjs` are removed. This applies to the cloud, to a rebuild after a failure (`--retry`) and to a local build.
- `/relevo:issue` keeps asking which milestone each issue belongs to and keeps offering the open milestones. A new answer, "none", is valid and is not insisted on; the issue is then created without `--milestone`. A milestone is still created only when the person asks.
- `/relevo:status` is unchanged: it summarises each milestone that exists and says nothing about issues that have none.
- No key is added to `relevo.yml`.
- The documentation says the milestone is optional and recommended, in English and Spanish, and `get-started` no longer says Relevo builds only issues that belong to one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the trigger no longer requires a milestone; the scenario "No milestone" is removed; the lists of outcomes that apply with their comment no longer name a missing milestone; a rebuild passes the same gates.
- `execution-modes`: a local build passes the gates that protect the build without a milestone, and the decisions that send the issue back to its writer no longer include a missing milestone.
- `issue`: the milestone question stays and "none" becomes a valid answer.

## Impact

- Code: `scripts/lib/plan.mjs` (the gate), `scripts/lib/messages.mjs` (the `no_milestone` kind in both languages).
- Skills and templates: `skills/go/SKILL.md` (two lists of outcomes), `skills/issue/SKILL.md` (approval and create steps), the comment in `templates/workflows/relevo-go.yml`.
- Tests: `plan.test.mjs`, `go-plan-output.test.mjs`, `github.test.mjs`, `messages.test.mjs`, `messages-language.test.mjs`, and the claims about `get-started` in `docs-claims.test.mjs`.
- Docs: `issue-format`, `get-started`, `how-it-works` (English and Spanish); `CHANGELOG.md`, with the version in `.claude-plugin/plugin.json`, updated on `dev` first. `docs/pilot-findings.md` is a historical record and is not edited.
- No effect on an issue that already has a milestone, and nothing to migrate.
