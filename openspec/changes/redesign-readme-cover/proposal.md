# Proposal

## Why

The cover still says "early development", that the solo cycle ran once and that the team features never ran with a team. That is no longer true, and a reader (or a model answering from the page) concludes that Relevo should not be used. The cover also explains before it says what Relevo is or what a person gains.

## What Changes

- `README.md` and `README.es.md` get a new cover: headline, category line and hook, the animated logo, the install commands near the top, usage figures, the build queue, the three handoffs, reasons to use it, safeguards and a FAQ.
- The "early development" status is replaced by a statement that Relevo is in use on real projects and may still change before 1.0.
- The explanation of the logo and the command table move into a collapsed section near the end.
- Antigravity leaves the cover; the other documentation keeps describing it.
- `docs/pilot-findings.md` records the usage figures with their date and counting rule, without naming any project.
- The description in `package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` says that Relevo is an AI agent orchestrator, from issue to merge.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation`: adds what the cover says first, what it may claim, what it keeps and how the package describes itself. The existing requirements (Get started first in the documentation list, both languages with the same structure) do not change.

## Impact

- `README.md`, `README.es.md`, `docs/pilot-findings.md`, `CHANGELOG.md`, new images under `docs/cover/`.
- `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (description only).
- `tests/readme-sync.test.mjs` (the cover now shows state pictures outside the command table) and new tests for the cover.
- No script, skill, agent or workflow behaviour changes.
- Out of scope: a recorded demo, the description and topics of the GitHub repository, the brand guide, the version bump and the release.
