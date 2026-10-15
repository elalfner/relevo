## Context

Relevo splits the work between people. The person who thinks an idea through and writes the issues (the spec writer, often a project manager) does not build or review code and should not need git. The agent builds from the issue; a person verifies the result on a device and a peer reviews the pull request.

`think` uses the `domain-modeling` discipline: it settles terms and writes them to `GLOSSARY.md` as they settle, and it offers a decision record in `docs/adr/` when a decision is hard to reverse, surprising and the result of a real trade-off. `relevo-v1` adds the rule that this documentation stays uncommitted. With `dev` and `main` protected by rulesets, uncommitted files cannot reach the repository except through a pull request, which the spec writer does not make. In the sandbox pilot (issue #5, "Show the build number") the two new terms had no path into the repository.

The issue is the only thing the builder sees, and its pull request is the only thing that is reviewed. Those two already exist and are already the channel for everything else.

## Goals / Non-Goals

**Goals:**
- The spec writer settles vocabulary and decisions without touching git.
- What was settled reaches the repository in a pull request that someone reviews, together with the feature that introduced it.
- The text that is written is the text the spec writer approved, not the agent's paraphrase.

**Non-Goals:**
- Letting the issue ask for any other documentation (README, specs, comments). The section names `GLOSSARY.md` and `docs/adr/` and nothing else.
- Judging by script whether an entry is "vocabulary only". The spec writer approves the text; QA checks that what was written is what was approved.
- Changing how a solo person who commits by hand works. Nothing forbids it.

## Decisions

### D1. The documentation travels inside the issue

`create` adds an optional `## Documentation` section with the exact text. `go` reads the issue like any other part of it, adds a task to the change, and the developer writes the text; the pull request carries the files.

*Alternatives rejected*:
- *`think` opens a pull request itself.* It needs git, a branch, a base to target and a merge, and `think` "never commits, pushes or creates issues" by design. It would also make the spec writer the owner of a pull request with no code in it.
- *A maintainer commits what `think` left behind.* Nobody in the flow is assigned to; the files would wait on one machine again.
- *Keep writing the files and only warn.* This is the current state and the reason for this change.

### D2. `think` hands over, it does not write

`think` still reads the glossary, challenges conflicting terms, sharpens vague ones and tests boundaries with scenarios. It stops writing the files. Each settled term is kept in the agreement as three fields (name, definition, words to avoid); each warranted decision record as a title and a text. The agreement gets a part named "To document" next to *decided*, *open questions* and *proposed defaults*, so `create` finds it without asking again.

The rules for what a glossary entry may hold stay as they are: vocabulary only, no implementation details, no decisions, no general programming terms. They now apply to the handed-over text.

`think` runs `grill-with-docs`, which uses `domain-modeling`, and that skill's own rule is to write `GLOSSARY.md` the moment a term resolves and to offer ADRs. So `think` must redirect that one step, and this is a deliberate exception to the rule that `think` does not override the skills it runs (`relevo-v1`, "Think runs the exploration and grilling skills, it does not restate them"). The exception is narrow: only where the invoked skill would write `GLOSSARY.md` or a file under `docs/adr/`, `think` keeps the entry in "To document" instead. Challenging terms, sharpening language and probing with scenarios stay exactly as the skill does them.

### D3. The section names its targets, and only two

`## Documentation` says which file each piece goes to: entries to `GLOSSARY.md` (under its existing heading, after the existing ones) and records to `docs/adr/`. A decision record has no number in the issue, because the highest existing number can change between writing the issue and building it; `go` numbers it when it writes the file (highest number plus one).

*Alternative rejected*: a free-form "Documentation" section. It would let a text steer the agent to edit arbitrary files, which clashes with the rule that issue text is data and with the closed purpose of the section.

### D4. No new rule in `check-issue.mjs`

The section is optional, and what is in it cannot be judged by a script. The check only has to keep not counting it as a scenario or an edge case. QA is the check that matters, after the fact (D5), and the spec writer approves the text before the issue exists.

### D5. QA checks that the documentation is what the issue gave

When the issue has the section, QA compares the added lines of `GLOSSARY.md` and `docs/adr/` with the text in the issue, and rejects if they differ or if any other line of those files changed. It does not rewrite or judge the vocabulary; that was settled with the person.

## Risks / Trade-offs

- [The agent paraphrases or adds to an entry] → The text is given verbatim and QA compares it; any other change to those files is a rejection.
- [A weak definition is merged because the build gets reviewed for behaviour, not wording] → The wording was approved by the spec writer when the issue was approved, and `Documentation` is shown in full at that approval. The reviewer sees the entries in the pull request.
- [A decision record number collides with a record added by another pull request] → Numbering at build time takes the highest existing number at that moment; two builds in parallel can still pick the same number. Accepted: it is a visible rename in review, not a silent error.
- [The two specs this change extends are still deltas of `relevo-v1`] → This change records its requirements as ADDED under the same capability names. It is archived after `relevo-v1`, and the requirements it replaces there are converted at that point (see Migration Plan).

## Migration Plan

1. Implement and merge this change.
2. When `relevo-v1` is archived, its `think` requirements "Documentation changes stay uncommitted", "The glossary holds vocabulary only" (its writing half) and "Decision records are offered sparingly" are replaced by the requirements of this change, and this change's ADDED requirements become MODIFIED ones. `rename-create-to-issue` renames the `create` folder to `issue`; whichever of the two lands second follows the rename.
3. The sandbox needs nothing: its `GLOSSARY.md` exists and the first issue that carries a `Documentation` section (#5) is the proof.

## Open Questions

- Whether `think` should still offer to write the files when the repository is the person's own and not protected. Nothing in this change prevents it; it is left out to keep one path.
