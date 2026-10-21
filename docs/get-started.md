# Get started

English · [Español](get-started.es.md)

This page takes you from nothing to your first merged pull request, working alone on a repository. Expect about twenty minutes of your own time, plus the build, which takes a few minutes and varies. For a team, read the [Guide](guide.md) and [Configuration](configuration.md) afterwards.

## Before you start

- **Claude Code**, installed and signed in.
- **A GitHub repository** that you administer, with a project in Flutter, Vue or Laravel.
- **The GitHub CLI** signed in (`gh auth status`), and `git`.
- **Node.js 20.19 or newer**, which the OpenSpec tool needs.
- **A model credential** for the cloud builds: an API key from the Anthropic Console, or a Claude subscription.
- **For a Flutter app on Android**, a phone or an emulator, to test on.

## 1. Install the plugin

Relevo is a Claude Code plugin. In a terminal:

```bash
npm install -g @elalfner/relevo
relevo install
```

`relevo install` installs the plugin for every project of the machine. To install it for one repository only, run `relevo install --scope project` (shared with the team through `.claude/settings.json`) or `--scope local` (only you). Without npm, the two `claude plugin` commands do the same:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Only the plugin is installed (scripts, skills, agents, stack profiles and templates); the documentation is online.

- **You should see**: the installation finishes without an error and `relevo version` prints a version. After you restart Claude Code in your project, typing `/relevo:` lists the nine commands.
- **If not**: restart Claude Code in the project folder; if the plugin does not install, update Claude Code and try again. More in [Install](install.md).

## 2. Check your setup

In Claude Code, in your project:

```text
/relevo:doctor
```

- **You should see**: a list. A line starting `[pass]` is something that works; a line starting `[FAIL]` is followed by `fix:` and the command that solves it; a `[warn]` line is worth reading but does not stop you. A new repository has several failures, which is normal.
- **If not**: run the fix that each line gives and run `/relevo:doctor` again. Step 3 also offers to install what is missing.

## 3. Set the repository up

```text
/relevo:init
```

It asks who works on the repository (you), the review mode (`none`, for working alone), the language, the platform (its stack, its folder and its targets), where `go` builds (the cloud, by default) and the cost limit per run. Then it shows the whole plan and changes nothing until you agree.

- **You should see**: a plan with one line per change. A line starting `[will do]` is something `init` does itself (create `relevo.yml`, the labels, the rulesets, the workflows); a line starting `[by hand]` is something only you can do, such as creating the secret of step 4 or committing the new files. After you agree, it applies the first kind, leaves the new files for you to commit, and runs the doctor again with fewer failures. Get the workflows onto the default branch of the repository: GitHub runs a label event from the workflows of that branch.
- **If not**: if the plan says there is no OpenSpec root, run `openspec init` in the project and run `/relevo:init` again (it never creates those files itself). If it cannot find the repository, run it inside a clone with a GitHub remote, or sign in with `gh auth login`. If GitHub refuses branch protection on a free private repository it says so; go on, and the written confirmation of `ship` is your guard. See [Configuration](configuration.md) and [Stacks and platforms](stacks.md).

## 4. Add the model credential

The cloud build needs a credential for the model. You create it yourself in the secrets of the repository: Relevo never reads it, and the value never goes in a file or in the conversation.

```bash
gh secret set ANTHROPIC_API_KEY
gh secret list
```

`gh` asks for the value without showing it. If you use a Claude subscription instead, run `claude setup-token` and store the token the same way, with the name `CLAUDE_CODE_OAUTH_TOKEN`.

- **You should see**: `gh secret list` shows the name of the secret, never its value.
- **If not**: you need admin rights on the repository to create a secret; run the command inside the clone, or add `--repo owner/name`. The difference between the two credentials is in [Where `go` runs](execution.md).

## 5. Write your first issue

Choose something small that you can see on a screen. Tell `/relevo:issue` the idea; it asks only what is missing, checks the draft with the same rules the builder uses, shows it whole and creates it after you approve.

```text
/relevo:issue show the app version under the title on the home screen
```

Title: Show the app version on the home screen

