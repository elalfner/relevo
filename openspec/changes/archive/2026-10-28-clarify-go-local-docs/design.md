# Design

## Context

The difference was read from `skills/go/SKILL.md`, `scripts/go-local.mjs` and the `execution-modes` spec. The interactive run and `--local` both use a worktree under `.relevo-worktrees/`. Only `--local` starts a new `claude -p` (or `agy`) with the turn and cost limits of `relevo.yml` and the closed tool lists of the workflow, and prints its result at the end. The interactive run is the person's own session, which they see live. `tests/readme-sync.test.mjs` requires the same number of headings and valid anchors in each language; `tests/docs-claims.test.mjs` requires every command, script and file named to exist.

## Goals / Non-Goals

**Goals:**
- One place, the `go` entry of the commands page, holds the comparison; the other pages link to it.
- A person can choose without reading the code.

**Non-Goals:**
- Changing or removing `--local`, or the behaviour of either way.
- Changing the Antigravity text, which has its own section in `execution.md`.

## Decisions

- **The table lives in `commands.md`, one heading below `go`** ("In the session or on its own"), not in `guide.md`. The commands page is where `--local` is documented as an argument; the guide gets a bullet and a link. Alternative: duplicate the table in the guide; rejected because two copies drift, and the parity test would not notice.
- **A heading with no code or dashes**, so its anchor is stable and the same rule applies in Spanish ("En la sesión o por separado").
- **Rows**: who builds, tools, limits, what you see, context, worktree. The worktree row says "same place" so nobody reads the other rows as a difference in isolation.
- **The rule to choose** is one sentence: the session to watch and step in; `--local` to leave it running under the limits of the cloud.

## Risks / Trade-offs

- [The table says the session has "no limits" and that changes later] → the row says what the skill does today and the spec scenario names it; the next change to either way updates the table.
- [A wrong anchor in one language] → the existing link test fails until fixed.
