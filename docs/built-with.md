# Built with OpenSpec and mattpocock/skills

English · [Español](built-with.es.md)

Relevo was specified and built the way it asks you to work: with [OpenSpec](https://github.com/Fission-AI/OpenSpec) (MIT licensed), spec first, then code, then the pilot.

- The design lives in `openspec/`. The specifications, as they stand now, are in [`specs/`](../openspec/specs). [`changes/archive/2026-10-16-relevo-v1`](../openspec/changes/archive/2026-10-16-relevo-v1) keeps the change that built them: the proposal, the design decisions (D1 to D16, each with the alternatives that were rejected), the eleven specifications as they were written and the task list. Later changes, such as `glossary-travels-with-the-issue`, follow the same path, and finished ones are archived under `openspec/changes/archive/`.
- The history shows how it grew: the commits and pull requests, and the two pilots written up in [pilot-findings.md](pilot-findings.md), including what failed and how it was fixed. The [sandbox](https://github.com/elalfner/relevo-sandbox) is a small Flutter app where the whole cycle ran, and it is still there to read.
- The thinking was done with the skills of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT licensed), the same ones that `/relevo:think` runs for you.

OpenSpec and those skills are also what the plugin works with: `think` runs them, and `go` and `ship` use the OpenSpec command line to write and archive the specification of each issue. The copies this repository keeps are development tooling and are not part of the plugin (see [Commands](commands.md#skills-that-think-uses)).
