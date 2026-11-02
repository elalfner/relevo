# Tasks

## 1. Spikes that decide how the settings and limits are applied

- [ ] 1.1 Spike S1: find out whether the effort of a subagent can be given when it is launched, or only in the frontmatter of its agent file, by launching a subagent both ways in a throwaway session and reading what the runtime reports it used. Record the answer in `design.md` under D11 with the version of the tool. Verify by the recorded note.
- [ ] 1.2 Spike S2: find out whether Antigravity lets a subagent be launched with a model or an effort, by reading its documentation for the installed version and trying it. Record the answer under D11 and in `docs/pilot-findings.md`. Verify by the recorded note.
- [x] 1.3 Spike S3: find out whether the turn and cost limits of a Claude run count the turns and cost of a subagent, by running a session with a low turn limit that launches a subagent and reading the totals the run reports. Record the answer under D17. Verify by the recorded note; it decides whether task 9.1 is needed.
- [x] 1.4 Spike S4 (hand-built stream, not recorded: see design D17): replay an event stream with subagent responses through the run guard for Antigravity and check whether its token total includes them. Record the answer under D17. Verify by a test that holds the recorded stream and the expected totals.

## 2. The validation gate

- [x] 2.1 Add `scripts/lib/validation-gate.mjs` and `scripts/validation-gate.mjs`: make the new files visible to the diff (reuse `intent-to-add.mjs`), compute the hash of the diff against the base branch excluding the generated files of the profile, run `analyze` and `test` from the folder of the platform, run `scan-diff.mjs` and `restricted-check.mjs`, and print `green`, `red` or `could-not-run` with the exit codes 0, 1 and 2 (3 for bad arguments). Verify with `tests/validation-gate.test.mjs` on throwaway repositories: green, a failing test, a missing tool, and generated files left out of the hash.
- [x] 2.2 The receipt: write the hash, the base commit, each command with its exit code, duration and capped output tail, and the status, into a local folder that git ignores, created the way the fetcher's folder is. Verify with tests that the receipt has those fields and that it is not in the diff or in a commit.
- [x] 2.3 Add `scripts/receipt-check.mjs`: recompute the hash of the current diff and exit non-zero when it differs from the receipt's or the status is not `green`. Verify with tests for a matching receipt, a changed diff and a red receipt.
- [x] 2.4 Make the cap of the output tail and its truncation marker explicit and test them with a very long output.
- [x] 2.5 `docs/execution.md` and `docs/execution.es.md`: what the gate runs, the receipt and where it lives. Verify with `node --test tests/docs-claims.test.mjs`.

## 3. The lens agents

- [x] 3.1 Write `agents/qa-spec.md` for the scope of the `spec` lens in the design (scenarios and tests, tasks, project rules, scope and folder, configuration files and dependencies, documentation text, decisions and constraints), with the shared preamble, the output contract (first line, numbered findings, class, evidence) and the heading "Left for on-device review". Verify with `tests/agents.test.mjs`.
- [x] 3.2 Write `agents/qa-security.md`: the generic categories of the design, the evidence rule, and the reading of the security sections of the profile. Verify with `tests/agents.test.mjs`.
- [x] 3.3 Write `agents/qa-code.md`: reading the receipt instead of running the checks, what the profile lists for the stack, leftovers, the judgement of the tests that were written, and the review of a script that reviews the built change. Verify with `tests/agents.test.mjs`, including that it never runs the analysis or the tests.
- [x] 3.4 Write `agents/qa-interface.md`: the interface rules that the change touches, the design references, a mobile sketch as an image reference, and what only a person can see. Verify with `tests/agents.test.mjs`.
- [x] 3.5 Add to `tests/agents.test.mjs` the test that the shared sections (untrusted content, OpenSpec commands, output contract, evidence rule) are identical in the four files, that each is read-only, and that each part of the old QA protocol has exactly one owner among them, using the table of the design as the data of the test.

## 4. Planning, aggregating and reporting

- [x] 4.1 Add `scripts/lib/lens-plan.mjs` and `scripts/lens-plan.mjs`: decide which lenses are active (the interface lens only with an interface and at least one rule beyond the always-on ones, using the selection of the interface knowledge when it exists and treating it as inactive when it does not) and record a skipped lens with its reason. Verify with `tests/lens-plan.test.mjs` for each scenario of the `qa-lenses` spec.
- [x] 4.2 Add `scripts/lib/qa-aggregate.mjs` and `scripts/qa-aggregate.mjs`: read one report per lens, check the first line, collect findings with their class (`fixable` when absent) and the lists for the device, apply the blocking set and the attempt number (the last attempt is `qa.retries + 1`; the interface lens advises on it and always when `qa.retries` is 0), and print the result as JSON with the advisory notes. A report without a valid first line exits with a code that asks for it again once, and a second invalid report ends with the reason "lens report invalid". Verify with `tests/qa-aggregate.test.mjs` for each scenario.
- [x] 4.3 `scripts/render-message.mjs`: the built message says how many advisory notes there are and names the lens of the first three, in English and Spanish, and carries all of them in a hidden marker `relevo:qa-notes`; a build without notes is unchanged. Verify with `tests/messages.test.mjs`.
- [x] 4.4 `scripts/review-brief.mjs` and the checklist of `review`: read the marker and add one checklist line per note, marked as pending after the retries and naming the lens. Verify with the brief tests, with and without notes.

