# Tasks

## 1. The template

- [x] 1.1 In `templates/workflows/relevo-go.yml`, activate the Flutter and Laravel steps (each `if: needs.decide.outputs.stack == '<stack>'`), keep Vue as a comment that says Node is already installed, and keep the dependency installs commented with the reason
- [x] 1.2 Update the tests of the template: every toolchain step is active and guarded by its stack, the dependency installs stay comments, the steps come before the agent step

## 2. Doctor and init

- [x] 2.1 Doctor: for each platform of the stacks Flutter and Laravel, fail when the go workflow has no active step with the action of that stack; nothing when the go workflow is not installed; comments do not count; the message names the platform and the step
- [x] 2.2 Doctor tests for the three scenarios, with the old workflow of the sandbox as a fixture
- [x] 2.3 Init: the item of a go workflow that differs mentions the toolchain step; test it

## 3. Documentation

- [x] 3.1 Get started, install and execution pages (English and Spanish): the build installs the toolchain of the stack, versions can be changed, dependencies are the project's
- [x] 3.2 Docs claims: the pages name the two actions the template uses
- [x] 3.3 Changelog entry under Unreleased

## 4. Check on a real run

- [x] 4.1 Copy the new template into the sandbox, promote it, label a test issue and confirm QA ran `flutter analyze` and `flutter test`
