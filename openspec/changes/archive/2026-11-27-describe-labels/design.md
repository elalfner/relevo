# Design

## Context

See proposal.md for the motivation.

- `scripts/lib/labels.mjs` holds the 15 labels with literal descriptions. `next-step.mjs` imports it.
- `gatherFacts` in `doctor.mjs` reads `repos/{repo}/labels` and keeps only the names in `facts.labels` (left unset or null when it cannot read them).
- `planInit` is pure; `applyPlan` skips what is not `todo`, and `--skip id` leaves an item for a later run.
- In a web session `ghClient` answers `gh` over REST, and `gh-web.mjs` covers `label create` but not `label edit`.

## Goals / Non-Goals

**Goals:** new texts held to the table by a test; an idempotent `init` item that edits only descriptions.

**Non-Goals:** a `doctor` check for stale descriptions; per-label selection inside the item; translations; the README block of the flow.

## Decisions

### Literal texts, checked by a test, not generated
The descriptions stay literals in `labels.mjs`. Generating them from the table is not possible within 100 characters (its hints are long), and importing the table from `labels.mjs` would make a cycle.

| Label | Description |
|---|---|
| `ready` | `Spec ready. Next: /relevo:go <n>, or apply the go label; approving starts nothing` |
| `queued` | `Waiting for capacity, a free agent and no file clash. Nothing to do` |
| `building` | `The agent is building it. Nothing to do` |
| `built` | `Built and QA passed. Next: /relevo:review <n>, to review it on a device` |
| `in-review` | `Being reviewed. Next: /relevo:review <n> to continue; if something fails, /relevo:fix <n>` |
| `pr-open` | `Pull request open. Next: /relevo:ship <n>, once someone else approves it` |
| `needs-spec` | `The spec needs work. Next: /relevo:issue <n>; the comment says the rest` |
| `blocked` | `Waiting for the issues it depends on to be merged. Nothing to do` |
| `build-failed` | `Build failed. Next: /relevo:go <n> --resume or /relevo:fix <n>; the comment says which` |
| `changes-requested` | `The reviewer asked for changes. Next: /relevo:fix <n>` |
| `needs-reviewer` | `No reviewer or review overdue. Next: the spec writer assigns one or asks someone; no command` |

Each says first what the state is and then the next step: the command alone does not tell someone new what the label means. All are under 100 characters. They name the `go` label as "the go label", because a repository may rename it and the description is the same text for all.

### What the test checks
For each of the 11 labels: every `/relevo:...` command in the description (with `<n>` read as `{n}`) appears in the command or the English hint of some variant of that state; when the table's default variant has a command, the description names it; when no variant has a command, the description ends with `. Nothing to do`, except `needs-reviewer`, whose step is a person's action. Hints count because `/relevo:fix <n>` for `in-review` is only there.

### Scope of the item: the 11 labels
`labels.describe` covers state and exit labels and `needs-reviewer`, derived from `kind` plus that key. `ship`, `urgent`, `go` and `local` are left alone, even when edited by hand.

### Facts
Add `facts.labelDescriptions` (name → text, `''` for none) from the same API call, leaving `facts.labels` as the list of names that other code reads. No map means no item, which covers unreadable labels. Names are matched exactly, as the creation of missing labels does. `tracker: files` produces no item.

### Plan and apply
The item carries `changes: [{ name, from, to }]`, placed after `labels`. `renderPlan` prints each change indented under the line, as it does a workflow diff; an empty old text is shown as empty quotes. `applyPlan` runs `gh label edit <name> --repo <repo> --description <text>` for each. `gh label create --force` is not used: it rewrites the color.

A label being renamed by `labels.rename` is not listed: its new name does not exist yet, and `labels` already sets its description.

### One yes, declinable
The plan is still approved with one question. The skill says that the person may refuse this item alone (`--skip labels.describe`), for example to keep a text edited by hand.

### Web session
Add `label edit` to `gh-web.mjs` with only `--repo` and `--description`, as a `PATCH` of the label. Other flags stay refused.

## Risks / Trade-offs

- A hand-edited description cannot be kept while updating the others → the item is declined whole, or the text is restored by hand; it is listed again on every run.
- An edit fails halfway (permissions) → the item is reported as failed; running `init` again lists only what still differs.
- The test compares commands, not meaning → the texts are fixed in the table above and reviewed there.
