# Design

## Decisions

**A script decides, and it is stateless.** `escalate --from <model>` needs only the configuration and the model of the failed attempt, so a resumed or local run (no progress folder) works the same. The progress folder only receives a record of each step for the report; a step that did not happen is not recorded.

**One name per retry, cumulative.** With the default `qa.retries` of 1 there is one retry, so one step. With more retries each goes one more name up until the ceiling.

**The ceiling is the limit.** The default ceiling of the developer is `sonnet`, so with no configuration a retry never costs more than the defaults. A repository that wants a retry on `opus` raises `agents.dev.ceiling`; an issue cannot (its `Model:` line is clamped to the ceiling).

**Why not the lenses.** The lens evaluation (`docs/lens-evaluation.md`) shows that a lens's quality is bounded by its model, but a rejection comes from the code, not from the reviewer being weak.

**Reasons.** `gate-red` and `qa-rejected`: the two retries that exist. `tasks left unfinished` has no retry; if it gets one, it uses the same command with a new reason.

**Fails open.** Any problem (unreadable configuration, a name outside the ladder, a model set in `relevo.yml`) keeps the model of the failed attempt, and the run goes on.
