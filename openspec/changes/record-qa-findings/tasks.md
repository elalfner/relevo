# Tasks

## 1. Record of the attempts

- [x] 1.1 Add `scripts/lib/qa-record.mjs` (append an attempt, read the log, build and parse the marker with the bounds, redaction and public mode of the design); verify with unit tests, including a finding that quotes a key and a broken line in the log
- [x] 1.2 Add `--log` to `qa-aggregate.mjs` and `validation-gate.mjs`, recording nothing on a reask and changing no exit code when the file cannot be written; verify with tests of both commands
- [x] 1.3 Make `qa-run.md`, `go` and `fix` pass one log file of the run to both scripts and to `render-message.mjs`; verify with the skill tests that the three places name the flag

## 2. Comments and the kind of a fix

- [x] 2.1 Add the marker to `built`, `build_failed` and `fix_done` in English and Spanish, with `qa_log` read by `render-message.mjs`; verify that the visible text is unchanged and that a call with no log renders as before
- [x] 2.2 Add the optional `kind` to `fix_done` with its visible line; verify with message tests for the five kinds, an unknown one and none, and that `tests/messages-language.test.mjs` passes
- [x] 2.3 Write in `skills/fix/SKILL.md` how the kind is decided, said to the person and passed; verify with a skill test that names the five kinds

## 3. Report and digest

- [x] 3.1 Add `relevo qa-report` with `--repo`, `--since` and `--list`, reading only; verify with a fake `gh` the scenarios of no records, a failed run, a stranger's marker and two markers in one comment
- [x] 3.2 Add the digest line from the same read of comments; verify with tests of a week with and without records
- [x] 3.3 Document the command and the record in `docs/commands.md` and `docs/security.md` and their Spanish pages, and add the `CHANGELOG.md` entry; verify that `tests/readme-sync.test.mjs` and `tests/docs-claims.test.mjs` pass

## 4. Integration

- [x] 4.1 Run `npm test`, `openspec validate --all` and `claude plugin validate .`; verify all pass
- [ ] 4.2 In the sandbox, from a pinned commit of `dev`, build one issue that QA rejects once and fix it once; verify that `relevo qa-report --list` shows the finding and the kind, and record the run in `docs/pilot-findings.md`
