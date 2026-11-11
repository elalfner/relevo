## Context

`openspec instructions apply --json` (OpenSpec 1.16) returns `context` (the config `context`) and `operationGuidance` (`operations.apply.guidance`), but not `rules`. `instructions tasks --json` returns `context` and `rules.tasks`. `go` today passes only `contextFiles` and the pending tasks to the dev agent, and `agents/dev.md` never mentions any of this, so config guidance is lost.

## Decisions

- **Pass explicitly, from `go`.** The orchestrator already runs `instructions apply`; it also runs `instructions tasks --json` once per run and hands `context`, `rules` and `operationGuidance` to the developer as "project guidance", only the fields that are non-empty. Alternative (say only the rules file is read) rejected: the teams already use `config.yaml`.
- **Default guide lives in `agents/dev.md`.** A fixed section, five lines, so it reaches every launch (build, fix, integrate) without `go` doing anything. Alternative (a file read at runtime) costs a read per launch.
- **Precedence.** Project rules files and the project guidance win over the guide; none of them overrides the `You must never` list or the untrusted-content rule of the agent. The guidance is project-owned like `CLAUDE.md`, so it is binding, not data.
- **Scope of "every agent".** Only the developer is changed: the QA lens agents are edited by another change (#121). Recorded as a follow-up.

## Assumptions

- The text is passed word for word and not size-capped by Relevo; OpenSpec itself rejects a `context` over 51,200 bytes.
- `instructions tasks` fails or prints nothing for a repository whose schema has no `tasks` artifact; then `go` uses what apply gave and continues.

## Risks

- The agent may still ignore the guidance. Not verifiable by tests; listed for the manual test.
