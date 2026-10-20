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

## Each command, with its arguments

### `/relevo:init`

No arguments. Looks at the repository, proposes the platforms, the settings and the workflows, shows a plan and applies it only after you agree. Safe to run again.

```text
/relevo:init
```

### `/relevo:think [idea or #issue]`

An idea, or the number of an issue that came back with an open question. It explores, then interviews you, and ends with the agreement that `/relevo:issue` turns into issues. It writes no file.

```text
/relevo:think show who has a birthday today on the home screen
/relevo:think #42
```

### `/relevo:issue [what to build, the path of a saved agreement, or the number of an issue to update]`

What to build, the path of a saved agreement, or the number of an issue to rewrite. It asks only what is missing, checks every draft, shows them, creates them after you approve and then asks, as a separate question, whether to apply `ready`.

```text
/relevo:issue a reset button on the counter screen
/relevo:issue 42
```

### `/relevo:go [issue-number] [--local] [--decision <base64>]`

The number of a `ready` issue. In the cloud it runs by itself when `ready` is applied; by hand, `--local` builds it on your machine in a separate worktree. `--decision` is passed by the workflow, not typed.

```text
/relevo:go 42 --local
```

### `/relevo:review [issue-number]`

The number of a `built` issue. It starts the review on the device or in a browser, shows a short brief, the shot list and the checklist, and waits for you. You write `ok 1 2`, `fail 3 <what happened>`, `capture <name>`, `waive <n> <reason>` or `done`.

```text
/relevo:review 42
```

### `/relevo:fix [issue-number] [what is wrong]`

The issue and what is wrong, in your words. It writes the correct behaviour into the specification first, then the code, and returns the issue to where it was.

```text
/relevo:fix 42 the total shows 3 when there are 4 clients
```

### `/relevo:ship [issue-number]`

The number of a `pr-open` issue whose pull request someone other than the author approved. It shows what will happen, asks for a written yes, archives the specification, merges and closes the issue.

```text
/relevo:ship 42
```

### `/relevo:status`

No arguments. Who is waiting on what, the `ready` issues assigned to you and any build that has stopped reporting.

```text
/relevo:status
```

### `/relevo:doctor`

No arguments. Checks the tools, the skills, `relevo.yml`, the workflows and the repository settings, and says how to fix each problem.

```text
/relevo:doctor
```

## The issue format

`/relevo:issue` writes the issue and `/relevo:go` builds it, so the issue is the only thing the builder is given. Besides the scenarios and edge cases, it can carry what the agreement settled, in optional sections: `Outcome`, `Decisions` (each with an id `D1`, what was decided, why and what was discarded), `Constraints` (`C1`), `Code pointers`, `Verification`, `Assumptions` and `Open questions`. `go` copies them word for word into the change's design, and QA rejects a build that breaks a decision or a constraint, citing its id. An issue with an open question, or with the text `NEEDS CLARIFICATION`, is sent back to its writer as ambiguous. The format is in [Writing an issue Relevo can build](issue-format.md).

- `/relevo:think` writes what it settled with ids before it asks you to run the interview, and `/relevo:issue` shows a table of which id went to which section; an id is dropped only if you say so.
- `/relevo:think #42` starts from an issue that came back with an open question.
- After creating issues, `/relevo:issue` asks one separate question: apply `ready` now? Nothing starts without your yes.
- Before drafting, `/relevo:issue` searches the open issues for similar ones.
- `/relevo:review` begins with a short brief (what was asked, the outcome, what to check first) computed from the issue.

## What `review` checks

`review` is where a person closes the loop, so its guards do not pass by accident.

- **An empty log proves nothing.** If the device log is empty, or none of its lines was written by the app, the audit says `REVIEW INCONCLUSIVE`. It is not a pass and it cannot be waived: start the app again, repeat the steps and audit once more.
- **You can accept a known finding, in writing.** `waive <number> <reason>` is yours alone; the agent never suggests it. When every finding is waived the verdict reads `REVIEW PASSED (with waivers)` and the pull request body lists them with your reasons. A finding you did not waive still blocks, and waivers are cleared if a fix changes the specification.
- **The log is kept as you test**, so a long review does not lose lines to the device's buffer.
- **A micro-fix is a commit** before the pull request opens.
- **It tests the current code**: it brings in the remote branch before it merges the base, and it asks you to confirm in writing if you are not the assignee.
- **No second pull request**: an existing one for the branch is reused, and a rejected push stops with the reason.

## Letting the agent help with the review

By default the person does everything in `review` and the agent only observes. With `review.autopilot` set to `precheck` or `verify` the agent may also walk the checklist, and the person still confirms the lines and gives the agreement before a pull request opens.

- **Where it works.** A Flutter app on an Android device is driven through `flutter_driver` (the app needs `lib/main_driver.dart` with `enableFlutterDriverExtension()`); a web app (Vue, or Flutter on the web) is driven in a browser of its own by a Playwright script that the agent writes from the scenarios and `qa` reads first. A web target has no manual review, so it needs `precheck` or `verify`. The review of iOS is not available yet.
- **What it may not do.** It never uses coordinates, `adb shell input`, Appium or Maestro, never your own browser, never a site that is not `localhost`, the page under review or in `review.allowed_origins`, and never sends a message or makes a call in another app. Before it starts you confirm in writing that the app points to data that is not production. A test login is given as the name of an environment variable; the agent never sees the value.
- **What it records.** In `precheck` it records its own result per line and you confirm each one. In `verify` it can mark a line `ok (auto)` only when the `THEN` was proved by an assertion, a finder or the log, and the pull request lists those lines. Appearance, animation and fidelity to an image stay yours.
- **The default is `off`** because the driven review has not yet run against a real app; a repository turns it on.
- **A script is not sandboxed.** The runner refuses a script that reaches the file system, the process or the network outside the browser, but that is a tripwire; read a script that will touch anything sensitive.

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
