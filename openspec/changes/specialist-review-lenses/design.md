# Design

## Context

See `proposal.md` for the motivation. What exists today and shapes the approach:

- `agents/qa.md` is one read-only agent, whose first line is `QA PASSED` or `QA REJECTED`, with a protocol of nine parts: automated validation, scenarios, task integrity, project rules, the diff (platform, configuration, leftovers, secrets, scope), documentation, decisions and constraints from the issue, a review script, and design references. It runs the analysis and the tests itself. `agents/dev.md` is a separate agent with a fix mode. Both fix `model` and `effort` in their frontmatter (`sonnet`, `high`).
- `go`, `fix` and `review` all launch `relevo:qa`; `go` and `fix` retry with `qa.retries`. A retry gives QA its previous report and the files the developer changed.
- A stack profile has sections for the issue writer, the developer ("Hygiene for the developer") and the auditor ("What the auditor looks for in the diff"), and `skills:` per role (`dev`, `qa`, `issue`, `review`). `stack-profile.mjs` resolves it and `go` hands it to the agents.
- A QA hand-off lists "left for on-device review", and `review` builds its checklist and brief from the hand-off and the specification (`review-brief.mjs`). The hidden `relevo:usage` comment is the model for a machine-readable marker.
- The run flags (`run-flags.mjs`) give the closed list of tools, which allows the subagent tool as a whole, and the turn and cost limits. With Antigravity the limit is `run_max_tokens`, enforced by a guard of Relevo (`agent-guard.mjs`) that counts the turns of the main agent and of its subagents, and the renderer writes agents with only a name, a description and tools, and rewrites `relevo:dev` and `relevo:qa` to `relevo-dev` and `relevo-qa`.
- Configuration validation rejects a key that does not apply to the agent in use (`rejectedFor`). It has no level that only warns.
- Antigravity subagents do not block: the call returns at once and the report arrives later as a message. The skill `go` is rewritten for that by the renderer.

## Goals / Non-Goals

**Goals:**

- Every check that does not need judgement runs once, in a script, and is proven by a receipt.
- Each kind of judgement has its own reviewer with its own knowledge, model and effort.
- The developer agent knows the criteria before QA applies them.
- Nothing is applied silently: settings that cannot apply say so, and every limit counts every subagent.
- Whether the lenses help is measured, and the defaults follow the measurement.

**Non-Goals:**

- Launching lenses in parallel (follow-up change `parallel-review-lenses`).
- The model of `go` itself, which is chosen where the workflow starts the agent.
- Disabling a lens from configuration, or weakening one: a repository states exceptions in its own rules file, as today.
- Anything about who may approve or merge, or about branch protection.

## Decisions

**decided** came out of the exploration with the maintainer. **proposed** is set here and is still to confirm when the design is reviewed.

### D1. Four lenses, and where each part of today's QA goes (decided for the lenses; the mapping is proposed)

| Today's QA part | New owner |
|---|---|
| 1. Automated validation | The gate (D3). The `code` lens reads its receipt |
| 2. Scenarios have code and tests | `spec` |
| 3. Task integrity | `spec` |
| 4. Project rules | `spec`, which checks every rule of the project's rules file |
| 5. Diff: outside the platform folder, configuration files, scope and new dependencies | `spec` |
| 5. Diff: leftovers and temporary markers | `code`, with the scan in the gate |
| 5. Diff: secrets | `security`, with the scan in the gate |
| 6. Documentation from the issue | `spec` |
| 7. Decisions and constraints from the issue | `spec` |
| 8. A review script | `code` |
| 9. Design references | `interface` |
| The profile's "what the auditor looks for" | `code` |
| Interface rules (change `interface-decisions-upfront`) | `interface` |
| Security review of the stack (new) | `security` |

Every part has exactly one owner. A test checks the table against the sections of the lens files so that none is dropped.

### D2. Four agent files with a common preamble that a test keeps identical (proposed)

