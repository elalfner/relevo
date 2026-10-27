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
- Never overwrite `relevo.yml` that already exists and differs; report it. A `relevo.yml` with the older `platform: flutter-android` line stays as it is.
- A workflow that already exists and differs is reported, unless the plan offers to update it: that line (`Update .github/workflows/<file> from A to B, keeping your own changes`) means a three-way merge with the published templates came out clean, and it is written only with the person's yes to the plan. A workflow whose merge conflicts or has no close published version is left as it is; never edit it to resolve the conflict yourself.
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
- the language of the hand-off messages (`en` or `es`);
- the platforms: for each one a name, its stack (look at the project to propose one: the profiles in `${CLAUDE_PLUGIN_ROOT}/stacks/` are the stacks Relevo ships with: `flutter`, `vue`, `laravel` and `supabase`), the folder where it lives (`.` for a repository with one platform, `apps/web` in a monorepo) and, for a stack that has targets, which ones (for Flutter: `android`, `ios`, `web`; for Vue: `web`; Laravel and Supabase have none). Several platforms in one repository are written down, but `go` builds only a repository with one for now;
- where `go` builds: in the cloud, on each person's machine, or both (the default), and, for the cloud, with an API key from the Anthropic Console (the default) or with a subscription token. A subscription's quota is shared by every run and by the interactive use of the account, so `init` sets `limits.concurrent_agents` to 1 for it. Nothing about this goes in `relevo.yml` apart from that number: the installed workflows, the secret that exists and the repository variable `RELEVO_CLOUD_GO` (`off` pauses the cloud at once, with no pull request) decide it. Whatever the answer, the ship workflow (`relevo-ship.yml`) is added: it ships an approved issue when a person applies the `relevo:ship` label, runs no model and needs no model credential, and the repository variable `RELEVO_CLOUD_SHIP` (`off`) pauses it;
- whether the repository runs its GitHub Actions on a self-hosted runner. Ask nothing more when the answer is no: the workflows run on `ubuntu-latest` and `relevo.yml` gets no `runner` key. On a yes, ask for the runner's labels (for example `self-hosted` and `linux-build`): they become `runner.labels` in `relevo.yml` and the `runs-on` of every workflow `init` adds. Say that Relevo assumes a self-hosted runner keeps its files between jobs, whatever the person says about it, and that the agent's code runs with the permissions of the runner's user; do not ask whether the runner is ephemeral;
- the repositories this one depends on, if any (`owner/repo`, for example the back end of a front end): they are written to `links`, the closed list that `Depends-on: owner/repo#N` is checked against;
- whether to create a commented `.relevo/stacks/<stack>.md` for each stack, where the project can add its own hygiene to the plugin's profile (optional; `init` creates it but does not commit it: it is left for the person to commit, because the cloud and teammates read it from git);
- which agent builds in the cloud, only when the person says they use Antigravity: `claude` (the default) or `antigravity`. With `antigravity` the model key is `GEMINI_API_KEY`, a key made only for Relevo in its own Google Cloud project with a quota, and the limit asked below is a number of tokens (`limits.run_max_tokens`) because that agent has no cost limit; `docs/security.md` says what else it cannot enforce;
- the cost limit per unattended run in US dollars: the template's 5 is a placeholder the person must accept or change (with `antigravity`, the token limit instead).

Write the answers as JSON to a temporary file **outside the repository**, with the keys `members`, `specWriter`, `reviewMode`, `language`, `platforms` (a map of name to `{ stack, path, targets }`), `links` (a list of `owner/repo`, possibly none), `runs` (`cloud`, `local` or `both`), `credential` (`api_key` or `subscription`), `runnerLabels` (a list of runner labels, only for a self-hosted runner), `stackProfiles` (the stacks that get a profile file, possibly none) and, if given, `runMaxCost`. Never put a secret in it.

### 3. Show the plan

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs plan --answers <answers file>
```

Show it as it is. Each line says whether it is already `ok`, will be done, `differs` (exists, left alone) or must be done `by hand`. A workflow update shows its difference under the line, and a conflict shows both versions. When a line says that no published version is close to a workflow, ask which version of Relevo it was copied from and run the plan again with `--from <version>`. Then ask one direct yes/no question: apply the changes marked "will do"? Wait for the answer.

### 4. Offer the installs, one at a time

For each line in the plan that is an install, show its exact command and ask for a yes to that command alone. Run it only on a yes. If the person declines, continue, say that dependency is still missing, and that `go` and `ship` will not run until the OpenSpec tool is installed.

One install is not a dependency: `install.plugin-project` declares the Relevo plugin in the project, so that a teammate who clones the repository is offered it, even when the plugin is already installed for the machine. Show its exact command (the two `claude plugin` commands at the project scope) and run it only on a yes. If it ran, `.claude/settings.json` is new or changed: say that it is left for the person to commit. If the person declines, nothing else changes, and `/relevo:doctor` keeps warning about it. When the plan says that file is not valid JSON, do not touch it: tell the person to fix it.

`install.web-hook` adds a `SessionStart` hook to `.claude/settings.json` that installs OpenSpec at the start of a session of Claude Code on the web, where every new container lacks it. Show the hook the plan names (it runs nothing outside a remote session and nothing when `openspec` already runs) and ask for a yes to it alone. On a yes, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/web-hook.mjs` from the repository root: it adds the hook next to the other settings and hooks of the file and changes nothing else, and it writes nothing when the file is not valid JSON. Say that `.claude/settings.json` is left for the person to commit. If the person declines, write nothing for it: `/relevo:doctor` keeps warning about it in a web session. When the plan says the file is not valid JSON, do not touch it.

For a Vue platform reviewed in a browser, the plan has two installs, in this order: `install.playwright.<platform>` adds Playwright to the platform's development dependencies, and `install.chromium.<platform>` downloads its Chromium. Run each from the repository root exactly as shown (the command enters the platform folder itself). If Playwright was added, `package.json` and the lock file of that platform changed: say that they are left for the person to commit with the other new files, on the base branch, so that every review finds Playwright. If the person declines either one, continue and say that a browser review of that platform stops until it is installed, and that `/relevo:doctor` keeps warning about it. A `review.autopilot` line among the manual steps means the existing `relevo.yml` keeps the autopilot `off`: say that a browser review needs `precheck` or `verify`, and leave the file as it is.

### 5. Apply

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs apply --answers <answers file>
```

The branch rules (`protection` and `push-scope`) stop anyone, the person included, from pushing straight to the base and release branches. A workflow only runs once it is on the default branch, so when the plan also adds workflow files, apply with `--skip protection,push-scope`, ask the person to commit and push the new files first, and run `apply` again afterwards to add the rules.

It carries out only the "will do" changes that are not installs. When GitHub refuses one (no administrator permission, or the feature needs a paid plan) it prints the exact settings to change by hand; show them to the person.

### 6. Check

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs` and show its output.

## Report

Finish with: what was created, what was left alone, what the person must still do by hand (always the model credential in the repository secrets, with all whitespace removed from a subscription token, and committing and pushing the new files to the default branch, because a workflow only runs from there; name each `.relevo/stacks/<stack>.md` it created among them), and the doctor result.
