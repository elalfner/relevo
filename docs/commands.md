# Commands

English · [Español](commands.es.md)

Distributed as a Claude Code plugin named `relevo`:

| Command | What it does |
|---|---|
| `/relevo:init` | Sets up config (including the [platforms and their stacks](stacks.md)), labels, branch protection and workflows (idempotent, shows a plan first) |
| `/relevo:think` | Prepares the context before any issue exists: it runs the `openspec-explore` skill and then the `grill-with-docs` skill, one after the other, in the same conversation. The skills do the work; `think` only chains them and hands off to `issue`. `grill-with-docs` is published so that only you can launch it, so when it is time `think` asks you to run `/grill-with-docs` in the same conversation. It writes no files: the glossary entries and decision records it settles travel in the issue's `Documentation` section, so nobody has to commit them by hand |
| `/relevo:issue` | Turns an idea into issues that pass the spec check: asks only what is missing, checks, shows, then creates (never starts a build). With an issue number it rewrites that issue instead, only while it is not queued, being built or built |
| `/relevo:go` | Builds a ready issue: spec check, build, QA with one retry (runs automatically in the cloud). It verifies the issue text is the one that was approved, refuses protected paths, and says what to do when the branch already exists |
| `/relevo:review` | Guided on-device review: the person drives, the agent captures and audits logs |
| `/relevo:fix` | Fixes review feedback, updating the spec first |
| `/relevo:ship` | Verifies approval, archives the spec, merges, closes the loop |
| `/relevo:status` | Who is waiting on what, plus a daily digest |
| `/relevo:doctor` | Checks that the environment and repo settings are correct, including the tools and skills each [stack profile](stacks.md) asks for |

## The issue format

`/relevo:issue` writes the issue and `/relevo:go` builds it, so the issue is the only thing the builder is given. Besides the scenarios and edge cases, it can carry what the agreement settled, in optional sections: `Outcome`, `Decisions` (each with an id `D1`, what was decided, why and what was discarded), `Constraints` (`C1`), `Code pointers`, `Verification`, `Assumptions` and `Open questions`. `go` copies them word for word into the change's design, and QA rejects a build that breaks a decision or a constraint, citing its id. An issue with an open question, or with the text `NEEDS CLARIFICATION`, is sent back to its writer as ambiguous. The format is in [Writing an issue Relevo can build](issue-format.md).

- `/relevo:think` writes what it settled with ids before it asks you to run the interview, and `/relevo:issue` shows a table of which id went to which section; an id is dropped only if you say so.
- `/relevo:think #42` starts from an issue that came back with an open question.
- After creating issues, `/relevo:issue` asks one separate question: apply `ready` now? Nothing starts without your yes.
- Before drafting, `/relevo:issue` searches the open issues for similar ones.
- `/relevo:review` begins with a short brief (what was asked, the outcome, what to check first) computed from the issue.

## What `fix` and `ship` check

`fix` and `ship` change a branch after a person has looked at it, so scripts hold what must not vary.

- **A fix that QA rejects is saved, not lost.** After the retries `fix` stashes the work under `relevo-fix #<n> iteration <k>` and leaves the tree clean. The next `/relevo:fix <n>` offers it back (the stash lives in that clone only). A conflict on restore stops and keeps the stash; discarding it needs your written confirmation.
- **A branch with only the specification is not "fixed".** `fix` says to delete the remote branch and apply `relevo:ready` again.
- **The task list is checked.** Before the developer runs, the only open tasks are the corrections; one of them starts with `Test:` (a regression test) unless every correction ends with `(device only)`. After QA, none is open.
- **`ship` can be run again.** If the change is already archived on the branch, `ship` goes on from the merge. If the archive leaves conflicts only inside `openspec/`, it reverts the archive commit, brings in the base branch and archives again, with normal pushes. A conflict in code stops it.
- **An approval counts for the code it saw.** An approval given on an older commit does not count; after the archive commit, the approval on the head recorded at the start still does.
- **The issue must be `pr-open`**, and `ship` names the missing command (`/relevo:review` or `/relevo:fix`) otherwise. The change is validated and has no open task before it is archived.
- **Who runs `ship`.** With `review.merger: approver`, a member of `team.members` who is not the author or the spec writer (and, in `roles` mode, one of `team.approvers`). Someone eligible who did not approve confirms in writing that they did not.

## Skills that `think` uses

`/relevo:think` does not reimplement anything: it runs two existing skills directly, so their behaviour is exactly theirs.

| Skill | Comes from | Role in `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explores the idea and the code |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | interviews you until every decision is made; you launch it yourself with `/grill-with-docs` when `think` asks, because its author reserved it for the person; the glossary and decision-record entries it settles are handed to `create`, not written |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | used by `grill-with-docs` |

The plugin does not contain them: what `/plugin install` copies is `skills/`, `agents/` and `templates/`. Install them in your project (`openspec init`, and `npx skills add mattpocock/skills`); if one is missing, `think` stops and says which.

This repository does keep copies for working on it: the OpenSpec skills and commands under `.claude/` (generated by OpenSpec 1.14.1; refresh them with `openspec update`) and the skills from mattpocock/skills under `.agents/skills/`, linked from `.claude/skills/` (installed with `npx skills add`, pinned in `skills-lock.json`). Their licence notices are in [NOTICE](../NOTICE).
