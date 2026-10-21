# Tasks

## 1. Collect what failed

- [ ] 1.1 `gatherStatus` records `unread` for the comparison, the workflow and the pause variable (not for a not-found that answers the question) and returns it
- [ ] 1.2 Tests: a 403 on each of the three, a 404 on the workflow and on the variable, and a run where everything is read

## 2. Show it

- [ ] 2.1 `buildStatus` carries `unread`; `renderStatus` prints "Could not read" with a sentence per read in English and Spanish, and appends "(from what could be read)" to the empty answer
- [ ] 2.2 Tests: the text in both languages, the JSON, and that a complete report is unchanged

## 3. Documentation

- [ ] 3.1 The status entry of the commands pages (English and Spanish) and the changelog under Unreleased
- [ ] 3.2 Remove the "seen and not fixed" note of the pilot findings by pointing to the change

## 4. Check

- [ ] 4.1 Run `status` from this cloud session against the sandbox, where the Actions reads are refused, and see the lines
