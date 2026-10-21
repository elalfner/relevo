# Design

## Context

In `templates/workflows/relevo-go.yml` the `build` job installs Node, OpenSpec and then runs the agent. The toolchain of each stack is a block of commented lines, each guarded by `needs.decide.outputs.stack`, with an instruction to uncomment those the project needs. The `decide` job already outputs `stack` and `path` for that purpose. A test (`tests/workflow-go.test.mjs`) checks that every example is guarded by its stack. The doctor reads the text of each workflow it fetches (`f.workflows[file].text`) and knows the stack of each configured platform (`f.platformFacts`).

## Goals / Non-Goals

**Goals:**
- A build for Flutter, Vue or Laravel can run the project's checks without the project editing the workflow.
- A project whose workflow lacks the step is told before it spends a run.

**Non-Goals:**
- Installing the dependencies of the project.
- A check that the toolchain exists before the run spends turns.
- Committing rejected work.

## Decisions

- **Active steps with a guard, not a switch in `relevo.yml`.** The guard `if: needs.decide.outputs.stack == 'flutter'` costs nothing when it is false, needs no new setting and keeps the file the one place that says what the build does. Alternatives: a setting listing the toolchains (a second place that can disagree with the workflow), and one generated step per project (init would have to rewrite the file, which it does not do).
- **Only the setup of the tool, not the dependencies.** `flutter pub get` runs no install-time scripts and `flutter test` runs it by itself, so Flutter needs no more. For Vue and Laravel the install command depends on the package manager and lockfile, and `--ignore-scripts` and `--no-scripts` are a security decision; they stay commented, with the reason. Vue's toolchain is Node, which the job already installs, so the template adds no Vue step beyond a comment that says so.
- **Versions.** `subosito/flutter-action@v2` with `channel: stable` and `cache: true`; `shivammathur/setup-php@v2` with PHP 8.3 and `composer`. They are the examples the template already had. The template says to change them; a changed workflow differs from the template and init leaves it alone.
- **Doctor reads active lines only.** It strips whole-line comments of the go workflow text and looks for the action of each stack (`subosito/flutter-action`, `shivammathur/setup-php`). A step that is not guarded by the stack still counts: the check is that the toolchain is installed, not how. Vue is not checked, because Node is always there. A stack with no step in the template is not judged.
- **Failure, not warning.** Without the toolchain every cloud build fails QA after spending the run, so doctor fails, as it does for a missing secret. It checks only when the go workflow is installed, so a project that builds on machines is not told about the cloud.
- **Init stays read-only on existing files.** It adds the template to a repository that has none, with the toolchain active, and for a workflow that differs it adds a sentence to the existing "differs" item.

## Risks / Trade-offs

- A project that already installs Flutter in its own way gets a second setup when it copies the new template; the guard makes the extra step a no-op only if it is removed. The project compares the files as init says.
- The runner spends about a minute of setup per cloud build on Flutter, as before for projects that had enabled it.
- The doctor looks for the name of an action, so a project that installs Flutter with a script is told it has none. The message says to enable the step or, if the project installs it another way, to ignore the message; a setting to silence it is not added until someone needs it.
