# Design

## Context

What was checked in the code and in the pilot logs:

- `agents.dev` and `agents.qa.<lens>` have `model` and `effort`, with the defaults of `AGENT_DEFAULTS` in `scripts/lib/config.mjs` (dev sonnet/high; spec and security opus/high; code sonnet/high; interface sonnet/medium). `go` reads them with `validate-config.mjs --effective` and passes them as the `model` and `effort` parameters of the Agent tool.
- A model is a name, not a value from a list: the docs say Relevo does not check it because the list changes. So there is no order between models today, and "a floor and a ceiling" needs one.
- Fields of the issue that `go` reads as lines (`Allow-paths:`) are read by scripts, so a new line of the same kind fits.
- The hash of the issue (`issue-hash.mjs`) covers the title and the body, so a `Model:` line in the body is protected by it.
- In the sandbox build of issue 76 the lenses on `opus` cost 37 % of the run and the longest lens lasted about 4 minutes on a small change.

## Goals / Non-Goals

**Goals:**
- A role on `auto` gets a model from signals, deterministically, within a range the repository sets.
- An issue can ask for a model, within that range, and the comment says what was used and why.
- The cost of the defaults is a ceiling: `auto` does not spend more than today unless the repository allows it.

**Non-Goals:**
- Escalation on retry (a second change, with data from several runs), switching model in the middle of the developer's work, and learning from past runs.
- Choosing the effort: it stays the configured one in this stage.
- Judging with a model: the plan is a script.

## Decisions

1. **A script decides, not the main agent.** `scripts/model-plan.mjs` prints the plan as JSON and `go` only launches with it. An agent that rates its own task tends to escalate, and a rule that is written down can be tested and tuned. Alternative: an evaluator agent on every issue (costs tokens, adds a step nobody audits).
2. **The order of the models is `agents.ladder`.** A list in `relevo.yml`, from the lowest to the highest, default `[haiku, sonnet, opus]`. Relevo reads only the order, never checks the names, so a new model needs a line of configuration and no release. Alternatives: an order written in the code (a release for each new model), or a `max:` by name with no order (no way to say one step below).
3. **The default range is the default model and one step below.** Ceiling = the default model of the role, floor = the name before it in the ladder (or the ceiling when it is the first). With that, `auto` can only save: the developer ranges `haiku`-`sonnet`, spec and security `sonnet`-`opus`, code and interface `haiku`-`sonnet`. A repository that wants more raises `ceiling`. The security lens is never below `sonnet` by default, and no setting weakens what it blocks.
4. **The score is size plus two raises.** Size = tasks plus scenarios: up to 6 small, up to 14 medium, more large. Small is the floor, medium the middle of the range (rounded up) and large the ceiling. A dependency file in `Allow-paths:` or a security-sensitive word (authentication, credential, token, password, payment, permission, secret, encryption) raises the pick one step up to the ceiling, and sends the security lens to the ceiling. The signals are available before the build, so the plan is made once, before the first launch. Alternatives: signals from the diff (known only after the developer worked) and "an existing similar change" (needs a similarity rule that is not checked yet): both are later.
5. **The issue lowers freely and raises up to the ceiling.** `Model:` for the developer and `QA-model:` for every lens, only for a role on `auto`. A value above the ceiling is clamped, a value below the floor is used, a name the ladder does not have is ignored with the reason, and `trust: public` ignores the lines. Otherwise one line in an issue would bypass the cost limit.
6. **A role that is not on `auto` is untouched.** The model written wins, the issue is not read for it, and the plan says `config`.
7. **Too few signals means the defaults.** No tasks and no scenarios: the default model of the role, said in the reason. It does not change the cost of what already works.
8. **The effort is not scored in this stage.** The plan carries the configured effort of each role. Choosing it needs its own signals and its own evidence.
9. **The plan is reported.** `run-usage.mjs` reads the plan that `go` saved in the progress folder (`model-plan.json`, whole numbers and fixed words only) and adds one sentence to the comment and the key `plan` to the marker. A run without a plan gives today's comment.
10. **The plan fails open.** If the script fails, `go` launches with the configuration and says so. Errors in the plan must not stop a build.
11. **Version.** The skill and the scripts change, no workflow template does, so the version stays at 0.14.5 with a new entry in the changelog.

## Risks / Trade-offs

- [`haiku` on a task that needed more] → the range never goes below one step of the default, the issue can raise up to the ceiling, and the comment says what was used, so a wrong pick is visible. The escalation on retry is the planned answer and comes with the next change.
- [The word list for sensitive areas misses a case or matches too much] → it only raises one step within the range; it is a list in one file with tests.
- [The size thresholds are guesses] → they are constants with tests, to be tuned with the data of the plan reports.
- [`go` ignores the plan] → the same risk as any instruction of the skill; the comment reports what was passed to the Agent tool, so the difference would show.
- [Not verified in a real run here] → the CHANGELOG says so under "Known limits", as in earlier changes.
