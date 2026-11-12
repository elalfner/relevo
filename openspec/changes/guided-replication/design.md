## Context

#135 depends on #133 (checkpoints per group: `task-groups.mjs`, `checkpoint.mjs`) and #134 (`agents.ladder`, `model-plan.mjs`, `escalateDev`), both merged. `go` builds one group per launch and checkpoints each. D1 of the issue: the switch of model is declared in `tasks.md`, not guessed. C2 of #115: no guard is weakened.

## Goals / Non-Goals

**Goals**
- A `Pattern:` line parsed like `Depends-on:`, and a merged-or-not report before building.
- A recipe in `tasks.md` that a script validates; replica tasks launched one per cheap agent.
- The template passes the gate and QA before replication (C1); replicas go through the same guards (C2).
- A replica model derived from the existing ladder and plan; two failures of a target use the stronger model.

**Non-Goals (left for a follow-up)**
- Attributing a QA rejection to one target and retrying only that target. In this change QA runs on the template, then once on the whole branch; a rejection at the end uses the existing retry (one level up, `escalateDev`), which is not per target.
- A script that applies the rename map to the template files. The agent is told by its cost guide to use a short script; a deterministic `replica-apply` is a follow-up.
- A pattern from another repository; a generator in the target project.
- Showing replica launches separately in the usage comment: each launch is recorded like any agent, with its model, and `run-usage.mjs` is not changed.

## Decisions

**1. `tasks.md` format.**
```
## Replication recipe

- Template: `section 1`          (or `pattern`, or `src/a.vue`, `tests/a.test.ts`)

## 2. Replicas

- [ ] 2.1 [replica] Invoices screen
  - Rename: Orders -> Invoices, orders -> invoices
  - Differences: a total column; no status filter
```
The unnumbered heading is ignored by `task-groups.mjs` (an unnumbered heading ends the numbered sections), and `replica-plan.mjs check` reads the section by its title. A replica is only a task with the `[replica]` marker; the script, not the agent, reads it. The spec step writes the recipe from the issue; if the issue lacks the differences the check fails and the issue goes back (`missing`), which is the edge case of #135.

**2. Where the template comes from.** `section K`: the files of the checkpoint commit of section K of `tasks.md` (`replica-plan.mjs template --k --of`, which finds `wip: checkpoint k/n (#N)` with git; `go` passes the checkpoint number it used). In a resumed run the groups are numbered again, so the commit may not be found: then the developer is told to read what the checkpoints changed with `git log`. This is a known gap. `pattern`: the files of the merged pull request of `Pattern: #N`, with its diff written to `$RELEVO_PROGRESS_DIR/pattern-N.diff` (outside the working tree, never committed, capped at 200 KB, over which only the file list is given). Paths: used as written. Alternative rejected: the agent decides what to copy; not reproducible.

**3. Finding the merged change of #N.** REST timeline of the issue: a cross-reference from a pull request whose `merged_at` is set, whose base is the base branch and that was merged within two minutes of the closing of the issue (so a later pull request that only mentions #N does not count; an issue closed by hand long after the merge is reported as not merged). Checked against `relevo-sandbox`: a merged issue is found, an issue closed as not planned is reported as not merged, and a pull request that never names the issue is not found; this is documented in `docs/issue-format.md`. Not exercised against the live API (the repo has a note of that kind on `github.mjs`); the client is injected and tested with fixtures. A failure of the lookup is `unverified`, never a block. A closed issue with no merged pull request counts as not merged.

**4. Reasons.** A pattern that is not merged or missing uses `inputs` (an input of the issue is not available), a recipe that cannot be written uses `missing`. No new next-step reason and no new message, so no catalog change.

**5. Model of a replica.** One name below `dev.model` of the plan in `agents.ladder`, never below `agents.dev.floor`; failures >= 2 give `dev.model`; beyond that the existing `model-plan.mjs escalate`. A developer not on `auto` keeps its model. Only `agents.ladder` and `agents.dev.floor` are read; `model-plan.mjs` is not edited, so it does not conflict with #162's change to the clamp. No `agents.replica` key.

**6. Gates.** The template check (gate + lenses, step 5 of `go` with its retries) runs once, before the first replica; the gate (cheap with receipt reuse) after each replica; the lenses once at the end over the whole branch. Cost: the lenses run twice in a replicated build. The template check has its own set of attempts and the final QA starts a new one; `run_max_*` and the budget guard bound the total. The final run could be narrowed to the replicas' files; not done, so that QA keeps seeing the same diff as any other build.

**7. Replica launch context.** The brief is the template files list (or the diff file), the rename map and the differences of the one target, plus rules, profile, platform folder, `allow_paths`, guidance. Not the whole change.

## Risks / Trade-offs

- An error of the template propagates: mitigated by C1 and by the gate after each replica.
- The cheaper model may fail often on a target; each failure costs a launch before the stronger model. Two failures is the bound the issue asks for.
- The lookup is unverified against the live API.

## Questions for the maintainer (go to the PR description)

1. QA per target or once at the end (decision 6)?
2. Derived replica model (decision 5), or an explicit `agents.replica` key?
3. Is the follow-up scope (per-target QA attribution, mechanical rename script) right?
