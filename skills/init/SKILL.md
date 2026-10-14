---
name: init
description: Sets up a repository for Relevo. It asks for the team, the review mode and the language, shows the full plan of what it will create (relevo.yml, lifecycle labels, the base branch, branch protection, the workflows, the ignore line for evidence/), applies it only after confirmation, offers to install missing dependencies one by one, and finishes by running doctor. Running it again only lists what differs. It never touches the model API key. Use when asked to set up, install or configure Relevo in a repository.
argument-hint: ""
disable-model-invocation: true
---

# Relevo init

Set this repository up for Relevo. Show the plan first, change nothing until the person confirms, and make a second run harmless.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the plan and the changes; use them instead of editing labels, rulesets or workflow files yourself.

## What you must never do

- Never read, write, print or ask for the model API key or any token. Tell the person to add it to the repository secrets themselves.
- Never apply a change before the person says yes to the plan, and never install anything before they confirm that exact command.
- Never overwrite a workflow or `relevo.yml` that already exists and differs; report it.
- Never create files under `openspec/` by hand. If there is no OpenSpec root, tell the person to run `openspec init`.
- Never commit or push. The new files are left for the person to commit.
- Never put credentials in `relevo.yml` or in the answers file.

## Steps

### 1. Preflight

Stop with a clear message, changing nothing, if `gh auth status` fails (ask the person to run `gh auth login`) or the folder is not a git repository with a GitHub remote.

### 2. Ask what is missing

If `relevo.yml` already exists and is valid, skip this step. Otherwise ask, in small groups and without inventing answers:

- who builds and reviews (GitHub usernames) and who writes the specs;
- the review mode: `none` (a solo project), `peer` or `roles`;
- the language of the hand-off messages (`en` or `es`) and the platform (look at the project to propose one; today `flutter-android`);
- the cost limit per unattended run in US dollars: the template's 5 is a placeholder the person must accept or change.

Write the answers as JSON to a temporary file **outside the repository**, with the keys `members`, `specWriter`, `reviewMode`, `language`, `platform` and, if given, `runMaxCost`. Never put a secret in it.

### 3. Show the plan

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs plan --answers <answers file>
```

Show it as it is. Each line says whether it is already `ok`, will be done, `differs` (exists, left alone) or must be done `by hand`. Then ask one direct yes/no question: apply the changes marked "will do"? Wait for the answer.

### 4. Offer the installs, one at a time

For each line in the plan that is an install, show its exact command and ask for a yes to that command alone. Run it only on a yes. If the person declines, continue, say that dependency is still missing, and that `go` and `ship` will not run until the OpenSpec tool is installed.

### 5. Apply

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs apply --answers <answers file>
```

The branch rules (`protection` and `push-scope`) stop anyone, the person included, from pushing straight to the base and release branches. A workflow only runs once it is on the default branch, so when the plan also adds workflow files, apply with `--skip protection,push-scope`, ask the person to commit and push the new files first, and run `apply` again afterwards to add the rules.

It carries out only the "will do" changes that are not installs. When GitHub refuses one (no administrator permission, or the feature needs a paid plan) it prints the exact settings to change by hand; show them to the person.

### 6. Check

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs` and show its output.

## Report

Finish with: what was created, what was left alone, what the person must still do by hand (always the model credential in the repository secrets, with all whitespace removed from a subscription token, and committing and pushing the new files to the default branch, because a workflow only runs from there), and the doctor result.
