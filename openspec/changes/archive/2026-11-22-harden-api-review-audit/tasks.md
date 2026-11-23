# Tasks

## 1. Per-service compose log

- [x] 1.1 In `scripts/lib/api-log.mjs`, give `defaultRun` a `maxBuffer` of 256 MiB and read a `compose:` log one service at a time (listing services with `docker compose config --services` when none is named), collecting failures per service. Verify: a unit test with a fake `run` where one of three services fails returns the other two in `text` and one `unreadable` entry named for the failing service.
- [x] 1.2 Translate an `ENOBUFS` failure into a reason that names the service, says the log exceeds the read, and says what `reset-log` does and costs. Verify: a unit test with a fake `run` returning `ENOBUFS` checks the reason text and that the audit verdict is `REVIEW INCONCLUSIVE`.

## 2. Windows and runs

- [x] 2.1 Record `runsBefore` in the snapshot taken by `reset-log` and pass it to `auditApi` in `scripts/review-state.mjs`; return `REVIEW INCONCLUSIVE` when runs exist but none since the reset. Verify: unit tests for the scenarios "Empty window after a reset", "Run after the reset" and "Failing run before the reset".
- [x] 2.2 Show in `reset-log` output that the runs so far no longer prove the new window. Verify: a CLI test of `reset-log` after a recorded run checks the message.

## 3. State owner

- [x] 3.1 Store `change` and `kind` in `newState`, make `init` refuse to overwrite another change's or kind's state, and add `owner <change-dir>` in `scripts/review-state.mjs`. Verify: tests for the four scenarios of "The state of a review belongs to one change", including a state with no `change`.

## 4. Preflight of the checkout

- [x] 4.1 Extend `needsPreflight` and `scripts/api-preflight.mjs` with the `node_modules` and `.env` path checks, a `warnings` list and the non-stop exit code, reading no file content. Verify: unit tests for "Checkout without dependencies", "Checkout without environment file", "No example file" and "Everything present", and a check that no read of `.env` happens.
- [x] 4.2 Add the Compose working-directory comparison (realpath, branch when known) to the preflight and to `init` for a `compose:` log, with the "could not tell" fallback. Verify: unit tests with a fake `docker` for "Instance from another worktree", "Same folder" and "Not running".

## 5. Skill and documentation

- [x] 5.1 Update `skills/review/SKILL.md`: run `owner` before resuming, name the preflight `warnings` (exit 5, with `--compose`) and ask before any test. Verify: the existing tests that read the skill still pass and the text names `owner` and the new exit code.
- [x] 5.2 Update `docs/stacks.md` and `docs/stacks.es.md` (the section on declaring a review adapter) for the per-service read, the checkout checks, the Compose directory warning, the window rule and `owner`, and add a line to `CHANGELOG.md` under the next version. Verify: `npm test` passes, including the checks that compare the English and Spanish documents.
- [x] 5.3 Run `npm test` and `openspec validate --all`. Verify: both exit 0.
