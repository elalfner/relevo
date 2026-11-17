# Tasks

## 1. The setting

- [x] 1.1 In the config tests, test `runner.build_labels`: absent (the build runner is `runner.labels`), a list, an empty list, a single string, a non-string entry, and the build key with no `runner.labels`; run them and see them fail
- [x] 1.2 `scripts/lib/config.mjs`: the setting and one helper that returns the effective labels of the build job and of the other jobs; `scripts/validate-config.mjs --effective` prints both; verify the tests pass
- [x] 1.3 `templates/relevo.yml`: the commented `runner.build_labels` example beside `runner.labels`; `docs/configuration.md` and `docs/configuration.es.md`: the key and its default; verify `tests/docs-claims.test.mjs` passes

## 2. Init

- [x] 2.1 In `tests/init.test.mjs`, test that with `runner.build_labels` the build job of `relevo-go.yml` gets those labels and every other job of every workflow gets `runner.labels`, that without it nothing changes, that a rewrite keeps both, and that the question about the builds is asked only after the person says the runner is self-hosted; run them and see them fail
- [x] 2.2 `scripts/lib/init.mjs`: the answer, the key in `relevo.yml` and the `runs-on` per job; `skills/init/SKILL.md`: the question; verify the tests pass

## 3. Doctor

- [x] 3.1 In `tests/doctor.test.mjs`, test the comparison per job: a build job on its own labels passes with the key and fails without it, the other jobs are compared with `runner.labels`, the report gives both runners when they differ, and a `runs-on` taken from a repository variable is resolved for each job; run them and see them fail
- [x] 3.2 `scripts/lib/doctor.mjs`: the comparison per job and the report; verify the tests of 3.1 and the existing runner tests pass
- [x] 3.3 Test the advice: builds that share self-hosted runners with the light jobs, a workflow of the project on the labels of the build job (named, never changed), no advice on the runners of GitHub or when the builds are apart, and that the advice never fails the check; make it pass in `scripts/lib/doctor.mjs` and `skills/doctor/SKILL.md`

## 4. A build that waits

- [x] 4.1 In `tests/progress.test.mjs` and `tests/progress-cli.test.mjs`, test `progress.mjs waiting`: it creates one comment with the marker and the waiting marker, edits an open one instead of creating a second, never fails, and `progress.mjs started` drops the waiting marker with one edit and keeps the comment, also when the watch never writes; run them and see them fail
- [x] 4.2 `scripts/lib/progress.mjs` and `scripts/progress.mjs`: the command, the waiting marker and its text in `scripts/lib/messages.mjs`, in English and Spanish; verify the tests pass and that the minutes of the comment still count from the start of the build job
- [x] 4.3 In `tests/workflow-progress.test.mjs` and `tests/workflow-go.test.mjs`, test that the decision job runs the command after the claim and only for a `start` decision, and that the `requeue` job has a step, before it starts the queue, that returns to `queued` a `building` issue whose comment still has the waiting marker when the build job did not end in success or failure, and leaves any other issue alone, and that the build job runs `progress.mjs started` as its first step; run them and see them fail
- [x] 4.4 `templates/workflows/relevo-go.yml`: the step of the decision job, the step of the `requeue` job with its comment (no runner took the build) and the `runs-on` note of the build job; a script for the step if it does more than one command, with its test; verify the workflow tests pass
- [ ] 4.5 Read in the documentation of GitHub how long a job waits for a self-hosted runner before it is cancelled, and write the figure and its source in `docs/execution.md` and `docs/execution.es.md`; verify the page names it

## 5. Status

- [x] 5.1 In `tests/status.test.mjs`, test an issue past the alert time whose comment has the waiting marker (reported as waiting for a runner, with the hours and the two ways forward, and no restart hint), one without the marker (the alert of today), and one before the alert time (nothing, and no comment is read); run them and see them fail
- [x] 5.2 `scripts/lib/status.mjs` and its data reader: the read of the progress comment for the issues past the alert time, and the texts in both languages; `skills/status/SKILL.md`; verify the tests pass

## 6. The documentation

- [x] 6.1 `docs/execution.md` and `docs/execution.es.md`, the page on self-hosted runners: which jobs run where, the limit of a machine shared by several repositories, how to label runners for builds, the light jobs on the runners of GitHub, the checks of the project, the shared memory and processors, and the Antigravity build runner; verify `tests/docs-claims.test.mjs` passes
- [x] 6.2 `CHANGELOG.md`: an entry under Unreleased, Added; verify it says that nothing changes without the key

## 7. Integration

- [x] 7.1 Run the whole suite (`node --test`) and `openspec validate --all`; verify both pass
- [ ] 7.2 On a self-hosted machine with one runner labelled for builds and others for the rest: request two builds at once and verify that one runs and the other shows that it waits for a runner in its progress comment, that a review event is handled while the build runs, and that `doctor` passes with both runners reported
- [ ] 7.3 Cancel a build job while it waits for a runner and verify that the issue returns to `queued` with the comment, and is not `build-failed`; record 7.2 and 7.3 in `docs/pilot-findings.md`
