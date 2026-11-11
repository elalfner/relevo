# Proposal

## Why

In a pilot on a real Vue project, several issues said "export and the enable/disable actions are out of scope" while the project rules (read by QA on every run) require them on every list. The build followed the rules, noted the difference in the design and the hand-off, and QA passed; a reviewer then settled in review which one wins, three times. A QA lens also left a "non-blocking" note about a violation of a rule written in the rules file, and the build passed although that file says a change that breaks the rules is rejected. One issue limited its scope to a single identifier while its scenarios needed the page to open without error, and only running the build found it. Issue #121, part of #115.

## What Changes

- A model-free check reads the issue against the project rules (`qa.rules_from`) and against itself: an `Out of scope` line that excludes something a hard rule requires, and an `Out of scope` limit that forbids what one of its own scenarios needs (the first blocks, the second only warns, because the words alone were not reliable enough to stop a build). Each finding quotes both lines (with the file and line of the rule) so a person can reproduce it by reading them.
- The check runs where the issue text is already checked: `check-issue.mjs` before the issue is created, and `build-preflight.mjs --stage issue` before any agent turn of a build. A conflict sends the issue back to `needs-spec` with a new reason, `conflict`.
- An issue can override a rule on purpose with a recorded decision: a line `Overrides: <file>:<line>` inside a `### D<n>.` decision. The check then skips that rule. It never decides which rule wins.
- A rule of the rules file is a requirement by default. A line (or a heading and what is under it) marked `[advice]` is advice and never blocks.
- A QA finding that cites a hard rule with `Rule: <file>:<line> "<quoted text>"` is blocking, whichever lens wrote it and whichever attempt it is, including the `interface` lens on its last attempt and a report that says `QA PASSED`. `qa-aggregate.mjs` verifies the citation against the rules file; a citation that does not match the file is not trusted and the finding keeps the lens's own treatment.
- The four lens agents are told to cite the rule they apply in that form, and never to write a rule violation as a note.

## Capabilities

### New Capabilities

### Modified Capabilities
- `issue`: the check of a draft finds a contradiction with the project rules or inside the issue.
- `go`: the same check runs before the build starts; a cited violation of a hard rule blocks.
- `issue-lifecycle`: `needs-spec` has a reason `conflict` and a next step for it.

## Impact

`scripts/lib/issue-check.mjs` (a focused addition; #119 edits the same file), new `scripts/lib/rule-conflicts.mjs` and `scripts/lib/rules-file.mjs`, `scripts/check-issue.mjs`, `scripts/lib/build-preflight.mjs` and `scripts/build-preflight.mjs`, `scripts/lib/qa-aggregate.mjs` and `scripts/qa-aggregate.mjs`, `scripts/lib/next-step.mjs`, `skills/go/references/qa-run.md`, the four `agents/qa-*.md`, `docs/issue-format.md` and `docs/configuration.md` (and their `.es.md` twins), tests, `CHANGELOG.md` (unreleased). Not touched: `agents/dev.md`, `skills/go/SKILL.md` (issue #130), the version in `plugin.json`. Constraint C1 holds: every blocking verdict quotes lines a person can re-read.
