# QA: the gate, the lenses and the retry

`go`, `fix` and `review` read this file and follow it, so that QA behaves the same in the three. QA is no longer one agent: a script runs the checks that need no judgement (the **gate**), and four read-only reviewers (the **lenses**: `spec`, `security`, `code` and `interface`) each review what they own. A script decides the result.

You are given by the skill that sent you here: the change folder `openspec/changes/<change_id>/`, `<issue_file>` (the saved body of the issue), the base branch `<base>`, the platform and its folder `<path>`, the rules files (`qa.rules_from`), `allow_paths`, the number of retries `<qa_retries>`, and the files the developer agent reported. All reports and plans are saved in the scratch folder of the run, never in the repository.

**The attempts.** The total number of developer attempts is `<qa_retries> + 1`, and `<n>` is the number of the attempt you are on (1 the first time). A red gate uses an attempt, exactly as a rejection by the lenses does, so the total never grows. The **last attempt** is the one numbered `<qa_retries> + 1`.

## 1. Make the new files visible and run the gate

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/intent-to-add.mjs <files the developer reported>
node ${CLAUDE_PLUGIN_ROOT}/scripts/validation-gate.mjs --base origin/<base> --platform <platform> --files <the same files, comma separated>
```

Announce the phase `qa` with the attempt, as the skill says, when the gate starts. No agent runs the gate. It runs `analyze` and `test` of the profile from the folder of the platform, the scan for temporary markers and credentials and the check for restricted files, and writes a receipt tied to the exact diff. Its first line is `green`, `red` or `could-not-run`:

- **`could-not-run`** (exit 2): a tool the profile needs is missing, and the developer agent cannot install one. Do not retry. Take the failure path with the reason `automated validation could not run`, naming what the gate printed as missing.
- **`red`** (exit 1): do not launch any lens. If this is not the last attempt, raise the developer for the retry (see "The model of a retry" below) and launch `relevo:dev` in **fix** mode with that model, giving it the end of the output of what failed: `.relevo-receipt/receipt.json` holds, for each command, its exit code and the capped tail of its output; give it that, not a summary of your own. This used an attempt: go back to step 1 with `<n> + 1`. On the last attempt take the failure path with the reason `automated validation failed after the retries` and the tail of the failing command as the first finding.
- **`green`** (exit 0): go on.

## 2. Plan the lenses

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/lens-plan.mjs --platform <platform> --text-file <issue_file> > <plan.json>
```

`spec`, `security` and `code` are always active. `interface` is active only when the stack of the platform has an interface and the change matches at least one interface rule beyond the always-on ones; otherwise the script records it as `SKIPPED` with the reason, and you launch no agent for it. Every active lens reviews the change in every round, so that the developer agent receives all the findings at once.

## 3. Launch each active lens, one at a time, in the foreground

Before each lens, check the budget of the run (the section "The budget of the run" of the skill): `node ${CLAUDE_PLUGIN_ROOT}/scripts/run-budget.mjs check --max-turns <run_max_turns> --max-minutes <run_max_minutes>`. If it exits 1, launch no lens and take the failure path with the reason `run limit reached`, naming this lens and the ones after it as the agents that did not run.

Once per round, before the first lens, list the files that are still as the install step of the job left them (a lockfile, `analysis_options.yaml`): `node ${CLAUDE_PLUGIN_ROOT}/scripts/tree-baseline.mjs list`. It prints one path per line, and nothing in a local run. These files are not part of the change: give the list to every lens as `not_the_change`, so that it leaves them out of the diff it reads and reports no finding about them. A file the developer changed after the install is not in the list.

For each active lens, in the order `spec`, `security`, `code`, `interface`:

1. **Check the receipt first:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/receipt-check.mjs`. If it exits 1 the diff changed since the gate ran (or the receipt is not green): run step 1 again before this lens. A lens never starts on a diff whose checks did not run.
2. Record that the lens starts: `node ${CLAUDE_PLUGIN_ROOT}/scripts/progress.mjs lens <lens> --attempt <n>`. It changes no phase and only feeds the seconds of each lens in the usage record. Then launch the agent `relevo:qa-<lens>` in the foreground, giving the **model** and the **effort** that the model plan gives it when you launch it (`qa.<lens>` in the output of `model-plan.mjs`, made once by `go` before the first launch; when there is no plan, `agents.qa.<lens>` in the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs --effective`, and for a role on `auto` the default model of the role): pass them as the `model` and `effort` parameters of the Agent tool. The effort given at launch is applied (measured in spike S1 of the design). Never start two together, and never end your turn while one is running.
3. Give it only what it reads, and with it the `not_the_change` list when it is not empty:
   - `spec`: the change folder, `<issue_file>`, the base branch, the rules files, the folder of the platform and `allow_paths`. It is given no stack section.
   - `security`: the change folder, the base branch, the folder of the platform and the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/stack-profile.mjs --platform <platform> --lens security`.
   - `code`: the change folder, the base branch, the folder of the platform, the receipt (`.relevo-receipt/receipt.json`), the output of `stack-profile.mjs --platform <platform> --lens code`, the skill paths for `qa`, and the review script when there is one. It never runs the analysis or the tests: it reads the receipt.
   - `interface`: the change folder, `<issue_file>`, the base branch, the folder of the platform, `.relevo-design/manifest.json` when the issue has design references, and the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/interface-rules.mjs --role qa --platform <platform> --text-file <issue_file>` with the count of rules it left out.
   - On a retry, also the previous report of that lens and the files the developer changed since, so that it checks each earlier finding and reviews only what changed.
