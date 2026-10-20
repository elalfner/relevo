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
| `limits.built_unreviewed_per_person` | built issues one person may have waiting | 2 |
| `limits.concurrent_agents` | unattended runs at the same time | 3 |
| `limits.review_sla_hours` | hours before a reminder, and the same time again before escalation | 8 |
| `limits.run_max_turns` | turns per unattended run | 100 |
| `limits.run_max_cost` | **required**: US dollars per unattended run; choose your own | 5 |
| `qa.retries` | developer attempts after QA rejects | 1 |
| `qa.rules_from` | project rules QA reads at every run: one file or a list | `CLAUDE.md` |
| `evidence.policy` | `attach_to_pr`, or `local_only` for sensitive data | `attach_to_pr` |
| `digest.issue` | number of the issue where the daily digest is posted as a comment | none |
| `language` | language of the hand-off messages (`en`, `es`) | `en` |
| `trust` | `private-team` or `public` | `private-team` |
| `labels` | rename any label; the keys are fixed, the names are yours | `relevo:ready`, `relevo:built`, … |
