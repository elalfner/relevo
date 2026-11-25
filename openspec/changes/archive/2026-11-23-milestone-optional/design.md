# Design

## Context

The gate is one block in `scripts/lib/plan.mjs`, inside the branch that every route to a build passes through: a `ready` issue in the cloud, a rebuild with `--retry`, and a local build all reach it before the assignee gate. That is why removing it changes all three at once and why three specs mention it. Nothing else reads `issue.milestone` to decide: `status` reads it only to group and to compare against `due_on`, and the planner input keeps carrying it (the field is part of the input shape and of the fixtures). See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- An issue builds the same with or without a milestone, in every route.
- `/relevo:issue` keeps nudging towards a milestone so groups and cuts stay visible.

**Non-Goals:**
- No setting to require a milestone (see Decisions).
- No change to `status`, to the review capacity warning, or to how `due_on` is read.
- No change to the order of the other gates.

## Decisions

**Remove the gate instead of making it configurable.** A key such as `issue.require_milestone` would keep today's behaviour for whoever wants it, at the price of one more setting, its validation, its documentation in two languages and a branch in the planner. The person who asked for this change wants the milestone as a recommendation, and nobody has asked to enforce it. If a repository needs it later, adding the key is a small, compatible change. Alternative considered: a key defaulting to `true`. Rejected because it keeps the friction for everyone who does not read the configuration page.

**Delete the decision and its message, do not leave dead code.** `no-milestone` and `no_milestone` go from the planner, the message catalog (English and Spanish) and the skills that list outcomes. A planner output that can never be produced should not stay in a list that `go` reads to know what is "a normal outcome". The usage of the kind in an old comment on an issue is only text and needs nothing.

**Keep the question in `/relevo:issue`, add "none".** The skill already lists the open milestones; it now offers "none" beside them and accepts it once. The create step passes `--milestone` only when there is one. A milestone is still created only when the person asks.

**Leave `status` alone.** It already skips the capacity warning when a milestone has no due date and shows only milestones that exist. An issue without one is simply not counted in any milestone.

## Risks / Trade-offs

- [A team relied on the gate so that nothing built outside a planned batch] → It is named **BREAKING** in the CHANGELOG with the sentence to read, and the cause for a future setting is left open.
- [A hand-off or digest assumed every built issue had a milestone] → Checked: `status` filters by milestone number and handles `null`; the planner fixtures already include `milestone: null` as an input. The tests that assert the removed decision are rewritten to assert `start`.
- [Spec text drifts from the skills] → The skills `go` and `issue` are updated in the same change and the existing tests that read them stay green.

## Migration Plan

None. A repository changes nothing and an issue that already has a milestone behaves as before. Rollback is reverting the change; no state or label is involved. The release follows the project flow: version and CHANGELOG on `dev` first, then a pull request to `main`.
