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

No arguments. Looks at the repository, proposes the platforms, the settings and the workflows, shows a plan and applies it only after you agree. Safe to run again. A workflow that already exists and differs from the template is updated only when it can be merged with the published templates without a conflict: the plan shows the difference, keeps your own changes (your credential line, your runner) and writes it only when you agree. With a conflict, or when no published version is close to it, it is left as it is and the plan says why. For the go workflow the plan reminds you to check that its build job installs the toolchain of your stacks. It also offers, as an install you confirm command by command, to declare the plugin in the project (`claude plugin install relevo@relevo --scope project`), so that a teammate who clones the repository is offered it; the new `.claude/settings.json` is left for you to commit. It also offers, with a yes to it alone, a `SessionStart` hook in that file that installs OpenSpec at the start of a session of Claude Code on the web, where each new container lacks it; it runs nothing on a terminal. For a Vue platform reviewed in a browser it offers, the same way, to add Playwright to the platform's development dependencies (`npm install -D playwright`, with `package.json` and the lock file left for you to commit) and to download its Chromium, and a new `relevo.yml` gets `review.autopilot: precheck`, because a browser review is always driven by the agent.

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

The number of a `ready` issue. In the cloud it runs by itself when `ready` is applied; by hand, `/relevo:go` in a Claude Code session builds it on your machine in a worktree of its own (so two can run at once), and `--local` builds in a separate process with the closed tool lists and the limits of the workflow (the worktree is the same; the rest differs, see below). `--decision` is passed by the workflow, not typed. If QA rejects the build after the retries (or tasks are left unfinished) the work is not lost: it is committed to the branch as `wip: rejected by QA`, the issue is `qa-failed`, and the comment says it is code QA did not approve ([QA failed](guide.md#qa-failed)).

```text
/relevo:go 42 --local
```

#### In the session or on its own

| | `/relevo:go 42` in a session | `/relevo:go 42 --local` |
|---|---|---|
| Who builds | your own Claude Code session | a new `claude -p` process (`agy -p` with Antigravity) |
| Tools | those of your session | the closed lists of the workflow |
| Limits | none of `relevo.yml` | the turn and cost limits of `relevo.yml` |
| What you see | the build, live; you can step in | the output when it ends |
| Context | uses the context of your session | does not touch it |
| Worktree | its own, under `.relevo-worktrees/` | the same place |

Use the session when you want to watch and step in; use `--local` to leave it running under the same limits as the cloud.

### `/relevo:review [issue-number]`

The number of a `built` issue. It starts the review on the device, in a browser or, for a backend such as Laravel, with the project's tests, shows a short brief, the shot list (none for a backend) and the checklist, and waits for you. You write `ok 1 2`, `fail 3 <what happened>`, `capture <name>`, `waive <n> <reason>` or `done`.

```text
/relevo:review 42
```

### `/relevo:fix [issue-number] [what is wrong]`

The issue and what is wrong, in your words. It writes the correct behaviour into the specification first, then the code, and returns the issue to where it was. When the branch holds the work that a rejected cloud build kept (`wip: rejected by QA`), you can leave out what is wrong: it takes the finding from the failure comment and runs the checks QA could not run.

```text
/relevo:fix 42 the total shows 3 when there are 4 clients
```

### `/relevo:ship [issue-number]`

The number of a `pr-open` issue whose pull request someone other than the author approved. It shows what will happen, asks for a written yes, archives the specification, merges and closes the issue.

```text
/relevo:ship 42
```

**Or apply the label `relevo:ship` to the issue.** When the ship workflow is installed, GitHub runs the same steps with no model and no local copy, so you can ship from the browser or a phone. The label is your written confirmation, and the rest is checked as in the command. Only the person who ships under `review.merger` may use it: the approver, or the author with `merger: author`. Someone eligible who did not approve uses the command, which asks them to confirm that. When anything stops it (no approval on the current code, failing checks, conflicts, an open task, no checks at all, or a base branch that requires checks without the App), the run comments why, mentions you and removes the label. Apply it again once that is solved. [Where `go` runs](execution.md#shipping-with-a-label) explains the checks and the App.

### `/relevo:status`

No arguments. Who is waiting on what, the `ready` issues assigned to you and any build that has stopped reporting. When a read from GitHub fails (for example a 403 on the repository variable that pauses the cloud), the report says which one under "Could not read" and that it may be incomplete, and an empty answer reads "Nothing is waiting on you. (from what could be read)".

The daily digest posted by the digest workflow has the same content for the team, plus one line with the usage of the cloud runs of the last seven days when they left a usage marker ([what it counts](execution.md#what-a-cloud-run-reports)). `/relevo:status` itself does not show it.

The digest also ends with the time of each stage of an issue, as the median of the stages that finished in the last seven days and how many they were, for example `Stages, last 7 days (median): gate 13 s (4), build 6 min (3), waiting for you 3 h (3), device review 24 h (2)`. [What it counts](execution.md#how-long-each-stage-takes).

```text
/relevo:status
```

### `/relevo:doctor`

One optional argument, `--all`. Checks the tools, the skills, `relevo.yml`, the workflows and the repository settings, and says how to fix each problem. It also checks the installed plugin (its folders and version), that each workflow pins a version of the package (`RELEVO_VERSION`) and that the go workflow installs the toolchain of the stack of each Flutter or Laravel platform. It warns when the repository does not declare the plugin in `.claude/settings.json`, because a teammate who clones it would not be offered it. In a web session it also warns when the repository has no hook that installs OpenSpec at the start of the session; on a terminal it says nothing about it.

The report starts with a line that says what it judged: the repository, and whether the workflows were read from the default branch (which is what GitHub runs) or from the working copy. Then it lists, in this order, the `FAILURES` (each `[FAIL]` line with its `fix:`), the `WARNINGS` (`[warn]`, which do not stop you) and the `NOTES` (`[note]`, information that asks nothing of you). The `NOTES` include a line with the versions it can read here, without the network: the plugin in use, each installation that Claude Code lists (the user scope and the scope of this repository) and the pins of the workflows on the default branch. If the user and the project scope are on different versions, a warning gives the command that updates the lagging one (`claude plugin update relevo@relevo --scope user`); if the text of a workflow is older than its pin, or has no `# relevo-template:` line, another says that `/relevo:init` updates it by merging it with the new template and keeping your changes. The checks that passed are only counted: `--all` lists them too, each as `[pass]`. Files that fail for the same reason are one line that names them all, and the closing line counts those lines. The exit status is 1 only when a check failed; `relevo doctor --json` always lists every check, with its level.

```text
/relevo:doctor [--all]
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

## Reviewing a Laravel backend

A Laravel platform has no screen, so its review has no device, no browser and no screenshot. The checklist still has one line per scenario, and you still confirm every line.

- **With `review.autopilot` `off`** (the default) you run the project's tests in your terminal and tell the review the result: `ran <exit code>`, with `--tests <n>` when you know how many ran. Then you write `ok` or `fail` for each line, as in any review.
- **With `precheck` or `verify`** the agent runs the existing feature test that covers each line and records the test and its exit code. It never writes a test, a filter that matches no test proves nothing, and a line with no test stays for you. The pull request says which runs were yours and which were the agent's.
- **The audit reads the log since the review started**, by default `storage/logs`, and never empties or deletes it. A test run that passes writes nothing there, so a recorded run is what shows that the code was exercised: a clean run with a quiet log is `REVIEW PASSED`, and no run at all is `REVIEW INCONCLUSIVE`.
- **The database matters.** Before it runs a test the review reads the database that `phpunit.xml` declares, never your `.env`. In-memory SQLite, which a new project uses, needs nothing; any other database needs your written confirmation that it is not production.
- **A server is optional.** Add a `serve` block to the `review` block of `.relevo/stacks/laravel.md` ([Stacks and platforms](stacks.md)) and, with `precheck` or `verify`, the agent can start it on a free local port for the lines that need requests. Without it, no server is started.
- **Missing dependencies stop it**: when there is no `vendor/`, the review gives the `composer install` command for you to run and installs nothing.

## Letting the agent help with the review

By default the person does everything in `review` and the agent only observes. With `review.autopilot` set to `precheck` or `verify` the agent may also walk the checklist, and the person still confirms the lines and gives the agreement before a pull request opens.

- **Where it works.** A Flutter app on an Android device is driven through `flutter_driver` (the app needs `lib/main_driver.dart` with `enableFlutterDriverExtension()`); a web app (Vue, or Flutter on the web) is driven in a browser of its own by a Playwright script that the agent writes from the scenarios and `qa` reads first. A web target has no manual review, so it needs `precheck` or `verify`. The review of iOS is not available yet.
- **What it may not do.** It never uses coordinates, `adb shell input`, Appium or Maestro, never your own browser, never a site that is not `localhost`, the page under review or in `review.allowed_origins`, and never sends a message or makes a call in another app. Before it starts you confirm in writing that the app points to data that is not production. A test login is given as the name of an environment variable; the agent never sees the value.
- **What it records.** In `precheck` it records its own result per line and you confirm each one. In `verify` it can mark a line `ok (auto)` only when the `THEN` was proved by an assertion, a finder, the log or the exit code of a project command (typecheck, lint, test, build), and the pull request lists those lines. A line it checks by reading code, CI or docs is only pre-checked. Appearance, animation and fidelity to an image stay yours. With `precheck` or `verify` the brief says up front which lines the agent walks and how.
- **Before a browser review.** `scripts/web-preflight.mjs` checks that `node_modules` exists and matches `package-lock.json` (the merge with the base branch can change it), that Playwright and its Chromium resolve from the project, and that the address and the module scripts of its page answer. When the dependencies are missing or out of date, the review offers the frozen install of the lock file (`npm ci --ignore-scripts`, `pnpm install --frozen-lockfile --ignore-scripts` or `yarn install --immutable`) and runs it only if you agree; it never runs package scripts, and without a lock file it asks you to install. Playwright is a development dependency of the project: when it is missing the review installs nothing and points you to `/relevo:init`. Its Chromium is downloaded only if you agree. When the app does not answer, you get the command to start it and the variable names of `.env.example`.
- **Screenshots in a browser review.** The shot list becomes `capture(name, check)` calls in the script: the check proves the page shows that shot's state, and when it fails no screenshot is taken. The files go to `evidence/`, the agent sees only their paths, and they are taken while you test, never after you agree. With `evidence.policy: attach_to_pr` you are offered only the PNG files.
- **Other configurations.** For a line that needs the app started differently (a missing or invalid variable), the agent starts its own server with `scripts/extra-server.mjs` on a free port, runs the script against it with an output folder of its own, and stops it. Only the log of the normal run is audited. Your server is never stopped; if `.env` files exist, a line that needs a variable removed is left for you, because the dev server would load it anyway.
- **Gates in the runner.** `scripts/web-review.mjs` itself refuses to start without your confirmation of the data, with `review.autopilot: off`, after you agreed, or with a script that `qa` did not pass in that exact form. When the page itself fails, it says so before the script's error.
- **Back to the base branch.** The review does not switch branches while your dev server runs from the working tree (`scripts/dev-server-guard.mjs`): it would lose its files. It tells you instead.
- **The default is `off`** because the driven review has not yet run against a real app; a repository turns it on.
- **A script is not sandboxed.** The runner refuses a script that reaches the file system, the process or the network outside the browser, takes a screenshot itself or passes a file path to the browser, and it keeps the script's console out of the agent's view; but that is a tripwire; read a script that will touch anything sensitive.

## What `fix` and `ship` check

`fix` and `ship` change a branch after a person has looked at it, so scripts hold what must not vary.

- **A fix that QA rejects is saved, not lost.** After the retries `fix` stashes the work under `relevo-fix #<n> iteration <k>` and leaves the tree clean. The next `/relevo:fix <n>` offers it back (the stash lives in that clone only). A conflict on restore stops and keeps the stash; discarding it needs your written confirmation.
- **A branch with only the specification is not "fixed".** `fix` says to delete the remote branch and apply `relevo:ready` again.
- **The task list is checked.** Before the developer runs, the only open tasks are the corrections; one of them starts with `Test:` (a regression test) unless every correction ends with `(device only)`. After QA, none is open.
- **`ship` can be run again.** If the change is already archived on the branch, `ship` goes on from the merge. If the archive leaves conflicts only inside `openspec/`, it reverts the archive commit, brings in the base branch and archives again, with normal pushes. A conflict in code stops it.
- **An approval counts for the code it saw.** An approval given on an older commit does not count; after the archive commit, the approval on the head recorded at the start still does. So do its checks, when the archive commit has none of its own and changes only `openspec/`.
- **The issue must be `pr-open`**, and `ship` names the missing command (`/relevo:review` or `/relevo:fix`) otherwise. The change is validated and has no open task before it is archived.
- **Who runs `ship`.** With `review.merger: approver`, a member of `team.members` who is not the author or the spec writer (and, in `roles` mode, one of `team.approvers`). Someone eligible who did not approve confirms in writing that they did not.

## Skills that `think` uses

`/relevo:think` does not reimplement anything: it runs two existing skills directly, so their behaviour is exactly theirs.

| Skill | Comes from | Role in `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explores the idea and the code |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | interviews you until every decision is made; you launch it yourself with `/grill-with-docs` when `think` asks, because its author reserved it for the person; the glossary and decision-record entries it settles are handed to `create`, not written |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | used by `grill-with-docs` |

The plugin does not contain them: what is installed is the plugin only: its scripts, skills, agents, stack profiles and templates. Install them in your project (`openspec init`, and `npx skills add mattpocock/skills`); if one is missing, `think` stops and says which.

This repository does keep copies for working on it: the OpenSpec skills and commands under `.claude/` (generated by OpenSpec 1.14.1; refresh them with `openspec update`) and the skills from mattpocock/skills under `.agents/skills/`, linked from `.claude/skills/` (installed with `npx skills add`, pinned in `skills-lock.json`). Their licence notices are in [NOTICE](../NOTICE).