4. Save its answer in a file, one per lens. The first line is `QA PASSED` or `QA REJECTED`.
5. Record what the lens used: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run-budget.mjs record --agent relevo:qa-<lens> --tool-uses <n> --duration-ms <n> --tokens <n>`, with the numbers of the `<usage>` block that ends its report.

## 4. Aggregate

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qa-aggregate.mjs --plan <plan.json> --attempt <n> --retries <qa_retries> --report spec=<file> --report security=<file> --report code=<file> [--report interface=<file>]
```

It prints JSON and decides: `spec`, `security` and `code` always block, and `interface` blocks on every attempt except the last, where its findings become advisory notes (and always when `qa_retries` is 0). Any blocking rejection makes the result `QA REJECTED`. Its exit code:

- **0, `QA PASSED`**: go to step 6.
- **1, `QA REJECTED`**: go to step 5.
- **4**: a report has no valid first line. Ask that lens again, once, saying only that its first line must be exactly `QA PASSED` or `QA REJECTED`, save the new report, and run this step again with `--reasked <lens>`.
- **5**: a second invalid report. Take the failure path with the reason `lens report invalid`. Do not retry the developer agent.

## 5. A rejection

If `all_non_fixable` is `true`, every blocking finding needs something that the developer agent cannot supply (an input the issue depends on, a decision of the specification, or something an unattended run may not do), so a retry cannot succeed: **do not retry**. Take the failure path with the reason `QA rejected: nothing the developer agent can fix`, with `finding_class` set to `first_non_fixable_class` and `retries_skipped` set to `true`. A finding with no class, or an unknown one, counts as `fixable`.

Otherwise, if `<n>` is below `<qa_retries> + 1`: check the budget (`run-budget.mjs check`, as in step 3) and, if it exits 1, take the failure path with the reason `run limit reached` instead of retrying; if not, announce `phase development --attempt <n> --of <qa_retries>`, raise the developer for the retry (see "The model of a retry" below) and launch `relevo:dev` in **fix** mode with that model, giving it the complete reports of all the lenses that rejected, together, run `intent-to-add.mjs` on the files of its new report, and go back to step 1 with `<n> + 1`, announcing `phase qa --attempt <n + 1> --of <qa_retries + 1>`.

If it was the last attempt, take the failure path with the reason `QA rejected after the retries` and the first finding of the aggregation; when `first_non_fixable_class` is not null, pass it as `finding_class` (and no `retries_skipped`).

## 6. A pass, and the notes

The `advisory` list of the output holds the findings of the `interface` lens on the last attempt and the scenarios that only a person on a device can confirm. When it is not empty, the hand-off carries it: pass it to `render-message.mjs built` as `qa_notes` (a list of `{ lens, text }`). The message shows how many there are and names the lens of the first three, and a hidden marker `relevo:qa-notes` carries all of them so that `review` lists each one in its checklist, pending after the retries and naming its lens. Write no file in the repository for them.

## What this guards

The receipt guards against an omission or a mistake: a lens cannot start on code whose checks did not run. It is not a defence against an agent that writes a false file; the guards of the commit (the protected paths, the restricted files, the scan) remain the enforcement.

## The model of a retry

Before each launch of `relevo:dev` in **fix** mode, ask a script for its model; do not choose it yourself:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/model-plan.mjs escalate --from <the model the developer ran with last time> --attempt <the number of the attempt that starts> --reason <gate-red | qa-rejected>
```

It prints `{ model, escalated, why }`. Launch the developer with `model`, and keep the effort of the plan. A developer on `auto` goes one name up `agents.ladder` on each retry and never past its `ceiling`; a developer whose model is set in `relevo.yml` stays where it is (`escalated` is `false`). The lenses keep the model of the plan. When the command prints anything else, launch with the model of the last attempt. `<the model the developer ran with last time>` is `dev.model` of the plan the first time and the `model` that this command printed afterwards. The cost limits are checked as for any launch, so a stronger model never raises them.
