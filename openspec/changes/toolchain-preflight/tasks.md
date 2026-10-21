# Tasks

## 1. The check

- [x] 1.1 `scripts/lib/toolchain-check.mjs`: from a resolved profile and a probe, the list of missing tools; nothing for an empty list
- [x] 1.2 `scripts/toolchain-check.mjs --platform <name> [--plugin-root <dir>] [--config relevo.yml]`: resolves the profile, probes each tool, prints the missing ones as JSON, exits 1 when any is missing
- [x] 1.3 Tests: a present tool, a missing one, several, an empty list, an unresolvable platform, and the script with fake tools on the path

## 2. The message

- [x] 2.1 `scripts/lib/messages.mjs`: the kind `toolchain_missing` in English and Spanish; `scripts/lib/next-step.mjs`: its reason with a hint and no command; tests for both languages and the docs-claims on next steps

## 3. The workflow

- [x] 3.1 `templates/workflows/relevo-go.yml`: a step before the agent that unpacks the package to `$RUNNER_TEMP`, runs the check, and on failure moves the issue to `qa-failed`, posts the comment and fails the job
- [x] 3.2 Tests of the template: the step comes after the toolchain steps and before the agent, unpacks outside the workspace, never writes `.relevo-plugin`, names the guard of the script it runs and posts only on its own failure

## 4. Documentation

- [x] 4.1 The execution and guide pages (English and Spanish) and the changelog under Unreleased

## 5. Check on a real run

- [ ] 5.1 In the sandbox, on the experiment branch with the Flutter step commented out, start a build and see it stop in seconds with the comment and no model turns
