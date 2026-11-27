# Tasks

## 1. Verify the hook where it has to work

- [x] 1.1 In the sandbox, with a throwaway hook in a pinned commit that only logs, run one cloud build and confirm that a plugin `PreToolUse` hook loaded with `--plugin-dir` fires in the action for the orchestrator and for a subagent, with `agent_id`, and that a denial reaches the subagent; record the result in `docs/pilot-findings.md`. If it does not, stop and revise the design

## 2. The deadline and long commands

- [x] 2.1 Compute the hard stop in `scripts/lib/run-budget.mjs`, with the optional job deadline of the folder; verify with unit tests of the default, a local build, the job cap, a cap earlier than the limit and unreadable state
- [x] 2.2 Cut a command of `long-run.mjs` at the hard stop, with the state `cut` and no recorded check; verify with tests that the whole process group ends, that a start after the deadline does not run, that the gate is cut, and that outside a build nothing changes

## 3. The hook

- [x] 3.1 Add `hooks/hooks.json` and `scripts/time-guard.mjs` and list `hooks` in `package.json`; verify with tests of a launch after the limit, a subagent call before and after the hard stop, an orchestrator call, a session with no build, a finished build and bad input, and that `claude plugin validate .` passes
- [x] 3.2 Measure the time the hook adds to a tool call outside a build and write it in the change; verify that it makes no decision there

## 4. The skill and the reports

- [x] 4.1 Make `go`, `qa-run.md` and `agents/dev.md` treat a refusal or a `cut` as the limit, with the finding that names what was cut; verify with the skill tests
- [x] 4.2 Add the "usage unknown" message in English and Spanish and its option in `run-usage.mjs`; verify with tests of no file, a log with no result and a log with usage, and that `tests/messages-language.test.mjs` passes
- [x] 4.3 Record the job deadline and post the usage comment in `templates/workflows/relevo-go.yml`; verify with workflow tests, including a skipped agent step and a workflow with no readable timeout

## 5. Documentation

- [x] 5.1 Describe the hard stop, the remaining overshoot, the plugin hook and the usage comment in `docs/configuration.md`, `docs/execution.md`, `docs/security.md` and their Spanish pages, and add the `CHANGELOG.md` entry; verify that `tests/readme-sync.test.mjs` and `tests/docs-claims.test.mjs` pass

## 6. Integration

- [x] 6.1 Run `npm test`, `openspec validate --all` and `claude plugin validate .`; verify all pass
- [ ] 6.2 In the sandbox, from a pinned commit of `dev`, with `run_max_minutes: 5` and a slow test, run one build whose developer passes the hard stop; verify that the run ends within the hard stop plus the time to keep the work, that the work is on the branch, that the comment names what was cut, and record the run in `docs/pilot-findings.md`
