# Proposal

## Why

`/relevo:go` builds on your machine in two ways: in your own Claude Code session (in a worktree of its own) and, with `--local`, in a separate process. Since the interactive run also got a worktree, the commands page says `--local` "does the same in a separate process", which reads as if the two were equivalent. They are not, and nothing tells a person when to choose each.

## What Changes

- `docs/commands.md` and `docs/commands.es.md`: under `go`, a table of the two ways to build by hand (who builds, tools, limits, what you see, context, worktree) and a one-sentence rule to choose. The sentence that calls them the same is replaced.
- `docs/guide.md` and `docs/guide.es.md`: the section "Cloud, local or both" says in one bullet which of the two to use by hand and links to that table.
- `docs/execution.md` and `docs/execution.es.md`: "Building on your machine" links to the table instead of restating the difference.
- Documentation only: no script, skill, workflow or behaviour changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `documentation`: the commands page SHALL state the difference between building in the session and with `--local`, and the guide and the execution page SHALL point to it.

## Impact

- Pages: `docs/commands.md`, `docs/guide.md`, `docs/execution.md` and their `.es` twins (same headings in both languages, which a test checks).
- `CHANGELOG.md`: one line under Unreleased.
- No code, no new scripts or labels, so the claims tests keep passing as long as the new text names only things that exist.
