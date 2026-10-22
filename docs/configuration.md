# Configuration

English · [Español](configuration.es.md)

Relevo reads its behaviour from one `relevo.yml` per repository, at the root. `/relevo:init` creates and updates it. Never put API keys or tokens in it: they belong in the repository's secret store.

Validate the file with:

```bash
node scripts/validate-config.mjs relevo.yml
```

The shipped template, with a comment on every line, is [templates/relevo.yml](../templates/relevo.yml). The rules are in [the specification](../openspec/specs/configuration/spec.md).

| Setting | What it controls | In the template |
|---|---|---|
| `branches.base` | integration branch: feature pull requests target it | `dev` |
| `branches.release` | release branch, promoted from the base in a separate pull request | `main` |
| `links` | repositories an issue may depend on with `Depends-on: owner/repo#N` (a closed list); a private one is read with the read-only secret `RELEVO_LINKS_TOKEN` | none |
| `tracker`, `git_provider`, `platforms` | where the issues and pull requests live, and the platforms that are built ([Stacks and platforms](stacks.md)); the older `platform: flutter-android` still works | `github`, `github`, one Flutter platform for Android |
| `team.members` | GitHub usernames of the people who build and review | empty |
| `team.spec_writer` | who writes the specs; never reviews or merges | none |
| `team.approvers` | who may approve, only used when `review.mode` is `roles` | empty |
| `review.mode` | `none` (solo), `peer` or `roles` | `peer` |
| `review.merger` | who runs `/relevo:ship`: `author` or `approver` | `approver` |
| `review.autopilot` | how much of the review the agent may drive: `off` (the person does everything), `precheck` (the agent walks the lines and records its result; the person confirms every line) or `verify` (the agent may also mark lines it proved with an assertion, a semantic finder or the log; the person confirms the rest and agrees) | `off` |
| `review.allowed_origins` | web origins a driven review may visit besides `localhost`, for example `https://staging.example.com` | `[]` |
| `skills.allow_scripts` | names of the extra skills that have scripts and may be used; a skill with scripts that is not listed is left out, and `/relevo:doctor` says so | empty |
| `limits.built_unreviewed_per_person` | built issues one person may have waiting | 2 |
| `limits.concurrent_agents` | unattended runs at the same time | 3 |
| `limits.review_sla_hours` | hours before a reminder, and the same time again before escalation | 8 |
| `limits.run_max_turns` | turns per unattended run | 100 |
| `limits.building_alert_hours` | hours without activity before an issue on `building` is reported as stuck ([Where `go` runs](execution.md)) | 3 |
| `limits.run_max_cost` | **required** with `agent.build: claude` (the default), and refused with `antigravity`: US dollars per unattended run; choose your own | 5 |
| `limits.run_max_tokens` | **required** with `agent.build: antigravity`, and refused with `claude`: tokens per unattended run, which Relevo's run guard enforces because Antigravity has no limit of its own | none |
| `agent.build` | which agent builds in the cloud: `claude`, or `antigravity` (what each can and cannot enforce is in [Security](security.md)) | `claude` |
| `qa.retries` | developer attempts after QA rejects | 1 |
| `qa.rules_from` | project rules QA reads at every run: one file or a list | `CLAUDE.md` |
| `evidence.policy` | `attach_to_pr`, or `local_only` for sensitive data | `attach_to_pr` |
| `digest.issue` | number of the issue where the daily digest is posted as a comment | none |
| `language` | language of the hand-off messages (`en`, `es`) | `en` |
| `design.images` | `true` downloads a picture pasted into an issue and shows it to the model (a screenshot can show customer data); files already in the repository do not depend on it | `false` |
| `trust` | `private-team` or `public` | `private-team` |
| `labels` | rename any label; the keys are fixed, the names are yours | `relevo:ready`, `relevo:built`, … |

## Platforms, profiles and checks

- Each entry of `platforms` has a `stack`, a `path` and, for stacks that have them, `targets`. [Stacks and platforms](stacks.md) explains the shipped profiles.
- The profile of a stack comes in layers: the file `stacks/<stack>.md` of the plugin, then `.relevo/stacks/<stack>.md` of your repository. Yours adds hygiene text, tools, skills and commands the plugin does not have; it cannot replace a command of the plugin. Commit it, because the cloud and your teammates read it from git.
- To replace a command, write it in `platforms.<name>.checks`, in the open, for example `analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse"`. Only the commands the profile names (`analyze`, `test`, `format`) can be replaced.

## What the limits mean

- `limits.run_max_cost` is required and you choose it. With an API key it is a real ceiling on spending per run. With a subscription token the cost the log reports is notional, so it is only a safety net against a runaway run.
- With `agent.build: antigravity` there is no cost limit to set, because the agent has none: `limits.run_max_tokens` is the limit, and the quota and budget of the Google Cloud project that owns the key are the ceiling that really holds. `trust: public` is not accepted with it yet.
- `limits.run_max_turns` is the main control with a subscription, together with a low `limits.concurrent_agents`: the quota is shared by every run and by the interactive use of the account.
- A run that reaches a turn or cost limit stops and the issue becomes `qa-failed` with the reason. [Where `go` runs](execution.md) has the rest.