## 5. The knowledge of each lens

- [x] 5.1 `scripts/stack-profile.mjs` and its library: the option `--lens spec|security|code|interface` that prints only the sections that lens reads, the sections `Security for the developer` and `Security review`, nothing for `spec`, and the whole body for `dev` as before. Verify with the profile tests for each scenario of the `platforms` spec.
- [x] 5.2 Write the sections `Security for the developer` and `Security review` of `stacks/supabase.md` (access policies on tables, exposure of service keys, functions that run with elevated rights, storage policies), each item with its source and the date it was read from the official documentation. Verify with the profile test that each item has a source and a date.
- [x] 5.3 The same for `stacks/laravel.md` (mass assignment, authorization policies, raw queries, unescaped output, uploads, request forgery protection). Verify as in 5.2.
- [x] 5.4 The same for `stacks/vue.md` (unescaped HTML, where tokens are stored, redirect targets, messages between windows, third-party scripts). Verify as in 5.2.
- [x] 5.5 The same for `stacks/flutter.md` (where tokens are stored, cleartext traffic, logging, platform channels, deep links). Verify as in 5.2.
- [x] 5.6 Test that a profile of the repository adds to these sections and removes nothing, and that a stack without them still resolves for every lens.
- [x] 5.7 `docs/stacks.md` and `docs/stacks.es.md`: the new sections and how a repository adds to them. Verify with `node --test tests/docs-claims.test.mjs`.

## 6. The shared procedure and the developer agent