```markdown
## Summary

Show the version of the app under the title of the home screen, so a tester knows which build they have.

## Scenarios

- **WHEN** the home screen is shown
- **THEN** the text "Version 1.2.0" appears under the title

## Edge cases

- the version cannot be read: the line is not shown and the screen still opens

## Out of scope

- Any other change to the home screen.
```

- **You should see**: the draft above, a question about the milestone and the assignee (you), and, after you approve, the issue created in GitHub with its link. Then a separate question: apply `ready`? Say yes in step 6.
- **If not**: if the check says scenarios or edge cases are missing, answer the questions it asks; do not edit around it. What an issue needs is in [Writing an issue Relevo can build](issue-format.md).

## 6. Let it build

Applying the label `relevo:ready` starts the build. Answer yes to the question of step 5, or, from a terminal:

```bash
gh issue edit 1 --add-label relevo:ready
```

- **You should see**: within a minute the issue gets `relevo:building`. After a few minutes it has a comment that says the issue is built (in the `language` of your `relevo.yml`), with what happened, the branch, what to test and `Your next step: /relevo:review 1`, and the label is `relevo:built`.
- **If not**: if nothing starts, check that the workflows are on the default branch, that the secret exists and that the issue has a milestone and an assignee. A comment saying the cloud is not configured means the secret is missing. See [Where `go` runs](execution.md) and the [Guide](guide.md).

## 7. Review it

```text
/relevo:review 1
```

Connect the phone or start the emulator, and start the app (`flutter run`). The agent shows a short brief, the screenshots worth taking and a checklist with one line per scenario. You test the app and write `ok 1`, `fail 2 <what happened>`, `capture <name>` or `done`. When you are done it audits the log, and with your agreement it opens the pull request.

- **You should see**: the checklist; after `done`, a verdict `REVIEW PASSED`; then your question whether to open the pull request, and the issue ending as `relevo:pr-open`.
- **If not**: no device means it tells you what to connect. If a line fails, write `fail <number> <what happened>`, then run `/relevo:fix 1 <what happened>` and review again. An inconclusive verdict means the log had nothing of your app: start it again and repeat the steps. See [Commands](commands.md) and the [Guide](guide.md).

## 8. Ship it

```text
/relevo:ship 1
```

- **You should see**: a summary of the pull request and what will happen, then a question for a written yes. After your yes it archives the specification, merges the pull request into the integration branch, closes the issue and removes the labels.
- **If not**: if it says checks are running or failing, wait or fix them and run it again; if it says the issue is not ready, run the command it names. Promoting the integration branch to the release branch is a separate pull request. See the [Guide](guide.md).

## What next

- Work with other people: set `review.mode` to `peer` and list the team in [Configuration](configuration.md); the [Guide](guide.md) says who does what at each state.
- Add a second platform, or a Vue or Laravel one: [Stacks and platforms](stacks.md).
- Build on your own machine, or pause the cloud: [Where `go` runs](execution.md).
- Understand what is protected and what is not before using it on a public repository: [Security model](security.md).
- Every command with its arguments: [Commands](commands.md).

## If something goes wrong

| Symptom | Likely cause | What to do |
|---|---|---|
| `/relevo:` shows no commands | the plugin is not installed, or Claude Code was not restarted | repeat step 1 and restart Claude Code in the project |
| `/relevo:init` cannot find the repository | you are not in a clone with a GitHub remote, or `gh` is not signed in | run `gh auth login` and start Claude Code inside the clone |
| Labelling `ready` starts nothing | the workflows are not on the default branch, or `RELEVO_CLOUD_GO` is `off` | merge the files of step 3 and check the repository variable |
| A comment says the cloud is not configured | there is no model secret | create it as in step 4 and apply `ready` again |
| The issue went back to `relevo:needs-spec` | it is incomplete or has an open question | read the last comment and run `/relevo:issue 1` |
| The build ended as `relevo:qa-failed` | QA still rejected it after the retry | run `/relevo:fix 1` and describe what QA found |
| The review says the verdict is inconclusive | the log had no line of your app | start the app again, repeat the steps and finish again |
| `ship` refuses | the checks are running or failing, or the review has not opened the pull request | wait for the checks, or run `/relevo:review 1` first |