`agents/qa-spec.md`, `qa-security.md`, `qa-code.md` and `qa-interface.md` replace `qa.md`. They share the sections that must not differ (untrusted content, the OpenSpec commands, the output contract, the evidence rule) and differ in scope and knowledge. Each is read-only (`disallowedTools: Write, Edit, NotebookEdit`) and answers with the same first line. A test fails if the shared sections drift apart. Alternatives: one agent that receives the lens as a parameter (rejected: one tool list, one frontmatter, no per-lens description or model by default); a build step that composes the files (rejected: generated files would be committed or the install would depend on it).

### D3. A mechanical gate with a receipt (decided; names and fields proposed)

`validation-gate.mjs`, run by `go` and never by an agent, after the developer agent finishes and its new files are made visible to the diff:

- computes a hash of the diff against the base branch, excluding generated files;
- runs the `analyze` and `test` commands of the profile from the folder of the platform, the diff scanner and the restricted-file check;
- writes a receipt in a local folder that git ignores, created the way the fetcher's folder is, with the hash, the base commit, each command with its exit code, duration and the tail of its output, and a status of `green`, `red` or `could-not-run`.

Exit codes: 0 green, 1 red, 2 could not run, 3 bad arguments. `receipt-check.mjs` recomputes the hash of the current diff and fails when it differs from the receipt's. `go`, `fix` and `review` run it before every lens and re-run the gate when it fails. A red gate goes to the developer agent in fix mode with the tail of the output (capped), and consumes a developer attempt exactly as a QA rejection does, so the total number of attempts stays `qa.retries + 1`. `could-not-run` ends the run with today's reason, "automated validation could not run", and is not retried, because the developer agent cannot install a tool.

The receipt protects against a mistake or an omission: a lens cannot start on code whose checks did not run. It is not a defence against an agent that writes a false file, and the security page says so (D14).

### D4. The aggregation is a script and it fails closed (decided; details proposed)