- [x] 6.1 Write `skills/go/references/qa-run.md`: the gate, the plan of lenses, launching each lens one at a time with its model, the aggregation, the attempt accounting (a red gate uses an attempt), the retry with the previous report of each lens, the advisory notes and the failure paths. Verify with `tests/skill-go.test.mjs` (the reference exists and names each step).
- [x] 6.2 `skills/go/SKILL.md` step 5: read the reference instead of launching `relevo:qa`, announce the QA phase when the gate starts, and keep the failure paths. Verify with `tests/skill-go.test.mjs`.
- [x] 6.3 `skills/fix/SKILL.md`: the same procedure on the iteration's diff. `skills/review/SKILL.md`: the same procedure after the synchronisation, and the checklist with the notes. Verify with `tests/skill-fix.test.mjs` and `tests/skill-review.test.mjs`.
- [x] 6.4 `agents/dev.md`: receive the build faces (the hygiene and the security for the developer, the interface rules, the issue's decisions) and the output of a red gate in fix mode. Verify with `tests/agents.test.mjs`.
- [x] 6.5 Replace every remaining use of `relevo:qa`: `scripts/web-review.mjs` (its message names the `code` lens), `scripts/lib/next-step.mjs`, `scripts/fix-state.mjs` and the skills, and delete `agents/qa.md`. Verify with a search that finds no `relevo:qa` and with the whole test suite.
- [x] 6.6 `docs/guide.md` and `docs/guide.es.md`: which lens or the gate can reject and what each means, the advisory notes and how they reach the review. Verify with `node --test tests/docs-claims.test.mjs`.

## 7. The settings

- [x] 7.1 `scripts/lib/config.mjs`: the keys `agents.dev.*` and `agents.qa.<lens>.*` with the validation of the spec (a non-empty model, an effort from the list, an unknown lens or effort fails, no keys is valid) and the defaults. Verify with `tests/config.test.mjs` for each scenario of the `configuration` and `agent-settings` specs.
- [x] 7.2 Add the level of validation that warns without failing, mark the agent settings as not applied with Antigravity, and print the warnings from `scripts/validate-config.mjs`. Verify with the config tests: Antigravity warns and passes, a rejected key still fails.
- [ ] 7.3 Give the model of the role when `go`, `fix` and `review` launch an agent, and the effort in the way that task 1.1 found. Verify with the skill tests.
- [ ] 7.4 `scripts/doctor.mjs` and `scripts/init.mjs`: warn about the settings that the agent does not apply, say where the effort is not applied, check that the lens agents exist and that profiles resolve for each lens, and report a file that still names `relevo:qa`. Verify with `tests/doctor.test.mjs`, `tests/init.test.mjs` and `tests/skill-init-doctor.test.mjs` for each scenario of the `init-doctor` spec.
- [x] 7.5 `templates/relevo.yml`: the keys commented out with the defaults. Verify with the test that validates the shipped file.
- [x] 7.6 `docs/configuration.md` and `docs/configuration.es.md`: the keys, the defaults, the cost of the defaults and how to restore the previous cost. Verify with `node --test tests/docs-claims.test.mjs`.

## 8. The other tools

- [x] 8.1 `scripts/lib/adapters/antigravity.mjs` and `scripts/lib/adapters/tools.mjs`: render the four lens agents with the names of the spec and read-only tool lists, and extend the rewrite of agent names, which today stops at a hyphen. Verify with `tests/adapter-antigravity.test.mjs`: valid names, no `relevo:qa-` token, and the test that every agent file of the plugin renders to a valid name.
- [x] 8.2 Extend the rewritten paragraph about waiting for subagents so that the lenses are called one at a time. Verify with the adapter test.
- [ ] 8.3 `scripts/lib/agent-guard.mjs`: apply the result of task 1.4 so that the token limit counts the subagents. Verify with the replayed stream of that task.
- [x] 8.4 `docs/security.md` and `docs/security.es.md`: for each agent, which of these controls hold, which hold in part and which do not exist, including the settings not applied with Antigravity and that the receipt is not a boundary. Verify with `node --test tests/docs-claims.test.mjs`.

## 9. The limits of a run

- [x] 9.1 If task 1.3 found that the runtime does not count the turns or the cost of a subagent, add the accounting from the log of the run in `scripts/lib/run-usage.mjs` and apply `limits.run_max_turns` and `limits.run_max_cost` to the total; if it counts them, record that and add a test that documents it. Verify with the usage tests and a run that exceeds a low limit with lenses.

## 10. The evaluation

- [x] 10.1 Create `tests/fixtures/lens-defects/<lens>/<stack>/<case>/` with a bad and a good variant for each defect of the design: a state update after an asynchronous gap without a check, unescaped output of user input, a table without an access policy, a hard-coded secret, a scenario with no code, a task checked off without implementation, a broken decision, an altered line of documentation, and the interface defects of the change `interface-decisions-upfront`. Verify with a test that every case has both variants and states the expected finding.
- [x] 10.2 Add `scripts/eval-lenses.mjs`: opt-in, prints an estimate of the cost and asks before it spends anything, runs each lens on each case, reports per lens the defects found, the good variants flagged and the cost, runs without a given rule or with a given skill, and writes a dated report. Verify with a test that `npm test` never runs it and with a dry run that uses a stub in place of the model.
- [ ] 10.3 Run the evaluation once with the maintainer's approval of the cost, write the result in `docs/lens-evaluation.md` and `docs/lens-evaluation.es.md`, set the thresholds with the maintainer, and keep or change each default on that evidence. Verify with the docs tests and with the defaults of the configuration page.

## 11. Integration checks

- [x] 11.1 Run `npm test` and `openspec validate --all`, the two steps of the CI, and confirm both pass.
- [ ] 11.2 Run a local build (`go-local.mjs`) on a throwaway repository with a failing test, then with a change that breaks a decision of its issue, then with an injection defect, then with an interface defect on the last attempt. Each must end as the specs say: a red gate that returns to the developer agent without any lens, a `spec` rejection, a `security` rejection, and a passed build whose hand-off carries the advisory note, which the review checklist then lists.
- [x] 11.3 Render the plugin for Antigravity and confirm that the lens agents have valid names and read-only tools, that the settings produce the warning, and that `doctor` reports nothing else.
- [x] 11.4 Search every file of this change and the new documentation and fixtures for the name of any real project, organisation or customer that was used as an example during the exploration, and confirm that none appears.

## Workflow follow-up

- Launching the lenses in parallel is the change `parallel-review-lenses`. It starts only after the spikes of group 1 and these two: that several subagents in one turn behave correctly under the rule that an unattended session waits for each report, and how an Antigravity fan-out reports and how the aggregation waits for every lens.
- Archive this change after `interface-decisions-upfront` and `build-preflight-gates` on `dev`. Then reconcile the main spec `agent-adapters`: its scenario "Rendering for Antigravity" still names the agents `relevo-dev` and `relevo-qa`, and the change `interface-decisions-upfront` edits the same requirement.
- At release time, raise the version in `.claude-plugin/plugin.json` and `package.json` and add the entry to `CHANGELOG.md` on `dev` first, as `CLAUDE.md` says, with the note that two lenses use the stronger model by default and how to keep the previous cost, then promote `dev` to `main` and tag.
- Archive the change on `dev` with `/opsx:archive` once merged; the new capabilities `qa-lenses`, `validation-gate` and `agent-settings` are created and the main specs `go`, `fix`, `review`, `issue-lifecycle`, `configuration`, `platforms`, `role-skills`, `agent-adapters`, `init-doctor`, `security` and `documentation` receive the added and modified requirements.
