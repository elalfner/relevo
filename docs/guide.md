# Guide

English · [Español](guide.es.md)

This page answers "what do I do now?". The other pages say what each command and setting is; this one follows an issue from the idea to the merge and says what to do when something does not go as planned.

## The life of an issue

An issue is always in one state, shown by a label, and each state has one next step. The same table is what the hand-off messages say.

| State | Next command | Who |
|---|---|---|
| `ready` | none: the agent starts by itself; to build on your machine, `/relevo:go <n> --local` | nobody |
| `queued` | none: it starts when the assignee has capacity | nobody |
| `building` | none: the agent is building it | nobody |
| `blocked` | none: it starts when the issues it depends on are merged | nobody |
| `built` | `/relevo:review <n>` | the assignee |
| `in-review` | `/relevo:review <n>` to continue; if something fails, `/relevo:fix <n>` | the assignee |
| `pr-open` | `/relevo:ship <n>`, after someone other than the author approves on GitHub | the approver |
| `needs-spec` | `/relevo:issue <n>`; if the question needs exploring, `/relevo:think #<n>` first | the spec writer |
| `qa-failed` | `/relevo:fix <n>`; if the branch has only the specification, delete it and apply `ready` again | the assignee |
| `changes-requested` | `/relevo:fix <n>` | the author |
| `needs-reviewer` | none: assign a reviewer, or ask someone to take it | the spec writer |

Before an issue has a state, `/relevo:think` explores the idea and `/relevo:issue` writes the issue. `/relevo:status` shows who is waiting on what.

## What do I do when…

### A review found a failure

Do not edit the code yourself. Write what went wrong on the checklist line (`fail <number> <what happened>`), then run `/relevo:fix <n> <what went wrong>`. It corrects the specification first, then the code, and the issue returns to where it was. Start `/relevo:review <n>` again: lines you confirmed stay confirmed, the failed one is tested again.

### A reviewer asked for changes

When a reviewer requested changes on the pull request, the issue becomes `changes-requested` and the author is told. Run `/relevo:fix <n> <what the reviewer asked>`. When it finishes, the issue returns to `pr-open` and the reviewer is asked to look again.

### QA failed

The issue becomes `qa-failed` and the assignee is told, with the first finding. When the cloud build was rejected after the retries (or left tasks unfinished), the work is not lost: the branch holds it as a commit `wip: rejected by QA`, and the comment says it is code that QA did not approve. Run `/relevo:fix <n>`: it takes the finding from that comment as the defect, so you do not have to describe it, and runs the checks QA could not run. To rethink the issue instead, use `/relevo:think` and then `/relevo:issue <n>`. If the safe commit refused the work (a protected path, a file outside the platform, a marker or a possible credential), nothing is pushed and the comment says so. If the branch has code that you wrote, run `/relevo:fix <n>` and describe what QA found. If it has only the specification (the build failed before any code), delete the remote branch and apply `ready` again.

### The quota ran out

A cloud run that stops at a usage limit or an empty credit says so in the last comment. The issue is not lost: apply `ready` again later, or build it on your machine with `/relevo:go <n> --local`. With a subscription the quota is shared with the interactive use of the same account, so a busy day can use it up.

### I do not know the correct behaviour

Do not guess in a fix. Run `/relevo:think` to explore it (or `/relevo:think #<n>` for an issue that came back with a question), then `/relevo:issue <n>` to write the answer into the issue. An issue with a question left open does not pass the check and is not built.

### The issue went back to needs-spec

Read the last comment: it says what is missing. If information is missing, run `/relevo:issue <n>` and complete it. If a question is open, decide it, with `/relevo:think #<n>` first if you need to explore. Then apply `ready` again.

## Fix or a new issue

- Use `/relevo:fix <n>` when the built work does not do what its issue says, or the reviewer asked for a change to the same feature: the defect is in what was built.
- Write a new issue when the work is correct but you want something else, or something more: that is a different feature, with its own scenarios.
- If the correct behaviour was never written down, it is a gap in the issue, not a defect: `fix` writes it as a scenario first, so describe it as the behaviour you expect.

## Cloud, local or both

- **Both** (the default) builds in the cloud when `ready` is applied, and you can still build by hand.
- **Cloud only** is for building without anyone waiting; **machines only** has no model secret in the repository and each person uses their own session.
- To switch without a pull request, set the repository variable `RELEVO_CLOUD_GO` to `off` and the cloud stops; delete it to resume, then apply `ready` again to the issues that waited. The details are in [Where `go` runs](execution.md).

## Credentials and limits

- With an API key, `limits.run_max_cost` is a real ceiling on spending; with a subscription it is only notional and the controls are `limits.run_max_turns` and a low `limits.concurrent_agents`.
- Every cloud run leaves a comment with its turns, cost and tokens when the log has them.
- A run that reaches its turn or cost limit stops and the issue is `qa-failed` with the reason.

## Public repositories

- Set `trust: public`. Only a maintainer's `ready` starts a run, and `review.mode` cannot be `none`.
- An issue written by a stranger is not built until a maintainer has read it: copy it into an issue of your own, or edit it, and apply `ready` yourself. What you read is what is built.
- Read [Security model](security.md) before you start: it says what is protected and what is not.
