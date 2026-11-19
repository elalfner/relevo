# Proposal

## Why

The QA lenses of `go` run one after another, each in the foreground (3.4, 0.5, 0.7 and 0.3 minutes in a measured build, 5 in total), although they are read-only and independent. In the same build the `spec` lens searched the whole filesystem (`find /`) to locate `issue-sections.mjs`, because `agents/qa-spec.md` names it as `<plugin>/scripts/...` and nothing gives the agent that path. Issue #125, part of #115.

## What Changes

- `go` launches the active lenses together, in one turn, once the gate receipt is valid, and waits for all the reports. A runtime limit on concurrent subagents makes it launch them in batches.
- `lens-plan.mjs` also prints the launch batches (`--max-parallel`, default all active lenses in one batch).
- Constraint C1 is kept: the receipt is checked immediately before each launch, which is the only point where a lens can start, and a batch is launched in one turn so the diff cannot change inside it.
- One lens that fails to report does not stop the others: its report is asked for once more, alone, and the run then names the failed lens.
- The per-lens time record no longer assumes that a lens lasts until the next one begins: `progress.mjs lens <lens> --attempt n` records the start and `--end` records the end, so overlapping lenses are timed correctly.
- The `spec` lens is given the resolved path of `issue-sections.mjs`; the agent no longer names a `<plugin>` placeholder.
- The foreground rule of the skill stays for the developer and for each launch; it no longer says "one at a time" for the lenses.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the lenses launch together under the receipt rule, their time is recorded per lens when they overlap, and every Relevo script path an agent needs is resolved for it.

## Impact

`skills/go/SKILL.md` (small), `skills/go/references/qa-run.md`, `agents/qa-spec.md`, `scripts/lens-plan.mjs` and `scripts/lib/lens-plan.mjs`, `scripts/progress.mjs` and `scripts/lib/phase-log.mjs`, tests, `CHANGELOG.md` (unreleased). The version is not changed. The models of the lenses (`agents.qa.<lens>`, the model plan and the escalation of a retry) are untouched.
