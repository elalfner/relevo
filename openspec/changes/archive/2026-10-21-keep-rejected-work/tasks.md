# Tasks

## 1. The failure path

- [x] 1.1 In `skills/go/SKILL.md`, before the push of the failure path, for the reasons `QA rejected after the retries` and `tasks left unfinished` run `commit-change.mjs` with the reported files and `tasks.md` and the message `wip: rejected by QA (#<issue>)`; push only if it commits; a refusal or an error pushes nothing and uses `unsafe` or `not_pushed`
- [x] 1.2 Keep the prefix in one constant (`scripts/lib/wip-commit.mjs`) with a function that tells whether a commit subject is the work-in-progress commit; test it
- [x] 1.3 Tests of the skill: the order (commit, then push), the two reasons, the refusal case, and that no other reason commits

## 2. The comment

- [x] 2.1 `scripts/lib/messages.mjs`: the branch state `kept` in English and Spanish, with the finding, that the code is not approved and the two ways forward; a test for each language and for the unknown-state error
- [x] 2.2 The next step of `qa-failed` with kept work stays `/relevo:fix <n>`; test it with `next-step.mjs`

## 3. Fix

- [x] 3.1 A script that prints the last failure comment of an issue (`gh` read, tolerant of a failed read) and a test with fake comments
- [x] 3.2 `skills/fix/SKILL.md`: when the last commit is the work-in-progress commit, take the finding of the failure comment as the defect, say what QA could not check, and run the checks; otherwise unchanged; test the skill text

## 4. Documentation

- [x] 4.1 Guide and commands pages (English and Spanish): a rejected cloud build keeps its work, what the comment says, `fix` or `think` plus `issue`, deleting the branch to start over
- [x] 4.2 Changelog entry under Unreleased

## 5. Check on a real run

- [x] 5.1 In the sandbox, make QA reject a build (for example an issue whose test cannot pass) and confirm the branch holds the work in progress, the comment says `kept`, and `/relevo:fix` corrects it
