# Tasks

## 1. The figures

- [x] 1.1 `scripts/lib/run-usage.mjs`: add `mainAgentShare(runs)` returning `{ runs, of, cost, total, turns, allTurns }` or null, over the runs that have `agents` with a `main` entry that has a cost and a cost of their own greater than 0; `sumUsage` is not changed. Verify with new cases in `tests/usage.test.mjs`: three runs with the detail (the figures add up), runs without `agents`, a main agent without a cost, a run with no cost of its own, an empty list, and that `sumUsage` still returns exactly its old shape.

## 2. The digest line

- [x] 2.1 `scripts/lib/status.mjs`: `buildStatus` puts `mainAgentShare(usage)` in the report, and the digest writes the line after the line of usage, in English and Spanish, with "more than half" only above 50 %, the runs it covers out of those of the usage line, and no line when the result is null. Verify with the status tests: the figures, the Spanish line, above and at half, partial coverage, no detail, no usage, and that nothing is posted when nothing is waiting.
- [x] 2.2 Check that no setting, limit or label is read or changed by the line: run the digest script with a state file (`--input`) that has a share above half and verify that it prints and writes nothing else. Verify with a test that runs `scripts/digest.mjs --input` on such a file.

## 3. Documentation

- [x] 3.1 `docs/execution.md` and `docs/execution.es.md`, in "What a cloud run reports": the line, where its figures come from, which runs count, how to read a share above half, the three options and that none is applied automatically, and that the runner counts only the main agent's turns against `limits.run_max_turns`. Verify with `node --test tests/docs-claims.test.mjs` and by checking that both pages use the same figures and names.

## 4. Final check

- [x] 4.1 Run `npm test` and `openspec validate main-agent-cost-share --strict`. Verify that both pass.

## Workflow follow-up

- Update the version in `.claude-plugin/plugin.json` and the entry in `CHANGELOG.md` on `dev` when the change is released.
- Archive the change after the pull request is merged.
