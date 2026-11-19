# Proposal

## Why

The verification of guided replication on real runs (#167) showed that the usage comment names the model that each replica ran on but not why. The reason exists: `replica-plan.mjs model` prints it (`one name below sonnet in agents.ladder, not below the floor haiku`, `the developer is not on auto, so the repository decided its model`, `this target failed 2 times on the cheaper model, so the stronger model builds it`), but nobody keeps it, so the comment cannot say it. The scenario of #167 asks for "which model each replica used and why", and the reason is what tells a person that replicas on `sonnet` are a configuration choice and not a fault.

## What Changes

- `replica-plan.mjs model` takes an optional `--task <id>` and, with it and the progress folder of the run, records `{ task, model, failures, why }` in `replica-models.json` there, as `model-plan.mjs` does for the plan. Without `--task` or without the folder, nothing is written and the output is the same.
- `run-usage.mjs` reads that file (when it is missing or unreadable the run gets the comment it gets today) and gives each replica its reason: the one recorded by the last launch of that target.
- The usage comment adds the reason after each replica, in English and Spanish (the phrase is in the message catalog; the reason itself is quoted as the script wrote it, like the reasons of the plan), and the hidden marker carries it as `why` in each entry of `replicas`.
- The `go` skill passes `--task <task id>` in the command of step 3 of a replicated build.
- The docs of the usage comment (`docs/execution.md` and its Spanish version) say it. `CHANGELOG.md` entry under Unreleased.
- Out of scope: translating the reasons (they are quoted in English, like the notes of the plan); the other findings of #167.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `execution-modes`: the usage comment of a run with replicas says why each replica ran on its model.

## Impact

- `scripts/replica-plan.mjs`, `scripts/lib/run-usage.mjs`, `scripts/lib/messages.mjs`, `skills/go/SKILL.md`, the docs, and the tests of each (`tests/replica-plan.test.mjs`, `tests/usage.test.mjs`, `tests/messages-language.test.mjs`, `tests/skill-go.test.mjs`).
- No guard changes: the file is written outside the working tree, like `model-plan.json`; the protected paths, the credential scan, the budget guard and `limits.run_max_cost` are untouched, and no action is added or re-pinned.
- A run whose `go` skill is older than this change passes no `--task`, so it records nothing and the comment stays as it was. The digest ignores the new key of the marker.
- The version in `plugin.json` is not bumped here.