`qa-aggregate.mjs` reads one report per lens. It checks the first line, collects the numbered findings with their `Class:` (from change `build-preflight-gates`, `fixable` when absent) and the "left for on-device review" list, and prints a JSON result. The blocking set is `spec`, `security` and `code` on every attempt, plus `interface` while the attempt is not the last (the last attempt is the one numbered `qa.retries + 1`; with `qa.retries: 0` it always advises). The result is `QA REJECTED` when any blocking lens rejects. A report with no valid first line is re-requested once from the same lens, and if it is still invalid the run ends with the reason "lens report invalid" and no developer retry. A lens that is not active is recorded as `SKIPPED` with its reason by the script, not by an agent. Alternatives: an agent as the approver (rejected: the rule is deterministic, and Relevo's other gates are scripts).

### D5. When the interface lens is active (proposed)

The profile's `interface` kinds are not `none`, and the selection of interface rules for the change returns at least one rule beyond the always-on core. Otherwise the lens is skipped with a line that says why. Without the interface knowledge of change `interface-decisions-upfront` the lens never activates.

### D6. Every round runs every active lens (proposed)

The cheaper alternative is to stop at the first rejection. Running all of them gives the developer agent every finding at once, which saves a round, and a round costs a developer run and a gate. The evaluation (D13) decides whether fail-fast should replace it.

### D7. Advisory notes travel in the hand-off and into the checklist (proposed)

When the aggregation passes with advisory content (the `interface` findings of the last attempt, and the scenarios that only a device can show), `go` adds a hidden marker `relevo:qa-notes` with the notes to the hand-off comment, next to the visible lines. The built message shows at most a few and says how many more there are. `review-brief.mjs` reads the marker and adds the notes to the checklist, each marked as pending after the retries and naming its lens, so the person looks at exactly what the reviewers doubted. No file is written to the repository. A local run posts the same comment.

### D8. The knowledge of each lens comes from the profile, by section (proposed)

`stack-profile.mjs --lens spec|security|code|interface` prints only the sections that lens reads, so a lens does not carry the others' context:

| Section | Read by |
|---|---|
| Verification | the gate, `dev` |
| Architecture | `code` |
| Hygiene for the developer | `dev` |
| What the auditor looks for in the diff | `code` |
| Security for the developer (new) | `dev` |
| Security review (new) | `security` |
| Interface rules (from the knowledge, change `interface-decisions-upfront`) | `dev`, `interface` |

`spec` reads no stack section: it compares the code with the specification. A stack without the new sections uses the generic content of the lens agent, so a repository's own stack works from the first day.

### D9. The security lens: a generic core and a section per stack (proposed)

The agent carries the generic categories: injection and unsafe construction of queries or commands, authentication and authorization, secrets and sensitive data in code, logs and errors, unsafe deserialization and evaluation, trust of input that comes from the client, open redirects, and new dependencies the design does not justify. The secret patterns stay in the scanner of the gate; the lens judges context. Each plugin stack gets a section with its typical issues, each with the source and the date read, as the profiles already do: for the Supabase stack access policies on tables and the exposure of service keys, for Laravel mass assignment, authorization policies, raw queries and unescaped output, for Vue unescaped HTML, token storage and redirect targets, and for Flutter the storage of tokens, cleartext traffic, logs and the handling of deep links. The same evidence rule as today applies: a finding needs a line, an output or a quoted scenario, and a speculative one is not a rejection.

### D10. Settings per role, with defaults and a warning tier (decided shape; defaults proposed)

```yaml
agents:
  dev:
    model: sonnet
    effort: high
  qa:
    spec:      { model: opus,   effort: high }
    security:  { model: opus,   effort: high }
    code:      { model: sonnet, effort: high }
    interface: { model: sonnet, effort: medium }
```

The model is a non-empty string, an alias or a full identifier, and is not validated against a list because the list changes; the runtime refuses an unknown one. The effort is one of `low`, `medium`, `high`, `xhigh` and `max`. An unknown lens name is an error. The default of `dev` equals today's, so an upgrade does not change its cost. The defaults of the lenses raise the cost of QA for a project that changes nothing, because two lenses use the stronger model, and the release notes say so. The evaluation may change them before release.

Validation gets a level that warns without blocking, used here for Antigravity: the settings are valid, and `doctor` and `init` print "not applied with this agent" and name the settings. The existing `rejectedFor` keys keep rejecting.

### D11. How the settings are applied (decided that nothing is silent; mechanism pending a spike)

`go` passes the model of the role when it launches the subagent. Whether the effort can be given at launch, or only in the agent's frontmatter, is spike S1. The specification is written to hold either way: the effort is applied where the runtime allows it, and `doctor` says where it is not applied, instead of leaving the setting to look effective. With Antigravity neither is applied (spike S2 checks whether that can change).

### D12. One shared procedure for the three skills (proposed)

The gate, the lenses, the aggregation, the retry and the notes are described once, in a reference file that `go`, `fix` and `review` read, so the three behave the same. Role skills: the existing `qa` role goes to the `code` lens, and new roles `qa-spec`, `qa-security` and `qa-interface` can be listed in a profile. The workflow already allows the subagent tool as a whole (`Task` in its list of allowed tools), not agent by agent, so the lens agents need no change to the allowed tools of a workflow. The review of a script (`web-review.mjs` and the `qa-pass` state of `review-state.mjs`) keeps its meaning with the `code` lens as the one that passes it, and its message names that lens instead of `relevo:qa`.

### D13. An evaluation on seeded defects is the acceptance (decided)

`eval-lenses.mjs` is opt-in, never part of the automatic tests, and prints an estimate of cost before it asks to continue. Fixtures hold, for each lens and stack, a case with a seeded defect and a good variant that must not be flagged: a state update after an asynchronous gap without a check, unescaped output of user input, a table without an access policy, a hard-coded secret, a scenario with no code, a checked task with no implementation, a broken decision, an altered documentation line, and the interface defects of change `interface-decisions-upfront`. The harness reports, per lens, how many defects were found, how many good variants were flagged and the cost, and can run without a given rule or with a given skill to compare. The result is recorded in a dated page of the documentation. The thresholds are set by the maintainer after the first run, and a default (a model, an effort, or the decision to keep a lens) changes only on that evidence.

### D14. What the security page says (proposed)

The lens agents are read-only. The gate and the receipt are safeguards against mistakes, not boundaries. The page on controls says, for each supported agent, which of these hold, which hold in part and which do not exist, as it does for the other controls.

### D15. Antigravity (proposed)

The renderer maps the new agent names (`relevo:qa-spec` and the others do not match the current pattern, which stops at a hyphen, so it is extended), copies the new script and knowledge folders, and in the first version keeps the existing instruction to call one subagent at a time. The settings are warned about, not applied (D10).

### D16. Order and dependencies (proposed)

Change `build-preflight-gates` is expected first and supplies the finding classes and the usage record; change `interface-decisions-upfront` supplies the interface knowledge and the `interface` key. Without them this change still works: classes default to `fixable`, and the interface lens stays inactive.

### D17. Phase two, in a follow-up change, behind three spikes (decided)

The follow-up `parallel-review-lenses` launches the lenses together. It starts only after: S5, several subagents in one turn behave correctly under the rule that an unattended session waits for each report; S3 and S4, the turn, cost and token limits count the subagents; and S6, an Antigravity fan-out reports and the aggregation waits for every lens through a list of expected lenses. S3 and S4 also decide how this change satisfies "every limit counts every subagent": by the runtime when it does, and by Relevo's own accounting from the logs when it does not. S4 is partly answered already: the run guard for Antigravity counts a turn for each response of the main agent or of a subagent, and sums the tokens it reads from the stream, so what remains is to confirm that the token total includes the subagents' own responses. S3, for Claude, is open.

## Risks / Trade-offs

- [More lenses cost more] → the evaluation measures it, the defaults are changed on that evidence, and the gate removes the repeated checks.
- [Two lenses overlap or disagree] → one owner per part (D1), a test of the table, and the aggregation takes a rejection from any blocking lens.
- [A generic security lens is noisy on a stack with little content] → the evidence rule, the per-stack sections, and the evaluation of false positives on good variants.
- [A forged receipt] → it is a safeguard against mistakes only (D14), and the commit guards remain the enforcement.
- [Raising the default cost of QA surprises people] → stated in the release notes and the configuration page, and each lens can be set to the model of today.
- [Removing `relevo:qa` breaks a repository that names it] → the migration below and a note in the changelog; `doctor` reports a workflow or a profile that still names it.
- [The renderer for Antigravity misses a name] → a test that every agent file of the plugin renders to a valid name.
- [The effort setting looks effective and is not] → D11 and the warning tier.

## Migration Plan

1. Land the gate, the receipt check, the aggregation, the profile sections and the settings with their tests. Keep `qa.md` until the lens agents and the shared procedure are in place.
2. Switch `go`, `fix` and `review` to the shared procedure and remove `qa.md`. The workflows need no new allowed tool, so an existing workflow keeps working with the new plugin version; the workflow template only changes if a task of this change needs it (for example to ignore the folder of the receipt), and then a project takes it through `/relevo:init` and raises `RELEVO_VERSION`.
3. Land the documentation in both languages, with the release notes about the cost.
4. Run the evaluation and record it before the version that changes any default.
5. Roll back by restoring the previous plugin version and workflow: no label or stored data changes shape, and the new keys of `relevo.yml` and of the hand-off comment are ignored by older versions.

## Open Questions

- The thresholds of the evaluation, set after the first run.
- The exact generic and per-stack content of the security lens, written and sourced while writing the tasks.
- How many advisory notes the built message shows before it says how many more. The marker carries all of them.
