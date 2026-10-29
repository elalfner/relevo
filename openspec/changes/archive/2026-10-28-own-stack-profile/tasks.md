# Tasks

## 1. A full profile from init

- [x] 1.1 In `scripts/lib/init.mjs`, give `stackProfileTemplate` the second form for a stack the plugin does not ship (commented `analyze`, `test` and `format`, `tools`, `generated`, and a body with the hygiene and auditor headings); verify with a test in `tests/init.test.mjs` that the text for `go` parses with `parseProfile`, has no uncommented command and keeps the form for `vue` unchanged
- [x] 1.2 Add the plan item `stack-profile.<stack>` for every platform whose stack has no profile in the plugin, with the existing rule (created, not committed, listed to commit), and none when the file exists or the stack is shipped; verify with tests for the scenarios of a Go platform, a shipped stack, a declined profile and an existing file
- [x] 1.3 Update `skills/init/SKILL.md` so the question about profile files proposes the own stacks and says that `doctor` warns while the commands are missing; verify with `tests/skill-init-doctor.test.mjs`

## 2. Doctor judges a stack of your own

- [x] 2.1 In `platformChecks` of `scripts/lib/doctor.mjs`, warn when a repository-only profile has no `analyze` or no `test` after `checks`, naming them and the file; verify with tests for no commands, a command from `checks` and a profile with a plugin layer
- [x] 2.2 In `toolchainChecks`, judge a repository-only stack outside `TOOLCHAIN_ACTIONS` by an active line guarded by `needs.decide.outputs.stack == '<stack>'`, as a warning that names the line to add, skipping a stack whose tools are only `node` and `npm`; verify with tests for a missing step, a present step, a commented step, a Node-only stack and no go workflow
- [x] 2.3 Reword the comment of the toolchain block in `templates/workflows/relevo-go.yml` so it names own stacks and the warning, and keep the template test and the stamp in `tests/` passing (`npm test`)

## 3. Documentation

- [x] 3.1 Add the section "Your own stack" to `docs/stacks.md` and `docs/stacks.es.md` with the Go profile, the cloud step, committing the file and the warnings of `doctor`, and link it from layer 3 of the table; verify with the docs tests that both pages have it and with a profile of the example parsed by `parseProfile`
- [x] 3.2 Mention the new warnings in the checks list of `docs/commands.md` and `docs/commands.es.md` if they describe `doctor`; verify with `npm test`

## 4. Whole change

- [x] 4.1 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change once reviewed, and run `npm test` and `openspec validate --all` again after the archive, as the CI does.
