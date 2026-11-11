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
| `branches.base` | integration branch: every build branch starts from it and its pull request targets it, whatever the default branch of the repository is | `dev` |
| `branches.release` | release branch, promoted from the base in a separate pull request | `main` |
| `links` | repositories an issue may depend on with `Depends-on: owner/repo#N`, or point to with `owner/repo:path` in `Design reference` and `Code pointers` (a closed list); a private one is read with the secret `RELEVO_LINKS_TOKEN`, a fine-grained token with read access to issues, pull requests and contents | none |
| `tracker`, `git_provider`, `platforms` | where the issues and pull requests live, and the platforms that are built ([Stacks and platforms](stacks.md)); the older `platform: flutter-android` still works | `github`, `github`, one Flutter platform for Android |
| `team.members` | GitHub usernames of the people who build and review | empty |
| `team.spec_writer` | who writes the specs; never reviews or merges | none |
| `team.approvers` | who may approve, only used when `review.mode` is `roles` | empty |
| `review.mode` | `none` (solo), `peer` or `roles` | `peer` |
| `review.merger` | who runs `/relevo:ship`: `author` or `approver` | `approver` |
| `review.autopilot` | how much of the review the agent may drive: `off` (the person does everything), `precheck` (the agent walks the lines and records its result; the person confirms every line) or `verify` (the agent may also mark lines it proved with an assertion, a semantic finder, the log or the exit code of a project command; the person confirms the rest and agrees). A web target needs `precheck` or `verify`, and the review recommends `verify`; commit the setting to the base branch | `off` |
| `review.ship_without_ci` | `true` lets the `relevo:ship` label merge a pull request on which no check ran; `/relevo:ship` asks the person instead | `false` |
| `review.allowed_origins` | web origins a driven review may visit besides `localhost`, for example `https://staging.example.com` | `[]` |
| `restricted_paths` | paths or globs, relative to the repository, that no agent or script of Relevo reads, added to the built-in list (`.env` and `.env.*` except the example files (`.env.example`, `.env.sample`, `.env.template`, `.env.dist`), private keys and certificates, credential files such as `.npmrc` and `.netrc`, mobile service configuration, `secrets/`). It only adds: it cannot remove a built-in entry, a profile cannot weaken it, and an absolute path or one that leaves the repository is rejected ([Security](security.md)) | `[]` |
| `skills.allow_scripts` | names of the extra skills that have scripts and may be used; a skill with scripts that is not listed is left out, and `/relevo:doctor` says so | empty |
| `limits.built_unreviewed_per_person` | built issues one person may have waiting; an issue with a valid `relevo:urgent` label starts anyway | 2 |
| `limits.concurrent_agents` | unattended runs at the same time | 3 |
| `limits.review_sla_hours` | hours before a reminder, and the same time again before escalation | 8 |
| `limits.run_max_turns` | turns per unattended run: the runner limits the main agent, and Relevo limits the subagents together to the same number | 100 |
| `limits.run_max_minutes` | minutes after which an unattended run starts no further agent (at least 5). Keep it at least 5 below the `timeout-minutes` of the build job of the go workflow, which is 60 | 50 |
| `limits.building_alert_hours` | hours without activity before an issue on `building` is reported as stuck ([Where `go` runs](execution.md)) | 3 |
| `limits.run_max_cost` | **required** with `agent.build: claude` (the default), and refused with `antigravity`: US dollars per unattended run; choose your own | 5 |
| `limits.run_max_tokens` | **required** with `agent.build: antigravity`, and refused with `claude`: tokens per unattended run, which Relevo's run guard enforces because Antigravity has no limit of its own | none |
| `runner.labels` | runner of every Relevo workflow, as a list of labels (`[self-hosted, linux-build]`); `/relevo:init` writes it into the workflow files and `/relevo:doctor` checks that they agree. Relevo assumes any runner persists between jobs, so there is no setting for that ([Self-hosted runners](execution.md#self-hosted-runners)) | `[ubuntu-latest]` |
| `agent.build` | which agent builds in the cloud: `claude`, or `antigravity` (what each can and cannot enforce is in [Security](security.md)) | `claude` |
| `qa.retries` | developer attempts after QA rejects | 1 |
| `agents.dev.model`, `agents.dev.effort` | model (an alias such as `sonnet` or a full identifier) and effort (`low`, `medium`, `high`, `xhigh`, `max`) of the developer agent | `sonnet`, `high` |
| `agents.qa.<lens>.model`, `agents.qa.<lens>.effort` | the same for each QA reviewer: `spec`, `security`, `code` or `interface`. An unknown lens fails; there is no key to turn one off | `spec` and `security`: `opus`, `high`; `code`: `sonnet`, `high`; `interface`: `sonnet`, `medium` |
| `qa.rules_from` | project rules QA reads at every run: one file or a list | `CLAUDE.md` |
| `evidence.policy` | `attach_to_pr`, or `local_only` for sensitive data | `attach_to_pr` |
| `digest.issue` | number of the issue where the daily digest is posted as a comment | none |
| `language` | language of the hand-off messages (`en`, `es`) | `en` |
| `design.images` | `true` downloads a picture pasted into an issue and shows it to the model (a screenshot can show customer data); files already in the repository do not depend on it | `false` |
| `design.system.tokens` | Files or folders inside the repository that hold the colours, spacing and type styles (a theme file, a CSS file of variables). The interface step of `think` reads only these paths, or the ones you confirm. Each must exist and be neither restricted nor protected | `[]` |
| `design.system.components` | Folders with the reusable components that a new screen should use | `[]` |
| `design.system.references` | Folders inside the repository with screenshots or sketches to look at | `[]` |
| `trust` | `private-team` or `public` | `private-team` |
| `labels` | rename any label; the keys are fixed, the names are yours | `relevo:ready`, `relevo:built`, … |

## Platforms, profiles and checks

- Each entry of `platforms` has a `stack`, a `path` and, for stacks that have them, `targets`. [Stacks and platforms](stacks.md) explains the shipped profiles.
- The profile of a stack comes in layers: the file `stacks/<stack>.md` of the plugin, then `.relevo/stacks/<stack>.md` of your repository. Yours adds hygiene text, tools, skills and commands the plugin does not have; it cannot replace a command of the plugin. Commit it, because the cloud and your teammates read it from git.
- To replace a command, write it in `platforms.<name>.checks`, in the open, for example `analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse"`. Only the commands the profile names (`analyze`, `test`, `format`) can be replaced.

## The model and the effort of each agent

QA is made of four reviewers (see [What each QA reviewer reads of a profile](stacks.md#what-each-qa-reviewer-reads-of-a-profile)), and the developer agent and each reviewer have their own `model` and `effort` under `agents`. Set only what you want to change; everything else keeps its default.

```yaml
agents:
  qa:
    security: { model: sonnet }   # the reviewer of security with the model it would otherwise not use
```

- **The keys**, spelled out: `agents.dev.model`, `agents.dev.effort`, `agents.qa.spec.model`, `agents.qa.spec.effort`, `agents.qa.security.model`, `agents.qa.security.effort`, `agents.qa.code.model`, `agents.qa.code.effort`, `agents.qa.interface.model`, `agents.qa.interface.effort`.
- **The cost of the defaults.** `spec` and `security` use the stronger model (`opus`) by default, so QA costs more than when it was one agent on `sonnet`. To keep the previous cost, set both to `sonnet`:
  ```yaml
  agents:
    qa:
      spec: { model: sonnet }
      security: { model: sonnet }
  ```
  The defaults change only on the evidence of an evaluation of the reviewers on seeded defects.
- **A model is a name, not a list.** Write an alias or a full identifier; Relevo does not check it against a list because the list changes, and the runtime refuses one it does not know.
- **No setting turns a reviewer off or lowers what it blocks.** A project's exceptions go in its own rules file (`qa.rules_from`), which the `spec` reviewer already reads. Every rule of that file is a requirement unless its line (or the heading above it) is marked `[advice]`; a finding that cites a requirement as `Rule: <file>:<line> "<its words>"` blocks, whichever reviewer wrote it.
- **With Antigravity** the settings are accepted and are not applied: they are not written to the agents it renders. `/relevo:doctor` and `/relevo:init` print a warning that names each one and go on.

### Choosing the model for each issue: `auto`

A role can be `auto` instead of a model name. A script (`scripts/model-plan.mjs`, which `go` runs once before the first launch) then picks its model from the issue, between a floor and a ceiling; nothing is decided by the main agent.

```yaml
agents:
  ladder: [haiku, sonnet, opus]     # the order of the models, lowest to highest (this is the default)
  dev:
    model: auto
    ceiling: sonnet                  # optional: the highest model auto may use for this role
    floor: haiku                     # optional: the lowest model it may pick by size
  qa:
    spec:
      model: auto
```

- **The ladder** is only an order. Relevo does not check the names against a list of models; a new model is a new line in `agents.ladder`.
- **The range.** Without `ceiling` it is the default model of the role (developer `sonnet`, spec and security `opus`, code and interface `sonnet`), and without `floor` it is one step below. A QA lens is never below `sonnet` by default (the lens evaluation did not pass `haiku` for `code` and `interface`, `docs/lens-evaluation.md`); write a `floor` to go lower. So `auto` cannot cost more than the defaults unless you raise a ceiling.
- **The score.** The size of the change (pending tasks plus scenarios of the issue: up to 6 takes the floor, up to 14 the middle, more the ceiling), raised one step when the issue allows a dependency file in `Allow-paths:` or names a security-sensitive area (authentication, credential, token, password, payment, permission, secret, encryption). The security lens goes to its ceiling in both cases. With no tasks and no scenarios to score, the default model of the role is used. The effort is not scored: it stays the configured one.
- **The issue can ask.** A line `Model: <name>` (developer) or `QA-model: <name>` (every lens) is read only for a role on `auto`. It can lower the model freely and raise it only up to the ceiling; a name that is not in the ladder is ignored, and with `trust: public` the lines are ignored. The lines are part of the text of the issue, so the hash of the issue covers them. `/relevo:issue` may propose one, with its reason, and writes it only if you confirm.
- **A role that is not `auto`** keeps the model written, whatever the issue says. `limits.run_max_cost` stays the hard stop in every case.
- **The comment says what was used.** The usage comment of a run lists, for each role, the model, the effort, whether it came from the configuration, from `auto` or from the issue, and why. If the plan cannot be made, `go` uses the configuration and says so.
- **A retry goes one level up.** When the gate is red or QA rejects the work and the developer runs again in fix mode, a developer on `auto` goes one name up `agents.ladder` (`haiku` to `sonnet`, then `opus`) and never past its `ceiling`. A developer whose model is written in `relevo.yml` stays on it, and the lenses are not raised. With the default ceiling (`sonnet`) a retry never costs more than the defaults; raise `agents.dev.ceiling` to allow a retry on `opus`. The comment says each step.

## What the limits mean

- `limits.run_max_cost` is required and you choose it. With an API key it is a real ceiling on spending per run. With a subscription token the cost the log reports is notional, so it is only a safety net against a runaway run.
- With `agent.build: antigravity` there is no cost limit to set, because the agent has none: `limits.run_max_tokens` is the limit, and the quota and budget of the Google Cloud project that owns the key are the ceiling that really holds. `trust: public` is not accepted with it yet.
- `limits.run_max_turns` is the main control with a subscription, together with a low `limits.concurrent_agents`: the quota is shared by every run and by the interactive use of the account.
- **Two caps for turns, not a sum.** The runner counts only the turns of the main agent against `--max-turns`. Relevo counts the subagents itself: when each one finishes, `go` records its tool calls from the usage block that ends its report (its turns are the calls plus one), and before it launches the next agent (the developer again, or the next QA lens) it asks `run-budget.mjs`. When the turns of the subagents together reach `limits.run_max_turns`, or the run has lasted `limits.run_max_minutes`, no other agent starts and the run takes the failure path with the reason `run limit reached`, naming the agents that did not run. The guard stops a run only on a figure it can read; one agent that is already running is not stopped in the middle. The comment about the run still says when the total of turns went past the limit.
- **The work is not lost at a limit.** When `go` stops at a limit it commits the work as `wip: stopped by limit (#N)` and pushes it to the branch of the issue, and `/relevo:fix` continues from it. When the runner cuts the agent (the turn or cost limit of the runner) or the job is cancelled or times out, a step of the go workflow that always runs does the same for the working tree that is left, through the same scans as any commit (protected paths, restricted files, markers, credentials); it never forces a push and overwrites nothing: it pushes only a fast-forward of what the remote has, and leaves alone a remote branch with commits this run does not have.
- A run that reaches a turn, minute or cost limit stops and the issue becomes `qa-failed` with the reason, and the comment says whether the work was kept. [Where `go` runs](execution.md) has the rest.
