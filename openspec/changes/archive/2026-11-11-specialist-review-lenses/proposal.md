## Why

`qa` is one agent that carries nine different jobs: running the checks, comparing the code with every scenario, task, decision and documentation line of the issue, applying the project's rules, hunting the bugs of the stack, reviewing security, and judging references and appearance. It is one long review in one context, it re-runs the analysis and the tests that the developer agent already ran, and a failing test costs a complete QA before anyone hears about it. It uses one model and one effort for all of it, and so does the developer agent.

Three observations from a sample of ten issues of one real web project, to be confirmed on other projects: a rejection that was only a failing check cost a full QA and a retry; one issue passed QA although its own hand-off said that analysis, lint and tests had not run; and the review of appearance happened after QA, by a person, over many rounds. Nothing here shows that more reviewers find more. The change is built so that this is measured on seeded defects before any default is trusted.

## What Changes

- **QA becomes four read-only lenses**, each with its own scope, knowledge, model and effort:
  - `spec`: every scenario, task, decision and constraint of the issue, the documentation text the issue carries, the project rules, and that the change stays inside its scope and its folder.
  - `security`: the security review of the diff, with content for each stack.
  - `code`: the hygiene and the typical bugs of the stack, leftovers, and the tests that the developer wrote.
  - `interface`: the interface rules and the design references. It runs only when the stack has an interface and the change touches one.
- **A mechanical gate runs the checks once, with no model.** A script runs the analysis and the tests of the profile, the diff scanner and the restricted-file check, and writes a receipt tied to the exact diff. No lens starts without a valid receipt. A red gate goes back to the developer agent with the exact output, without any QA. The `code` lens reads the receipt and does not re-run the checks, so a `QA PASSED` can no longer exist for code whose checks did not run.
- **The lenses block by rule.** `spec`, `security` and `code` always block. `interface` blocks on every attempt except the last one, and on the last it only advises. A script reads the reports and decides: any blocking rejection rejects the run, and a report that cannot be read counts as a rejection.
- **Advisory notes reach the person.** What the `interface` lens could not settle on the last attempt, and the scenarios that only a device can show, go into the hand-off and into the checklist of `/relevo:review`, marked as pending after the retries.
- **The developer agent receives the "build it like this" face of every lens**, not only of the interface: what the issue demands, the security rules of its stack, the hygiene of the stack and the interface rules that the change touches. It also receives the exact output of a red gate.
- **Model and effort are settings per role**, for the developer agent and for each lens, with defaults. With Antigravity the settings are accepted but not applied, and `doctor` and `init` say so instead of ignoring them silently.
- **Antigravity gets the same lenses**, with the renderer adapted to their names and to how its subagents report.
- **Cost and limits count every lens.** The turn and cost limits of a run, and the token limit with Antigravity, include the subagents.
- **An evaluation on seeded defects is part of the acceptance.** A runnable, opt-in harness measures detection and false positives for each lens, with and without a given rule, on defects of the stack, of security, of the specification and of the interface.
- **The first version runs the lenses one after another.** Launching them in parallel is specified here and delivered by a follow-up change, `parallel-review-lenses`, once three spikes pass: the effect of several subagents in one turn on unattended runs, the cost and turn accounting of subagents, and how an Antigravity fan-out reports.

Out of scope: launching the lenses in parallel (the follow-up change), the model of `go` itself, a visual comparison of pixels, letting a repository weaken a lens, and changes to who may approve or merge.

## Capabilities

### New Capabilities

- `qa-lenses`: the four lenses and what each owns, their activation, their reports and the aggregation rule, the blocking rule over attempts, the advisory notes, and the evaluation requirement.
- `validation-gate`: the mechanical gate, its receipt, the rule that no lens starts without a valid receipt, and the return of a red gate to the developer agent.
- `agent-settings`: model and effort per role, their defaults and validation, how they are applied, and the warning when an agent cannot apply them.

### Modified Capabilities

- `go`: the QA step becomes the gate, then the lenses in sequence, then the aggregation; the retries count gate failures; the hand-off carries the advisory notes; the limits include the subagents.
- `fix`: it runs the same gate, lenses and aggregation on the iteration's diff.
- `review`: it re-runs them after bringing in the base branch, and the checklist includes the advisory notes.
- `issue-lifecycle`: the hand-off message may carry advisory notes and says which lens produced them.
- `configuration`: the keys of `agent-settings`, and a level of warning in validation that does not block.
- `platforms`: a profile has sections for each lens (security review, security for the developer) and the existing sections map to lenses.
- `role-skills`: skills for the roles of the lenses, with the existing `qa` role going to the `code` lens.
- `agent-adapters`: the names of the lens agents and the rendering for Antigravity.
- `init-doctor`: `doctor` and `init` warn about settings that an agent does not apply, and `doctor` checks the lens agents and the profile sections.
- `security`: the lens agents are read-only, the receipt is a safeguard against mistakes and not a security boundary, and the page on controls says so for each agent.
- `documentation`: the guide, the configuration page, the stacks page, the execution page and the security page, in English and Spanish.

## Impact

- `agents/qa.md` is replaced by `agents/qa-spec.md`, `agents/qa-security.md`, `agents/qa-code.md` and `agents/qa-interface.md`; `agents/dev.md` gains the faces it receives and the output of a red gate.
- `skills/go/SKILL.md`, `skills/fix/SKILL.md`, `skills/review/SKILL.md`, and one shared reference that describes the gate, the lenses and the aggregation for the three.
- New scripts for the gate, the receipt check and the aggregation; changes to `scripts/stack-profile.mjs` (sections by lens), `scripts/lib/config.mjs`, `scripts/validate-config.mjs`, `scripts/doctor.mjs`, `scripts/init.mjs`, `scripts/render-message.mjs`, `scripts/review-brief.mjs`, `scripts/web-review.mjs`, `scripts/review-state.mjs`, `scripts/run-usage.mjs`, `scripts/lib/adapters/antigravity.mjs` and `scripts/lib/adapters/tools.mjs`. The run guard for Antigravity already counts the turns of subagents; its token count is confirmed in a spike.
- The profiles in `stacks/` for each stack, and `templates/relevo.yml`.
- An opt-in evaluation harness and its fixtures, built on the seeded interface defects of change `interface-decisions-upfront`.
- `docs/` pages and their Spanish pages, `docs/security.md` for each agent, and tests for every script, skill and agent file above.
- No change to labels, to the lifecycle states or to who may approve or merge.
