# Proposal

## Why

The first cloud build of the sandbox failed QA with "Flutter SDK is not installed", after a paid run, because the build job of the `relevo-go.yml` template does not install any toolchain: the setup of each stack is a commented example that the project has to uncomment. Nothing tells a newcomer: not the Get started page, not `/relevo:init`, not `/relevo:doctor`. It also made an upgrade lose the one line a project had added by hand (`docs/pilot-findings.md`, sandbox #37). A project that follows the documentation should get a build that can run its own checks.

## What Changes

- The build job of the template ships the setup of the toolchains of Flutter, Vue and Laravel active, each guarded by `if: needs.decide.outputs.stack == '<stack>'`, so only the step for the platform of the issue runs and the others cost nothing. The decision job already outputs `stack` and `path`.
- Installing the dependencies of the project (`npm ci --ignore-scripts`, `composer install --no-scripts`) stays a commented example: the package manager and the lockfile vary, and the choice of running no install-time scripts is the project's. The template says so next to it.
- `/relevo:doctor` fails when the go workflow of the repository has no active toolchain step for the stack of a configured platform (Flutter and Laravel; Vue needs only Node, which every build job already installs). It reads the workflow text it already fetches and does nothing when the go workflow is not installed, as in the local mode.
- `/relevo:init` says in the plan, for a go workflow that exists and differs from the template, that its build job must install the toolchain of the stacks of the project.
- The Get started page, the install page and the execution page say that the build installs the toolchain of the stack and that a project may change the versions; English and Spanish.
- Tests of the template, of the doctor and of the documentation are updated.
- Out of scope: committing the work of a rejected build, and a check that the toolchain exists before the run spends turns. Both are separate changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `execution-modes`: the go workflow template installs the toolchain of the stack of the issue.
- `init-doctor`: doctor checks that the build installs the toolchain; init mentions it in the plan.

## Impact

- `templates/workflows/relevo-go.yml`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, the tests `workflow-go`, `workflow-package`, `security`, `doctor`, `init` and `docs-claims`, and the pages `get-started`, `install`, `execution` in both languages.
- Existing projects keep their workflows: `init` still leaves a workflow that differs as it is, and `doctor` tells them what is missing.
- The template pins no new action version beyond the major tags the examples already used (`subosito/flutter-action@v2`, `shivammathur/setup-php@v2`).
